// Ordens de compra (PO). Máquina de estados e permissões do backend (PoController):
//   criar — COMPRADOR, COMPANY_ADMIN        · aprovar/rejeitar — COMPANY_ADMIN da empresa compradora
//   aceitar/recusar/despachar/entregue — FORNECEDOR, COMPANY_ADMIN da empresa fornecedora
//   receção e resolução de divergência — COMPRADOR, COMPANY_ADMIN da empresa compradora
// Transições inválidas → 409; o servidor recalcula preços e impostos (o cliente só envia produto + quantidade).
import { api } from '../client';
import { bool, lista, nulavel, num, numOuTexto, obj, opc, str, todos, umDe, validar } from '../schema';

export const ESTADOS_ORDEM = [
  'AGUARDANDO_APROVACAO', 'APROVADA', 'REJEITADA', 'ACEITE_FORNECEDOR', 'RECUSADA_FORNECEDOR', 'AGUARDANDO_PAGAMENTO',
  'PAGA', 'EM_EXECUCAO', 'ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA',
];

const data = opc(nulavel(str));
const Empresa = obj({ id: str, name: str, taxId: opc(nulavel(str)), contactEmail: opc(nulavel(str)), city: opc(nulavel(str)), country: opc(nulavel(str)), bankName: opc(nulavel(str)), iban: opc(nulavel(str)), swift: opc(nulavel(str)) });

export const Pagamento = obj({
  id: str, invoiceId: str, amount: numOuTexto, currency: str, status: str, canal: opc(nulavel(str)),
  proofUrl: opc(nulavel(str)), proofName: opc(nulavel(str)), receivedAt: data, processedAt: data,
});

export const Fatura = obj({
  id: str, reference: str, purchaseOrderId: str, amount: numOuTexto, netAmount: opc(nulavel(numOuTexto)), taxAmount: opc(nulavel(numOuTexto)),
  withholdingAmount: opc(nulavel(numOuTexto)), currency: str, status: str, issuedAt: data, dueAt: data,
  payment: opc(nulavel(Pagamento)),
});

const Linha = obj({
  id: str, productId: str, quantity: num, unitPrice: numOuTexto, lineTotal: numOuTexto,
  product: opc(nulavel(obj({ id: str, name: str, kind: opc(str), category: opc(nulavel(str)), measurementUnit: opc(nulavel(str)) }))),
});

export const Ordem = obj({
  id: str, reference: str, buyerCompanyId: str, supplierCompanyId: str, status: umDe(...ESTADOS_ORDEM),
  totalAmount: numOuTexto, currency: str, isCallOff: opc(bool),
  createdAt: str, approvedAt: data, rejectedAt: data, rejectionReason: data, acceptedAt: data, refusedAt: data, refusalReason: data,
  paymentDueAt: data, paidAt: data, dispatchedAt: data, deliveredAt: data, receivedAt: data,
  receptionStatus: data, divergenceResolution: data, divergenceResolutionNotes: data, divergenceResolvedAt: data,
  items: opc(lista(Linha)),
});

// O detalhe acrescenta as empresas, a fatura (com o pagamento) e quem criou/aprovou.
const Detalhe = todos(Ordem, obj({
  buyerCompany: opc(nulavel(Empresa)), supplierCompany: opc(nulavel(Empresa)), invoice: opc(nulavel(Fatura)),
  createdBy: opc(nulavel(obj({ name: str }))), approvedBy: opc(nulavel(obj({ name: str }))),
}));

const Evento = obj({ id: str, action: str, createdAt: str, actorName: opc(nulavel(str)), actorRole: opc(nulavel(str)) });

export const listarOrdens = async (opcoes) => validar(lista(Ordem), await api.get('/api/purchase-orders', undefined, opcoes), 'GET /api/purchase-orders');
export const obterOrdem = async (id, opcoes) => validar(Detalhe, await api.get(`/api/purchase-orders/${encodeURIComponent(id)}`, undefined, opcoes), 'GET /api/purchase-orders/{id}');
export const historicoDaOrdem = async (id, opcoes) => validar(lista(Evento), await api.get(`/api/purchase-orders/${encodeURIComponent(id)}/history`, undefined, opcoes), 'GET /api/purchase-orders/{id}/history');

/** @param {{ supplierCompanyId: string, items: { productId: string, quantity: number }[] }} pedido */
export const criarOrdem = async (pedido) => validar(Ordem, await api.post('/api/purchase-orders', pedido), 'POST /api/purchase-orders');

const acao = (nome) => async (id, corpo) => validar(Ordem, await api.patch(`/api/purchase-orders/${encodeURIComponent(id)}/${nome}`, corpo), `PATCH /api/purchase-orders/{id}/${nome}`);
export const aprovarOrdem = acao('approve');
/** `reason` opcional no backend; a interface pede sempre uma justificação. */
export const rejeitarOrdem = acao('reject');
export const aceitarOrdem = acao('accept');
/** `reason` obrigatório. */
export const recusarOrdem = acao('refuse');
export const despacharOrdem = acao('dispatch');
export const marcarEntregue = acao('delivered');
/** `{ conforme: boolean, notes?: string }` */
export const registarRecepcao = acao('reception');
/** `{ outcome: 'ACEITE' | 'REPOSICAO', notes?: string }` */
export const resolverDivergencia = acao('resolve-divergence');
