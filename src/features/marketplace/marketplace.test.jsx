import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { comPapel, erroApi, json, montarApp } from '../../test/utils';
import fxPesquisa from '../../test/fixtures/mercado-pesquisa.json';
import fxFacetas from '../../test/fixtures/mercado-facetas.json';
import fxFornecedores from '../../test/fixtures/mercado-fornecedores.json';
import fxProduto from '../../test/fixtures/produto.json';

const comprador = comPapel('COMPRADOR');
const R = { 'GET /api/public/catalog/search': fxPesquisa, 'GET /api/public/catalog/facets': fxFacetas, 'GET /api/public/catalog/suppliers': fxFornecedores, ['GET /api/public/catalog/products/' + fxProduto.slug]: fxProduto, ['GET /api/public/catalog/products/' + fxProduto.slug + '/reviews']: [] };
const COTACAO = { id: 'q1', status: 'ABERTA', note: 'Entrega no Soyo', responsePrice: null, responseLeadDays: null, responseNote: null, respondedAt: null, createdAt: '2026-10-30T10:00:00Z', items: [{ id: 'i1', productId: fxProduto.id, quantity: 3, product: { id: fxProduto.id, name: fxProduto.name, unitPrice: '950000', currency: 'AOA' } }], buyerCompany: { id: 'b', name: 'Petro Angola' }, supplierCompany: { id: 's', name: 'Kianda' } };

