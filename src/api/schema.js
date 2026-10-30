// Validação mínima das respostas da API (sem dependências). Cada validador devolve `null` se o valor serve ou
// uma mensagem com o caminho do problema. Chaves desconhecidas são permitidas: o backend pode acrescentar campos
// sem partir o frontend; o que se valida é o que a interface REALMENTE usa.
//
//   validar(obj({ id: str, preco: opc(numOuTexto) }), resposta, 'GET /api/x');  // lança ApiError RESPOSTA_INESPERADA
import { ApiError } from './client';

const tipo = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

export const str = (v, p) => (typeof v === 'string' ? null : `${p}: esperava texto, veio ${tipo(v)}`);
export const num = (v, p) => (typeof v === 'number' && Number.isFinite(v) ? null : `${p}: esperava número, veio ${tipo(v)}`);
export const bool = (v, p) => (typeof v === 'boolean' ? null : `${p}: esperava booleano, veio ${tipo(v)}`);
export const qualquer = () => null;
/** O backend envia valores monetários como texto numérico ("950000") ou como número. */
export const numOuTexto = (v, p) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) ? null : `${p}: esperava valor numérico, veio ${tipo(v)}`);

/** Aceita undefined ou null; senão aplica o validador. */
export const opc = (s) => (v, p) => (v === undefined || v === null ? null : s(v, p));
/** Aceita null; senão aplica o validador (a chave tem de existir). */
export const nulavel = (s) => (v, p) => (v === null ? null : s(v, p));

export const lista = (s) => (v, p) => {
  if (!Array.isArray(v)) return `${p}: esperava lista, veio ${tipo(v)}`;
  for (let i = 0; i < v.length; i += 1) {
    const e = s(v[i], `${p}[${i}]`);
    if (e) return e;
  }
  return null;
};

export const obj = (forma) => (v, p) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return `${p}: esperava objecto, veio ${tipo(v)}`;
  for (const [k, s] of Object.entries(forma)) {
    const e = s(v[k], `${p}.${k}`);
    if (e) return e;
  }
  return null;
};

/** Todos os validadores têm de aceitar (devolve o primeiro erro). Serve para estender um objecto com campos opcionais. */
export const todos = (...vs) => (v, p) => { for (const s of vs) { const e = s(v, p); if (e) return e; } return null; };

export const umDe = (...valores) => (v, p) => (valores.includes(v) ? null : `${p}: valor inesperado (${String(v)})`);

/** Devolve o próprio valor se serve; senão lança ApiError(RESPOSTA_INESPERADA) com o caminho do problema. */
export function validar(schema, valor, origem = 'resposta') {
  const erro = schema(valor, '$');
  if (erro) {
    throw new ApiError({ status: 200, code: 'RESPOSTA_INESPERADA', message: `Resposta inesperada de ${origem}: ${erro}` });
  }
  return valor;
}
