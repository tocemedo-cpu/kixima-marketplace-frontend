// Autenticação e onboarding. A sessão é o cookie httpOnly que o servidor define no login: aqui não há tokens.
import { api } from '../client';
import { bool, lista, nulavel, obj, opc, str, validar } from '../schema';

const Utilizador = obj({
  id: str, name: str, email: str, role: str,
  companyId: nulavel(str), companyName: opc(nulavel(str)), companyType: opc(nulavel(str)),
  adminAreas: opc(lista(str)), avatarUrl: opc(nulavel(str)), companyPlan: opc(nulavel(str)),
});
// Login normal devolve { user, mfaPendente, … }; com 2FA devolve { requires2fa: true, challenge, metodo, enviadoPara }.
const RespostaLogin = (v, p) => {
  if (v && v.requires2fa) return obj({ requires2fa: bool, challenge: str })(v, p);
  return obj({ user: Utilizador })(v, p);
};
const RespostaEu = obj({ user: Utilizador });

/** @returns {Promise<{ requires2fa?: true, challenge?: string, metodo?: string, enviadoPara?: string, user?: object }>} */
export async function entrar(email, password) {
  // O token que o servidor também devolve no corpo é ignorado de propósito: a sessão é o cookie.
  const r = validar(RespostaLogin, await api.post('/api/auth/login', { email, password }), 'POST /api/auth/login');
  return r.requires2fa ? { requires2fa: true, challenge: r.challenge, metodo: r.metodo || 'TOTP', enviadoPara: r.enviadoPara || '' } : { user: normalizarUtilizador(r) };
}

export async function verificar2fa(challenge, code) {
  const r = validar(obj({ user: Utilizador }), await api.post('/api/auth/2fa/verify', { challenge, code }), 'POST /api/auth/2fa/verify');
  return normalizarUtilizador(r);
}

export async function reenviar2fa(challenge) {
  const r = await api.post('/api/auth/2fa/reenviar', { challenge });
  return { enviadoPara: r?.enviadoPara || '' };
}

export async function eu(opcoes) {
  const r = validar(RespostaEu, await api.get('/api/auth/me', undefined, opcoes), 'GET /api/auth/me');
  return normalizarUtilizador(r);
}

export const sair = () => api.post('/api/auth/logout');

export const pedirRecuperacao = (email) => api.post('/api/auth/forgot-password', { email });
export const redefinirSenha = (token, password) => api.post('/api/auth/reset-password', { token, password });

export async function consultarConvite(token, opcoes) {
  return validar(obj({ role: opc(str), email: opc(nulavel(str)), name: opc(nulavel(str)) }), await api.get(`/api/companies/invite/${encodeURIComponent(token)}`, undefined, opcoes), 'GET /api/companies/invite/{token}');
}
export const aceitarConvite = (token, dados) => api.post(`/api/companies/invite/${encodeURIComponent(token)}/accept`, dados);

/** Cadastro público de empresa (multipart: dados + documentos). */
export const registarEmpresa = (formData) => api.postForm('/api/companies/register', formData);

// Junta os campos de MFA ao utilizador, como o resto da aplicação os consome (user.mfaPendente…).
function normalizarUtilizador(r) {
  return { ...r.user, mfaPendente: Boolean(r.mfaPendente ?? r.user.mfaPendente), mfaPrazo: r.mfaPrazo ?? r.user.mfaPrazo ?? null };
}

