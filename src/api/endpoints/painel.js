// Painéis por perfil. Cada endpoint já vem agregado e filtrado pelo servidor para a empresa da sessão.
//   /api/dashboard/comprador (COMPRADOR) · /api/buyer/* (COMPRADOR, COMPANY_ADMIN) · /api/company-admin/* (COMPANY_ADMIN)
//   /api/financeiro/* e /api/payments/* (FINANCEIRO, COMPANY_ADMIN) · /api/reports/fornecedor (FORNECEDOR, COMPANY_ADMIN)
import { api } from '../client';
import { bool, lista, nulavel, num, numOuTexto, obj, opc, qualquer, str, todos, validar } from '../schema';
import { Fatura, Pagamento } from './ordens';

const kpis = obj({});
const Pagina = (item) => obj({ kpis, items: lista(item) });
const data = opc(nulavel(str));
const Parte = obj({ id: opc(str), name: opc(str) });

// ---------- Comprador ----------
export const painelComprador = async (o) => validar(obj({ kpis, minhasOrdens: lista(obj({ label: str, count: num })) }), await api.get('/api/dashboard/comprador', undefined, o), 'GET /api/dashboard/comprador');

const OrdemComprador = obj({ id: str, reference: str, status: str, supplier: opc(nulavel(Parte)), itemsCount: num, totalAmount: numOuTexto, currency: str, createdAt: str });
export const ordensDoComprador = async (query, o) => validar(obj({ kpis, items: lista(OrdemComprador), total: num, page: num, pages: num }), await api.get('/api/buyer/orders', query, o), 'GET /api/buyer/orders');

const PagamentoComprador = obj({ id: str, poId: str, reference: str, invoiceRef: str, supplier: opc(nulavel(Parte)), dueAt: data, amount: num, paid: num, open: num, status: str, currency: str });
export const pagamentosDoComprador = async (query, o) => validar(Pagina(PagamentoComprador), await api.get('/api/buyer/payments', query, o), 'GET /api/buyer/payments');

const EntregaComprador = obj({ id: str, reference: str, supplier: opc(nulavel(Parte)), itemsCount: num, dispatchedAt: data, deliveredAt: data, stage: str, label: str, progress: num });
export const entregasDoComprador = async (query, o) => validar(Pagina(EntregaComprador), await api.get('/api/buyer/deliveries', query, o), 'GET /api/buyer/deliveries');

const RecepcaoComprador = obj({ id: str, poId: str, reference: str, supplier: opc(nulavel(Parte)), item: opc(nulavel(str)), quantity: opc(num), receivedAt: data, status: str, receptionStatus: opc(nulavel(str)) });
export const rececoesDoComprador = async (query, o) => validar(Pagina(RecepcaoComprador), await api.get('/api/buyer/receptions', query, o), 'GET /api/buyer/receptions');

const FornecedorDoComprador = obj({ id: str, name: str, verified: opc(bool), status: opc(str), city: opc(nulavel(str)), country: opc(nulavel(str)), category: opc(nulavel(str)), rating: opc(nulavel(num)), productCount: opc(num) });
export const fornecedoresDoComprador = async (query, o) => validar(Pagina(FornecedorDoComprador), await api.get('/api/buyer/suppliers', query, o), 'GET /api/buyer/suppliers');

const Atividade = obj({ title: str, status: opc(str), at: data, desc: opc(nulavel(str)), relatedTo: opc(nulavel(str)), poId: opc(nulavel(str)) });
export const atividadesDoComprador = async (query, o) => validar(Pagina(Atividade), await api.get('/api/buyer/activities', query, o), 'GET /api/buyer/activities');

export const perfilDoComprador = async (o) => validar(obj({
  user: obj({ name: str, email: str, role: str }),
  company: obj({ id: str, name: str, taxId: opc(nulavel(str)), status: opc(str), city: opc(nulavel(str)), country: opc(nulavel(str)), contactEmail: opc(nulavel(str)) }),
  summary: obj({ ordersYear: num, totalBought: numOuTexto, suppliers: num, itemsReceived: num }),
  recent: lista(obj({ reference: str, supplier: opc(nulavel(str)), status: str, at: data })),
}), await api.get('/api/buyer/profile', undefined, o), 'GET /api/buyer/profile');

// ---------- Administrador da empresa ----------
export const painelDaEmpresa = async (o) => validar(obj({
  kpis, resumo: obj({}), volume: lista(obj({ label: str, value: num })),
  recent: lista(obj({ reference: str, status: str, at: data, party: opc(nulavel(str)) })),
}), await api.get('/api/company-admin/dashboard', undefined, o), 'GET /api/company-admin/dashboard');

export const organizacao = async (o) => validar(obj({
  company: obj({ id: str, name: str, taxId: opc(nulavel(str)), type: str, status: str, contactEmail: opc(nulavel(str)), contactPhone: opc(nulavel(str)), address: opc(nulavel(str)), city: opc(nulavel(str)), province: opc(nulavel(str)), country: opc(nulavel(str)), verified: opc(bool), plan: opc(nulavel(str)), size: opc(nulavel(str)), bankName: opc(nulavel(str)), iban: opc(nulavel(str)), swift: opc(nulavel(str)) }),
  summary: obj({ users: num, contracts: num, documents: num, certifications: num }),
}), await api.get('/api/company-admin/organizacao', undefined, o), 'GET /api/company-admin/organizacao');

const AtividadeEmpresa = obj({ title: str, module: opc(nulavel(str)), type: opc(nulavel(str)), status: opc(nulavel(str)), at: data, party: opc(nulavel(str)), responsavel: opc(nulavel(str)), relatedTo: opc(nulavel(str)) });
export const atividadesDaEmpresa = async (query, o) => validar(Pagina(AtividadeEmpresa), await api.get('/api/company-admin/activities', query, o), 'GET /api/company-admin/activities');

