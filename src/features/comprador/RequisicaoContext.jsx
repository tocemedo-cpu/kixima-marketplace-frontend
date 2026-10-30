import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';

// A requisição em curso (a "cesta" do comprador) guarda-se só na sessão do separador e só com o necessário para a
// mostrar: produto, fornecedor, quantidade e o preço que a pessoa VIU. O preço final e os impostos são sempre os
// que o servidor calcula ao emitir a ordem; nada aqui é enviado como preço.
const CHAVE = 'kixima.requisicao';

function ler() {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE) || '[]');
    return Array.isArray(v) ? v.filter((l) => l && typeof l.productId === 'string' && Number.isInteger(l.quantity) && l.quantity > 0) : [];
  } catch { return []; }
}
function gravar(linhas) {
  try { sessionStorage.setItem(CHAVE, JSON.stringify(linhas)); } catch { /* sem armazenamento: a requisição vive só em memória */ }
}

const Ctx = createContext(null);

export function RequisicaoProvider({ children }) {
  const { user, estado } = useAuth();
  const [linhas, setLinhas] = useState(ler);
  useEffect(() => { gravar(linhas); }, [linhas]);
  // Sem sessão (terminada, expirada ou nunca iniciada) a requisição esvazia-se: não passa de uma pessoa para outra.
  // Enquanto a sessão ainda está a ser verificada ('carregando') não se mexe, para sobreviver a um recarregamento.
  useEffect(() => { if (estado === 'anonimo') setLinhas([]); }, [estado]);
  // Trocar de conta sem passar por anónimo também esvazia.
  const id = user?.id ?? null;
  const [dono, setDono] = useState(id);
  useEffect(() => { if (id && dono && id !== dono) setLinhas([]); if (id) setDono(id); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const adicionar = useCallback((linha) => setLinhas((atual) => {
    const i = atual.findIndex((l) => l.productId === linha.productId);
    if (i < 0) return [...atual, linha];
    const copia = [...atual];
    copia[i] = { ...copia[i], quantity: copia[i].quantity + linha.quantity };
    return copia;
  }), []);
  const alterarQuantidade = useCallback((productId, quantity) => setLinhas((a) => a.map((l) => (l.productId === productId ? { ...l, quantity } : l))), []);
  const remover = useCallback((productId) => setLinhas((a) => a.filter((l) => l.productId !== productId)), []);
  const removerFornecedor = useCallback((supplierId) => setLinhas((a) => a.filter((l) => l.supplierId !== supplierId)), []);
  const limpar = useCallback(() => setLinhas([]), []);

  const valor = useMemo(() => ({ linhas, total: linhas.reduce((s, l) => s + l.quantity, 0), adicionar, alterarQuantidade, remover, removerFornecedor, limpar }), [linhas, adicionar, alterarQuantidade, remover, removerFornecedor, limpar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useRequisicao() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRequisicao fora de <RequisicaoProvider>');
  return v;
}
