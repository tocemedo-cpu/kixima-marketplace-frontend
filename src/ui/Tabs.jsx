import { useId, useRef } from 'react';

/**
 * Abas (padrão WAI-ARIA): setas esquerda/direita e Home/End movem o foco e a selecção; só a aba activa está
 * na ordem de tabulação. `items`: [{ id, label, content }]. Controlado: `value` + `onChange(id)`.
 */
export default function Tabs({ items, value, onChange, label }) {
  const base = useId();
  const refs = useRef({});
  const idx = Math.max(0, items.findIndex((i) => i.id === value));

  const ir = (n) => {
    const alvo = items[(n + items.length) % items.length];
    onChange(alvo.id);
    refs.current[alvo.id]?.focus();
  };
  const aoTeclar = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); ir(idx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(idx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); ir(0); }
    else if (e.key === 'End') { e.preventDefault(); ir(items.length - 1); }
  };

  return (
    <div className="kx-tabs">
      <div role="tablist" aria-label={label} className="kx-tabs__list" onKeyDown={aoTeclar}>
        {items.map((it) => {
          const activa = it.id === items[idx].id;
          return (
            <button
              key={it.id}
              ref={(el) => { refs.current[it.id] = el; }}
              type="button"
              role="tab"
              id={`${base}-t-${it.id}`}
              aria-selected={activa}
              aria-controls={`${base}-p-${it.id}`}
              tabIndex={activa ? 0 : -1}
              className={`kx-tabs__tab ${activa ? 'is-active' : ''}`}
              onClick={() => onChange(it.id)}
            >
              {it.label}
            </button>
          );
        })}
      </div>
      {items.map((it) => (
        <div
          key={it.id}
          role="tabpanel"
          id={`${base}-p-${it.id}`}
          aria-labelledby={`${base}-t-${it.id}`}
          hidden={it.id !== items[idx].id}
          className="kx-tabs__panel"
          tabIndex={0}
        >
          {it.id === items[idx].id ? it.content : null}
        </div>
      ))}
    </div>
  );
}
