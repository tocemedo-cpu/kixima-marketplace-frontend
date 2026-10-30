import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';
import Icon from './Icon';

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal acessível: role="dialog" + aria-modal, foco preso lá dentro, Esc fecha, o foco volta ao
 * elemento que o abriu, e a página por trás não rola. `closeOnScrim=false` para formulários com dados por guardar.
 */
export default function Modal({ open, onClose, title, children, footer, size = 'md', closeOnScrim = true, placement = 'center' }) {
  const idTitulo = useId();
  const caixa = useRef(null);
  const anterior = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    anterior.current = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Foco inicial: o primeiro controlo; senão a própria caixa.
    const ini = caixa.current?.querySelector('[data-autofocus]') || caixa.current?.querySelector(FOCAVEIS) || caixa.current;
    ini?.focus();
    return () => {
      document.body.style.overflow = overflow;
      anterior.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const aoTeclar = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const lista = [...caixa.current.querySelectorAll(FOCAVEIS)];
    if (lista.length === 0) { e.preventDefault(); return; }
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  };

  return createPortal(
    <div className={`kx-modal ${placement === 'left' ? 'kx-modal--left' : ''}`.trim()} onKeyDown={aoTeclar}>
      <div className="kx-modal__scrim" onClick={closeOnScrim ? onClose : undefined} aria-hidden="true" />
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1} className={`kx-modal__box kx-modal__box--${size}`}>
        <header className="kx-modal__header">
          <h2 id={idTitulo} className="kx-modal__title">{title}</h2>
          <button type="button" className="kx-modal__close" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="kx-modal__body">{children}</div>
        {footer ? <footer className="kx-modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmação para operações importantes (aprovar, rejeitar, pagar, eliminar). `onConfirm` pode ser assíncrono:
 * enquanto corre, o botão mostra "a processar" e o diálogo não fecha; se falhar, mostra o erro e fica aberto.
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'primary' }) {
  const [a, setA] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { if (!open) { setA(false); setErro(''); } }, [open]);

  const confirmar = async () => {
    setA(true); setErro('');
    try { await onConfirm(); onClose(); }
    catch (e) { setErro(e?.message || 'Não foi possível concluir a operação.'); }
    finally { setA(false); }
  };

  return (
    <Modal
      open={open}
      onClose={a ? () => {} : onClose}
      title={title}
      size="sm"
      closeOnScrim={false}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={a} data-autofocus>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={confirmar} loading={a}>{confirmLabel}</Button>
        </>
      )}
    >
      {children}
      {erro ? <p className="kx-field__error" role="alert">{erro}</p> : null}
    </Modal>
  );
}
