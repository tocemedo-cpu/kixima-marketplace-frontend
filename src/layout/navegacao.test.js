import { describe, expect, it } from 'vitest';
import { PAPEIS, paginaInicial } from '../auth/papeis';
import { NAV_POR_PAPEL, navegacaoDe } from './navegacao';

const destinos = (itens) => itens.flatMap((i) => (i.children ? i.children.map((c) => c.to) : [i.to]));

describe('navegação por papel', () => {
  it('cada papel tem menu e uma página inicial que é o primeiro item', () => {
    for (const role of PAPEIS) {
      expect(NAV_POR_PAPEL[role], role).toBeTruthy();
      expect(destinos(navegacaoDe(role))[0]).toBe(paginaInicial(role));
    }
  });

  it('os papéis não herdam menus uns dos outros', () => {
    const comprador = destinos(navegacaoDe('COMPRADOR'));
    const empresa = destinos(navegacaoDe('COMPANY_ADMIN'));
    expect(comprador.some((d) => d.startsWith('/empresa') || d.startsWith('/sistema') || d.startsWith('/financeiro'))).toBe(false);
    // o Administrador da empresa aprova, mas não compra nem paga por omissão
    expect(empresa.some((d) => d.startsWith('/comprador') || d.startsWith('/financeiro'))).toBe(false);
    expect(destinos(navegacaoDe('FINANCEIRO')).some((d) => d.startsWith('/empresa') || d.startsWith('/comprador'))).toBe(false);
    expect(destinos(navegacaoDe('FORNECEDOR')).some((d) => d.startsWith('/empresa') || d.startsWith('/sistema'))).toBe(false);
  });

  it('só o Admin do Sistema vê a administração da plataforma', () => {
    for (const role of PAPEIS.filter((r) => r !== 'ADMIN_SISTEMA')) expect(destinos(navegacaoDe(role)).some((d) => d.startsWith('/sistema')), role).toBe(false);
    expect(destinos(navegacaoDe('ADMIN_SISTEMA')).some((d) => d.startsWith('/sistema'))).toBe(true);
  });

  it('papel desconhecido recebe um menu mínimo, sem áreas privadas de trabalho', () => {
    expect(destinos(navegacaoDe('OUTRO')).some((d) => /^\/(comprador|empresa|financeiro|sistema)(\/|$)/.test(d))).toBe(false);
  });
});