export const relatoriosDaEmpresa = async (o) => validar(obj({
  kpis, series: lista(obj({ label: str, receitas: num, despesas: num, contratos: num })),
  catalog: lista(obj({ key: str, name: str, module: opc(nulavel(str)), desc: opc(nulavel(str)), format: opc(nulavel(str)) })),
}), await api.get('/api/company-admin/reports', undefined, o), 'GET /api/company-admin/reports');

const Definicoes = obj({ aprovacaoObrigatoria: bool, assinaturaDigital: bool, historicoAlteracoes: bool, backupAutomatico: bool, lembretesPrazos: bool, valoresSemImpostos: bool });
export const definicoesDaEmpresa = async (o) => validar(Definicoes, await api.get('/api/company-admin/settings', undefined, o), 'GET /api/company-admin/settings');
export const guardarDefinicoes = async (valores) => validar(Definicoes, await api.put('/api/company-admin/settings', valores), 'PUT /api/company-admin/settings');

const Utilizador = obj({ id: str, name: str, email: str, role: str, active: bool, createdAt: opc(str) });
export const utilizadoresDaEmpresa = async (o) => validar(lista(Utilizador), await api.get('/api/companies/users', undefined, o), 'GET /api/companies/users');
/** `{ active: boolean }` */
export const definirEstadoDeUtilizador = async (id, active) => validar(qualquer, await api.patch(`/api/companies/users/${encodeURIComponent(id)}/status`, { active }), 'PATCH /api/companies/users/{id}/status');

const Convite = obj({ id: str, email: str, role: str, status: str, expiresAt: opc(nulavel(str)), createdAt: opc(str), name: opc(nulavel(str)) });
export const convitesDaEmpresa = async (o) => validar(lista(Convite), await api.get('/api/companies/invites', undefined, o), 'GET /api/companies/invites');
/** role ∈ { COMPRADOR, FORNECEDOR, FINANCEIRO } (o backend impõe). O convite chega por email; o frontend não vê tokens. */
export const convidar = async ({ role, name, email }) => api.post('/api/companies/invites', { role, name, email });
export const reenviarConvite = async (id) => api.post(`/api/companies/invites/${encodeURIComponent(id)}/resend`);
export const cancelarConvite = async (id) => api.post(`/api/companies/invites/${encodeURIComponent(id)}/cancel`);

// ---------- Financeiro ----------
const LinhaFin = obj({ id: str, reference: str, supplier: opc(nulavel(str)), poReference: opc(nulavel(str)), poId: str, amount: num, currency: str, status: str, issuedAt: data, dueAt: data, paidAt: data });
export const resumoFinanceiro = async (o) => validar(obj({ kpis, series: lista(obj({ label: str, faturas: num, pagamentos: num })), pendentes: lista(LinhaFin) }), await api.get('/api/financeiro/overview', undefined, o), 'GET /api/financeiro/overview');
export const faturasFinanceiro = async (query, o) => validar(Pagina(LinhaFin), await api.get('/api/financeiro/invoices', query, o), 'GET /api/financeiro/invoices');
export const pagamentosFinanceiro = async (query, o) => validar(Pagina(LinhaFin), await api.get('/api/financeiro/payments', query, o), 'GET /api/financeiro/payments');

const FaturaComOrdem = todos(Fatura, obj({ purchaseOrder: opc(nulavel(obj({ id: str, reference: str }))) }));
export const faturasPendentes = async (o) => validar(lista(FaturaComOrdem), await api.get('/api/payments/invoices/pending', undefined, o), 'GET /api/payments/invoices/pending');
export const historicoDePagamentos = async (o) => validar(lista(todos(Pagamento, obj({ invoice: opc(nulavel(obj({ reference: str }))) }))), await api.get('/api/payments/history', undefined, o), 'GET /api/payments/history');

/** Pagamento com comprovativo OBRIGATÓRIO (multipart, campo `proof`: PDF ou imagem). Só FINANCEIRO/COMPANY_ADMIN da compradora. */
export const pagarFatura = async (invoiceId, ficheiro) => {
  const form = new FormData();
  form.append('proof', ficheiro);
  return validar(Pagamento, await api.postForm(`/api/payments/invoices/${encodeURIComponent(invoiceId)}/pay`, form), 'POST /api/payments/invoices/{id}/pay');
};
/** Lado da fornecedora: confirma que recebeu o valor. */
export const confirmarRecebido = async (paymentId) => validar(Pagamento, await api.patch(`/api/payments/${encodeURIComponent(paymentId)}/confirm-received`), 'PATCH /api/payments/{id}/confirm-received');

// ---------- Contratos (todos os papéis; o servidor filtra pela empresa) ----------
const Contrato = obj({
  id: str, reference: str, status: str, totalValue: numOuTexto, usedValue: numOuTexto, currency: str, billingPeriodicity: opc(nulavel(str)),
  paymentTermDays: opc(nulavel(num)), validFrom: data, validUntil: data, categoriesCovered: opc(lista(str)),
  clientCompany: opc(nulavel(Parte)), supplierCompany: opc(nulavel(Parte)),
});
export const listarContratos = async (o) => validar(lista(Contrato), await api.get('/api/contracts', undefined, o), 'GET /api/contracts');
export const obterContrato = async (id, o) => validar(Contrato, await api.get(`/api/contracts/${encodeURIComponent(id)}`, undefined, o), 'GET /api/contracts/{id}');
