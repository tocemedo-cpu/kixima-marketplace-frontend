// Contrato com o backend: as respostas guardadas em src/test/fixtures vêm do backend Java real (base de testes)
// e têm de passar nos validadores; uma forma inesperada tem de falhar de forma clara.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as publico from './publico';
import * as auth from './auth';
import * as mercado from './mercado';
import * as cotacoes from './cotacoes';
import fxStats from '../../test/fixtures/publico-stats.json';
import fxFeedback from '../../test/fixtures/publico-feedback.json';
import fxPlanos from '../../test/fixtures/planos.json';
import fxLogin from '../../test/fixtures/auth-login.json';
import fxMe from '../../test/fixtures/auth-me.json';
import fxPesquisa from '../../test/fixtures/mercado-pesquisa.json';
import fxFacetas from '../../test/fixtures/mercado-facetas.json';
import fxFornecedores from '../../test/fixtures/mercado-fornecedores.json';
import fxProduto from '../../test/fixtures/produto.json';
import fxAvaliacoes from '../../test/fixtures/produto-avaliacoes.json';

const resp = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('públicos', () => {
  it('estatísticas, avaliações e planos reais passam nos validadores', async () => {
    fetchMock.mockResolvedValueOnce(resp(fxStats)).mockResolvedValueOnce(resp(fxFeedback)).mockResolvedValueOnce(resp(fxPlanos));
    expect(await publico.estatisticas()).toEqual(fxStats);
    expect((await publico.avaliacoes()).total).toBe(fxFeedback.total);
    const p = await publico.planos();
    expect(p.planos.map((x) => x.plano)).toEqual(['BASE', 'CORE', 'PRO']);
    expect(p.taxaPorTransacao).toEqual(fxPlanos.taxaPorTransacao);
  });
});

describe('autenticação', () => {
  it('login normal devolve o utilizador e IGNORA o token do corpo (a sessão é o cookie)', async () => {
    fetchMock.mockResolvedValue(resp({ ...fxLogin, token: 'jwt-que-nao-deve-ser-guardado' }));
    const r = await auth.entrar('comprador@petroangola.co.ao', 'x');
    expect(r.user.role).toBe('COMPRADOR');
    expect(JSON.stringify(r)).not.toContain('jwt-que-nao-deve-ser-guardado');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'comprador@petroangola.co.ao', password: 'x' });
  });

  it('login com 2FA devolve o desafio, sem utilizador', async () => {
    fetchMock.mockResolvedValue(resp({ requires2fa: true, challenge: 'abc', metodo: 'EMAIL', enviadoPara: 'a****@x.co' }));
    expect(await auth.entrar('a@x.co', 'p')).toEqual({ requires2fa: true, challenge: 'abc', metodo: 'EMAIL', enviadoPara: 'a****@x.co' });
  });

  it('/me real passa e junta os campos de MFA', async () => {
    fetchMock.mockResolvedValue(resp(fxMe));
    const u = await auth.eu();
    expect(u).toMatchObject({ role: 'COMPRADOR', name: fxMe.user.name, mfaPendente: false });
  });

  it('um login sem user nem requires2fa é uma resposta inesperada', async () => {
    fetchMock.mockResolvedValue(resp({ ola: 'mundo' }));
    await expect(auth.entrar('a@x.co', 'p')).rejects.toMatchObject({ code: 'RESPOSTA_INESPERADA' });
  });

  it('o convite usa o token codificado no caminho', async () => {
    fetchMock.mockResolvedValue(resp({ role: 'COMPRADOR', email: 'a@x.co', name: 'Ana' }));
    await auth.consultarConvite('a/b c');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/companies/invite/a%2Fb%20c');
  });
});

describe('marketplace', () => {
  it('pesquisa, facetas, fornecedores, produto e avaliações reais passam nos validadores', async () => {
    fetchMock.mockResolvedValueOnce(resp(fxPesquisa)).mockResolvedValueOnce(resp(fxFacetas)).mockResolvedValueOnce(resp(fxFornecedores)).mockResolvedValueOnce(resp(fxProduto)).mockResolvedValueOnce(resp(fxAvaliacoes));
    const r = await mercado.pesquisar({ q: 'inspeção', page: 1, limit: 4 });
    expect(r.items).toHaveLength(fxPesquisa.items.length);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/public/catalog/search?q=inspe%C3%A7%C3%A3o&page=1&limit=4');
    expect((await mercado.facetas()).categories.length).toBeGreaterThan(0);
    expect(await mercado.fornecedoresVerificados()).toHaveLength(fxFornecedores.length);
    expect((await mercado.produtoPorSlug(fxProduto.slug)).id).toBe(fxProduto.id);
    expect(await mercado.avaliacoesDoProduto(fxProduto.id)).toEqual(fxAvaliacoes);
  });

  it('um preço que não é numérico torna a resposta inesperada (e diz onde)', async () => {
    const estragado = { ...fxPesquisa, items: [{ ...fxPesquisa.items[0], unitPrice: { valor: 1 } }] };
    fetchMock.mockResolvedValue(resp(estragado));
    await expect(mercado.pesquisar({})).rejects.toMatchObject({ code: 'RESPOSTA_INESPERADA', message: expect.stringContaining('items[0].unitPrice') });
  });

  it('401 da pesquisa (sem sessão) chega como ApiError 401', async () => {
    fetchMock.mockResolvedValue(resp({ error: { code: 'UNAUTHORIZED', message: 'Sessão necessária.' } }, 401));
    await expect(mercado.pesquisar({})).rejects.toMatchObject({ status: 401 });
  });
});

describe('cotações', () => {
  const cotacao = { id: 'q1', status: 'ABERTA', note: null, responsePrice: null, responseLeadDays: null, responseNote: null, respondedAt: null, createdAt: '2026-10-30T10:00:00Z', items: [{ id: 'i1', productId: 'p1', quantity: 2, product: { id: 'p1', name: 'X', unitPrice: '10', currency: 'AOA' } }], buyerCompany: { id: 'b', name: 'B' }, supplierCompany: { id: 's', name: 'S' } };

  it('criar envia fornecedor, nota e itens; responder envia preço/prazo/nota', async () => {
    fetchMock.mockResolvedValueOnce(resp(cotacao, 201)).mockResolvedValueOnce(resp({ ...cotacao, status: 'RESPONDIDA', responsePrice: '9', responseLeadDays: 5 })).mockResolvedValueOnce(resp({ ...cotacao, status: 'FECHADA' }));
    const c = await cotacoes.pedirCotacao({ supplierCompanyId: 's', note: 'urgente', items: [{ productId: 'p1', quantity: 2 }] });
    expect(c.status).toBe('ABERTA');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ supplierCompanyId: 's', note: 'urgente', items: [{ productId: 'p1', quantity: 2 }] });
    expect((await cotacoes.responderCotacao('q1', { price: 9, leadDays: 5, note: 'ok' })).status).toBe('RESPONDIDA');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/quotes/q1/respond');
    expect((await cotacoes.encerrarCotacao('q1')).status).toBe('FECHADA');
  });

  it('um estado fora do enum é resposta inesperada', async () => {
    fetchMock.mockResolvedValue(resp([{ ...cotacao, status: 'PENDENTE' }]));
    await expect(cotacoes.listarCotacoes()).rejects.toMatchObject({ code: 'RESPOSTA_INESPERADA' });
  });
});
