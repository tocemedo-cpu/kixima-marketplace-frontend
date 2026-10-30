// Pedidos de cotação. Permissões (backend): listar — qualquer papel (comprador vê os seus, fornecedor os recebidos);
// criar e encerrar — só COMPRADOR; responder — FORNECEDOR e COMPANY_ADMIN.
import { api } from '../client';
import { lista, nulavel, num, numOuTexto, obj, opc, str, umDe, validar } from '../schema';

export const ESTADOS_COTACAO = ['ABERTA', 'RESPONDIDA', 'FECHADA'];

export const Cotacao = obj({
  id: str, status: umDe(...ESTADOS_COTACAO), note: opc(nulavel(str)),
  responsePrice: opc(nulavel(numOuTexto)), responseLeadDays: opc(nulavel(num)), responseNote: opc(nulavel(str)),
  respondedAt: opc(nulavel(str)), createdAt: str,
  items: lista(obj({ id: str, productId: str, quantity: num, product: opc(nulavel(obj({ id: str, name: str, unitPrice: opc(nulavel(numOuTexto)), currency: opc(nulavel(str)) }))) })),
  buyerCompany: opc(nulavel(obj({ id: str, name: str }))),
  supplierCompany: opc(nulavel(obj({ id: str, name: str }))),
});

export const listarCotacoes = async (status, opcoes) => validar(lista(Cotacao), await api.get('/api/quotes', { status }, opcoes), 'GET /api/quotes');

/** @param {{ supplierCompanyId: string, note?: string, items: { productId: string, quantity: number }[] }} pedido */
export const pedirCotacao = async (pedido) => validar(Cotacao, await api.post('/api/quotes', pedido), 'POST /api/quotes');

/** Só COMPRADOR. */
export const encerrarCotacao = async (id) => validar(Cotacao, await api.patch(`/api/quotes/${encodeURIComponent(id)}/close`), 'PATCH /api/quotes/{id}/close');

/** Só FORNECEDOR e COMPANY_ADMIN. `price` > 0; `leadDays` >= 0 (opcional). */
export const responderCotacao = async (id, { price, leadDays, note }) => validar(Cotacao, await api.patch(`/api/quotes/${encodeURIComponent(id)}/respond`, { price, leadDays, note }), 'PATCH /api/quotes/{id}/respond');
