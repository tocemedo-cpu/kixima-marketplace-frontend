// Administração da plataforma. Todos os endpoints são ADMIN_SISTEMA; algumas áreas finas (AdminArea) podem restringir
// ainda mais — o servidor responde 403 e a interface mostra a mensagem, sem tentar adivinhar.
import { api } from '../client';
import { bool, lista, nulavel, num, numOuTexto, obj, opc, qualquer, str, validar } from '../schema';

const data = opc(nulavel(str));

export const Empresa = obj({
  id: str, name: str, taxId: opc(nulavel(str)), type: str, status: str, contactEmail: opc(nulavel(str)), city: opc(nulavel(str)), country: opc(nulavel(str)),
  verified: opc(bool), plan: opc(nulavel(str)), createdAt: opc(str), approvedAt: data, rejectedAt: data,
});
export const listarEmpresas = async (o) => validar(lista(Empresa), await api.get('/api/companies', undefined, o), 'GET /api/companies');
/** Aprova (`approve: true`) ou rejeita uma empresa pendente. `rejectionReason` acompanha a rejeição. */
export const decidirEmpresa = async (id, { approve, rejectionReason }) => validar(Empresa, await api.patch(`/api/companies/${encodeURIComponent(id)}/decision`, { approve, rejectionReason }), 'PATCH /api/companies/{id}/decision');

export const utilizadoresDaPlataforma = async (o) => validar(lista(obj({ id: str, name: str, email: str, role: str, active: bool, companyName: opc(nulavel(str)), createdAt: opc(str) })), await api.get('/api/admin/users', undefined, o), 'GET /api/admin/users');
export const definirEstadoDeUtilizadorAdmin = async (id, active) => validar(qualquer, await api.patch(`/api/admin/users/${encodeURIComponent(id)}/status`, { active }), 'PATCH /api/admin/users/{id}/status');

export const atividadeDaPlataforma = async (o) => validar(obj({
  kpis: obj({}), items: lista(obj({ type: opc(str), module: opc(nulavel(str)), title: str, detail: opc(nulavel(str)), at: data })),
}), await api.get('/api/admin/activities', undefined, o), 'GET /api/admin/activities');

export const registoDeAuditoria = async (query, o) => validar(obj({
  items: lista(obj({ id: str, action: str, entityType: opc(nulavel(str)), entityRef: opc(nulavel(str)), actorName: opc(nulavel(str)), actorRole: opc(nulavel(str)), createdAt: str })),
  total: num, page: num, pages: num, actions: opc(lista(obj({ action: str, count: num }))),
}), await api.get('/api/admin/audit-logs', query, o), 'GET /api/admin/audit-logs');

export const taxasDaPlataforma = async (o) => validar(obj({
  fees: lista(obj({ id: str, status: opc(str), amount: opc(numOuTexto), currency: opc(str), createdAt: opc(str) })),
  kpis: obj({}),
}), await api.get('/api/admin/platform-fees', undefined, o), 'GET /api/admin/platform-fees');

export const prontidao = async (o) => validar(obj({
  ambiente: opc(str), verificadoEm: opc(str), resumo: obj({ total: num, ok: num, avisos: num, falhas: num }),
  grupos: lista(obj({ grupo: str, checks: lista(obj({ titulo: str, estado: str, detalhe: opc(nulavel(str)), acao: opc(nulavel(str)) })) })),
}), await api.get('/api/admin/prontidao', undefined, o), 'GET /api/admin/prontidao');
