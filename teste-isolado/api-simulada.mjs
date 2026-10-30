// KIXIMA Marketplace — API SIMULADA para testar o frontend SOZINHO, antes de o ligar ao backend Java real.
//
// NÃO é o backend e não o substitui: responde com respostas REAIS do backend Java capturadas numa base de testes (as
// fixtures em src/test/fixtures) e simula, em memória, o ciclo das ordens, pagamentos, cotações, catálogo, equipa e
// credenciamento para que cada ecrã e cada fluxo possam ser experimentados. As regras de negócio verdadeiras (preços, IVA,
// limites de plano, permissões finas, auditoria, 2FA, email) são do backend e NÃO estão aqui.
//
//   - O estado vive em memória e volta ao início quando o processo reinicia.
//   - Os painéis agregados são instantâneos fixos, exceto: ordens, aprovações, faturas e pagamentos (recalculados).
//   - A sessão é um cookie httpOnly como no backend; a palavra-passe de demonstração vem de DEMO_SENHA (obrigatória, sem valor
//     por omissão, nunca escrita no código nem nos logs).
//   - Um endpoint que o frontend use e não esteja simulado responde 404 NAO_SIMULADO.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = process.env.FIXTURES_DIR || path.join(AQUI, '..', 'src', 'test', 'fixtures');
const lerFixture = (nome) => JSON.parse(fs.readFileSync(path.join(PASTA, `${nome}.json`), 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));
const agora = () => new Date().toISOString();
const dias = (n) => new Date(Date.now() + n * 86400000).toISOString();
const uuid = () => crypto.randomUUID();
// As fixtures vêm de uma base de testes onde os ensaios automáticos deixaram empresas e contas «Teste E2E»: não são dados de demonstração.
const eLixoDeEnsaio = (o) => /e2e/i.test(`${o?.name || ''} ${o?.email || ''} ${o?.companyName || ''}`);

export function criarEstado() {
  const detalhe = lerFixture('ordem-divergencia');
  const empresas = { comprador: clone(detalhe.buyerCompany), fornecedora: clone(detalhe.supplierCompany) };
  const catalogo = clone(lerFixture('fornecedor-catalogo'));
  const utilizadores = lerFixture('sistema-utilizadores').filter((u) => !eLixoDeEnsaio(u)).map((u) => {
    const doFornecedor = u.role === 'FORNECEDOR'; const semEmpresa = u.role === 'ADMIN_SISTEMA';
    const emp = doFornecedor ? empresas.fornecedora : empresas.comprador;
    return { id: u.id, name: u.name, email: u.email, role: u.role, active: true, createdAt: u.createdAt,
      companyId: semEmpresa ? null : emp.id, companyName: semEmpresa ? null : emp.name, companyType: semEmpresa ? null : (doFornecedor ? 'FORNECEDOR' : 'CLIENTE'), companyPlan: 'CORE' };
  });
  const ordens = clone(lerFixture('ordens')).map((o) => ({ ...o, items: o.items.map((l) => ({ ...l, product: produtoResumo(catalogo, l.productId) })) }));
  // Faturas e pagamentos reconstruídos a partir das respostas reais (histórico de pagamentos e faturas pendentes).
  const faturas = new Map(); const pagamentos = [];
  for (const f of lerFixture('financeiro-pendentes')) faturas.set(f.purchaseOrderId, { ...clone(f), purchaseOrder: undefined, payment: null });
  for (const p of lerFixture('financeiro-historico')) {
    const inv = clone(p.invoice); faturas.set(inv.purchaseOrderId, { ...inv, payment: null });
    pagamentos.push({ ...clone(p), invoice: undefined });
  }
  for (const p of pagamentos) { const f = [...faturas.values()].find((x) => x.id === p.invoiceId); if (f) f.payment = p; }
  const prontidao = clone(lerFixture('sistema-prontidao')); prontidao.ambiente = 'teste-isolado';
  return {
    empresas, catalogo, utilizadores, ordens, faturas, pagamentos, cotacoes: [], convites: [],
    historico: new Map(), prontidao, auditoria: clone(lerFixture('sistema-auditoria').items).filter((i) => !eLixoDeEnsaio({ name: `${i.actorName} ${i.entityRef}` })),
    empresasPlataforma: lerFixture('sistema-empresas').filter((e) => !eLixoDeEnsaio(e)),
    definicoes: clone(lerFixture('empresa-definicoes')),
    contratos: clone(lerFixture('contratos')),
  };
}

function produtoResumo(catalogo, id) {
  const p = catalogo.find((x) => x.id === id);
  return p ? { id: p.id, name: p.name, kind: p.kind, category: p.category, measurementUnit: p.measurementUnit ?? null } : { id, name: 'Produto', kind: 'PRODUTO', category: null, measurementUnit: null };
}

