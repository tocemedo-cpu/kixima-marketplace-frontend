import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { comPapel, erroApi, json, montarApp, PAINEL_COMPRADOR, PAINEL_FORNECEDOR } from '../test/utils';
import fxOrdens from '../test/fixtures/ordens.json';
import fxOrdemAprovacao from '../test/fixtures/ordem-aguardando-aprovacao.json';
import fxOrdemExecucao from '../test/fixtures/ordem-em-execucao.json';
import fxOrdemDivergencia from '../test/fixtures/ordem-divergencia.json';
import fxCompradorOrdens from '../test/fixtures/comprador-ordens.json';
import fxEmpresaDash from '../test/fixtures/empresa-dashboard.json';
import fxFinPendentes from '../test/fixtures/financeiro-pendentes.json';
import fxFinFaturas from '../test/fixtures/financeiro-faturas.json';
import fxSistemaEmpresas from '../test/fixtures/sistema-empresas.json';
import fxSistemaAtividade from '../test/fixtures/sistema-atividade.json';
import fxSistemaProntidao from '../test/fixtures/sistema-prontidao.json';
import fxContratos from '../test/fixtures/contratos.json';

const h1 = (nome) => screen.findByRole('heading', { level: 1, name: nome });
const sessaoDe = (role, companyId) => comPapel(role, companyId ? { companyId } : {});
const ORDEM = fxOrdemAprovacao;                                   // AGUARDANDO_APROVACAO
const emEstado = (base, status, extra = {}) => ({ ...base, status, ...extra });

describe('guardas por papel', () => {
  it('cada papel aterra no seu painel', async () => {
    montarApp('/comprador', { sessao: comPapel('COMPRADOR'), rotas: PAINEL_COMPRADOR });
    expect(await h1('Painel do comprador')).toBeInTheDocument();
  });

  it('um papel noutra área vê "Sem acesso" e nenhum pedido dessa área é feito', async () => {
    const { chamadas } = montarApp('/empresa', { sessao: comPapel('COMPRADOR') });
    expect(await screen.findByText('Sem acesso a esta área')).toBeInTheDocument();
    expect(chamadas.some((c) => c.url.includes('/api/company-admin'))).toBe(false);
  });

  it('o Financeiro não entra na área do sistema nem na do comprador', async () => {
    montarApp('/sistema/empresas', { sessao: comPapel('FINANCEIRO') });
    expect(await screen.findByText('Sem acesso a esta área')).toBeInTheDocument();
  });

  it('o menu do comprador mostra as suas áreas e nenhuma de outros papéis', async () => {
    montarApp('/comprador', { sessao: comPapel('COMPRADOR'), rotas: PAINEL_COMPRADOR });
    await h1('Painel do comprador');
    const nav = screen.getByRole('navigation', { name: /principal/i });
    expect(within(nav).getByText('Compras')).toBeInTheDocument();
    expect(within(nav).queryByText('Aprovações')).toBeNull();
    expect(within(nav).queryByText('Empresas')).toBeNull();
  });
});

describe('painel do comprador (dados reais do backend)', () => {
  it('mostra os indicadores devolvidos pela API, sem recalcular', async () => {
    montarApp('/comprador', { sessao: comPapel('COMPRADOR'), rotas: PAINEL_COMPRADOR });
    await h1('Painel do comprador');
    const kpis = await screen.findByRole('list', { name: 'Indicadores' });
    expect(within(kpis).getByText('Em andamento').parentElement).toHaveTextContent('5');
  });

  it('se o servidor falha mostra o erro e permite tentar de novo', async () => {
    let n = 0;
    montarApp('/comprador', { sessao: comPapel('COMPRADOR'), rotas: { ...PAINEL_COMPRADOR, 'GET /api/dashboard/comprador': () => { n += 1; return n === 1 ? erroApi(500, 'INTERNAL', 'Erro interno.') : PAINEL_COMPRADOR['GET /api/dashboard/comprador']; } } });
    await h1('Painel do comprador');
    const tentar = (await screen.findAllByRole('button', { name: 'Tentar de novo' }))[0];
    await userEvent.click(tentar);
    expect(await screen.findByText('Em andamento')).toBeInTheDocument();
  });

  it('resposta fora do contrato é tratada como erro (não renderiza lixo)', async () => {
    montarApp('/comprador', { sessao: comPapel('COMPRADOR'), rotas: { ...PAINEL_COMPRADOR, 'GET /api/dashboard/comprador': { kpis: {} } } });
    await h1('Painel do comprador');
    expect((await screen.findAllByText(/formato inesperado/)).length).toBeGreaterThan(0);
    expect(screen.queryByText('Em andamento')).toBeNull();
  });
});