describe('pesquisa', () => {
  it('mostra os resultados da API (cartões com preço real, fornecedor e selo) e o total', async () => {
    montarApp('/produtos', { sessao: comprador, rotas: R });
    const cartoes = await screen.findAllByRole('article');
    expect(cartoes).toHaveLength(fxPesquisa.items.length);
    expect(within(cartoes[0]).getByRole('link', { name: fxPesquisa.items[0].name })).toHaveAttribute('href', `/produto/${fxPesquisa.items[0].slug}`);
    expect(screen.getByText(`${fxPesquisa.total}`, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getAllByText(/Kz/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Verificado').length).toBeGreaterThan(0);
  });

  it('envia os filtros da URL à API (e só os válidos), com a página e o limite', async () => {
    const { chamadas } = montarApp('/produtos?q=ultrassom&kind=SERVICO&sort=preco_asc&page=2&lixo=1&minPrice=abc', { sessao: comprador, rotas: R });
    await screen.findAllByRole('article');
    const u = new URL(chamadas.find((c) => c.url.startsWith('/api/public/catalog/search')).url, 'http://x');
    expect(Object.fromEntries(u.searchParams)).toEqual({ q: 'ultrassom', kind: 'SERVICO', sort: 'preco_asc', page: '2', limit: '24' });
  });

  it('sem resultados: estado vazio com "Limpar filtros" que repõe a pesquisa', async () => {
    montarApp('/produtos?q=zzz', { sessao: comprador, rotas: { ...R, 'GET /api/public/catalog/search': { items: [], total: 0, page: 1, pages: 1, limit: 24 } } });
    expect(await screen.findByText('Nada encontrado')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Limpar filtros' }).length).toBeGreaterThan(0);
  });

  it('erro: mensagem + "Tentar de novo"; depois de repetir mostra os resultados', async () => {
    let falha = true;
    montarApp('/produtos', { sessao: comprador, rotas: { ...R, 'GET /api/public/catalog/search': () => (falha ? erroApi(422, 'VALIDATION_ERROR', 'Parâmetros de pesquisa inválidos.') : fxPesquisa) } });
    expect(await screen.findByText('Parâmetros de pesquisa inválidos.')).toBeInTheDocument();
    falha = false;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findAllByRole('article')).toHaveLength(fxPesquisa.items.length);
  });

  it('um 503 do servidor mostra texto genérico (nunca detalhes técnicos)', async () => {
    montarApp('/produtos', { sessao: comprador, rotas: { ...R, 'GET /api/public/catalog/search': () => erroApi(500, 'INTERNAL_ERROR', 'NullPointerException em X') } });
    expect(await screen.findByText(/O servidor teve um problema/)).toBeInTheDocument();
    expect(screen.queryByText(/NullPointer/)).not.toBeInTheDocument();
  });

  it('escolher um filtro actualiza a URL e volta a pesquisar (página 1)', async () => {
    const { chamadas } = montarApp('/produtos?page=2', { sessao: comprador, rotas: R });
    await screen.findAllByRole('article');
    await userEvent.click(screen.getByRole('radio', { name: /^Serviços/ }));
    await waitFor(() => expect(chamadas.filter((c) => c.url.startsWith('/api/public/catalog/search')).at(-1).url).toContain('kind=SERVICO'));
    expect(chamadas.filter((c) => c.url.startsWith('/api/public/catalog/search')).at(-1).url).toMatch(/page=1|^(?!.*page=2)/);
    expect(await screen.findByRole('button', { name: 'Remover filtro: Serviços' })).toBeInTheDocument();
  });

  it('só a resposta mais recente conta (resposta antiga que chega tarde é ignorada)', async () => {
    let resolverAntiga;
    const antiga = new Promise((r) => { resolverAntiga = r; });
    const { chamadas } = montarApp('/produtos?q=antiga', {
      sessao: comprador,
      rotas: { ...R, 'GET /api/public/catalog/search': (url) => (!url.includes('kind=SERVICO') ? antiga : { ...fxPesquisa, items: [{ ...fxPesquisa.items[0], name: 'RESULTADO NOVO' }], total: 1 }) },
    });
    await waitFor(() => expect(chamadas.some((c) => c.url.includes('q=antiga'))).toBe(true));
    await userEvent.click(screen.getByRole('radio', { name: /^Serviços/ }));        // muda os filtros → nova pesquisa
    expect(await screen.findByText('RESULTADO NOVO')).toBeInTheDocument();
    resolverAntiga(json({ ...fxPesquisa, items: [{ ...fxPesquisa.items[0], name: 'RESULTADO ANTIGO' }], total: 1 }));
    await new Promise((r) => { setTimeout(r, 50); });
    expect(screen.queryByText('RESULTADO ANTIGO')).not.toBeInTheDocument();
  });

  it('com várias páginas mostra a paginação e pede a página escolhida', async () => {
    const { chamadas } = montarApp('/produtos', { sessao: comprador, rotas: { ...R, 'GET /api/public/catalog/search': { ...fxPesquisa, total: 60, pages: 3, page: 1, limit: 24 } } });
    await screen.findAllByRole('article');
    await userEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    await waitFor(() => expect(chamadas.filter((c) => c.url.startsWith('/api/public/catalog/search')).at(-1).url).toContain('page=2'));
  });

  it('sem preço público mostra "Preço sob cotação" (nunca 0 nem um valor inventado)', async () => {
    montarApp('/produtos', { sessao: comprador, rotas: { ...R, 'GET /api/public/catalog/search': { ...fxPesquisa, items: [{ ...fxPesquisa.items[0], unitPrice: null, promoPrice: null }], total: 1 } } });
    expect(await screen.findByText('Preço sob cotação')).toBeInTheDocument();
    expect(screen.queryByText(/0,00/)).not.toBeInTheDocument();
  });
});

describe('fornecedoras', () => {
  it('o directório lista as fornecedoras verificadas, sem sessão', async () => {
    montarApp('/fornecedores', { rotas: R });
    expect(await screen.findByText(fxFornecedores[0].name)).toBeInTheDocument();
    expect(screen.getByText(/fornecedores verificados em destaque/)).toBeInTheDocument();
  });
});

describe('ficha do produto', () => {
  it('comprador: preço, fornecedor, certificações e botão de cotação', async () => {
    montarApp(`/produto/${fxProduto.slug}`, { sessao: comprador, rotas: R });
    expect(await screen.findByRole('heading', { level: 1, name: fxProduto.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pedir cotação' })).toBeInTheDocument();
    expect(screen.getAllByText(fxProduto.supplier.name).length).toBeGreaterThan(0);
    expect(screen.getByText(fxProduto.certifications[0])).toBeInTheDocument();
    expect(screen.getByText(/Ainda não há avaliações/)).toBeInTheDocument();
  });

  it.each(['FORNECEDOR', 'FINANCEIRO', 'COMPANY_ADMIN', 'ADMIN_SISTEMA'])('%s não vê o botão de cotação e percebe porquê', async (papel) => {
    montarApp(`/produto/${fxProduto.slug}`, { sessao: comPapel(papel), rotas: R });
    expect(await screen.findByText(/pedidos de cotação são feitos por contas de Comprador/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pedir cotação' })).not.toBeInTheDocument();
  });

  it('só mostra as especificações que existem (sem linhas vazias)', async () => {
    montarApp(`/produto/${fxProduto.slug}`, { sessao: comprador, rotas: { ...R, ['GET /api/public/catalog/products/' + fxProduto.slug]: { ...fxProduto, brand: 'Marca Teste', material: null, weight: '' } } });
    await screen.findByRole('heading', { level: 1, name: fxProduto.name });
    expect(screen.getByText('Marca Teste')).toBeInTheDocument();
    expect(screen.queryByText('Material')).not.toBeInTheDocument();
  });

  it('produto que não existe (404): mensagem e saída para o catálogo', async () => {
    montarApp('/produto/nao-existe', { sessao: comprador, rotas: { 'GET /api/public/catalog/products/nao-existe': erroApi(404, 'NOT_FOUND', 'Produto não encontrado.') } });
    expect(await screen.findByText('Produto não encontrado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao catálogo' })).toHaveAttribute('href', '/produtos');
  });

  it('pedir cotação: valida a quantidade, envia o payload certo e confirma só depois da resposta', async () => {
    const { chamadas } = montarApp(`/produto/${fxProduto.slug}`, { sessao: comprador, rotas: { ...R, 'POST /api/quotes': json(COTACAO, 201) } });
    await userEvent.click(await screen.findByRole('button', { name: 'Pedir cotação' }));
    const d = screen.getByRole('dialog', { name: 'Pedir cotação' });
    const qtd = within(d).getByLabelText(/Quantidade/);
    await userEvent.clear(qtd); await userEvent.type(qtd, '0');
    await userEvent.click(within(d).getByRole('button', { name: 'Enviar pedido' }));
    expect(within(d).getByText(/quantidade inteira/)).toBeInTheDocument();
    expect(chamadas.some((c) => c.url === '/api/quotes')).toBe(false);
    await userEvent.clear(qtd); await userEvent.type(qtd, '3');
    await userEvent.type(within(d).getByLabelText(/Nota para o fornecedor/), 'Entrega no Soyo');
    await userEvent.click(within(d).getByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByRole('dialog', { name: 'Pedido enviado' })).toBeInTheDocument();
    expect(JSON.parse(chamadas.find((c) => c.url === '/api/quotes').corpo)).toEqual({ supplierCompanyId: fxProduto.supplierId, note: 'Entrega no Soyo', items: [{ productId: fxProduto.id, quantity: 3 }] });
  });

  it('se o servidor recusar o pedido, mostra o erro e NÃO finge que enviou', async () => {
    montarApp(`/produto/${fxProduto.slug}`, { sessao: comprador, rotas: { ...R, 'POST /api/quotes': erroApi(403, 'FORBIDDEN', 'Sem permissão para pedir cotações.') } });
    await userEvent.click(await screen.findByRole('button', { name: 'Pedir cotação' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByText('Sem permissão para pedir cotações.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Pedido enviado' })).not.toBeInTheDocument();
  });
});

describe('cotações', () => {
  it('comprador: vê "Encerrar" (com confirmação) e nunca "Responder"', async () => {
    const { chamadas } = montarApp('/mercado/cotacoes', { sessao: comprador, rotas: { 'GET /api/quotes': [COTACAO], 'PATCH /api/quotes/q1/close': { ...COTACAO, status: 'FECHADA' } } });
    expect(await screen.findByText(/3 × /)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(false);                       // nada acontece sem confirmar
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Encerrar pedido' }));
    await waitFor(() => expect(chamadas.some((c) => c.url === '/api/quotes/q1/close' && c.metodo === 'PATCH')).toBe(true));
  });

  it('fornecedor: vê "Responder" e não "Encerrar"; valida o preço e envia preço/prazo/nota', async () => {
    const { chamadas } = montarApp('/mercado/cotacoes', { sessao: comPapel('FORNECEDOR'), rotas: { 'GET /api/quotes': [COTACAO], 'PATCH /api/quotes/q1/respond': { ...COTACAO, status: 'RESPONDIDA', responsePrice: '900000', responseLeadDays: 7 } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Responder' }));
    expect(screen.queryByRole('button', { name: 'Encerrar' })).not.toBeInTheDocument();
    const d = screen.getByRole('dialog', { name: 'Responder ao pedido' });
    expect(within(d).getByText('Entrega no Soyo')).toBeInTheDocument();                  // a nota do comprador
    await userEvent.click(within(d).getByRole('button', { name: 'Enviar resposta' }));
    expect(within(d).getByText('Indique um preço maior que zero.')).toBeInTheDocument();
    await userEvent.type(within(d).getByLabelText(/Preço total/), '900000'); await userEvent.type(within(d).getByLabelText(/Prazo/), '7');
    await userEvent.type(within(d).getByLabelText(/Nota para o comprador/), 'Inclui mobilização');
    await userEvent.click(within(d).getByRole('button', { name: 'Enviar resposta' }));
    await waitFor(() => expect(chamadas.find((c) => c.url === '/api/quotes/q1/respond')).toBeTruthy());
    expect(JSON.parse(chamadas.find((c) => c.url === '/api/quotes/q1/respond').corpo)).toEqual({ price: 900000, leadDays: 7, note: 'Inclui mobilização' });
  });

  it.each(['FINANCEIRO', 'ADMIN_SISTEMA'])('%s: lista sem nenhuma ação', async (papel) => {
    montarApp('/mercado/cotacoes', { sessao: comPapel(papel), rotas: { 'GET /api/quotes': [COTACAO] } });
    await screen.findByText(/3 × /);
    expect(screen.queryByRole('button', { name: /^(Encerrar|Responder)$/ })).not.toBeInTheDocument();
  });

  it('abas filtram por estado com contagem; sem pedidos mostra como começar', async () => {
    montarApp('/mercado/cotacoes', { sessao: comprador, rotas: { 'GET /api/quotes': [COTACAO, { ...COTACAO, id: 'q2', status: 'FECHADA' }] } });
    expect(await screen.findByRole('tab', { name: 'Todos (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Abertos (1)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Respondidos (0)' }));
    expect(screen.getByText('Nenhum pedido neste estado')).toBeInTheDocument();
  });

  it('sem nenhum pedido, o comprador é encaminhado para o catálogo', async () => {
    montarApp('/mercado/cotacoes', { sessao: comprador, rotas: { 'GET /api/quotes': [] } });
    expect(await screen.findByText('Ainda não há pedidos de cotação')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir ao catálogo' })).toHaveAttribute('href', '/produtos');
  });

  it('sem sessão, qualquer página do mercado pede login', async () => {
    montarApp('/mercado/cotacoes', { rotas: {} });
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
  });
});
