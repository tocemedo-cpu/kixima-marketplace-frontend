import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RequisicaoProvider, useRequisicao } from './RequisicaoContext';

// O contexto de autenticação é simulado com um módulo mínimo (só `user` e `estado` interessam).
import { vi } from 'vitest';
const sessao = { user: { id: 'u1' }, estado: 'autenticado' };
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => sessao }));

const linha = (extra = {}) => ({ productId: 'p1', slug: 's1', name: 'Válvula', supplierId: 'f1', supplierName: 'Kianda', unitPrice: 850000, currency: 'AOA', quantity: 1, ...extra });
const montar = () => renderHook(() => useRequisicao(), { wrapper: RequisicaoProvider });

afterEach(() => { sessionStorage.clear(); sessao.user = { id: 'u1' }; sessao.estado = 'autenticado'; });

describe('requisição', () => {
  it('soma a quantidade da mesma linha em vez de duplicar', () => {
    const { result } = montar();
    act(() => { result.current.adicionar(linha()); result.current.adicionar(linha({ quantity: 2 })); });
    expect(result.current.linhas).toHaveLength(1);
    expect(result.current.linhas[0].quantity).toBe(3);
    expect(result.current.total).toBe(3);
  });

  it('remove por linha e por fornecedora', () => {
    const { result } = montar();
    act(() => { result.current.adicionar(linha()); result.current.adicionar(linha({ productId: 'p2', supplierId: 'f2' })); });
    act(() => result.current.remover('p1'));
    expect(result.current.linhas.map((l) => l.productId)).toEqual(['p2']);
    act(() => result.current.removerFornecedor('f2'));
    expect(result.current.linhas).toEqual([]);
  });

  it('sobrevive a um recarregamento (sessionStorage), mas ignora lixo guardado', () => {
    sessionStorage.setItem('kixima.requisicao', JSON.stringify([linha(), { productId: 5 }, { productId: 'x', quantity: 0 }, null]));
    const { result } = montar();
    expect(result.current.linhas.map((l) => l.productId)).toEqual(['p1']);
  });

  it('esvazia quando a sessão termina, mas não enquanto ainda está a ser verificada', () => {
    sessao.estado = 'carregando'; sessao.user = null;
    sessionStorage.setItem('kixima.requisicao', JSON.stringify([linha()]));
    const { result, rerender } = renderHook(() => useRequisicao(), { wrapper: RequisicaoProvider });
    expect(result.current.linhas).toHaveLength(1);
    sessao.estado = 'anonimo';
    rerender();
    expect(result.current.linhas).toEqual([]);
  });

  it('não guarda nada além do necessário (sem tokens nem dados da pessoa)', () => {
    const { result } = montar();
    act(() => result.current.adicionar(linha()));
    const guardado = JSON.parse(sessionStorage.getItem('kixima.requisicao'));
    expect(Object.keys(guardado[0]).sort()).toEqual(['currency', 'name', 'productId', 'quantity', 'slug', 'supplierId', 'supplierName', 'unitPrice']);
  });
});