// ---------------------------------------------------------------------------------------------------------------- pesquisa pública
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const CAMPOS_PUBLICOS = ['id', 'supplierId', 'name', 'slug', 'kind', 'category', 'subcategory', 'brand', 'manufacturer', 'model', 'countryOfOrigin', 'description', 'fullDescription', 'applications', 'benefits', 'keywords', 'unspscTitle', 'keySpec', 'standard', 'warranty', 'incoterm', 'material', 'weight', 'height', 'width', 'length', 'pressure', 'temperature', 'power', 'voltage', 'measurementUnit', 'unitPrice', 'promoPrice', 'currency', 'minQuantity', 'maxQuantity', 'leadTimeDays', 'availability', 'specialty', 'city', 'province', 'country', 'certifications', 'tags', 'rating', 'reviewCount', 'imageUrl', 'createdAt'];
const ORDENACOES = { relevantes: (a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating || (b.createdAt > a.createdAt ? 1 : -1), recentes: (a, b) => (b.createdAt > a.createdAt ? 1 : -1), avaliacao: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount, preco_asc: (a, b) => Number(a.unitPrice) - Number(b.unitPrice), preco_desc: (a, b) => Number(b.unitPrice) - Number(a.unitPrice), solicitados: (a, b) => b.viewCount - a.viewCount, vendidos: (a, b) => b.reviewCount - a.reviewCount || b.viewCount - a.viewCount };

const vistaPublica = (p) => { const o = {}; for (const c of CAMPOS_PUBLICOS) if (c in p) o[c] = p[c]; o.supplier = { id: p.supplier.id, name: p.supplier.name, verified: p.supplier.verified, logoUrl: p.supplier.logoUrl ?? null }; return o; };
const visiveis = (e) => e.catalogo.filter((p) => p.active && p.supplier.status === 'APROVADA');

function erroValidacao(campos) { return { status: 422, corpo: { error: { code: 'VALIDATION_ERROR', message: 'Parâmetros de pesquisa inválidos.', details: { formErrors: [], fieldErrors: campos } } } }; }

function filtrar(e, q, ignorar = '') {
  const certs = (q.get('certifications') || '').split(',').map((c) => c.trim()).filter(Boolean);
  const termo = normalizar(q.get('q')).trim();
  return visiveis(e).filter((p) => {
    if (ignorar !== 'kind' && q.get('kind') && p.kind !== q.get('kind')) return false;
    if (ignorar !== 'category' && q.get('category') && p.category !== q.get('category')) return false;
    if (ignorar !== 'country' && q.get('country') && p.country !== q.get('country')) return false;
    if (q.get('verified') === 'true' && !p.supplier.verified) return false;
    if (q.get('promo') === 'true' && p.promoPrice == null) return false;
    if (ignorar !== 'certifications' && certs.length && !certs.some((c) => (p.certifications || []).includes(c))) return false;
    if (ignorar !== 'price' && q.get('minPrice') && Number(p.unitPrice) < Number(q.get('minPrice'))) return false;
    if (ignorar !== 'price' && q.get('maxPrice') && Number(p.unitPrice) > Number(q.get('maxPrice'))) return false;
    if (q.get('minRating') && p.rating < Number(q.get('minRating'))) return false;
    if (termo) {
      const palheiro = normalizar([p.name, p.description, p.category, p.specialty, p.brand, p.model, p.city, p.keywords, (p.tags || []).join(' '), p.supplier.name].join(' '));
      if (!palheiro.includes(termo)) return false;
    }
    return true;
  });
}

function validarPesquisa(q) {
  const erros = {};
  if (q.get('kind') && !['PRODUTO', 'SERVICO'].includes(q.get('kind'))) erros.kind = ['Invalid enum value'];
  if (q.get('sort') && !ORDENACOES[q.get('sort')]) erros.sort = ['Invalid enum value'];
  for (const [k, max] of [['limit', 48], ['page', null]]) {
    if (q.get(k) === null) continue; const n = Number(q.get(k));
    if (!Number.isInteger(n) || n <= 0 || (max && n > max)) erros[k] = ['Expected positive integer'];
  }
  for (const k of ['minPrice', 'maxPrice', 'minRating']) if (q.get(k) !== null && !(Number(q.get(k)) >= 0)) erros[k] = ['Expected number'];
  return Object.keys(erros).length ? erroValidacao(erros) : null;
}

function pesquisaPublica(e, q) {
  const erro = validarPesquisa(q); if (erro) return erro;
  const limite = Number(q.get('limit') || 16); const pagina = Number(q.get('page') || 1);
  const lista = filtrar(e, q).sort(ORDENACOES[q.get('sort') || 'relevantes']);
  return { corpo: { items: lista.slice((pagina - 1) * limite, pagina * limite).map(vistaPublica), total: lista.length, page: pagina, pages: Math.max(1, Math.ceil(lista.length / limite)), limit: limite } };
}

function contar(lista, chave) { const m = new Map(); for (const v of lista) for (const k of [].concat(chave(v))) if (k != null) m.set(k, (m.get(k) || 0) + 1); return m; }
function facetasPublicas(e, q) {
  const erro = validarPesquisa(q); if (erro) return erro;
  const ordenar = (m) => [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const preco = filtrar(e, q, 'price').map((p) => Number(p.unitPrice)).filter(Number.isFinite);
  return { corpo: {
    categories: ordenar(contar(filtrar(e, q, 'category'), (p) => p.category)),
    kinds: [...contar(filtrar(e, q, 'kind'), (p) => p.kind)].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
    countries: [...contar(filtrar(e, q, 'country'), (p) => p.country)].map(([name, count]) => ({ name, count })),
    certifications: ordenar(contar(filtrar(e, q, 'certifications'), (p) => p.certifications || [])),
    priceBounds: { min: preco.length ? Math.min(...preco) : 0, max: preco.length ? Math.max(...preco) : 0 },
  } };
}

function fornecedorasPublicas(e, limite) {
  const aprovadas = [{ ...clone(lerFixture('publico-catalogo-fornecedoras')[0]), id: e.empresas.fornecedora.id, name: e.empresas.fornecedora.name }];
  return aprovadas.map((f) => { const meus = visiveis(e).filter((p) => p.supplierId === f.id); return { ...f, productCount: meus.length }; }).slice(0, limite);
}

// ---------------------------------------------------------------------------------------------------------------- ordens e finanças
const POR_ESTADO_ABERTO = ['AGUARDANDO_APROVACAO', 'APROVADA', 'AGUARDANDO_PAGAMENTO', 'PAGA', 'EM_EXECUCAO', 'ENTREGUE'];
const resumoParte = (emp) => ({ id: emp.id, name: emp.name, logoUrl: null, verified: true, city: emp.city ?? null, province: emp.province ?? null, country: emp.country ?? null });
const proximaReferencia = (prefixo, existentes) => { const ano = new Date().getFullYear(); const n = Math.max(0, ...existentes.map((r) => Number(String(r).split('-').pop()) || 0)) + 1; return `${prefixo}-${ano}-${String(n).padStart(prefixo === 'PO' ? 5 : 6, '0')}`; };
const moeda = (n) => String(Math.round(Number(n)));

function detalheDaOrdem(e, o) {
  const fat = e.faturas.get(o.id);
  const nomeDe = (id) => e.utilizadores.find((u) => u.id === id);
  return { ...clone(o), invoice: fat ? clone(fat) : null, buyerCompany: clone(e.empresas.comprador), supplierCompany: clone(e.empresas.fornecedora),
    createdBy: nomeDe(o.createdById) ? { name: nomeDe(o.createdById).name } : null, approvedBy: nomeDe(o.approvedById) ? { name: nomeDe(o.approvedById).name } : null };
}

function linhaFinanceira(e, f) {
  const o = e.ordens.find((x) => x.id === f.purchaseOrderId);
  return { id: f.id, reference: f.reference, supplier: e.empresas.fornecedora.name, poReference: o?.reference ?? null, poId: f.purchaseOrderId, amount: Number(f.amount), currency: f.currency, status: f.status, issuedAt: f.issuedAt, dueAt: f.dueAt, paidAt: f.payment?.processedAt ?? null };
}

const etapaEntrega = (o) => ({ REJEITADA: ['CANCELADA', 'Cancelada', 0], RECUSADA_FORNECEDOR: ['CANCELADA', 'Cancelada', 0], AGUARDANDO_APROVACAO: ['EM_PREPARACAO', 'A aguardar aprovação', 5], APROVADA: ['EM_PREPARACAO', 'A aguardar a fornecedora', 15], AGUARDANDO_PAGAMENTO: ['EM_PREPARACAO', 'A aguardar pagamento', 30], PAGA: ['EM_PREPARACAO', 'Em preparação', 45], EM_EXECUCAO: ['EM_TRANSITO', 'Em trânsito', 70], ENTREGUE: ['ENTREGUE', 'Entregue', 90] }[o.status] || ['ENTREGUE', 'Entregue', 100]);

function ordensDoComprador(e, q) {
  const filtradas = e.ordens.filter((o) => (!q.get('status') || o.status === q.get('status')) && (!q.get('q') || o.reference.toLowerCase().includes(q.get('q').toLowerCase())));
  const limite = Number(q.get('limit') || 20); const pagina = Number(q.get('page') || 1);
  const todas = e.ordens;
  return { kpis: { total: todas.length, valorTotal: todas.reduce((s, o) => s + Number(o.totalAmount), 0), emAndamento: todas.filter((o) => POR_ESTADO_ABERTO.includes(o.status)).length, concluidas: todas.filter((o) => ['RECEBIDA_CONFORME', 'CONCLUIDA'].includes(o.status)).length, canceladas: todas.filter((o) => ['REJEITADA', 'RECUSADA_FORNECEDOR'].includes(o.status)).length },
    items: filtradas.slice((pagina - 1) * limite, pagina * limite).map((o) => ({ id: o.id, reference: o.reference, status: o.status, supplier: resumoParte(e.empresas.fornecedora), itemsCount: o.items.length, totalAmount: Number(o.totalAmount), currency: o.currency, isCallOff: Boolean(o.isCallOff), createdAt: o.createdAt, acceptedAt: o.acceptedAt, paymentDueAt: o.paymentDueAt, dispatchedAt: o.dispatchedAt, deliveredAt: o.deliveredAt, receivedAt: o.receivedAt, receptionStatus: o.receptionStatus })),
    total: filtradas.length, page: pagina, pages: Math.max(1, Math.ceil(filtradas.length / limite)) };
}

function pagamentosDoComprador(e) {
  const itens = [...e.faturas.values()].map((f) => { const o = e.ordens.find((x) => x.id === f.purchaseOrderId); const paga = f.status === 'PAGA'; return { id: f.id, poId: f.purchaseOrderId, reference: o?.reference, invoiceRef: f.reference, supplier: resumoParte(e.empresas.fornecedora), poDate: o?.createdAt, dueAt: f.dueAt, amount: Number(f.amount), paid: paga ? Number(f.amount) : 0, open: paga ? 0 : Number(f.amount), status: f.status, currency: f.currency, origin: 'Gerada a partir do Checkout' }; });
  const soma = (fn) => itens.filter(fn).reduce((s, i) => s + i.open, 0);
  return { kpis: { aPagar: soma((i) => i.status === 'PENDENTE'), concluidos: itens.filter((i) => i.status === 'PAGA').reduce((s, i) => s + i.paid, 0), atrasados: soma((i) => i.status === 'VENCIDA'), totalPO: e.ordens.reduce((s, o) => s + Number(o.totalAmount), 0) }, items: itens };
}

function entregasDoComprador(e) {
  const itens = e.ordens.map((o) => { const [stage, label, progress] = etapaEntrega(o); return { id: o.id, reference: o.reference, supplier: resumoParte(e.empresas.fornecedora), itemsCount: o.items.length, emittedAt: o.createdAt, dispatchedAt: o.dispatchedAt, deliveredAt: o.deliveredAt, stage, label, progress, location: [e.empresas.fornecedora.city, e.empresas.fornecedora.country].filter(Boolean).join(', ') }; });
  const n = (s) => itens.filter((i) => i.stage === s).length;
  return { kpis: { emTransito: n('EM_TRANSITO'), emPreparacao: n('EM_PREPARACAO'), entregues: n('ENTREGUE'), canceladas: n('CANCELADA') }, items: itens };
}

function rececoesDoComprador(e) {
  const itens = [];
  for (const o of e.ordens.filter((x) => ['ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA'].includes(x.status))) for (const l of o.items) itens.push({ id: `${o.id}:${l.id}`, poId: o.id, reference: o.reference, supplier: resumoParte(e.empresas.fornecedora), item: l.product?.name ?? null, sku: null, quantity: l.quantity, receivedAt: o.receivedAt, status: o.status === 'ENTREGUE' ? 'A_RECEBER' : (o.status === 'RECEBIDA_COM_DIVERGENCIA' ? 'DIVERGENCIA' : 'RECEBIDO'), receptionStatus: o.receptionStatus });
  const n = (s) => itens.filter((i) => i.status === s).length;
  return { kpis: { aReceber: n('A_RECEBER'), recebidos: n('RECEBIDO'), divergencia: n('DIVERGENCIA'), total: itens.length }, items: itens };
}

const eFornecedoraDa = (u, o, e) => u.companyId === e.empresas.fornecedora.id && o.supplierCompanyId === u.companyId;

// Transições da ordem, com as mesmas mensagens e estados de origem do backend (docs/api/09-fluxos-de-negocio.md).
const TRANSICOES = {
  approve: { roles: ['COMPANY_ADMIN'], de: ['AGUARDANDO_APROVACAO'], verbo: 'aprovada' },
  reject: { roles: ['COMPANY_ADMIN'], de: ['AGUARDANDO_APROVACAO'], verbo: 'rejeitada' },
  accept: { roles: ['FORNECEDOR', 'COMPANY_ADMIN'], de: ['APROVADA'], verbo: 'aceite' },
  refuse: { roles: ['FORNECEDOR', 'COMPANY_ADMIN'], de: ['APROVADA'], verbo: 'recusada' },
  dispatch: { roles: ['FORNECEDOR', 'COMPANY_ADMIN'], de: ['PAGA', 'EM_EXECUCAO'], verbo: 'despachada' },
  delivered: { roles: ['FORNECEDOR', 'COMPANY_ADMIN'], de: ['EM_EXECUCAO'], verbo: 'marcada como entregue' },
  reception: { roles: ['COMPRADOR', 'COMPANY_ADMIN'], de: ['ENTREGUE', 'EM_EXECUCAO'], verbo: 'ter receção confirmada' },
  'resolve-divergence': { roles: ['COMPRADOR', 'COMPANY_ADMIN'], de: ['RECEBIDA_COM_DIVERGENCIA'], verbo: 'ter a divergência resolvida' },
};

const erro = (status, code, message, details) => ({ status, corpo: { error: { code, message, ...(details ? { details } : {}) } } });
const proibido = (roles) => erro(403, 'FORBIDDEN', `Esta ação requer um dos seguintes perfis: ${roles.join(', ')}.`);
const ACAO_AUDITORIA = { PO_APPROVE: 'PO_APROVADA', PO_REJECT: 'PO_REJEITADA', PO_ACCEPT: 'PO_ACEITE', PO_REFUSE: 'PO_RECUSADA_FORNECEDOR', PO_DISPATCH: 'PO_DESPACHADA', PO_DELIVERED: 'PO_ENTREGUE', PO_RECEPTION: 'PO_RECEPCAO_REGISTADA', PO_RESOLVE_DIVERGENCE: 'PO_DIVERGENCIA_RESOLVIDA' };
// Cada ação fica no histórico da ordem e no registo de auditoria do admin do sistema (como no backend).
const registar = (e, id, action, u) => {
  const l = e.historico.get(id) || []; l.unshift({ id: uuid(), action, createdAt: agora(), actorName: u.name, actorRole: u.role }); e.historico.set(id, l);
  const o = e.ordens.find((x) => x.id === id);
  e.auditoria.unshift({ id: uuid(), action: ACAO_AUDITORIA[action] || action, entityType: 'PurchaseOrder', entityId: id, entityRef: o?.reference ?? null, actorId: u.id, actorName: u.name, actorRole: u.role, companyId: u.companyId, ip: null, detail: {}, createdAt: agora() });
};

function transitar(e, u, id, nome, corpo) {
  const t = TRANSICOES[nome]; const o = e.ordens.find((x) => x.id === id);
  if (!t) return erro(404, 'ROUTE_NOT_FOUND', `Rota não encontrada: ${nome}`);
  if (!t.roles.includes(u.role)) return proibido(t.roles);
  if (!o) return erro(404, 'NOT_FOUND', 'Ordem de compra não encontrado.');
  if (!t.de.includes(o.status)) return erro(409, 'CONFLICT', `PO no estado "${o.status}" não pode ser ${t.verbo}.`);
  if (nome === 'dispatch' && o.status === 'EM_EXECUCAO' && !o.isCallOff) return erro(409, 'CONFLICT', `PO no estado "${o.status}" não pode ser ${t.verbo}.`);
  if (nome === 'refuse' && !String(corpo?.reason || '').trim()) return erro(422, 'VALIDATION_ERROR', 'Dados inválidos.', { formErrors: [], fieldErrors: { reason: ['Required'] } });
  if (nome === 'resolve-divergence' && !['ACEITE', 'REPOSICAO'].includes(corpo?.outcome)) return erro(422, 'BUSINESS_RULE_VIOLATION', 'Desfecho inválido — use ACEITE ou REPOSICAO.');
  const t0 = agora();
  if (nome === 'approve') Object.assign(o, { status: 'APROVADA', approvedAt: t0, approvedById: u.id });
  if (nome === 'reject') Object.assign(o, { status: 'REJEITADA', rejectedAt: t0, rejectionReason: String(corpo?.reason || '').trim() || null });
  if (nome === 'refuse') Object.assign(o, { status: 'RECUSADA_FORNECEDOR', refusedAt: t0, refusalReason: String(corpo.reason).trim() });
  if (nome === 'accept') {
    Object.assign(o, { status: o.isCallOff ? 'EM_EXECUCAO' : 'AGUARDANDO_PAGAMENTO', acceptedAt: t0, paymentDueAt: dias(7) });
    const liquido = Number(o.totalAmount); const imposto = Math.round(liquido * 0.14); const retencao = Math.round(liquido * 0.065);
    e.faturas.set(o.id, { id: uuid(), reference: proximaReferencia('FAT', [...e.faturas.values()].map((f) => f.reference)), purchaseOrderId: o.id, amount: moeda(liquido + imposto), netAmount: moeda(liquido), taxAmount: moeda(imposto), withholdingAmount: moeda(retencao), currency: o.currency, status: 'PENDENTE', issuedAt: t0, dueAt: dias(7), serie: null, payment: null });
  }
  if (nome === 'dispatch') Object.assign(o, { status: 'EM_EXECUCAO', dispatchedAt: t0 });
  if (nome === 'delivered') Object.assign(o, { status: 'ENTREGUE', deliveredAt: t0 });
  if (nome === 'reception') Object.assign(o, corpo?.conforme ? { status: 'RECEBIDA_CONFORME', receptionStatus: 'Conforme', receivedAt: t0 } : { status: 'RECEBIDA_COM_DIVERGENCIA', receptionStatus: 'Com Divergência', receivedAt: t0 });
  if (nome === 'resolve-divergence') Object.assign(o, { status: corpo.outcome === 'ACEITE' ? 'CONCLUIDA' : 'EM_EXECUCAO', divergenceResolution: corpo.outcome, divergenceResolutionNotes: corpo.notes || null, divergenceResolvedAt: t0 });
  o.updatedAt = t0;
  registar(e, o.id, `PO_${nome.toUpperCase().replaceAll('-', '_')}`, u);
  return { corpo: clone(o) };
}

function criarOrdem(e, u, corpo) {
  if (!['COMPRADOR', 'COMPANY_ADMIN'].includes(u.role)) return proibido(['COMPRADOR', 'COMPANY_ADMIN']);
  if (!Array.isArray(corpo?.items) || !corpo.items.length) return erro(422, 'VALIDATION_ERROR', 'Dados inválidos.', { formErrors: [], fieldErrors: { items: ['Array must contain at least 1 element(s)'] } });
  const linhas = [];
  for (const it of corpo.items) {
    const p = e.catalogo.find((x) => x.id === it.productId && x.supplierId === corpo.supplierCompanyId && x.active);
    if (!p) return erro(404, 'NOT_FOUND', 'Produto não encontrado.');
    if (!Number.isInteger(it.quantity) || it.quantity < 1) return erro(422, 'VALIDATION_ERROR', 'Dados inválidos.', { formErrors: [], fieldErrors: { items: ['Number must be greater than 0'] } });
    if (p.unitPrice == null) return erro(409, 'CONFLICT', 'Este item não tem preço público: peça uma cotação.');
    const preco = Number(p.promoPrice ?? p.unitPrice);
    linhas.push({ id: uuid(), productId: p.id, quantity: it.quantity, unitPrice: moeda(preco), lineTotal: moeda(preco * it.quantity), product: produtoResumo(e.catalogo, p.id) });
  }
  const id = uuid(); const t0 = agora();
  const o = { id, reference: proximaReferencia('PO', e.ordens.map((x) => x.reference)), buyerCompanyId: u.companyId, supplierCompanyId: corpo.supplierCompanyId, createdById: u.id, approvedById: null, status: 'AGUARDANDO_APROVACAO', totalAmount: moeda(linhas.reduce((s, l) => s + Number(l.lineTotal), 0)), netAmount: null, taxAmount: null, withholdingAmount: null, currency: 'AOA', isCallOff: false, contractId: null, consolidatedInvoiceId: null, erpManaged: false, acceptedAt: null, paymentDueAt: null, paidAt: null, dispatchedAt: null, deliveredAt: null, receivedAt: null, receptionStatus: null, divergenceResolution: null, divergenceResolutionNotes: null, divergenceResolvedAt: null, approvedAt: null, rejectedAt: null, rejectionReason: null, refusedAt: null, refusalReason: null, createdBySource: 'HUMANO', createdAt: t0, updatedAt: t0, items: linhas };
  e.ordens.unshift(o); registar(e, id, 'PO_CRIADA', u);
  return { status: 201, corpo: clone(o) };
}

function pagarFatura(e, u, idFatura, bruto, tipo) {
  if (!['FINANCEIRO', 'COMPANY_ADMIN'].includes(u.role)) return proibido(['FINANCEIRO', 'COMPANY_ADMIN']);
  const f = [...e.faturas.values()].find((x) => x.id === idFatura);
  if (!f) return erro(404, 'NOT_FOUND', 'Fatura não encontrado.');
  const nome = /name="proof"; filename="([^"]+)"/.exec(bruto)?.[1];
  if (!/multipart\/form-data/.test(tipo || '') || !nome) return erro(422, 'VALIDATION_ERROR', 'Anexe o comprovativo da transferência (PDF ou imagem) para confirmar o pagamento.');
  if (f.status === 'PAGA') return erro(409, 'CONFLICT', 'Esta fatura já está paga.');
  const t0 = agora();
  const p = { id: uuid(), invoiceId: f.id, amount: f.amount, currency: f.currency, status: 'PROCESSADO', canal: 'TRANSFERENCIA_MANUAL', processedById: u.id, reference: `PAG-${f.reference}`, proofUrl: null, proofName: nome, receivedAt: null, receivedById: null, processedAt: t0 };
  f.status = 'PAGA'; f.payment = p; e.pagamentos.unshift(p);
  const o = e.ordens.find((x) => x.id === f.purchaseOrderId); if (o) { o.status = 'PAGA'; o.paidAt = t0; }
  registar(e, f.purchaseOrderId, 'PAGAMENTO_PROCESSADO', u);
  return { status: 201, corpo: clone(p) };
}

