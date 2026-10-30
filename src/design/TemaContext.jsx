// Tema visual: Claro, Escuro 1, Escuro 2, ou o do sistema.
//
// A escolha vive em localStorage ('kixima.tema') e fixa-se em <html data-tema="…">. Sem escolha, o atributo
// não existe e o CSS segue o prefers-color-scheme (ver temas.css). public/tema-init.js aplica o valor
// guardado antes do primeiro paint, por isso não há "piscar" ao abrir.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const CHAVE_TEMA = 'kixima.tema';

export const TEMAS = [
  { id: 'sistema', label: 'Sistema', titulo: 'Segue a preferência do dispositivo' },
  { id: 'claro', label: 'Claro', titulo: 'Marfim e preto, o fundo base da marca' },
  { id: 'escuro-1', label: 'Escuro 1', titulo: 'O mesmo sistema invertido, com os neutros quentes do manual' },
  { id: 'escuro-2', label: 'Escuro 2', titulo: 'Azul-noite com âmbar de segurança' },
];

const IDS_VALIDOS = ['claro', 'escuro-1', 'escuro-2'];

function lerGuardado() {
  try {
    const v = localStorage.getItem(CHAVE_TEMA);
    return IDS_VALIDOS.includes(v) ? v : 'sistema';
  } catch {
    return 'sistema'; // armazenamento indisponível (janela privada): fica o do sistema
  }
}

const TemaContext = createContext(null);

export function TemaProvider({ children }) {
  const [escolha, setEscolha] = useState(lerGuardado);

  useEffect(() => {
    const raiz = document.documentElement;
    if (escolha === 'sistema') raiz.removeAttribute('data-tema');
    else raiz.setAttribute('data-tema', escolha);
  }, [escolha]);

  const definir = useCallback((id) => {
    const novo = id === 'sistema' || IDS_VALIDOS.includes(id) ? id : 'sistema';
    setEscolha(novo);
    try {
      if (novo === 'sistema') localStorage.removeItem(CHAVE_TEMA);
      else localStorage.setItem(CHAVE_TEMA, novo);
    } catch { /* sem armazenamento: a escolha vale só para esta sessão */ }
  }, []);

  const value = useMemo(() => ({ escolha, definir, temas: TEMAS }), [escolha, definir]);
  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>;
}

export function useTema() {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error('useTema deve ser usado dentro de <TemaProvider>.');
  return ctx;
}
