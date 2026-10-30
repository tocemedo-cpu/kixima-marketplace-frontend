// Cliente HTTP único para o backend Java. TUDO o que sai para a API passa por aqui.
//
// - Mesma origem (caminhos relativos '/api/…'): em desenvolvimento o proxy do Vite, em produção o servidor.
// - A sessão é o cookie `httpOnly` (kixima_sessao): o browser envia-o; este código nunca o lê nem o guarda.
//   Por isso não existe aqui nenhum getToken/setToken — e não deve passar a existir.
// - Erros normalizados num ApiError com { status, code, message, details } a partir de
//   `{ error: { code, message, details } }`, e com códigos próprios para rede/tempo esgotado/resposta inesperada.
// - GET repete-se com espera crescente em falhas transitórias (rede, 502/503/504); POST/PUT/PATCH/DELETE nunca
//   se repetem sozinhos (não são idempotentes).
// - Um 401 numa chamada que NÃO é de autenticação significa sessão expirada: avisa quem se registou
//   (AuthContext) para limpar o estado e levar a pessoa ao login.

export class ApiError extends Error {
  constructor({ status = 0, code = 'ERRO', message = 'Ocorreu um erro.', details = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Erros de validação do servidor: { campo: ['mensagem', …] } (vazio se não for um 422 com detalhes). */
  get fieldErrors() {
    return this.details?.fieldErrors || {};
  }

  get isNetwork() { return this.code === 'REDE' || this.code === 'TEMPO_ESGOTADO'; }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isValidation() { return this.status === 422; }
  get isServer() { return this.status >= 500; }
}

const TEMPO_LIMITE_MS = 20_000;
const REPETICOES_GET = 2;
const ESTADOS_TRANSITORIOS = new Set([502, 503, 504]);
// Chamadas onde um 401 é a resposta normal ("credenciais inválidas"), não uma sessão expirada.
const SEM_AVISO_DE_SESSAO = /^\/api\/auth\/(login|2fa\/(verify|reenviar)|forgot-password|reset-password)$|^\/api\/companies\/(register|invite\/)/;

let aoSessaoExpirada = null;
/** O AuthContext regista aqui o que fazer quando a sessão expira. */
export function definirAoSessaoExpirada(fn) { aoSessaoExpirada = fn; }

const dormir = (ms) => new Promise((r) => { setTimeout(r, ms); });

function montarUrl(path, query) {
  if (!query) return path;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    p.append(k, String(v));
  }
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}

async function lerCorpo(res) {
  if (res.status === 204) return null;
  const tipo = res.headers.get('content-type') || '';
  if (tipo.includes('application/json')) {
    try { return await res.json(); } catch { return null; }
  }
  try { return await res.text(); } catch { return null; }
}

function erroDaResposta(res, corpo) {
  const e = corpo && typeof corpo === 'object' ? corpo.error : null;
  return new ApiError({
    status: res.status,
    code: e?.code || `HTTP_${res.status}`,
    message: e?.message || mensagemPorEstado(res.status),
    details: e?.details || null,
  });
}

function mensagemPorEstado(status) {
  if (status === 401) return 'A sessão expirou ou não está iniciada.';
  if (status === 403) return 'Não tem permissão para esta operação.';
  if (status === 404) return 'Não encontrado.';
  if (status === 422) return 'Dados inválidos.';
  if (status === 429) return 'Demasiados pedidos. Aguarde um momento e tente de novo.';
  if (status >= 500) return 'O servidor teve um problema. Tente de novo dentro de instantes.';
  return 'Não foi possível concluir o pedido.';
}

/** Texto para mostrar a uma pessoa. Mensagens de 4xx vêm do servidor em português; as restantes são genéricas. */
export function mensagemDeErro(err) {
  if (!(err instanceof ApiError)) return 'Ocorreu um erro inesperado.';
  if (err.code === 'REDE') return 'Sem ligação ao servidor. Verifique a sua internet e tente de novo.';
  if (err.code === 'TEMPO_ESGOTADO') return 'O servidor demorou demasiado a responder. Tente de novo.';
  if (err.code === 'RESPOSTA_INESPERADA') return 'O servidor respondeu num formato inesperado. Tente de novo ou contacte o suporte.';
  if (err.status >= 500) return mensagemPorEstado(err.status);
  return err.message || mensagemPorEstado(err.status);
}

/**
 * Pedido genérico. `body` (JSON) ou `form` (FormData) — nunca os dois.
 * `signal` cancela o pedido (o cancelamento relança o AbortError original, para o chamador o ignorar).
 */
export async function request(method, path, { query, body, form, signal, repetir, tempoLimite = TEMPO_LIMITE_MS } = {}) {
  const url = montarUrl(path, query);
  const tentativas = (repetir ?? method === 'GET') ? REPETICOES_GET : 0;
  let ultimo;

  for (let tentativa = 0; tentativa <= tentativas; tentativa += 1) {
    if (tentativa > 0) await dormir(300 * 2 ** (tentativa - 1));
    if (signal?.aborted) throw signal.reason ?? new DOMException('Cancelado', 'AbortError');

    const ctl = new AbortController();
    const aoCancelar = () => ctl.abort(signal.reason);
    signal?.addEventListener('abort', aoCancelar, { once: true });
    let esgotou = false;
    const timer = setTimeout(() => { esgotou = true; ctl.abort(); }, tempoLimite);

    try {
      const headers = { Accept: 'application/json' };
      let corpo;
      if (form) corpo = form; // o browser define o multipart/boundary
      else if (body !== undefined) { headers['Content-Type'] = 'application/json'; corpo = JSON.stringify(body); }

      const res = await fetch(url, { method, headers, body: corpo, credentials: 'include', signal: ctl.signal });
      const dados = await lerCorpo(res);

      if (res.ok) return dados;

      const erro = erroDaResposta(res, dados);
      if (res.status === 401 && !SEM_AVISO_DE_SESSAO.test(path)) aoSessaoExpirada?.(erro);
      if (ESTADOS_TRANSITORIOS.has(res.status) && tentativa < tentativas) { ultimo = erro; continue; }
      throw erro;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (signal?.aborted) throw e; // cancelado por quem chamou
      const erro = new ApiError({
        code: esgotou ? 'TEMPO_ESGOTADO' : 'REDE',
        message: esgotou ? 'O servidor demorou demasiado a responder.' : 'Sem ligação ao servidor.',
        cause: e,
      });
      if (tentativa < tentativas) { ultimo = erro; continue; }
      throw erro;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', aoCancelar);
    }
  }
  throw ultimo;
}

export const api = {
  get: (path, query, opcoes) => request('GET', path, { query, ...opcoes }),
  post: (path, body, opcoes) => request('POST', path, { body, ...opcoes }),
  put: (path, body, opcoes) => request('PUT', path, { body, ...opcoes }),
  patch: (path, body, opcoes) => request('PATCH', path, { body, ...opcoes }),
  delete: (path, opcoes) => request('DELETE', path, opcoes),
  postForm: (path, form, opcoes) => request('POST', path, { form, ...opcoes }),
};

export function eCancelamento(err) {
  return err?.name === 'AbortError';
}
