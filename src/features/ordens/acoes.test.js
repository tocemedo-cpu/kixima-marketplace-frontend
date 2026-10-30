import { describe, expect, it } from 'vitest';
import { acoesDisponiveis } from './acoes';

const COMPRADORA = 'emp-compradora';
const FORNECEDORA = 'emp-fornecedora';
const ordem = (extra) => ({ status: 'AGUARDANDO_APROVACAO', buyerCompanyId: COMPRADORA, supplierCompanyId: FORNECEDORA, isCallOff: false, dispatchedAt: null, divergenceResolution: null, invoice: null, ...extra });
const eu = (role, companyId) => ({ role, companyId });

describe('ações oferecidas por papel e estado', () => {
  it('só o Administrador da empresa compradora aprova ou rejeita', () => {
    expect(acoesDisponiveis(eu('COMPANY_ADMIN', COMPRADORA), ordem())).toEqual(['aprovar', 'rejeitar']);
    for (const role of ['COMPRADOR', 'FORNECEDOR', 'FINANCEIRO', 'ADMIN_SISTEMA']) expect(acoesDisponiveis(eu(role, COMPRADORA), ordem())).toEqual([]);
    expect(acoesDisponiveis(eu('COMPANY_ADMIN', FORNECEDORA), ordem())).toEqual([]);
  });

  it('a fornecedora aceita ou recusa uma ordem aprovada; a compradora não', () => {
    const o = ordem({ status: 'APROVADA' });
    expect(acoesDisponiveis(eu('FORNECEDOR', FORNECEDORA), o)).toEqual(['aceitar', 'recusar']);
    expect(acoesDisponiveis(eu('COMPANY_ADMIN', FORNECEDORA), o)).toEqual(['aceitar', 'recusar']);
    expect(acoesDisponiveis(eu('COMPRADOR', COMPRADORA), o)).toEqual([]);
    expect(acoesDisponiveis(eu('FORNECEDOR', 'outra-empresa'), o)).toEqual([]);
  });

  it('despachar depois de paga; entregar só depois de despachada', () => {
    expect(acoesDisponiveis(eu('FORNECEDOR', FORNECEDORA), ordem({ status: 'PAGA' }))).toEqual(['despachar']);
    expect(acoesDisponiveis(eu('FORNECEDOR', FORNECEDORA), ordem({ status: 'EM_EXECUCAO', dispatchedAt: '2026-10-24T10:00:00Z' }))).toEqual(['entregue']);
    // contrato-quadro: entra em execução sem pagamento prévio e ainda tem de ser despachada
    expect(acoesDisponiveis(eu('FORNECEDOR', FORNECEDORA), ordem({ status: 'EM_EXECUCAO', isCallOff: true }))).toEqual(['despachar']);
  });

  it('a receção e a resolução da divergência são do Comprador (não do Administrador)', () => {
    expect(acoesDisponiveis(eu('COMPRADOR', COMPRADORA), ordem({ status: 'ENTREGUE' }))).toEqual(['receber']);
    expect(acoesDisponiveis(eu('COMPANY_ADMIN', COMPRADORA), ordem({ status: 'ENTREGUE' }))).toEqual([]);
    expect(acoesDisponiveis(eu('COMPRADOR', COMPRADORA), ordem({ status: 'RECEBIDA_COM_DIVERGENCIA' }))).toEqual(['resolver']);
    expect(acoesDisponiveis(eu('COMPRADOR', COMPRADORA), ordem({ status: 'RECEBIDA_COM_DIVERGENCIA', divergenceResolution: 'ACEITE' }))).toEqual([]);
  });

  it('o pagamento é do Financeiro da compradora; a confirmação do valor é da fornecedora', () => {
    const fatura = { status: 'PENDENTE', payment: null };
    expect(acoesDisponiveis(eu('FINANCEIRO', COMPRADORA), ordem({ status: 'AGUARDANDO_PAGAMENTO', invoice: fatura }))).toEqual(['pagar']);
    expect(acoesDisponiveis(eu('COMPANY_ADMIN', COMPRADORA), ordem({ status: 'AGUARDANDO_PAGAMENTO', invoice: fatura }))).toEqual([]);
    const paga = ordem({ status: 'PAGA', invoice: { status: 'PAGA', payment: { id: 'p1', receivedAt: null } } });
    expect(acoesDisponiveis(eu('FORNECEDOR', FORNECEDORA), paga)).toEqual(['despachar', 'confirmar']);
    expect(acoesDisponiveis(eu('COMPRADOR', COMPRADORA), paga)).toEqual([]);
  });

  it('estados terminais não oferecem nada', () => {
    for (const status of ['REJEITADA', 'RECUSADA_FORNECEDOR', 'CONCLUIDA', 'RECEBIDA_CONFORME']) {
      for (const role of ['COMPRADOR', 'COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO']) {
        expect(acoesDisponiveis(eu(role, COMPRADORA), ordem({ status }))).toEqual([]);
        expect(acoesDisponiveis(eu(role, FORNECEDORA), ordem({ status }))).toEqual([]);
      }
    }
  });

  it('sem sessão ou sem ordem não oferece nada', () => {
    expect(acoesDisponiveis(null, ordem())).toEqual([]);
    expect(acoesDisponiveis(eu('COMPANY_ADMIN', COMPRADORA), null)).toEqual([]);
  });
});
