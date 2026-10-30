// Contrato: cada endpoint da Fase 5 aceita a resposta REAL do backend Java (fixtures capturadas) e rejeita lixo.
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ordens from './ordens';
import * as painel from './painel';
import * as fornecedor from './fornecedor';
import * as sistema from './sistema';

const f = (nome) => import(`../../test/fixtures/${nome}.json`).then((m) => m.default);
const servir = (corpo, status = 200) => vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } }))));
afterEach(() => vi.unstubAllGlobals());

const CASOS = [
  ['ordens.listarOrdens', () => ordens.listarOrdens(), 'ordens'],
  ['ordens.obterOrdem (aguardando aprovação)', () => ordens.obterOrdem('x'), 'ordem-aguardando-aprovacao'],
  ['ordens.obterOrdem (em execução)', () => ordens.obterOrdem('x'), 'ordem-em-execucao'],
  ['ordens.obterOrdem (divergência, com fatura e pagamento)', () => ordens.obterOrdem('x'), 'ordem-divergencia'],
  ['ordens.historicoDaOrdem', () => ordens.historicoDaOrdem('x'), 'ordem-historico'],
  ['painel.painelComprador', () => painel.painelComprador(), 'comprador-dashboard'],
  ['painel.perfilDoComprador', () => painel.perfilDoComprador(), 'comprador-perfil'],
  ['painel.ordensDoComprador', () => painel.ordensDoComprador(), 'comprador-ordens'],
  ['painel.pagamentosDoComprador', () => painel.pagamentosDoComprador(), 'comprador-pagamentos'],
  ['painel.entregasDoComprador', () => painel.entregasDoComprador(), 'comprador-entregas'],
  ['painel.rececoesDoComprador', () => painel.rececoesDoComprador(), 'comprador-rececoes'],
  ['painel.fornecedoresDoComprador', () => painel.fornecedoresDoComprador(), 'comprador-fornecedores'],
  ['painel.atividadesDoComprador', () => painel.atividadesDoComprador(), 'comprador-atividades'],
  ['painel.painelDaEmpresa', () => painel.painelDaEmpresa(), 'empresa-dashboard'],
  ['painel.organizacao', () => painel.organizacao(), 'empresa-organizacao'],
  ['painel.atividadesDaEmpresa', () => painel.atividadesDaEmpresa(), 'empresa-atividades'],
  ['painel.relatoriosDaEmpresa', () => painel.relatoriosDaEmpresa(), 'empresa-relatorios'],
  ['painel.definicoesDaEmpresa', () => painel.definicoesDaEmpresa(), 'empresa-definicoes'],
  ['painel.utilizadoresDaEmpresa', () => painel.utilizadoresDaEmpresa(), 'empresa-utilizadores'],
  ['painel.resumoFinanceiro', () => painel.resumoFinanceiro(), 'financeiro-overview'],
  ['painel.faturasFinanceiro', () => painel.faturasFinanceiro(), 'financeiro-faturas'],
  ['painel.pagamentosFinanceiro', () => painel.pagamentosFinanceiro(), 'financeiro-pagamentos'],
  ['painel.faturasPendentes', () => painel.faturasPendentes(), 'financeiro-pendentes'],
  ['painel.historicoDePagamentos', () => painel.historicoDePagamentos(), 'financeiro-historico'],
  ['painel.listarContratos', () => painel.listarContratos(), 'contratos'],
  ['fornecedor.meusProdutos', () => fornecedor.meusProdutos('x'), 'fornecedor-catalogo'],
  ['fornecedor.relatorioDoFornecedor', () => fornecedor.relatorioDoFornecedor(), 'fornecedor-relatorio'],
  ['fornecedor.movimentosDeStock', () => fornecedor.movimentosDeStock(), 'fornecedor-movimentos'],
  ['fornecedor.documentosDoFornecedor', () => fornecedor.documentosDoFornecedor(), 'fornecedor-documentos'],
  ['sistema.listarEmpresas', () => sistema.listarEmpresas(), 'sistema-empresas'],
  ['sistema.utilizadoresDaPlataforma', () => sistema.utilizadoresDaPlataforma(), 'sistema-utilizadores'],
  ['sistema.atividadeDaPlataforma', () => sistema.atividadeDaPlataforma(), 'sistema-atividade'],
  ['sistema.registoDeAuditoria', () => sistema.registoDeAuditoria(), 'sistema-auditoria'],
  ['sistema.taxasDaPlataforma', () => sistema.taxasDaPlataforma(), 'sistema-taxas'],
  ['sistema.prontidao', () => sistema.prontidao(), 'sistema-prontidao'],
];

describe('contrato com o backend Java (Fase 5)', () => {
  it.each(CASOS)('%s aceita a resposta real', async (_nome, chamar, fixture) => {
    servir(await f(fixture));
    await expect(chamar()).resolves.toBeTruthy();
  });

  it.each(CASOS)('%s rejeita uma resposta fora do contrato', async (_nome, chamar) => {
    servir({ inesperado: true });
    await expect(chamar()).rejects.toMatchObject({ code: 'RESPOSTA_INESPERADA' });
  });

  it('pagarFatura envia multipart com o campo "proof"', async () => {
    const mock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ id: 'p', invoiceId: 'i', amount: '10', currency: 'AOA', status: 'PROCESSADO' }), { status: 201, headers: { 'Content-Type': 'application/json' } })));
    vi.stubGlobal('fetch', mock);
    await painel.pagarFatura('inv 1', new File(['%PDF'], 'c.pdf', { type: 'application/pdf' }));
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe('/api/payments/invoices/inv%201/pay');
    expect(init.method).toBe('POST');
    expect(init.body.get('proof').name).toBe('c.pdf');
  });

  it('as ações de ordem usam PATCH no caminho certo e escapam o id', async () => {
    const o = await f('ordem-aguardando-aprovacao');
    for (const [fn, sufixo, corpo] of [['aprovarOrdem', 'approve'], ['rejeitarOrdem', 'reject', { reason: 'x' }], ['aceitarOrdem', 'accept'], ['recusarOrdem', 'refuse', { reason: 'x' }], ['despacharOrdem', 'dispatch'], ['marcarEntregue', 'delivered'], ['registarRecepcao', 'reception', { conforme: true }], ['resolverDivergencia', 'resolve-divergence', { outcome: 'ACEITE' }]]) {
      const mock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } })));
      vi.stubGlobal('fetch', mock);
      await ordens[fn]('a/b', corpo);
      expect(mock.mock.calls[0][0], fn).toBe(`/api/purchase-orders/a%2Fb/${sufixo}`);
      expect(mock.mock.calls[0][1].method, fn).toBe('PATCH');
    }
  });

  it('criarOrdem envia só produto e quantidade (nunca preços)', async () => {
    const criada = await f('ordem-aguardando-aprovacao');
    const mock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(criada), { status: 201, headers: { 'Content-Type': 'application/json' } })));
    vi.stubGlobal('fetch', mock);
    await ordens.criarOrdem({ supplierCompanyId: 'f1', items: [{ productId: 'p1', quantity: 2 }] });
    expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ supplierCompanyId: 'f1', items: [{ productId: 'p1', quantity: 2 }] });
  });
});
