import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { TemaProvider } from '../design/TemaContext';
import { ToastProvider } from '../ui';
import fxMe from './fixtures/auth-me.json';
import fxCompradorDashboard from './fixtures/comprador-dashboard.json';
import fxCompradorPerfil from './fixtures/comprador-perfil.json';
import fxFornecedorRelatorio from './fixtures/fornecedor-relatorio.json';
import fxOrdens from './fixtures/ordens.json';
import fxCatPesquisa from './fixtures/publico-catalogo-pesquisa.json';
import fxCatFacetas from './fixtures/publico-catalogo-facetas.json';
import fxCatFornecedoras from './fixtures/publico-catalogo-fornecedoras.json';
import fxCatProduto from './fixtures/publico-catalogo-produto.json';
import fxCatAvaliacoes from './fixtures/publico-catalogo-avaliacoes.json';
import fxPubStats from './fixtures/publico-stats.json';
import fxPubFeedback from './fixtures/publico-feedback.json';

export const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
export const erroApi = (status, code, message, details) => json({ error: { code, message, ...(details ? { details } : {}) } }, status);

/** Utilizador de /api/auth/me com outro papel. */
export const comPapel = (role, extra = {}) => ({ user: { ...fxMe.user, role, ...extra } });

/**
 * Monta a aplicação INTEIRA (rotas, providers) com um `fetch` simulado. `rotas` mapeia "MÉTODO /caminho" (sem query)
 * para uma função (url, init) → Response, ou para um valor JSON. Pedidos não previstos falham o teste (404 + aviso).
 */
export function montarApp(rota, { sessao = null, rotas = {} } = {}) {
  if (sessao) localStorage.setItem('kixima.sessao', '1');
  const chamadas = [];
  const fetchMock = vi.fn((url, init = {}) => {
    const metodo = (init.method || 'GET').toUpperCase();
    const caminho = String(url).split('?')[0];
    chamadas.push({ metodo, url: String(url), corpo: init.body, init });
    const chave = `${metodo} ${caminho}`;
    if (chave === 'GET /api/auth/me' && !rotas[chave]) return Promise.resolve(sessao ? json(sessao) : erroApi(401, 'UNAUTHORIZED', 'Sem sessão.'));
    const r = rotas[chave];
    if (r === undefined) { console.warn(`[teste] pedido não previsto: ${chave}`); return Promise.resolve(erroApi(404, 'ROUTE_NOT_FOUND', `não previsto: ${chave}`)); }
    const v = typeof r === 'function' ? r(String(url), init) : r;
    // `v` pode ser uma Promise (resposta que chega mais tarde): normaliza-se quando resolver.
    return Promise.resolve(v).then((x) => (x instanceof Response ? x : json(x)));
  });
  vi.stubGlobal('fetch', fetchMock);
  const ui = render(
    <MemoryRouter initialEntries={[rota]}>
      <TemaProvider><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></TemaProvider>
    </MemoryRouter>,
  );
  return { ...ui, chamadas, fetchMock };
}

// ---- Rotas simuladas por área de trabalho (respostas reais do backend Java, guardadas em test/fixtures) ----

export const PAINEL_COMPRADOR = { 'GET /api/dashboard/comprador': fxCompradorDashboard, 'GET /api/buyer/profile': fxCompradorPerfil };
export const PAINEL_FORNECEDOR = { 'GET /api/reports/fornecedor': fxFornecedorRelatorio, 'GET /api/purchase-orders': fxOrdens };

/** Montra pública (respostas reais de /api/public/catalog/*): o que um visitante sem sessão consegue ler. */
export const CATALOGO_PUBLICO = {
  'GET /api/public/catalog/search': fxCatPesquisa,
  'GET /api/public/catalog/facets': fxCatFacetas,
  'GET /api/public/catalog/suppliers': fxCatFornecedoras,
  [`GET /api/public/catalog/products/${fxCatProduto.slug}`]: fxCatProduto,
  [`GET /api/public/catalog/products/${fxCatProduto.slug}/reviews`]: fxCatAvaliacoes,
  'GET /api/public/stats': fxPubStats,
  'GET /api/public/feedback': fxPubFeedback,
};
export { fxCatPesquisa, fxCatFacetas, fxCatFornecedoras, fxCatProduto };
