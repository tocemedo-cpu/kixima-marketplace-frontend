import Icon from './Icon';

// Janela de páginas: 1 … 4 5 [6] 7 8 … 20 (sempre a primeira, a última e duas de cada lado da actual).
export function janelaDePaginas(pagina, paginas) {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  const set = new Set([1, paginas, pagina - 2, pagina - 1, pagina, pagina + 1, pagina + 2]);
  const lista = [...set].filter((n) => n >= 1 && n <= paginas).sort((a, b) => a - b);
  const saida = [];
  lista.forEach((n, i) => {
    if (i > 0 && n - lista[i - 1] > 1) saida.push('…');
    saida.push(n);
  });
  return saida;
}

/** Paginação. `page` é 1-based (como o `page`/`pages` que a API do marketplace devolve). */
export default function Pagination({ page, pages, onChange, label = 'Paginação' }) {
  if (!pages || pages <= 1) return null;
  const ir = (n) => { if (n >= 1 && n <= pages && n !== page) onChange(n); };
  return (
    <nav aria-label={label} className="kx-pagination">
      <button type="button" className="kx-pagination__btn" onClick={() => ir(page - 1)} disabled={page <= 1} aria-label="Página anterior">
        <Icon name="chevron-left" size={16} />
      </button>
      <ul>
        {janelaDePaginas(page, pages).map((n, i) => (
          <li key={`${n}-${i}`}>
            {n === '…' ? (
              <span className="kx-pagination__gap" aria-hidden="true">…</span>
            ) : (
              <button
                type="button"
                className={`kx-pagination__btn ${n === page ? 'is-active' : ''}`}
                onClick={() => ir(n)}
                aria-label={`Página ${n}`}
                aria-current={n === page ? 'page' : undefined}
              >
                {n}
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="kx-pagination__btn" onClick={() => ir(page + 1)} disabled={page >= pages} aria-label="Página seguinte">
        <Icon name="chevron-right" size={16} />
      </button>
    </nav>
  );
}
