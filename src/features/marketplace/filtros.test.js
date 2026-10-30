import { describe, expect, it } from 'vitest';
import { comAlteracao, etiquetasActivas, filtrosDaUrl, paginaDaUrl, vistaDaUrl } from './filtros';

const sp = (s) => new URLSearchParams(s);

describe('filtrosDaUrl', () => {
  it('lê só valores válidos e ignora lixo (nunca é enviado à API)', () => {
    expect(filtrosDaUrl(sp('q=%20válvula%20&kind=SERVICO&sort=preco_asc&verified=true&minPrice=10&maxPrice=abc&promo=sim'))).toEqual({ q: 'válvula', kind: 'SERVICO', sort: 'preco_asc', verified: 'true', minPrice: '10' });
    expect(filtrosDaUrl(sp('kind=OUTRO&sort=aleatorio&minPrice=-5'))).toEqual({});
  });
  it('certificações: lista separada por vírgulas, sem vazios', () => {
    expect(filtrosDaUrl(sp('certifications=ISO%209001,,API%20Q1')).certifications).toBe('ISO 9001,API Q1');
  });
  it('página inválida volta a 1; vista só "lista" ou "grade"', () => {
    expect(paginaDaUrl(sp('page=0'))).toBe(1); expect(paginaDaUrl(sp('page=abc'))).toBe(1); expect(paginaDaUrl(sp('page=3'))).toBe(3);
    expect(vistaDaUrl(sp('vista=lista'))).toBe('lista'); expect(vistaDaUrl(sp('vista=x'))).toBe('grade');
  });
});

describe('comAlteracao', () => {
  it('mudar um filtro volta à página 1; null remove o parâmetro', () => {
    expect(comAlteracao(sp('q=a&page=4'), { kind: 'PRODUTO' }).toString()).toBe('q=a&kind=PRODUTO');
    expect(comAlteracao(sp('q=a&kind=PRODUTO'), { kind: null }).toString()).toBe('q=a');
  });
  it('trocar de página mantém os filtros', () => {
    expect(comAlteracao(sp('q=a&page=2'), { page: 3 }, { manterPagina: true }).toString()).toBe('q=a&page=3');
  });
});

describe('etiquetasActivas', () => {
  it('uma etiqueta por filtro, e uma por certificação', () => {
    const e = etiquetasActivas({ q: 'x', kind: 'SERVICO', certifications: 'A,B', verified: 'true' });
    expect(e.map((x) => x.rotulo)).toEqual(['Pesquisa: x', 'Serviços', 'A', 'B', 'Fornecedor verificado']);
  });
});
