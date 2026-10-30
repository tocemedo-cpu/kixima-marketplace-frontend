// Estado de sessão. A sessão em si é o cookie `httpOnly` do servidor: o JavaScript da página não a vê.
// O que se guarda em localStorage é só uma MARCA ('1') de "esta pessoa já iniciou sessão neste browser" — não é
// credencial; serve para não fazer um pedido garantidamente 401 em cada visita de quem nunca entrou.
//
// Estados: 'carregando' (à procura da sessão) | 'anonimo' | 'autenticado'. `sessaoIndeterminada` distingue
// "a sessão pode existir mas o servidor não respondeu" (rede, 5xx, 429) de "não há sessão" (401): num soluço do
// servidor NÃO se deita fora uma sessão boa.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { definirAoSessaoExpirada } from '../api/client';
import * as auth from '../api/endpoints/auth';

const MARCA = 'kixima.sessao';
const lerMarca = () => { try { return localStorage.getItem(MARCA) === '1'; } catch { return false; } };
const guardarMarca = (v) => { try { if (v) localStorage.setItem(MARCA, '1'); else localStorage.removeItem(MARCA); } catch { /* sem armazenamento */ } };

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [estado, setEstado] = useState(lerMarca() ? 'carregando' : 'anonimo');
  const [sessaoIndeterminada, setSessaoIndeterminada] = useState(false);
  const vivo = useRef(true);

  const limpar = useCallback(() => { guardarMarca(false); setUser(null); setSessaoIndeterminada(false); setEstado('anonimo'); }, []);

  const carregarEu = useCallback(async () => {
    setEstado((e) => (e === 'autenticado' ? e : 'carregando'));
    try {
      const u = await auth.eu();
      if (!vivo.current) return;
      setUser(u); setSessaoIndeterminada(false); setEstado('autenticado');
    } catch (err) {
      if (!vivo.current) return;
      if (err.status === 401) { limpar(); return; }
      // Rede / 5xx / 429: mantém o que se sabia; não termina a sessão por um soluço.
      setSessaoIndeterminada(true);
      setEstado((e) => (e === 'autenticado' ? e : 'anonimo'));
    }
  }, [limpar]);

  useEffect(() => {
    vivo.current = true;
    definirAoSessaoExpirada(limpar);
    if (lerMarca()) carregarEu();
    return () => { vivo.current = false; definirAoSessaoExpirada(null); };
  }, [carregarEu, limpar]);

  /** Devolve { user } (sessão iniciada) ou { requires2fa, challenge, metodo, enviadoPara } (falta o 2.º passo). */
  const entrar = useCallback(async (email, password) => {
    const r = await auth.entrar(email, password);
    if (r.user) { guardarMarca(true); setUser(r.user); setSessaoIndeterminada(false); setEstado('autenticado'); }
    return r;
  }, []);

  const verificar2fa = useCallback(async (challenge, code) => {
    const u = await auth.verificar2fa(challenge, code);
    guardarMarca(true); setUser(u); setSessaoIndeterminada(false); setEstado('autenticado');
    return u;
  }, []);

  const sair = useCallback(async () => {
    try { await auth.sair(); } catch { /* sem rede: sai na mesma deste browser */ }
    limpar();
  }, [limpar]);

  const value = useMemo(() => ({
    user, estado, carregando: estado === 'carregando', autenticado: estado === 'autenticado', sessaoIndeterminada,
    entrar, verificar2fa, sair, recarregar: carregarEu,
  }), [user, estado, sessaoIndeterminada, entrar, verificar2fa, sair, carregarEu]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}
