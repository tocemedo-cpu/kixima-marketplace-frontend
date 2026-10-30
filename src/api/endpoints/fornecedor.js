// Área da prestadora/fornecedora. Permissões (CatalogController, ReportsController): FORNECEDOR e COMPANY_ADMIN da empresa fornecedora.
// O catálogo devolvido por GET /api/catalog é o de TODA a plataforma; a empresa filtra-se por `supplierId` (o servidor
// só aceita alterações a produtos da própria empresa).
import { api } from '../client';
import { bool, lista, nulavel, num, numOuTexto, obj, opc, qualquer, str, umDe, validar } from '../schema';

const Produto = obj({
  id: str, supplierId: str, name: str, kind: umDe('PRODUTO', 'SERVICO'), category: opc(nulavel(str)), description: opc(nulavel(str)),
  unitPrice: opc(nulavel(numOuTexto)), currency: opc(nulavel(str)), stockQuantity: opc(nulavel(num)), minStock: opc(nulavel(num)),
  leadTimeDays: opc(nulavel(num)), availability: opc(nulavel(str)), warehouse: opc(nulavel(str)), active: bool, slug: opc(str),
});

export const meusProdutos = async (supplierId, o) => validar(lista(Produto), await api.get('/api/catalog', { supplierId }, o), 'GET /api/catalog');

/** Criação: nome, categoria e preço unitário obrigatórios (createProductSchema). Corpo JSON aceite pelo backend. */
export const criarProduto = async (dados) => validar(Produto, await api.post('/api/catalog', dados), 'POST /api/catalog');
export const atualizarProduto = async (id, dados) => validar(Produto, await api.put(`/api/catalog/${encodeURIComponent(id)}`, dados), 'PUT /api/catalog/{id}');
/** Desativa (não apaga): o produto sai do marketplace. */
export const desativarProduto = async (id) => validar(Produto, await api.delete(`/api/catalog/${encodeURIComponent(id)}`), 'DELETE /api/catalog/{id}');
/** Campos opcionais; os ausentes não alteram o valor guardado. */
export const atualizarStock = async (id, { stockQuantity, minStock, warehouse, availability }) =>
  validar(Produto, await api.patch(`/api/catalog/${encodeURIComponent(id)}/stock`, { stockQuantity, minStock, warehouse, availability }), 'PATCH /api/catalog/{id}/stock');

export const movimentosDeStock = async (query, o) => validar(obj({ itens: lista(qualquer), total: num, pagina: num, paginas: num }), await api.get('/api/catalog/movements', query, o), 'GET /api/catalog/movements');

export const relatorioDoFornecedor = async (o) => validar(obj({
  totalProducts: num, activeProducts: num, lowStock: num, totalOrders: num, revenue: numOuTexto, totalViews: opc(num),
  statusCounts: obj({}),
  topProducts: lista(obj({ productId: str, name: str, quantity: num, total: numOuTexto })),
  topViewed: opc(lista(obj({ productId: str, name: str, views: num }))),
  janela: opc(obj({})),
}), await api.get('/api/reports/fornecedor', undefined, o), 'GET /api/reports/fornecedor');

export const documentosDoFornecedor = async (o) => validar(obj({
  productDocs: lista(qualquer),
  companyDocs: lista(obj({ id: str, type: str, originalName: opc(nulavel(str)), createdAt: opc(str) })),
}), await api.get('/api/catalog/documents', undefined, o), 'GET /api/catalog/documents');
