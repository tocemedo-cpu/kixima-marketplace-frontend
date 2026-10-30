import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CATALOGO_PUBLICO, comPapel, erroApi, fxCatFacetas, fxCatFornecedoras, fxCatPesquisa, fxCatProduto, json, montarApp, PAINEL_COMPRADOR } from '../../test/utils';

const SECCOES = ['Categorias de procurement industrial', 'Produtos em destaque', 'Fornecedoras verificadas', 'Serviços industriais', 'Porquê comprar na KIXIMA'];
const pedidos = (chamadas) => chamadas.map((c) => `${c.metodo} ${c.url.split('?')[0]}`);

describe('homepage pública (sem sessão)', () => {
  it('mostra o catálogo logo à entrada, sem login e sem pedir nada protegido', async () => {
    const { chamadas } = montarApp('/', { rotas: CATALOGO_PUBLICO });
    expect(await screen.findByRole('heading', { level: 1, name: /Procurement industrial para Oil & Gas/ })).toBeInTheDocument();
    for (const t of SECCOES) expect(await screen.findByRole('heading', { level: 2, name: t })).toBeInTheDocument();
    const produtos = fxCatPesquisa.items.filter((i) => i.kind === 'PRODUTO');
    expect(produtos.length).toBeGreaterThan(0);
    expect((await screen.findAllByRole('article')).length).toBeGreaterThanOrEqual(produtos.length);
    // só endpoints públicos
    for (const p of pedidos(chamadas)) expect(p, p).toMatch(/\/api\/(public\/|auth\/me)/);
    expect(screen.queryByRole('heading', { name: 'Entrar' })).toBeNull();
  });

  it('não parece um painel: sem gráficos, sem indicadores financeiros e sem formulário de login', async () => {
    montarApp('/', { rotas: CATALOGO_PUBLICO });
    await screen.findByRole('heading', { name: 'Produtos em destaque' });
    expect(document.querySelector('.kx-kpis')).toBeNull();
    expect(document.querySelector('svg[role="img"] canvas, canvas')).toBeNull();
    expect(screen.queryByLabelText(/^Senha/)).toBeNull();
  });

  it('as secções seguem a ordem aprovada', async () => {
    montarApp('/', { rotas: CATALOGO_PUBLICO });
    await screen.findByRole('heading', { name: 'Porquê comprar na KIXIMA' });
    const ordem = [...document.querySelectorAll('[data-seccao]')].map((e) => Number(e.dataset.seccao));
    expect(ordem).toEqual([...ordem].sort((a, b) => a - b));
    expect(ordem).toEqual(expect.arrayContaining([4, 5, 7, 8, 9, 10]));
  });

  it('cabeçalho: logótipo, pesquisa central, entrar e registar; navegação para produtos, categorias, serviços e fornecedoras', async () => {
    montarApp('/', { rotas: CATALOGO_PUBLICO });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: 'KIXIMA — página inicial' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    const topo = document.querySelector('.kx-topbar');
    expect(within(topo).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
    expect(within(topo).getByRole('link', { name: 'Registar empresa' })).toHaveAttribute('href', '/cadastro');
    const nav = screen.getAllByRole('navigation').find((n) => within(n).queryByRole('link', { name: 'Produtos' }));
    for (const [nome, href] of [['Produtos', '/produtos'], ['Serviços', '/servicos'], ['Fornecedoras', '/fornecedores']]) expect(within(nav).getByRole('link', { name: nome })).toHaveAttribute('href', href);
    expect(within(nav).getByRole('button', { name: /Categorias/ })).toBeInTheDocument();
  });

  it('as categorias vêm da API e levam à página da categoria', async () => {
    montarApp('/', { rotas: CATALOGO_PUBLICO });
    const nome = fxCatFacetas.categories[0].name;
    const ligacoes = await screen.findAllByRole('link', { name: new RegExp(nome) });
    expect(ligacoes.some((l) => l.getAttribute('href') === `/categorias/${encodeURIComponent(nome)}`)).toBe(true);
  });

  it('cartão comercial: foto, nome, categoria, fornecedora verificada, preço ou «sob cotação» e botão de detalhes', async () => {
    montarApp('/', { rotas: CATALOGO_PUBLICO });
    const destaque = fxCatPesquisa.items.find((i) => i.kind === 'PRODUTO');
    const destaques = (await screen.findByRole('heading', { level: 2, name: 'Produtos em destaque' })).closest('section');
    const cartao = (await within(destaques).findByRole('link', { name: destaque.name })).closest('article');
    expect(within(cartao).getByRole('link', { name: destaque.name })).toHaveAttribute('href', `/produto/${destaque.slug}`);
    expect(within(cartao).getByText(destaque.category)).toBeInTheDocument();
    expect(within(cartao).getByText(destaque.supplier.name)).toBeInTheDocument();
    if (destaque.supplier.verified) expect(within(cartao).getByText('Verificado')).toBeInTheDocument();
    expect(within(cartao).getByText('Ver detalhes')).toBeInTheDocument();
    if (destaque.unitPrice) expect(cartao.textContent).toMatch(/Kz/); else expect(within(cartao).getByText('Preço sob cotação')).toBeInTheDocument();
  });

  it('sem preço público mostra «Preço sob cotação» e nunca inventa um valor', async () => {
    const semPreco = { ...fxCatPesquisa, items: fxCatPesquisa.items.map((i) => ({ ...i, unitPrice: null, promoPrice: null })) };
    montarApp('/', { rotas: { ...CATALOGO_PUBLICO, 'GET /api/public/catalog/search': semPreco } });
    await screen.findByRole('heading', { name: 'Produtos em destaque' });
    expect(screen.queryByText(/Kz/)).toBeNull();
    expect(screen.getAllByText('Preço sob cotação').length).toBeGreaterThan(0);
  });

  it('catálogo vazio: as secções de produtos desaparecem em vez de serem preenchidas com exemplos', async () => {
    const vazio = { items: [], total: 0, page: 1, pages: 1, limit: 10 };
    montarApp('/', { rotas: { ...CATALOGO_PUBLICO, 'GET /api/public/catalog/search': vazio, 'GET /api/public/catalog/facets': { categories: [], kinds: [], countries: [], certifications: [], priceBounds: { min: 0, max: 0 } }, 'GET /api/public/catalog/suppliers': [] } });
    await screen.findByRole('heading', { name: 'Porquê comprar na KIXIMA' });
    for (const t of ['Produtos em destaque', 'Serviços industriais', 'Fornecedoras verificadas', 'Categorias de procurement industrial']) expect(screen.queryByRole('heading', { level: 2, name: t })).toBeNull();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('um erro numa secção não derruba as outras e permite tentar de novo', async () => {
    let falha = true;
    montarApp('/', { rotas: { ...CATALOGO_PUBLICO, 'GET /api/public/catalog/suppliers': () => (falha ? erroApi(503, 'SERVICO_INDISPONIVEL', 'x') : fxCatFornecedoras) } });
    expect(await screen.findByRole('heading', { name: 'Produtos em destaque' })).toBeInTheDocument();
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 5000 });
    falha = false;
    await userEvent.click(botao);
    expect((await screen.findAllByText(fxCatFornecedoras[0].name)).length).toBeGreaterThan(0);
  });

  it('recentes não repetem o que já aparece em destaque ou nos serviços', async () => {
    montarApp('/', { rotas: CATALOGO_PUBLICO });
    await screen.findByRole('heading', { name: 'Serviços industriais' });
    expect(screen.queryByRole('heading', { name: 'Publicados recentemente' })).toBeNull();
    const novo = { ...fxCatPesquisa.items[0], id: 'novo', slug: 'novo-produto', name: 'Produto Recém-Publicado', kind: 'PRODUTO' };
    montarApp('/', { rotas: { ...CATALOGO_PUBLICO, 'GET /api/public/catalog/search': (url) => json(new URL(url, 'http://x').searchParams.get('sort') === 'recentes' ? { ...fxCatPesquisa, items: [novo] } : fxCatPesquisa) } });
    expect(await screen.findByRole('heading', { name: 'Publicados recentemente' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Produto Recém-Publicado' })).toBeInTheDocument();
  });

  it('a pesquisa do cabeçalho vai direta aos resultados, sem pedir login', async () => {
    const { chamadas } = montarApp('/', { rotas: CATALOGO_PUBLICO });
    await userEvent.type(await screen.findByRole('searchbox'), 'válvula{enter}');
    expect(await screen.findByRole('heading', { level: 1, name: /Resultados para “válvula”/ })).toBeInTheDocument();
    expect(chamadas.some((c) => c.url.includes('/api/public/catalog/search?') && c.url.includes('q=v%C3%A1lvula'))).toBe(true);
    expect(screen.queryByText(/Inicie sessão/)).toBeNull();
  });

  it('a área de cotação convida a registar a empresa (a cotação exige conta) sem fingir que envia', async () => {
    const { chamadas } = montarApp('/', { rotas: CATALOGO_PUBLICO });
    const rfq = (await screen.findByRole('heading', { name: 'Peça uma cotação' })).closest('aside');
    expect(within(rfq).getByRole('link', { name: 'Registar a empresa' })).toHaveAttribute('href', '/cadastro');
    expect(within(rfq).getByText(/precisa de uma conta empresarial/)).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('sem avaliações públicas não mostra um bloco vazio; com avaliações mostra-as', async () => {
    montarApp('/', { rotas: { ...CATALOGO_PUBLICO, 'GET /api/public/feedback': { total: 0, average: 0, feedback: [] } } });
    await screen.findByRole('heading', { name: 'Porquê comprar na KIXIMA' });
    await waitFor(() => expect(screen.queryByText(/Ainda não há avaliações públicas/)).toBeNull());
  });

  it('com sessão a homepage continua a ser a vitrine (sem redirecionar) e o logótipo volta a ela', async () => {
    montarApp('/', { sessao: comPapel('COMPRADOR'), rotas: { ...CATALOGO_PUBLICO, ...PAINEL_COMPRADOR } });
    expect(await screen.findByRole('heading', { level: 1, name: /Procurement industrial/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'KIXIMA — página inicial' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute('href', '/comprador');
  });
});

describe('categorias, produtos e serviços (públicos)', () => {
  it('/categorias lista as categorias da API', async () => {
    montarApp('/categorias', { rotas: CATALOGO_PUBLICO });
    expect(await screen.findByRole('heading', { level: 1, name: 'Categorias' })).toBeInTheDocument();
    for (const c of fxCatFacetas.categories) expect(await screen.findByRole('link', { name: new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeInTheDocument();
  });

  it('/categorias/:nome filtra por essa categoria, mostra o nome e não oferece trocar de categoria no painel', async () => {
    const nome = fxCatFacetas.categories[0].name;
    const { chamadas } = montarApp(`/categorias/${encodeURIComponent(nome)}`, { rotas: CATALOGO_PUBLICO });
    expect(await screen.findByRole('heading', { level: 1, name: nome })).toBeInTheDocument();
    await waitFor(() => expect(chamadas.some((c) => c.url.startsWith('/api/public/catalog/search') && new URL(c.url, 'http://x').searchParams.get('category') === nome)).toBe(true));
    expect(screen.queryByRole('group', { name: 'Categoria' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Localização' })).toHaveTextContent('Categorias');
  });

  it('/servicos envia kind=SERVICO', async () => {
    const { chamadas } = montarApp('/servicos', { rotas: CATALOGO_PUBLICO });
    expect(await screen.findByRole('heading', { level: 1, name: 'Serviços industriais' })).toBeInTheDocument();
    await waitFor(() => expect(chamadas.some((c) => c.url.startsWith('/api/public/catalog/search') && c.url.includes('kind=SERVICO'))).toBe(true));
  });

  it('/produtos pesquisa sem sessão e filtra', async () => {
    const { chamadas } = montarApp('/produtos?sort=recentes', { rotas: CATALOGO_PUBLICO });
    expect(await screen.findByRole('heading', { level: 1, name: 'Produtos e serviços' })).toBeInTheDocument();
    await waitFor(() => expect(chamadas.some((c) => c.url.includes('sort=recentes'))).toBe(true));
    expect(pedidos(chamadas).every((p) => /\/api\/(public\/|auth\/me)/.test(p))).toBe(true);
  });

  it('endereços antigos do marketplace levam ao sítio novo', async () => {
    const { chamadas } = montarApp('/mercado/pesquisa?q=tubo', { rotas: CATALOGO_PUBLICO });
    expect(await screen.findByRole('heading', { level: 1, name: /Resultados para “tubo”/ })).toBeInTheDocument();
    expect(chamadas.some((c) => c.url.includes('q=tubo'))).toBe(true);
  });
});

describe('ficha do produto para visitantes', () => {
  it('qualquer visitante abre a ficha; para cotar é convidado a entrar, voltando à mesma ficha', async () => {
    const { chamadas } = montarApp(`/produto/${fxCatProduto.slug}`, { rotas: CATALOGO_PUBLICO });
    expect(await screen.findByRole('heading', { level: 1, name: fxCatProduto.name })).toBeInTheDocument();
    const entrar = screen.getByRole('link', { name: 'Entrar para pedir cotação' });
    expect(entrar).toHaveAttribute('href', `/login?next=${encodeURIComponent(`/produto/${fxCatProduto.slug}`)}`);
    expect(screen.getByRole('link', { name: 'Registar a empresa' })).toHaveAttribute('href', '/cadastro');
    expect(screen.queryByRole('button', { name: 'Pedir cotação' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Adicionar à requisição' })).toBeNull();
    expect(pedidos(chamadas).every((p) => /\/api\/(public\/|auth\/me)/.test(p))).toBe(true);
  });

  it('a ficha pública nunca mostra campos internos', async () => {
    montarApp(`/produto/${fxCatProduto.slug}`, { rotas: CATALOGO_PUBLICO });
    await screen.findByRole('heading', { level: 1, name: fxCatProduto.name });
    for (const campo of ['sku', 'supplierNotes', 'stockQuantity', 'warehouse', 'minStock', 'viewCount']) expect(fxCatProduto).not.toHaveProperty(campo);
  });
});
