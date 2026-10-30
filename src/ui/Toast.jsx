import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';

/**
 * Mensagens de confirmação ("Guardado.") e de erro curtas. Uma região aria-live anuncia-as sem tirar o foco.
 * Sucesso e informação somem sozinhas; erros ficam até serem fechadas (a pessoa precisa de tempo para as ler).
 *
 *   const toast = useToast(); toast.success('Pedido enviado.'); toast.error('Não foi possível enviar.');
 */
const ToastContext = createContext(null);
const MAX = 4;
const ICONE = { success: 'check', danger: 'alert', info: 'info' };

export function ToastProvider({ children, duracao = 5000 }) {
  const [lista, setLista] = useState([]);
  const seq = useRef(0);

  const fechar = useCallback((id) => setLista((l) => l.filter((t) => t.id !== id)), []);
  const abrir = useCallback((tone, texto) => {
    const id = ++seq.current;
    setLista((l) => [...l.slice(-(MAX - 1)), { id, tone, texto }]);
    return id;
  }, []);

  const api = useMemo(() => ({
    success: (t) => abrir('success', t),
    error: (t) => abrir('danger', t),
    info: (t) => abrir('info', t),
    dismiss: fechar,
  }), [abrir, fechar]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="kx-toasts" role="region" aria-label="Notificações" aria-live="polite">
        {lista.map((t) => <ToastItem key={t.id} toast={t} duracao={duracao} onClose={() => fechar(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, duracao, onClose }) {
  useEffect(() => {
    if (toast.tone === 'danger') return undefined; // erros não somem sozinhos
    const t = setTimeout(onClose, duracao);
    return () => clearTimeout(t);
  }, [toast.tone, duracao, onClose]);
  return (
    <div className={`kx-toast kx-toast--${toast.tone}`} role={toast.tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={ICONE[toast.tone]} size={18} />
      <span className="kx-toast__text">{toast.texto}</span>
      <button type="button" className="kx-toast__close" onClick={onClose} aria-label="Fechar notificação">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>.');
  return ctx;
}
