import { Children, cloneElement, forwardRef, isValidElement, useId } from 'react';

/**
 * Campo de formulário acessível. Liga o <label>, a ajuda e o erro ao controlo filho (id, aria-describedby,
 * aria-invalid, required), por isso quem o usa não tem de gerir ids:
 *
 *   <Field label="Nome" hint="Como aparece na factura" error={erro}><Input value={…} onChange={…} /></Field>
 */
export function Field({ label, hint, error, required = false, className = '', children }) {
  const id = useId();
  const idAjuda = hint ? `${id}-ajuda` : undefined;
  const idErro = error ? `${id}-erro` : undefined;
  const descricao = [idAjuda, idErro].filter(Boolean).join(' ') || undefined;
  const filho = Children.only(children);
  const controlo = isValidElement(filho)
    ? cloneElement(filho, { id, 'aria-describedby': descricao, 'aria-invalid': error ? 'true' : undefined, required: required || undefined })
    : filho;
  return (
    <div className={`kx-field ${error ? 'kx-field--erro' : ''} ${className}`.trim()}>
      <label htmlFor={id} className="kx-field__label">
        {label}
        {required ? <span className="kx-field__req" aria-hidden="true"> *</span> : null}
      </label>
      {controlo}
      {hint ? <p id={idAjuda} className="kx-field__hint">{hint}</p> : null}
      {error ? <p id={idErro} className="kx-field__error" role="alert">{error}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', ...resto }, ref) {
  return <input ref={ref} className={`kx-input ${className}`.trim()} {...resto} />;
});

export const Textarea = forwardRef(function Textarea({ className = '', rows = 4, ...resto }, ref) {
  return <textarea ref={ref} rows={rows} className={`kx-input kx-textarea ${className}`.trim()} {...resto} />;
});

export const Select = forwardRef(function Select({ className = '', children, ...resto }, ref) {
  return (
    <select ref={ref} className={`kx-input kx-select ${className}`.trim()} {...resto}>
      {children}
    </select>
  );
});

/** Caixa de selecção com rótulo clicável. */
export const Checkbox = forwardRef(function Checkbox({ label, className = '', ...resto }, ref) {
  return (
    <label className={`kx-check ${className}`.trim()}>
      <input ref={ref} type="checkbox" className="kx-check__input" {...resto} />
      <span className="kx-check__box" aria-hidden="true" />
      <span className="kx-check__label">{label}</span>
    </label>
  );
});

/** Interruptor (liga/desliga) — role="switch". */
export const Switch = forwardRef(function Switch({ label, className = '', ...resto }, ref) {
  return (
    <label className={`kx-switch ${className}`.trim()}>
      <input ref={ref} type="checkbox" role="switch" className="kx-switch__input" {...resto} />
      <span className="kx-switch__track" aria-hidden="true"><span className="kx-switch__thumb" /></span>
      <span className="kx-check__label">{label}</span>
    </label>
  );
});
