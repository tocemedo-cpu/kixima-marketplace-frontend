// Marketplace (exige sessão). Pesquisa, facetas, fornecedores verificados e ficha de produto.
//
// Filtros aceites por GET /api/marketplace/search (ver MarketplaceController): q, category, kind (PRODUTO|SERVICO),
// certifications (lista separada por vírgulas), availability, verified, promo, country, province, city, specialty,
// minRating, minPrice, maxPrice, sort, page, limit. O `q` cobre nome, descrição, categoria, especialidade, marca,
// modelo, título UNSPSC, cidade, palavras-chave, etiquetas e o nome do fornecedor — NÃO cobre fabricante,
// SKU nem código do fabricante (dependência do backend, documentada em docs/API-USADA.md).
import { api } from '../client';
import { bool, lista, nulavel, num, numOuTexto, obj, opc, str, umDe, validar } from '../schema';

export const ORDENACOES = ['relevantes', 'recentes', 'avaliacao', 'preco_asc', 'preco_desc', 'solicitados', 'vendidos'];

const Fornecedor = obj({ id: str, name: str, verified: opc(bool), logoUrl: opc(nulavel(str)) });

export const Produto = obj({
  id: str, supplierId: str, name: str, slug: str, kind: umDe('PRODUTO', 'SERVICO'),
  category: opc(nulavel(str)), description: opc(nulavel(str)),
  unitPrice: opc(nulavel(numOuTexto)), promoPrice: opc(nulavel(numOuTexto)), currency: opc(nulavel(str)),
  certifications: opc(lista(str)), tags: opc(lista(str)),
  rating: opc(nulavel(num)), reviewCount: opc(num), imageUrl: opc(nulavel(str)),
  supplier: opc(nulavel(Fornecedor)),
});

const Pesquisa = obj({ items: lista(Produto), total: num, page: num, pages: num, limit: num });
const Facetas = obj({
  categories: lista(obj({ name: str, count: num })),
  kinds: lista(obj({ name: str, count: num })),
  countries: opc(lista(obj({ name: str, count: num }))),
  certifications: opc(lista(obj({ name: str, count: num }))),
  priceBounds: opc(nulavel(obj({ min: num, max: num }))),
});
const Fornecedores = lista(obj({ id: str, name: str, city: opc(nulavel(str)), country: opc(nulavel(str)), logoUrl: opc(nulavel(str)), rating: opc(nulavel(num)), productCount: opc(num) }));
const Avaliacoes = lista(obj({ id: str, rating: num, comment: opc(nulavel(str)), authorName: opc(nulavel(str)), createdAt: opc(str) }));

// Montra pública do catálogo: SEM sessão, só leitura (PublicCatalogController no backend). Serve visitantes e
// utilizadores com sessão por igual; as operações empresariais continuam em endpoints protegidos.
export const pesquisar = async (filtros, opcoes) => validar(Pesquisa, await api.get('/api/public/catalog/search', filtros, opcoes), 'GET /api/public/catalog/search');
export const facetas = async (filtros, opcoes) => validar(Facetas, await api.get('/api/public/catalog/facets', filtros, opcoes), 'GET /api/public/catalog/facets');
export const fornecedoresVerificados = async (limite, opcoes) => validar(Fornecedores, await api.get('/api/public/catalog/suppliers', limite ? { limit: limite } : undefined, opcoes), 'GET /api/public/catalog/suppliers');
export const produtoPorSlug = async (slug, opcoes) => validar(Produto, await api.get(`/api/public/catalog/products/${encodeURIComponent(slug)}`, undefined, opcoes), 'GET /api/public/catalog/products/{slug}');
export const avaliacoesDoProduto = async (slug, opcoes) => validar(Avaliacoes, await api.get(`/api/public/catalog/products/${encodeURIComponent(slug)}/reviews`, undefined, opcoes), 'GET /api/public/catalog/products/{slug}/reviews');
