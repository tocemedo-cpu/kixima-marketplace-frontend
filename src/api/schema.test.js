import { describe, expect, it } from 'vitest';
import { lista, nulavel, num, numOuTexto, obj, opc, str, umDe, validar } from './schema';
import { ApiError } from './client';

describe('validadores', () => {
  it('numOuTexto aceita número e texto numérico (o backend envia "950000")', () => {
    expect(numOuTexto('950000', 'x')).toBeNull();
    expect(numOuTexto(12.5, 'x')).toBeNull();
    expect(numOuTexto('abc', 'x')).toMatch(/valor numérico/);
    expect(numOuTexto('', 'x')).not.toBeNull();
  });

  it('opc aceita undefined/null; nulavel exige a chave mas aceita null', () => {
    expect(opc(str)(undefined, 'x')).toBeNull();
    expect(opc(str)(null, 'x')).toBeNull();
    expect(opc(str)(3, 'x')).not.toBeNull();
    expect(nulavel(str)(null, 'x')).toBeNull();
    expect(nulavel(str)(undefined, 'x')).not.toBeNull();
  });

  it('o erro diz o caminho exacto do campo', () => {
    const s = obj({ itens: lista(obj({ nome: str, qtd: num })) });
    expect(s({ itens: [{ nome: 'a', qtd: 1 }, { nome: 'b', qtd: 'dois' }] }, '$')).toBe('$.itens[1].qtd: esperava número, veio string');
  });

  it('permite chaves desconhecidas (o backend pode acrescentar campos)', () => {
    expect(obj({ a: str })({ a: 'x', b: 1 }, '$')).toBeNull();
  });

  it('umDe rejeita valores fora do enum', () => {
    expect(umDe('A', 'B')('C', 'x')).toMatch(/inesperado/);
  });

  it('validar devolve o valor ou lança RESPOSTA_INESPERADA com a origem', () => {
    expect(validar(obj({ a: str }), { a: 'x' }, 'GET /x')).toEqual({ a: 'x' });
    const e = (() => { try { validar(obj({ a: str }), { a: 1 }, 'GET /x'); } catch (x) { return x; } return null; })();
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('RESPOSTA_INESPERADA');
    expect(e.message).toContain('GET /x');
  });
});
