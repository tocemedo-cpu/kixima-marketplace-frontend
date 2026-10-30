// Estado da pesquisa ⇄ URL. Tudo o que a pessoa escolhe vive nos parâmetros da URL: a pesquisa é partilhável,
// o botão "voltar" funciona e um refresh não perde nada.
import { ORDENACOES } from '../../api/endpoints/mercado';

export const POR_PAGINA = 24;

/** Lê os parâmetros da URL num objecto de filtros normalizado (valores inválidos são ignorados, nunca enviados). */
export function filtrosDaUrl(sp) {
  const f = {};
  const txt = (k) => { const v = (sp.get(k) || '').trim(); if (v) f[k] = v; };
  txt('q'); txt('category'); txt('country');
  if (['PRODUTO', 'SERVICO'].includes(sp.get('kind'))) f.kind = sp.get('kind');
  if (sp.get('verified') === 'true') f.verified = 'true';
  if (sp.get('promo') === 'true') f.promo = 'true';
  const certs = (sp.get('certifications') || '').split(',').map((c) => c.trim()).filter(Boolean);
  if (certs.length) f.certifications = certs.join(',');
  for (const k of ['minPrice', 'maxPrice']) {
    const n = Number(sp.get(k));
    if (sp.get(k) !== null && sp.get(k) !== '' && Number.isFinite(n) && n >= 0) f[k] = String(n);
  }
  if (ORDENACOES.includes(sp.get('sort'))) f.sort = sp.get('sort');
  return f;
}

export function paginaDaUrl(sp) {
  const n = Number.parseInt(sp.get('page') || '1', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export const vistaDaUrl = (sp) => (sp.get('vista') === 'lista' ? 'lista' : 'grade');

/** Aplica uma alteração aos parâmetros. Mudar um filtro volta à página 1; `null`/'' remove o parâmetro. */
export function comAlteracao(sp, alteracao, { manterPagina = false } = {}) {
  const novo = new URLSearchParams(sp);
  for (const [k, v] of Object.entries(alteracao)) {
    if (v === null || v === undefined || v === '' || v === false) novo.delete(k);
    else novo.set(k, String(v));
  }
  if (!manterPagina) novo.delete('page');
  return novo;
}

/** Filtros activos como lista de { chave, rotulo } para as etiquetas removíveis. */
export function etiquetasActivas(f) {
  const l = [];
  if (f.q) l.push({ chave: 'q', rotulo: `Pesquisa: ${f.q}` });
  if (f.kind) l.push({ chave: 'kind', rotulo: f.kind === 'SERVICO' ? 'Serviços' : 'Produtos' });
  if (f.category) l.push({ chave: 'category', rotulo: f.category });
  if (f.country) l.push({ chave: 'country', rotulo: f.country });
  for (const c of (f.certifications || '').split(',').filter(Boolean)) l.push({ chave: 'certifications', valor: c, rotulo: c });
  if (f.verified) l.push({ chave: 'verified', rotulo: 'Fornecedor verificado' });
  if (f.promo) l.push({ chave: 'promo', rotulo: 'Em promoção' });
  if (f.minPrice) l.push({ chave: 'minPrice', rotulo: `Preço mínimo: ${f.minPrice}` });
  if (f.maxPrice) l.push({ chave: 'maxPrice', rotulo: `Preço máximo: ${f.maxPrice}` });
  return l;
}

export const ROTULO_DE_ORDENACAO = {
  relevantes: 'Relevância',
  recentes: 'Mais recentes',
  avaliacao: 'Melhor avaliação',
  preco_asc: 'Preço: do mais baixo',
  preco_desc: 'Preço: do mais alto',
  solicitados: 'Mais solicitados',
  vendidos: 'Mais vendidos',
};