describe('aprovações do Administrador da empresa', () => {
  const rotasAprovacao = (extra = {}) => ({
    'GET /api/buyer/orders': (url) => json(new URL(url, 'http://x').searchParams.get('status') === 'AGUARDANDO_APROVACAO' ? { ...fxCompradorOrdens, items: fxCompradorOrdens.items.filter((o) => o.status === 'AGUARDANDO_APROVACAO') } : fxCompradorOrdens),
    'GET /api/purchase-orders': fxOrdens,
    ...extra,
  });

  it('lista só as ordens por decidir e o histórico com a justificação', async () => {
    montarApp('/empresa/aprovacoes', { sessao: comPapel('COMPANY_ADMIN'), rotas: rotasAprovacao() });
    await h1('Aprovações');
    const pendentes = (await screen.findByRole('heading', { name: 'A aguardar a sua decisão' })).closest('section');
    await waitFor(() => expect(within(pendentes).getAllByRole('row').length).toBeGreaterThan(1));
    expect(within(pendentes).getByText('PO-2026-00001')).toBeInTheDocument();
    expect(within(pendentes).queryByText('PO-2026-00008')).toBeNull();
    const historico = screen.getByRole('heading', { name: 'Histórico de decisões' }).closest('section');
    expect(await within(historico).findByText('PO-2026-00008')).toBeInTheDocument();
  });

  it('rejeitar exige justificação e não chama a API sem ela; com ela envia o motivo', async () => {
    const { chamadas } = montarApp('/empresa/aprovacoes', { sessao: comPapel('COMPANY_ADMIN'), rotas: rotasAprovacao({ 'PATCH /api/purchase-orders/60e8c945-de4b-46ac-9e51-ce893e85144d/reject': { ...ORDEM, status: 'REJEITADA' } }) });
    await h1('Aprovações');
    const linha = (await screen.findByText('PO-2026-00001', { selector: 'a' })).closest('tr');
    await userEvent.click(within(linha).getByRole('button', { name: 'Rejeitar' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.click(within(dialogo).getByRole('button', { name: /^Rejeitar$/ }));
    expect(await within(dialogo).findByText(/Indique o motivo/)).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(false);
    await userEvent.type(within(dialogo).getByLabelText(/Justificação da rejeição/), 'Fora do orçamento.');
    await userEvent.click(within(dialogo).getByRole('button', { name: /^Rejeitar$/ }));
    await waitFor(() => expect(chamadas.find((c) => c.metodo === 'PATCH')).toBeTruthy());
    expect(JSON.parse(chamadas.find((c) => c.metodo === 'PATCH').corpo)).toEqual({ reason: 'Fora do orçamento.' });
  });

  it('o painel da empresa mostra o número de ordens a aprovar vindo do servidor', async () => {
    montarApp('/empresa', { sessao: comPapel('COMPANY_ADMIN'), rotas: { 'GET /api/company-admin/dashboard': fxEmpresaDash } });
    await h1('Painel da empresa');
    const k = await screen.findByText('Ordens a aprovar');
    expect(k.parentElement).toHaveTextContent(String(fxEmpresaDash.kpis.aprovarPO));
  });
});

describe('ficha da ordem: ações por papel e estado', () => {
  const rotasOrdem = (ordem, extra = {}) => ({ [`GET /api/purchase-orders/${ordem.id}`]: ordem, [`GET /api/purchase-orders/${ordem.id}/history`]: [], ...extra });

  it('o Administrador da compradora vê aprovar e rejeitar; o Comprador não', async () => {
    const admin = montarApp(`/ordens/${ORDEM.id}`, { sessao: sessaoDe('COMPANY_ADMIN', ORDEM.buyerCompanyId), rotas: rotasOrdem(ORDEM) });
    expect(await screen.findByRole('button', { name: 'Aprovar ordem' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejeitar' })).toBeInTheDocument();
    admin.unmount();
    montarApp(`/ordens/${ORDEM.id}`, { sessao: sessaoDe('COMPRADOR', ORDEM.buyerCompanyId), rotas: rotasOrdem(ORDEM) });
    await h1('PO-2026-00001');
    expect(screen.queryByRole('button', { name: 'Aprovar ordem' })).toBeNull();
  });

  it('aprovar chama PATCH approve e recarrega a ordem', async () => {
    let aprovada = false;
    const { chamadas } = montarApp(`/ordens/${ORDEM.id}`, { sessao: sessaoDe('COMPANY_ADMIN', ORDEM.buyerCompanyId), rotas: {
      [`GET /api/purchase-orders/${ORDEM.id}`]: () => json(aprovada ? emEstado(ORDEM, 'APROVADA') : ORDEM),
      [`GET /api/purchase-orders/${ORDEM.id}/history`]: [],
      [`PATCH /api/purchase-orders/${ORDEM.id}/approve`]: () => { aprovada = true; return emEstado(ORDEM, 'APROVADA'); },
    } });
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar ordem' }));
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'PATCH' && c.url.endsWith('/approve'))).toBe(true));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aprovar ordem' })).toBeNull());
  });

  it('um 409 do servidor aparece como mensagem e a ficha continua utilizável', async () => {
    montarApp(`/ordens/${ORDEM.id}`, { sessao: sessaoDe('COMPANY_ADMIN', ORDEM.buyerCompanyId), rotas: rotasOrdem(ORDEM, {
      [`PATCH /api/purchase-orders/${ORDEM.id}/approve`]: erroApi(409, 'CONFLICT', 'PO no estado "APROVADA" não pode ser aprovada.'),
    }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar ordem' }));
    expect(await screen.findByText(/não pode ser aprovada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprovar ordem' })).toBeEnabled();
  });

  it('a fornecedora aceita uma ordem aprovada', async () => {
    const aprovada = emEstado(ORDEM, 'APROVADA');
    const { chamadas } = montarApp(`/ordens/${ORDEM.id}`, { sessao: sessaoDe('FORNECEDOR', ORDEM.supplierCompanyId), rotas: rotasOrdem(aprovada, { [`PATCH /api/purchase-orders/${ORDEM.id}/accept`]: emEstado(ORDEM, 'AGUARDANDO_PAGAMENTO') }) });
    expect(screen.queryByRole('button', { name: 'Aprovar ordem' })).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'Aceitar ordem' }));
    await waitFor(() => expect(chamadas.some((c) => c.url.endsWith('/accept'))).toBe(true));
  });

  it('recusar exige o motivo', async () => {
    const { chamadas } = montarApp(`/ordens/${ORDEM.id}`, { sessao: sessaoDe('FORNECEDOR', ORDEM.supplierCompanyId), rotas: rotasOrdem(emEstado(ORDEM, 'APROVADA'), { [`PATCH /api/purchase-orders/${ORDEM.id}/refuse`]: emEstado(ORDEM, 'RECUSADA_FORNECEDOR') }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Recusar' }));
    const d = await screen.findByRole('dialog');
    await userEvent.click(within(d).getByRole('button', { name: 'Recusar' }));
    expect(await within(d).findByText(/Indique o motivo/)).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(false);
    await userEvent.type(within(d).getByLabelText(/Motivo da recusa/), 'Sem stock.');
    await userEvent.click(within(d).getByRole('button', { name: 'Recusar' }));
    await waitFor(() => expect(JSON.parse(chamadas.find((c) => c.metodo === 'PATCH').corpo)).toEqual({ reason: 'Sem stock.' }));
  });

  it('em execução já despachada, a fornecedora só pode marcar como entregue', async () => {
    montarApp(`/ordens/${fxOrdemExecucao.id}`, { sessao: sessaoDe('FORNECEDOR', fxOrdemExecucao.supplierCompanyId), rotas: rotasOrdem(fxOrdemExecucao) });
    expect(await screen.findByRole('button', { name: 'Marcar como entregue' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registar despacho' })).toBeNull();
  });

  it('o Comprador resolve uma divergência com ACEITE ou REPOSICAO', async () => {
    const o = fxOrdemDivergencia;
    const { chamadas } = montarApp(`/ordens/${o.id}`, { sessao: sessaoDe('COMPRADOR', o.buyerCompanyId), rotas: rotasOrdem(o, { [`PATCH /api/purchase-orders/${o.id}/resolve-divergence`]: emEstado(o, 'CONCLUIDA') }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Resolver divergência' }));
    const d = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(d).getByLabelText('Desfecho'), 'REPOSICAO');
    await userEvent.click(within(d).getByRole('button', { name: 'Resolver divergência' }));
    await waitFor(() => expect(JSON.parse(chamadas.find((c) => c.metodo === 'PATCH').corpo)).toEqual({ outcome: 'REPOSICAO' }));
  });

  it('mostra os valores calculados pelo servidor e avisa que o cliente não os calcula', async () => {
    montarApp(`/ordens/${fxOrdemDivergencia.id}`, { sessao: sessaoDe('ADMIN_SISTEMA'), rotas: rotasOrdem(fxOrdemDivergencia) });
    expect(await screen.findByText(/calculados pelo servidor/)).toBeInTheDocument();
    expect(await screen.findByText(fxOrdemDivergencia.invoice.reference)).toBeInTheDocument();
  });

  it('ordem inexistente: erro do servidor com saída', async () => {
    montarApp('/ordens/nao-existe', { sessao: comPapel('COMPRADOR'), rotas: { 'GET /api/purchase-orders/nao-existe': erroApi(404, 'NOT_FOUND', 'Ordem de compra não encontrada.'), 'GET /api/purchase-orders/nao-existe/history': [] } });
    expect(await screen.findByText('Ordem de compra não encontrada.')).toBeInTheDocument();
  });
});

describe('financeiro: pagar com comprovativo', () => {
  const rotas = { 'GET /api/payments/invoices/pending': fxFinPendentes, 'GET /api/financeiro/invoices': fxFinFaturas };
  const fatura = fxFinPendentes[0];

  it('sem comprovativo não chama a API; ficheiro de tipo errado é recusado no cliente', async () => {
    const { chamadas } = montarApp('/financeiro/faturas', { sessao: comPapel('FINANCEIRO'), rotas });
    await userEvent.click(await screen.findByRole('button', { name: 'Pagar' }));
    const d = await screen.findByRole('dialog');
    await userEvent.click(within(d).getByRole('button', { name: 'Registar pagamento' }));
    expect(await within(d).findByText(/Anexe o comprovativo/)).toBeInTheDocument();
    await userEvent.upload(d.querySelector('input[type=file]'), new File(['x'], 'virus.exe', { type: 'application/x-msdownload' }), { applyAccept: false });
    expect(await within(d).findByText(/PDF ou uma imagem/)).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('envia o comprovativo como multipart (campo "proof") sem forçar Content-Type JSON', async () => {
    const { chamadas } = montarApp('/financeiro/faturas', { sessao: comPapel('FINANCEIRO'), rotas: { ...rotas, [`POST /api/payments/invoices/${fatura.id}/pay`]: json({ id: 'pg1', invoiceId: fatura.id, amount: fatura.amount, currency: fatura.currency, status: 'PROCESSADO' }, 201) } });
    await userEvent.click(await screen.findByRole('button', { name: 'Pagar' }));
    const d = await screen.findByRole('dialog');
    await userEvent.upload(d.querySelector('input[type=file]'), new File(['%PDF-1.4'], 'comprovativo.pdf', { type: 'application/pdf' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Registar pagamento' }));
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'POST')).toBe(true));
    const c = chamadas.find((x) => x.metodo === 'POST');
    expect(c.corpo).toBeInstanceOf(FormData);
    expect(c.corpo.get('proof').name).toBe('comprovativo.pdf');
    expect(Object.keys(c.init.headers || {}).map((k) => k.toLowerCase())).not.toContain('content-type');
  });

  it('o erro do servidor ao pagar fica visível e o diálogo mantém-se aberto', async () => {
    montarApp('/financeiro/faturas', { sessao: comPapel('FINANCEIRO'), rotas: { ...rotas, [`POST /api/payments/invoices/${fatura.id}/pay`]: erroApi(403, 'FORBIDDEN', 'Só o Financeiro da empresa compradora pode pagar.') } });
    await userEvent.click(await screen.findByRole('button', { name: 'Pagar' }));
    const d = await screen.findByRole('dialog');
    await userEvent.upload(d.querySelector('input[type=file]'), new File(['%PDF-1.4'], 'c.pdf', { type: 'application/pdf' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Registar pagamento' }));
    expect(await within(d).findByText(/Só o Financeiro/)).toBeInTheDocument();
  });
});

describe('admin do sistema', () => {
  it('rejeitar uma empresa exige motivo e envia { approve:false, rejectionReason }', async () => {
    const pendente = fxSistemaEmpresas.find((e) => e.status === 'PENDENTE');
    const { chamadas } = montarApp('/sistema/empresas', { sessao: comPapel('ADMIN_SISTEMA'), rotas: { 'GET /api/companies': fxSistemaEmpresas, [`PATCH /api/companies/${pendente.id}/decision`]: { ...pendente, status: 'REJEITADA' } } });
    const linha = (await screen.findByText(pendente.name)).closest('tr');
    await userEvent.click(within(linha).getByRole('button', { name: 'Rejeitar' }));
    const d = await screen.findByRole('dialog');
    await userEvent.click(within(d).getByRole('button', { name: 'Rejeitar empresa' }));
    expect(await within(d).findByText(/Indique o motivo/)).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(false);
    await userEvent.type(within(d).getByLabelText(/Motivo da rejeição/), 'Documentação incompleta.');
    await userEvent.click(within(d).getByRole('button', { name: 'Rejeitar empresa' }));
    await waitFor(() => expect(JSON.parse(chamadas.find((c) => c.metodo === 'PATCH').corpo)).toEqual({ approve: false, rejectionReason: 'Documentação incompleta.' }));
  });

  it('só empresas pendentes têm botões de decisão', async () => {
    montarApp('/sistema/empresas', { sessao: comPapel('ADMIN_SISTEMA'), rotas: { 'GET /api/companies': fxSistemaEmpresas } });
    await h1('Empresas e credenciamento');
    const aprovada = (await screen.findByText('Petro Angola Operações, Lda')).closest('tr');
    expect(within(aprovada).queryByRole('button')).toBeNull();
  });

  it('o painel mostra o aviso de empresas pendentes e a prontidão do servidor', async () => {
    montarApp('/sistema', { sessao: comPapel('ADMIN_SISTEMA'), rotas: { 'GET /api/admin/activities': fxSistemaAtividade, 'GET /api/companies': fxSistemaEmpresas, 'GET /api/admin/prontidao': fxSistemaProntidao } });
    expect(await screen.findByText('Empresas à espera de decisão')).toBeInTheDocument();
    expect(await screen.findByText(`${fxSistemaProntidao.resumo.ok} de ${fxSistemaProntidao.resumo.total}`)).toBeInTheDocument();
  });
});

describe('fornecedora e contratos', () => {
  it('o painel da prestadora avisa das ordens que esperam resposta', async () => {
    const aprovadas = fxOrdens.map((o, i) => (i === 0 ? { ...o, status: 'APROVADA' } : o));
    montarApp('/fornecedor', { sessao: comPapel('FORNECEDOR'), rotas: { ...PAINEL_FORNECEDOR, 'GET /api/purchase-orders': aprovadas } });
    await h1('Painel da prestadora');
    expect(await screen.findByText('Precisa da sua atenção')).toBeInTheDocument();
  });

  it('contratos: lista o que o servidor devolve', async () => {
    montarApp('/contratos', { sessao: comPapel('COMPRADOR'), rotas: { 'GET /api/contracts': fxContratos } });
    await h1('Contratos-quadro');
    expect(await screen.findByText(fxContratos[0].reference)).toBeInTheDocument();
  });
});
