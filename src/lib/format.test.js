import { describe, expect, it } from 'vitest';
import { destinoSeguro, formatarData, formatarNota, formatarPreco, iniciais } from './format';

describe('formatarPreco', () => {
  it('formata kwanzas e outras moedas, aceitando texto numérico', () => {
    expect(formatarPreco('950000', 'AOA').replace(/\s/g, ' ')).toMatch(/950 000,00/);
    expect(formatarPreco('950000', 'AOA')).toMatch(/Kz|AOA/);
    expect(formatarPreco(100, 'USD')).toMatch(/100,00/);
  });
  it('sem valor devolve null (nunca "0"): a interface mostra "Pedir cotação"', () => {
    expect(formatarPreco(null)).toBeNull();
    expect(formatarPreco(undefined)).toBeNull();
    expect(formatarPreco('')).toBeNull();
    expect(formatarPreco('abc')).toBeNull();
  });
  it('moeda desconhecida não rebenta', () => {
    expect(formatarPreco(10, 'ZZZZ')).toMatch(/10/);
  });
});

describe('outros formatos', () => {
  it('nota com uma casa decimal e vírgula', () => { expect(formatarNota(4.5)).toBe('4,5'); expect(formatarNota(5)).toBe('5,0'); });
  it('data inválida ou em falta dá "—"', () => { expect(formatarData(null)).toBe('—'); expect(formatarData('lixo')).toBe('—'); });
  it('iniciais', () => { expect(iniciais('Ana Comprador Silva')).toBe('AC'); expect(iniciais('')).toBe('?'); });
});

describe('destinoSeguro (evita redirecionamento aberto em ?next=)', () => {
  it.each([
    ['/mercado?q=a', '/mercado?q=a'],
    ['/', '/'],
    ['//evil.com', '/'],
    ['https://evil.com', '/'],
    ['javascript:alert(1)', '/'],
    ['/\\evil.com', '/'],
    [null, '/'],
    [undefined, '/'],
    [42, '/'],
  ])('%s → %s', (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado);
  });
});
