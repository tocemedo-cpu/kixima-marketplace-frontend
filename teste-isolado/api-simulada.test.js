// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarServidor } from './api-simulada.mjs';

const SENHA = 'senha-de-teste-do-simulador';
let servidor; let base;
beforeAll(async () => { servidor = criarServidor({ senha: SENHA }); await new Promise((r) => servidor.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${servidor.address().port}`; });
afterAll(() => new Promise((r) => servidor.close(r)));

const EMAILS = { COMPRADOR: 'comprador@petroangola.co.ao', COMPANY_ADMIN: 'admin@petroangola.co.ao', FORNECEDOR: 'fornecedor@kianda.co.ao', FINANCEIRO: 'financeiro@petroangola.co.ao', ADMIN_SISTEMA: 'admin@kixima.co.ao' };
const chamar = async (cookie, metodo, caminho, corpo, extra = {}) => {
  const r = await fetch(base + caminho, { method: metodo, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(corpo !== undefined && !(corpo instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, body: corpo === undefined ? undefined : (corpo instanceof FormData ? corpo : JSON.stringify(corpo)), ...extra });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, corpo: j, cookie: r.headers.getSetCookie?.()[0] };
};
const entrar = async (papel) => { const r = await chamar(null, 'POST', '/api/auth/login', { email: EMAILS[papel], password: SENHA }); expect(r.status).toBe(200); return r.cookie.split(';')[0]; };

describe('arranque e autenticação', () => {
  it('recusa arrancar sem palavra-passe de demonstração (não há valor por omissão)', () => {
    const antes = process.env.DEMO_SENHA; delete process.env.DEMO_SENHA;
    expect(() => criarServidor()).toThrow(/DEMO_SENHA/);
    if (antes !== undefined) process.env.DEMO_SENHA = antes;
  });

  it('login certo dá cookie httpOnly + SameSite=Lax; errado dá 401 sem cookie', async () => {
    const ok = await chamar(null, 'POST', '/api/auth/login', { email: EMAILS.COMPRADOR, password: SENHA });
    expect(ok.status).toBe(200); expect(ok.cookie).toMatch(/kixima_sessao=.+; .*HttpOnly; SameSite=Lax/);
    expect(ok.corpo.user).toMatchObject({ role: 'COMPRADOR', email: EMAILS.COMPRADOR });
    const mal = await chamar(null, 'POST', '/api/auth/login', { email: EMAILS.COMPRADOR, password: 'errada' });
    expect(mal.status).toBe(401); expect(mal.cookie).toBeUndefined();
    expect((await chamar(null, 'POST', '/api/auth/login', { email: 'ninguem@x.co', password: SENHA })).status).toBe(401);
  });

  it('sem sessão, o que é protegido dá 401; com sessão, /me devolve a pessoa; terminar sessão invalida o cookie', async () => {
    expect((await chamar(null, 'GET', '/api/auth/me')).status).toBe(401);
    const c = await entrar('FINANCEIRO');
    expect((await chamar(c, 'GET', '/api/auth/me')).corpo.user.role).toBe('FINANCEIRO');
    await chamar(c, 'POST', '/api/auth/logout');
    expect((await chamar(c, 'GET', '/api/auth/me')).status).toBe(401);
  });

  it('nenhum utilizador, empresa ou atividade de ensaio automático («E2E») aparece nos dados de demonstração', async () => {
    const admin = await entrar('ADMIN_SISTEMA');
    for (const caminho of ['/api/admin/users', '/api/companies', '/api/admin/activities']) {
      expect(JSON.stringify((await chamar(admin, 'GET', caminho)).corpo), caminho).not.toMatch(/e2e/i);
    }
  });
});

describe('permissões por papel (mesma mensagem do backend)', () => {
  it.each([
    ['COMPRADOR', '/api/admin/users'], ['COMPRADOR', '/api/financeiro/overview'], ['COMPRADOR', '/api/company-admin/dashboard'],
    ['FORNECEDOR', '/api/buyer/orders'], ['FINANCEIRO', '/api/companies'], ['COMPANY_ADMIN', '/api/admin/audit-logs'],
  ])('%s em %s → 403 com a lista de perfis', async (papel, caminho) => {
    const r = await chamar(await entrar(papel), 'GET', caminho);
    expect(r.status).toBe(403); expect(r.corpo.error).toMatchObject({ code: 'FORBIDDEN' }); expect(r.corpo.error.message).toMatch(/^Esta ação requer um dos seguintes perfis: /);
  });

  it('endpoint não simulado: 404 NAO_SIMULADO com sessão (nunca finge) e 401 sem sessão, como o backend', async () => {
    const r = await chamar(await entrar('COMPRADOR'), 'GET', '/api/algo/que/nao/existe');
    expect(r.status).toBe(404); expect(r.corpo.error.code).toBe('NAO_SIMULADO');
    expect((await chamar(null, 'GET', '/api/algo/que/nao/existe')).status).toBe(401);
    expect((await chamar(null, 'POST', '/api/public/catalog/search', {})).status).toBe(401);   // a montra pública é só de leitura
  });
});

describe('montra pública', () => {
  it('pesquisa sem sessão, com filtros, ordenação e sem campos internos', async () => {
    const todos = (await chamar(null, 'GET', '/api/public/catalog/search?limit=48')).corpo;
    expect(todos.total).toBeGreaterThan(0);
    for (const i of todos.items) for (const k of ['sku', 'manufacturerCode', 'supplierNotes', 'stockQuantity', 'warehouse', 'minStock', 'viewCount', 'active', 'updatedAt', 'isFavorite']) expect(i, k).not.toHaveProperty(k);
    const servicos = (await chamar(null, 'GET', '/api/public/catalog/search?kind=SERVICO')).corpo; expect(servicos.items.every((i) => i.kind === 'SERVICO')).toBe(true);
    const acentos = (await chamar(null, 'GET', '/api/public/catalog/search?q=valvula')).corpo; expect(acentos.items.map((i) => i.name).join()).toMatch(/Válvula/);
    const ordenados = (await chamar(null, 'GET', '/api/public/catalog/search?sort=preco_asc&limit=48')).corpo.items.map((i) => Number(i.unitPrice)); expect(ordenados).toEqual([...ordenados].sort((a, b) => a - b));
    expect((await chamar(null, 'GET', '/api/public/catalog/search?limit=1&page=2')).corpo).toMatchObject({ page: 2, limit: 1 });
  });

  it('parâmetros inválidos → 422 VALIDATION_ERROR; ficha por slug e 404', async () => {
    expect((await chamar(null, 'GET', '/api/public/catalog/search?sort=inventado')).status).toBe(422);
    expect((await chamar(null, 'GET', '/api/public/catalog/search?limit=999')).status).toBe(422);
    expect((await chamar(null, 'GET', '/api/public/catalog/suppliers?limit=0')).status).toBe(422);
    const slug = (await chamar(null, 'GET', '/api/public/catalog/search?limit=1')).corpo.items[0].slug;
    expect((await chamar(null, 'GET', `/api/public/catalog/products/${slug}`)).corpo.slug).toBe(slug);
    expect((await chamar(null, 'GET', '/api/public/catalog/products/nao-existe')).status).toBe(404);
  });

  it('facetas coerentes com a pesquisa', async () => {
    const f = (await chamar(null, 'GET', '/api/public/catalog/facets')).corpo; const cat = f.categories[0];
    expect((await chamar(null, 'GET', `/api/public/catalog/search?category=${encodeURIComponent(cat.name)}`)).corpo.total).toBe(cat.count);
  });
});

describe('ciclo da ordem de compra (estado em memória)', () => {
  it('emitir → aprovar → aceitar → pagar com comprovativo → despachar → entregar → receber com divergência → resolver', async () => {
    const comprador = await entrar('COMPRADOR'); const admin = await entrar('COMPANY_ADMIN'); const forn = await entrar('FORNECEDOR'); const fin = await entrar('FINANCEIRO');
    const produto = (await chamar(null, 'GET', '/api/public/catalog/search?kind=PRODUTO&limit=1')).corpo.items.find((p) => p.unitPrice);
    const criada = await chamar(comprador, 'POST', '/api/purchase-orders', { supplierCompanyId: produto.supplierId, items: [{ productId: produto.id, quantity: 2 }] });
    expect(criada.status).toBe(201); expect(criada.corpo.status).toBe('AGUARDANDO_APROVACAO'); expect(criada.corpo.reference).toMatch(/^PO-\d{4}-\d{5}$/);
    expect(Number(criada.corpo.totalAmount)).toBe(Number(produto.promoPrice ?? produto.unitPrice) * 2);   // o servidor calcula; o cliente só manda produto e quantidade
    const id = criada.corpo.id; const p = (n, c, corpo) => chamar(c, 'PATCH', `/api/purchase-orders/${id}/${n}`, corpo);

    expect((await p('approve', comprador)).status).toBe(403);                                   // o comprador não aprova
    expect((await p('accept', forn)).status).toBe(409);                                         // ainda não aprovada
    expect((await p('approve', admin)).corpo.status).toBe('APROVADA');
    expect((await p('approve', admin)).corpo.error.message).toMatch(/não pode ser aprovada/);   // repetir dá 409
    expect((await p('refuse', forn, {})).status).toBe(422);                                     // recusar exige motivo
    const aceite = await p('accept', forn); expect(aceite.corpo.status).toBe('AGUARDANDO_PAGAMENTO');

    const ficha = (await chamar(forn, 'GET', `/api/purchase-orders/${id}`)).corpo; expect(ficha.invoice).toMatchObject({ status: 'PENDENTE' }); expect(ficha.invoice.reference).toMatch(/^FAT-\d{4}-\d{6}$/);
    expect(Number(ficha.invoice.amount)).toBe(Number(ficha.invoice.netAmount) + Number(ficha.invoice.taxAmount));
    const pend = (await chamar(fin, 'GET', '/api/payments/invoices/pending')).corpo; expect(pend.some((f) => f.id === ficha.invoice.id)).toBe(true);

    expect((await chamar(fin, 'POST', `/api/payments/invoices/${ficha.invoice.id}/pay`, new FormData())).status).toBe(422);   // sem comprovativo
    const form = new FormData(); form.append('proof', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'comprovativo.pdf');
    const paga = await chamar(fin, 'POST', `/api/payments/invoices/${ficha.invoice.id}/pay`, form);
    expect(paga.status).toBe(201); expect(paga.corpo).toMatchObject({ status: 'PROCESSADO', proofName: 'comprovativo.pdf' });
    expect((await chamar(fin, 'GET', '/api/payments/invoices/pending')).corpo.some((f) => f.id === ficha.invoice.id)).toBe(false);
    expect((await chamar(forn, 'PATCH', `/api/payments/${paga.corpo.id}/confirm-received`)).corpo.receivedAt).toBeTruthy();

    expect((await p('dispatch', forn)).corpo.status).toBe('EM_EXECUCAO');
    expect((await p('delivered', forn)).corpo.status).toBe('ENTREGUE');
    expect((await p('reception', comprador, { conforme: false, notes: 'Faltam unidades' })).corpo.status).toBe('RECEBIDA_COM_DIVERGENCIA');
    expect((await p('resolve-divergence', comprador, { outcome: 'INVENTADO' })).status).toBe(422);
    expect((await p('resolve-divergence', comprador, { outcome: 'ACEITE' })).corpo.status).toBe('CONCLUIDA');
    expect((await chamar(admin, 'GET', `/api/purchase-orders/${id}/history`)).corpo.length).toBeGreaterThanOrEqual(7);
  });

  it('rejeitar guarda a justificação; os números do comprador e do administrador acompanham o estado', async () => {
    const comprador = await entrar('COMPRADOR'); const admin = await entrar('COMPANY_ADMIN');
    const produto = (await chamar(null, 'GET', '/api/public/catalog/search?limit=48')).corpo.items.find((p) => p.unitPrice);
    const antes = (await chamar(admin, 'GET', '/api/company-admin/dashboard')).corpo.kpis.aprovarPO;
    const o = (await chamar(comprador, 'POST', '/api/purchase-orders', { supplierCompanyId: produto.supplierId, items: [{ productId: produto.id, quantity: 1 }] })).corpo;
    expect((await chamar(admin, 'GET', '/api/company-admin/dashboard')).corpo.kpis.aprovarPO).toBe(antes + 1);
    const r = await chamar(admin, 'PATCH', `/api/purchase-orders/${o.id}/reject`, { reason: 'Fora do orçamento.' });
    expect(r.corpo).toMatchObject({ status: 'REJEITADA', rejectionReason: 'Fora do orçamento.' });
    expect((await chamar(admin, 'GET', '/api/company-admin/dashboard')).corpo.kpis.aprovarPO).toBe(antes);
    const lista = (await chamar(comprador, 'GET', '/api/buyer/orders?status=REJEITADA')).corpo; expect(lista.items.some((i) => i.id === o.id)).toBe(true);
  });

  it('a auditoria do admin do sistema regista as ações feitas e filtra por ação', async () => {
    const comprador = await entrar('COMPRADOR'); const admin = await entrar('COMPANY_ADMIN'); const sistema = await entrar('ADMIN_SISTEMA');
    const produto = (await chamar(null, 'GET', '/api/public/catalog/search?limit=48')).corpo.items.find((p) => p.unitPrice);
    const o = (await chamar(comprador, 'POST', '/api/purchase-orders', { supplierCompanyId: produto.supplierId, items: [{ productId: produto.id, quantity: 1 }] })).corpo;
    await chamar(admin, 'PATCH', `/api/purchase-orders/${o.id}/approve`);
    const a = (await chamar(sistema, 'GET', '/api/admin/audit-logs?action=PO_APROVADA')).corpo;
    expect(a.items.length).toBeGreaterThan(0); expect(a.items.every((i) => i.action === 'PO_APROVADA')).toBe(true);
    expect(a.items[0]).toMatchObject({ entityRef: o.reference, actorRole: 'COMPANY_ADMIN' }); expect(a.actions.some((x) => x.action === 'PO_APROVADA')).toBe(true);
  });

  it('criar ordem valida: sem linhas 422, produto de outra fornecedora 404, só COMPRADOR/COMPANY_ADMIN', async () => {
    const c = await entrar('COMPRADOR');
    expect((await chamar(c, 'POST', '/api/purchase-orders', { supplierCompanyId: 'x', items: [] })).status).toBe(422);
    expect((await chamar(c, 'POST', '/api/purchase-orders', { supplierCompanyId: 'x', items: [{ productId: 'nao', quantity: 1 }] })).status).toBe(404);
    expect((await chamar(await entrar('FORNECEDOR'), 'POST', '/api/purchase-orders', { supplierCompanyId: 'x', items: [] })).status).toBe(403);
  });
});

describe('cotações, catálogo, equipa e credenciamento', () => {
  it('cotação: pedir (COMPRADOR) → responder (FORNECEDOR, preço > 0) → encerrar', async () => {
    const comprador = await entrar('COMPRADOR'); const forn = await entrar('FORNECEDOR');
    const produto = (await chamar(null, 'GET', '/api/public/catalog/search?limit=1')).corpo.items[0];
    const q = await chamar(comprador, 'POST', '/api/quotes', { supplierCompanyId: produto.supplierId, note: 'Entrega no Soyo', items: [{ productId: produto.id, quantity: 3 }] });
    expect(q.status).toBe(201); expect(q.corpo.status).toBe('ABERTA');
    expect((await chamar(forn, 'PATCH', `/api/quotes/${q.corpo.id}/respond`, { price: 0 })).status).toBe(422);
    expect((await chamar(forn, 'PATCH', `/api/quotes/${q.corpo.id}/respond`, { price: 900000, leadDays: 5 })).corpo.status).toBe('RESPONDIDA');
    expect((await chamar(comprador, 'PATCH', `/api/quotes/${q.corpo.id}/close`)).corpo.status).toBe('FECHADA');
    expect((await chamar(forn, 'POST', '/api/quotes', {})).status).toBe(403);
  });

  it('fornecedora: criar, editar, atualizar stock e retirar do catálogo; a montra pública acompanha', async () => {
    const forn = await entrar('FORNECEDOR'); const eu = (await chamar(forn, 'GET', '/api/auth/me')).corpo.user;
    expect((await chamar(forn, 'POST', '/api/catalog', { name: 'x' })).status).toBe(422);
    const p = (await chamar(forn, 'POST', '/api/catalog', { name: 'Produto de teste isolado', category: 'Materiais', unitPrice: 12500, stockQuantity: 7 })).corpo;
    expect(p).toMatchObject({ supplierId: eu.companyId, active: true });
    expect((await chamar(null, 'GET', `/api/public/catalog/products/${p.slug}`)).corpo.name).toBe('Produto de teste isolado');
    expect((await chamar(forn, 'PATCH', `/api/catalog/${p.id}/stock`, { stockQuantity: 9 })).corpo.stockQuantity).toBe(9);
    expect((await chamar(forn, 'PUT', `/api/catalog/${p.id}`, { unitPrice: 13000 })).corpo.unitPrice).toBe('13000');
    expect((await chamar(forn, 'DELETE', `/api/catalog/${p.id}`)).corpo.active).toBe(false);
    expect((await chamar(null, 'GET', `/api/public/catalog/products/${p.slug}`)).status).toBe(404);
  });

  it('equipa e convites do administrador da empresa; credenciamento pelo admin do sistema', async () => {
    const admin = await entrar('COMPANY_ADMIN');
    expect((await chamar(admin, 'POST', '/api/companies/invites', { role: 'ADMIN_SISTEMA', name: 'X', email: 'x@y.co' })).status).toBe(422);
    const c = await chamar(admin, 'POST', '/api/companies/invites', { role: 'COMPRADOR', name: 'Pessoa', email: 'pessoa@exemplo.co.ao' }); expect(c.status).toBe(201);
    expect((await chamar(admin, 'GET', '/api/companies/invites')).corpo.some((i) => i.id === c.corpo.id)).toBe(true);
    await chamar(admin, 'POST', `/api/companies/invites/${c.corpo.id}/cancel`);
    expect((await chamar(admin, 'GET', '/api/companies/invites')).corpo.some((i) => i.id === c.corpo.id)).toBe(false);
    const eu = (await chamar(admin, 'GET', '/api/auth/me')).corpo.user;
    expect((await chamar(admin, 'PATCH', `/api/companies/users/${eu.id}/status`, { active: false })).status).toBe(409);   // não se desativa a si próprio

    const form = new FormData(); form.append('name', 'Empresa Registada Em Teste'); form.append('type', 'CLIENTE');
    expect((await fetch(`${base}/api/companies/register`, { method: 'POST', body: form })).status).toBe(201);
    const sistema = await entrar('ADMIN_SISTEMA'); const pend = (await chamar(sistema, 'GET', '/api/companies')).corpo.find((e) => e.status === 'PENDENTE' && e.name === 'Empresa Registada Em Teste');
    expect(pend).toBeTruthy();
    expect((await chamar(sistema, 'PATCH', `/api/companies/${pend.id}/decision`, { approve: true })).corpo.status).toBe('APROVADA');
    expect((await chamar(sistema, 'PATCH', `/api/companies/${pend.id}/decision`, { approve: false })).status).toBe(409);
  });

  it('cada instância começa do zero (o estado não é partilhado entre servidores)', async () => {
    const outro = criarServidor({ senha: SENHA }); await new Promise((r) => outro.listen(0, '127.0.0.1', r));
    const b2 = `http://127.0.0.1:${outro.address().port}`;
    const login = await fetch(`${b2}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAILS.COMPRADOR, password: SENHA }) });
    const c = login.headers.getSetCookie()[0].split(';')[0];
    const lista = await (await fetch(`${b2}/api/purchase-orders`, { headers: { Cookie: c } })).json();
    expect(lista).toHaveLength(8);   // as 8 ordens reais capturadas, sem as criadas acima
    await new Promise((r) => outro.close(r));
  });
});