// ---------------------------------------------------------------------------------------------------------------- servidor
const JSON_H = { 'Content-Type': 'application/json; charset=utf-8' };

export function criarServidor({ senha = process.env.DEMO_SENHA } = {}) {
  if (!senha) throw new Error('Defina DEMO_SENHA: a palavra-passe de demonstração não tem valor por omissão.');
  const e = criarEstado();
  const sessoes = new Map();
  const stats = lerFixture('publico-stats'); const feedback = lerFixture('publico-feedback'); const planos = lerFixture('planos');
  const fixo = (nome) => () => ({ corpo: clone(lerFixture(nome)) });

  // [método, expressão, papéis permitidos (null = qualquer um com sessão; 'publico' = sem sessão), tratador({u, m, q, corpo, bruto, tipo})]
  const rotas = [];
  const rota = (metodo, regex, papeis, fn) => rotas.push({ metodo, regex, papeis, fn });
  const TODOS = null; const PUB = 'publico';
  const SO = (...r) => r;

  // público
  rota('GET', /^\/(health|ready)$/, PUB, () => ({ corpo: { status: 'ok', ambiente: 'teste-isolado' } }));
  rota('GET', /^\/api\/public\/stats$/, PUB, () => ({ corpo: clone(stats) }));
  rota('GET', /^\/api\/public\/feedback$/, PUB, () => ({ corpo: clone(feedback) }));
  rota('GET', /^\/api\/planos$/, PUB, () => ({ corpo: clone(planos) }));
  rota('GET', /^\/api\/public\/catalog\/search$/, PUB, ({ q }) => pesquisaPublica(e, q));
  rota('GET', /^\/api\/public\/catalog\/facets$/, PUB, ({ q }) => facetasPublicas(e, q));
  rota('GET', /^\/api\/public\/catalog\/suppliers$/, PUB, ({ q }) => {
    const n = q.get('limit'); if (n !== null && !(Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= 24)) return erroValidacao({ limit: ['Expected integer between 1 and 24'] });
    return { corpo: fornecedorasPublicas(e, Number(n || 8)) };
  });
  rota('GET', /^\/api\/public\/catalog\/products\/([^/]+)$/, PUB, ({ m }) => {
    const p = visiveis(e).find((x) => x.slug === decodeURIComponent(m[1])); if (!p) return erro(404, 'NOT_FOUND', 'Produto não encontrado.');
    return { corpo: { ...vistaPublica(p), images: p.imageUrl ? [{ id: `img-${p.id}`, url: p.imageUrl, isPrimary: true, sortOrder: 0 }] : [], documents: [] } };
  });
  rota('GET', /^\/api\/public\/catalog\/products\/([^/]+)\/reviews$/, PUB, ({ m }) => (visiveis(e).some((x) => x.slug === decodeURIComponent(m[1])) ? { corpo: [] } : erro(404, 'NOT_FOUND', 'Produto não encontrado.')));

  // autenticação
  rota('POST', /^\/api\/auth\/login$/, PUB, ({ corpo, resp }) => {
    const u = e.utilizadores.find((x) => x.email === String(corpo?.email || '').trim().toLowerCase() && x.active);
    const a = Buffer.from(String(corpo?.password ?? '')); const b = Buffer.from(senha);
    if (!u || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return erro(401, 'UNAUTHORIZED', 'Credenciais inválidas.');
    const token = crypto.randomBytes(24).toString('hex'); sessoes.set(token, u.id);
    resp.setCookie = `kixima_sessao=${token}; Max-Age=86400; Path=/; HttpOnly; SameSite=Lax`;
    return { corpo: { mfaPendente: false, mfaRestrita: false, mfaPrazo: null, user: utilizadorPublico(u) } };
  });
  rota('GET', /^\/api\/auth\/me$/, TODOS, ({ u }) => ({ corpo: { user: { ...utilizadorPublico(u), mfaPendente: false, mfaRestrita: false, mfaPrazo: null } } }));
  rota('POST', /^\/api\/auth\/logout$/, PUB, ({ resp, cookieToken }) => { sessoes.delete(cookieToken); resp.setCookie = 'kixima_sessao=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax'; return { corpo: { ok: true } }; });
  rota('POST', /^\/api\/auth\/forgot-password$/, PUB, () => ({ corpo: { ok: true } }));
  rota('POST', /^\/api\/auth\/reset-password$/, PUB, () => erro(400, 'BAD_REQUEST', 'Este link já não é válido (ambiente de teste isolado: não há emails).'));
  rota('GET', /^\/api\/companies\/invite\/([^/]+)$/, PUB, () => erro(404, 'NOT_FOUND', 'Este convite já não é válido (ambiente de teste isolado: não há emails).'));
  rota('POST', /^\/api\/companies\/invite\/([^/]+)\/accept$/, PUB, () => erro(404, 'NOT_FOUND', 'Este convite já não é válido (ambiente de teste isolado: não há emails).'));
  rota('POST', /^\/api\/companies\/register$/, PUB, ({ bruto }) => {
    const nome = /name="name"\r?\n\r?\n([^\r\n]+)/.exec(bruto)?.[1] || 'Empresa registada em teste'; const tipo = /name="type"\r?\n\r?\n([^\r\n]+)/.exec(bruto)?.[1] || 'CLIENTE';
    e.empresasPlataforma.push({ id: uuid(), name: nome, taxId: /name="taxId"\r?\n\r?\n([^\r\n]+)/.exec(bruto)?.[1] ?? null, type: tipo, status: 'PENDENTE', contactEmail: null, city: null, country: 'Angola', verified: false, plan: 'BASICO', createdAt: agora(), approvedAt: null, rejectedAt: null });
    return { status: 201, corpo: { id: uuid(), status: 'PENDENTE' } };
  });

  // ordens e contratos
  rota('GET', /^\/api\/purchase-orders$/, TODOS, () => ({ corpo: clone(e.ordens) }));
  rota('POST', /^\/api\/purchase-orders$/, SO('COMPRADOR', 'COMPANY_ADMIN'), ({ u, corpo }) => criarOrdem(e, u, corpo));
  rota('GET', /^\/api\/purchase-orders\/([^/]+)$/, TODOS, ({ m }) => { const o = e.ordens.find((x) => x.id === m[1]); return o ? { corpo: detalheDaOrdem(e, o) } : erro(404, 'NOT_FOUND', 'Ordem de compra não encontrado.'); });
  rota('GET', /^\/api\/purchase-orders\/([^/]+)\/history$/, TODOS, ({ m }) => ({ corpo: e.historico.get(m[1]) || [] }));
  rota('PATCH', /^\/api\/purchase-orders\/([^/]+)\/(approve|reject|accept|refuse|dispatch|delivered|reception|resolve-divergence)$/, TODOS, ({ u, m, corpo }) => transitar(e, u, m[1], m[2], corpo));
  rota('GET', /^\/api\/contracts$/, TODOS, () => ({ corpo: clone(e.contratos) }));
  rota('GET', /^\/api\/contracts\/([^/]+)$/, TODOS, ({ m }) => { const c = e.contratos.find((x) => x.id === m[1]); return c ? { corpo: clone(c) } : erro(404, 'NOT_FOUND', 'Contrato não encontrado.'); });

  // comprador
  const C = SO('COMPRADOR', 'COMPANY_ADMIN');
  rota('GET', /^\/api\/dashboard\/comprador$/, SO('COMPRADOR'), fixo('comprador-dashboard'));
  rota('GET', /^\/api\/buyer\/orders$/, C, ({ q }) => ({ corpo: ordensDoComprador(e, q) }));
  rota('GET', /^\/api\/buyer\/payments$/, C, () => ({ corpo: pagamentosDoComprador(e) }));
  rota('GET', /^\/api\/buyer\/deliveries$/, C, () => ({ corpo: entregasDoComprador(e) }));
  rota('GET', /^\/api\/buyer\/receptions$/, C, () => ({ corpo: rececoesDoComprador(e) }));
  rota('GET', /^\/api\/buyer\/suppliers$/, C, fixo('comprador-fornecedores'));
  rota('GET', /^\/api\/buyer\/activities$/, C, fixo('comprador-atividades'));
  rota('GET', /^\/api\/buyer\/profile$/, C, fixo('comprador-perfil'));

  // cotações
  rota('GET', /^\/api\/quotes$/, TODOS, ({ q }) => ({ corpo: clone(e.cotacoes).filter((c) => !q.get('status') || c.status === q.get('status')) }));
  rota('POST', /^\/api\/quotes$/, SO('COMPRADOR'), ({ u, corpo }) => {
    const itens = [];
    for (const it of corpo?.items || []) { const p = e.catalogo.find((x) => x.id === it.productId && x.supplierId === corpo.supplierCompanyId && x.active); if (!p) return erro(404, 'NOT_FOUND', 'Produto não encontrado.'); itens.push({ id: uuid(), productId: p.id, quantity: it.quantity, product: { id: p.id, name: p.name, unitPrice: p.unitPrice, currency: p.currency } }); }
    if (!itens.length || itens.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) return erro(422, 'VALIDATION_ERROR', 'Dados inválidos.', { formErrors: [], fieldErrors: { items: ['Expected positive quantity'] } });
    const c = { id: uuid(), status: 'ABERTA', note: corpo.note || null, responsePrice: null, responseLeadDays: null, responseNote: null, respondedAt: null, createdAt: agora(), items: itens, buyerCompany: { id: e.empresas.comprador.id, name: e.empresas.comprador.name }, supplierCompany: { id: e.empresas.fornecedora.id, name: e.empresas.fornecedora.name } };
    e.cotacoes.unshift(c); return { status: 201, corpo: clone(c) };
  });
  rota('PATCH', /^\/api\/quotes\/([^/]+)\/close$/, SO('COMPRADOR'), ({ m }) => { const c = e.cotacoes.find((x) => x.id === m[1]); if (!c) return erro(404, 'NOT_FOUND', 'Cotação não encontrado.'); c.status = 'FECHADA'; return { corpo: clone(c) }; });
  rota('PATCH', /^\/api\/quotes\/([^/]+)\/respond$/, SO('FORNECEDOR', 'COMPANY_ADMIN'), ({ m, corpo }) => {
    const c = e.cotacoes.find((x) => x.id === m[1]); if (!c) return erro(404, 'NOT_FOUND', 'Cotação não encontrado.');
    if (!(Number(corpo?.price) > 0)) return erro(422, 'VALIDATION_ERROR', 'Dados inválidos.', { formErrors: [], fieldErrors: { price: ['Number must be greater than 0'] } });
    if (c.status !== 'ABERTA') return erro(409, 'CONFLICT', `Cotação no estado "${c.status}" não pode receber resposta.`);
    Object.assign(c, { status: 'RESPONDIDA', responsePrice: String(corpo.price), responseLeadDays: corpo.leadDays ?? null, responseNote: corpo.note ?? null, respondedAt: agora() }); return { corpo: clone(c) };
  });

  // administrador da empresa
  const A = SO('COMPANY_ADMIN');
  rota('GET', /^\/api\/company-admin\/dashboard$/, A, () => { const d = lerFixture('empresa-dashboard'); const abertas = e.ordens.filter((o) => POR_ESTADO_ABERTO.includes(o.status)).length; Object.assign(d.kpis, { aprovarPO: e.ordens.filter((o) => o.status === 'AGUARDANDO_APROVACAO').length, pedidos: e.ordens.length, emExecucao: e.ordens.filter((o) => o.status === 'EM_EXECUCAO').length }); d.resumo.concluidas = e.ordens.filter((o) => ['RECEBIDA_CONFORME', 'CONCLUIDA'].includes(o.status)).length; void abertas; return { corpo: d }; });
  rota('GET', /^\/api\/company-admin\/organizacao$/, A, fixo('empresa-organizacao'));
  rota('GET', /^\/api\/company-admin\/activities$/, A, fixo('empresa-atividades'));
  rota('GET', /^\/api\/company-admin\/reports$/, A, fixo('empresa-relatorios'));
  rota('GET', /^\/api\/company-admin\/settings$/, A, () => ({ corpo: clone(e.definicoes) }));
  rota('PUT', /^\/api\/company-admin\/settings$/, A, ({ corpo }) => { for (const k of Object.keys(e.definicoes)) if (typeof corpo?.[k] === 'boolean') e.definicoes[k] = corpo[k]; return { corpo: clone(e.definicoes) }; });
  rota('GET', /^\/api\/companies\/users$/, A, ({ u }) => ({ corpo: e.utilizadores.filter((x) => x.companyId === u.companyId).map((x) => ({ id: x.id, name: x.name, email: x.email, role: x.role, active: x.active, createdAt: x.createdAt })) }));
  rota('PATCH', /^\/api\/companies\/users\/([^/]+)\/status$/, A, ({ u, m, corpo }) => { const x = e.utilizadores.find((y) => y.id === m[1] && y.companyId === u.companyId); if (!x) return erro(404, 'NOT_FOUND', 'Utilizador não encontrado.'); if (x.id === u.id) return erro(409, 'CONFLICT', 'Não pode desativar a própria conta.'); x.active = Boolean(corpo?.active); return { corpo: { ok: true } }; });
  rota('GET', /^\/api\/companies\/invites$/, A, () => ({ corpo: clone(e.convites) }));
  rota('POST', /^\/api\/companies\/invites$/, A, ({ corpo }) => {
    if (!['COMPRADOR', 'FORNECEDOR', 'FINANCEIRO'].includes(corpo?.role)) return erro(422, 'VALIDATION_ERROR', 'Dados inválidos.', { formErrors: [], fieldErrors: { role: ["Invalid enum value. Expected 'COMPRADOR' | 'FORNECEDOR' | 'FINANCEIRO'"] } });
    const c = { id: uuid(), email: corpo.email, name: corpo.name ?? null, role: corpo.role, status: 'PENDENTE', createdAt: agora(), expiresAt: dias(7) }; e.convites.push(c); return { status: 201, corpo: clone(c) };
  });
  rota('POST', /^\/api\/companies\/invites\/([^/]+)\/resend$/, A, ({ m }) => { const c = e.convites.find((x) => x.id === m[1]); if (!c) return erro(404, 'NOT_FOUND', 'Convite não encontrado.'); c.expiresAt = dias(7); return { corpo: { ok: true } }; });
  rota('POST', /^\/api\/companies\/invites\/([^/]+)\/cancel$/, A, ({ m }) => { e.convites = e.convites.filter((x) => x.id !== m[1]); return { corpo: { ok: true } }; });

  // financeiro
  const F = SO('FINANCEIRO', 'COMPANY_ADMIN');
  rota('GET', /^\/api\/payments\/invoices\/pending$/, F, () => ({ corpo: [...e.faturas.values()].filter((f) => f.status === 'PENDENTE').map((f) => ({ ...clone(f), purchaseOrder: { id: f.purchaseOrderId, reference: e.ordens.find((o) => o.id === f.purchaseOrderId)?.reference } })) }));
  rota('GET', /^\/api\/payments\/history$/, F, () => ({ corpo: e.pagamentos.map((p) => ({ ...clone(p), invoice: { reference: [...e.faturas.values()].find((f) => f.id === p.invoiceId)?.reference } })) }));
  rota('POST', /^\/api\/payments\/invoices\/([^/]+)\/pay$/, SO('FINANCEIRO', 'COMPANY_ADMIN'), ({ u, m, bruto, tipo }) => pagarFatura(e, u, m[1], bruto, tipo));
  rota('PATCH', /^\/api\/payments\/([^/]+)\/confirm-received$/, SO('FORNECEDOR', 'COMPANY_ADMIN', 'FINANCEIRO'), ({ u, m }) => { const p = e.pagamentos.find((x) => x.id === m[1]); if (!p) return erro(404, 'NOT_FOUND', 'Pagamento não encontrado.'); p.receivedAt = agora(); p.receivedById = u.id; return { corpo: clone(p) }; });
  rota('GET', /^\/api\/financeiro\/overview$/, F, () => {
    const linhas = [...e.faturas.values()].map((f) => linhaFinanceira(e, f)); const pend = linhas.filter((l) => l.status === 'PENDENTE'); const ate7 = Date.now() + 7 * 86400000;
    const d = lerFixture('financeiro-overview'); d.kpis = { pagamentosPendentes: pend.reduce((s, l) => s + l.amount, 0), pagamentosPendentesCount: pend.length, faturasRecebidas: linhas.length, pagosMes: linhas.filter((l) => l.status === 'PAGA').reduce((s, l) => s + l.amount, 0), aprovacoesPendentes: e.ordens.filter((o) => o.status === 'AGUARDANDO_APROVACAO').length, aVencer7: pend.filter((l) => new Date(l.dueAt).getTime() <= ate7).length }; d.pendentes = pend; return { corpo: d };
  });
  rota('GET', /^\/api\/financeiro\/invoices$/, F, () => { const linhas = [...e.faturas.values()].map((f) => linhaFinanceira(e, f)); const pend = linhas.filter((l) => l.status === 'PENDENTE'); const ate7 = Date.now() + 7 * 86400000; return { corpo: { kpis: { pendentes: pend.length, valorPendente: pend.reduce((s, l) => s + l.amount, 0), aVencer7: pend.filter((l) => new Date(l.dueAt).getTime() <= ate7).length, vencidas: linhas.filter((l) => l.status === 'VENCIDA').length, aprovadasMes: linhas.filter((l) => l.status === 'PAGA').length }, items: pend } }; });
  rota('GET', /^\/api\/financeiro\/payments$/, F, () => { const linhas = [...e.faturas.values()].map((f) => linhaFinanceira(e, f)); return { corpo: { kpis: { aPagar: linhas.filter((l) => l.status === 'PENDENTE').reduce((s, l) => s + l.amount, 0), pagosMes: linhas.filter((l) => l.status === 'PAGA').reduce((s, l) => s + l.amount, 0), vencidos: linhas.filter((l) => l.status === 'VENCIDA').length, total: linhas.length }, items: linhas } }; });

  // fornecedora
  const FO = SO('FORNECEDOR', 'COMPANY_ADMIN');
  rota('GET', /^\/api\/catalog$/, TODOS, ({ q }) => ({ corpo: clone(e.catalogo).filter((p) => !q.get('supplierId') || p.supplierId === q.get('supplierId')) }));
  rota('POST', /^\/api\/catalog$/, FO, ({ u, corpo }) => {
    const campos = {}; if (String(corpo?.name || '').trim().length < 2) campos.name = ['String must contain at least 2 character(s)']; if (!String(corpo?.category || '').trim()) campos.category = ['Required']; if (corpo?.unitPrice == null || !(Number(corpo.unitPrice) >= 0)) campos.unitPrice = ['Required'];
    if (Object.keys(campos).length) return erro(422, 'VALIDATION_ERROR', 'Dados inválidos.', { formErrors: [], fieldErrors: campos });
    const base = e.catalogo[0]; const t0 = agora(); const slug = `${normalizar(corpo.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${e.catalogo.length + 1}`;
    const p = { ...Object.fromEntries(Object.keys(base).map((k) => [k, null])), id: uuid(), supplierId: u.companyId, supplier: clone(base.supplier), name: corpo.name.trim(), category: corpo.category.trim(), kind: corpo.kind === 'SERVICO' ? 'SERVICO' : 'PRODUTO', description: corpo.description ?? null, unitPrice: String(corpo.unitPrice), currency: 'AOA', stockQuantity: corpo.stockQuantity ?? null, leadTimeDays: corpo.leadTimeDays ?? null, active: true, slug, certifications: [], tags: [], rating: 0, reviewCount: 0, viewCount: 0, imageUrl: null, createdAt: t0, updatedAt: t0 };
    e.catalogo.unshift(p); return { status: 201, corpo: clone(p) };
  });
  rota('PUT', /^\/api\/catalog\/([^/]+)$/, FO, ({ u, m, corpo }) => { const p = e.catalogo.find((x) => x.id === m[1]); if (!p || p.supplierId !== u.companyId) return erro(404, 'NOT_FOUND', 'Produto não encontrado.'); for (const k of ['name', 'category', 'kind', 'description', 'stockQuantity', 'leadTimeDays']) if (k in (corpo || {})) p[k] = corpo[k]; if (corpo?.unitPrice != null) p.unitPrice = String(corpo.unitPrice); p.updatedAt = agora(); return { corpo: clone(p) }; });
  rota('DELETE', /^\/api\/catalog\/([^/]+)$/, FO, ({ u, m }) => { const p = e.catalogo.find((x) => x.id === m[1]); if (!p || p.supplierId !== u.companyId) return erro(404, 'NOT_FOUND', 'Produto não encontrado.'); p.active = false; return { corpo: clone(p) }; });
  rota('PATCH', /^\/api\/catalog\/([^/]+)\/stock$/, FO, ({ u, m, corpo }) => { const p = e.catalogo.find((x) => x.id === m[1]); if (!p || p.supplierId !== u.companyId) return erro(404, 'NOT_FOUND', 'Produto não encontrado.'); for (const k of ['stockQuantity', 'minStock', 'warehouse', 'availability']) if (corpo?.[k] != null) p[k] = corpo[k]; return { corpo: clone(p) }; });
  rota('GET', /^\/api\/catalog\/movements$/, FO, fixo('fornecedor-movimentos'));
  rota('GET', /^\/api\/catalog\/documents$/, FO, fixo('fornecedor-documentos'));
  rota('GET', /^\/api\/reports\/fornecedor$/, FO, fixo('fornecedor-relatorio'));

  // admin do sistema
  const S = SO('ADMIN_SISTEMA');
  rota('GET', /^\/api\/companies$/, S, () => ({ corpo: clone(e.empresasPlataforma) }));
  rota('PATCH', /^\/api\/companies\/([^/]+)\/decision$/, S, ({ m, corpo }) => {
    const c = e.empresasPlataforma.find((x) => x.id === m[1]); if (!c) return erro(404, 'NOT_FOUND', 'Empresa não encontrado.'); if (c.status !== 'PENDENTE') return erro(409, 'CONFLICT', `Empresa no estado "${c.status}" não pode ser decidida.`);
    if (corpo?.approve) Object.assign(c, { status: 'APROVADA', approvedAt: agora() }); else Object.assign(c, { status: 'REJEITADA', rejectedAt: agora() }); return { corpo: clone(c) };
  });
  rota('GET', /^\/api\/admin\/users$/, S, () => ({ corpo: e.utilizadores.map((x) => ({ id: x.id, name: x.name, email: x.email, role: x.role, active: x.active, companyName: x.companyName, createdAt: x.createdAt, adminAreas: [] })) }));
  rota('PATCH', /^\/api\/admin\/users\/([^/]+)\/status$/, S, ({ u, m, corpo }) => { const x = e.utilizadores.find((y) => y.id === m[1]); if (!x) return erro(404, 'NOT_FOUND', 'Utilizador não encontrado.'); if (x.id === u.id) return erro(409, 'CONFLICT', 'Não pode desativar a própria conta.'); x.active = Boolean(corpo?.active); return { corpo: { ok: true } }; });
  rota('GET', /^\/api\/admin\/activities$/, S, () => { const d = lerFixture('sistema-atividade'); d.items = d.items.filter((i) => !eLixoDeEnsaio({ name: `${i.title} ${i.detail}` })); d.kpis.empresas = e.empresasPlataforma.length; d.kpis.utilizadores = e.utilizadores.length; return { corpo: d }; });
  rota('GET', /^\/api\/admin\/audit-logs$/, S, ({ q }) => {
    const acao = q.get('action'); const limite = Number(q.get('limit') || 25); const pagina = Math.max(1, Number(q.get('page') || 1));
    const filtrados = e.auditoria.filter((i) => !acao || i.action === acao);
    const acoes = [...contar(e.auditoria, (i) => i.action)].map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
    return { corpo: { items: filtrados.slice((pagina - 1) * limite, pagina * limite), total: filtrados.length, page: pagina, pages: Math.max(1, Math.ceil(filtrados.length / limite)), actions: acoes } };
  });
  rota('GET', /^\/api\/admin\/platform-fees$/, S, fixo('sistema-taxas'));
  rota('GET', /^\/api\/admin\/prontidao$/, S, () => ({ corpo: clone(e.prontidao) }));

  const utilizadorPublico = (x) => ({ id: x.id, name: x.name, email: x.email, role: x.role, adminAreas: [], companyId: x.companyId, companyName: x.companyName, companyType: x.companyType, companyPlan: x.companyPlan, avatarUrl: null });

  const servidor = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'); const resp = {};
    const cookieToken = /(?:^|;\s*)kixima_sessao=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    const partes = []; for await (const c of req) partes.push(c);
    const bruto = Buffer.concat(partes).toString('latin1'); const tipo = req.headers['content-type'] || '';
    let corpo; if (tipo.includes('application/json') && bruto) { try { corpo = JSON.parse(Buffer.from(bruto, 'latin1').toString('utf8')); } catch { corpo = undefined; } }
    const responder = (r) => { const status = r.status || 200; res.writeHead(status, { ...JSON_H, ...(resp.setCookie ? { 'Set-Cookie': resp.setCookie } : {}), 'Cache-Control': 'no-store' }); res.end(JSON.stringify(r.corpo ?? r)); };
    try {
      if (!tipo.includes('multipart') && !tipo.includes('json') && bruto && req.method !== 'GET') return responder(erro(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type não suportado.'));
      for (const r of rotas) {
        if (r.metodo !== req.method) continue; const m = r.regex.exec(url.pathname); if (!m) continue;
        const u = e.utilizadores.find((x) => x.id === sessoes.get(cookieToken) && x.active);
        if (r.papeis !== PUB) {
          if (!u) return responder(erro(401, 'UNAUTHORIZED', 'Sessão em falta ou expirada. Inicie sessão.'));
          if (r.papeis && !r.papeis.includes(u.role)) return responder(proibido(r.papeis));
        }
        return responder(r.fn({ u, m, q: url.searchParams, corpo, bruto, tipo, resp, cookieToken }) || { corpo: {} });
      }
      // Como no backend, um caminho /api protegido sem sessão dá 401 (e não revela se existe); com sessão, o que não está simulado dá 404 claro.
      const quem = e.utilizadores.find((x) => x.id === sessoes.get(cookieToken) && x.active);
      if (url.pathname.startsWith('/api/') && !quem) return responder(erro(401, 'UNAUTHORIZED', 'Sessão em falta ou expirada. Inicie sessão.'));
      return responder(erro(404, 'NAO_SIMULADO', 'Este endpoint não está simulado no ambiente de teste isolado.'));
    } catch (err) { return responder(erro(500, 'ERRO_NO_SIMULADOR', `Falha no simulador: ${err.message}`)); }
  });
  servidor.estado = e;
  return servidor;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const porta = Number(process.env.SIMULADOR_PORT || 4100); const anfitriao = process.env.SIMULADOR_HOST || '127.0.0.1';
  criarServidor().listen(porta, anfitriao, () => console.log(`API simulada (teste isolado) em http://${anfitriao}:${porta}`));
}
