import Icon from './Icon';
import { Skeleton } from './States';
import { EmptyState } from './States';

/**
 * Tabela de dados. `columns`: [{ key, header, render?(linha), align?, mono?, sortable? }].
 * No telemóvel cada linha passa a cartão (cada célula traz o seu rótulo via data-label), por isso não há
 * barra de rolagem horizontal. Ordenação controlada: `sort={{ key, dir: 'asc'|'desc' }}` + `onSort(key)`.
 */
export default function Table({
  caption, columns, rows, getRowKey = (r, i) => r.id ?? i, sort, onSort, loading = false, empty, onRowClick,
}) {
  const aria = (key) => (sort?.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined);
  return (
    <div className="kx-table-wrap">
      <table className="kx-table">
        {caption ? <caption className="kx-sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" aria-sort={c.sortable ? aria(c.key) || 'none' : undefined} className={c.align ? `kx-align-${c.align}` : undefined}>
                {c.sortable && onSort ? (
                  <button type="button" className="kx-table__sort" onClick={() => onSort(c.key)}>
                    {c.header}
                    <Icon name={sort?.key === c.key && sort.dir === 'asc' ? 'chevron-up' : 'chevron-down'} size={14} />
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
              <tr key={`sk-${i}`} aria-hidden="true">
                {columns.map((c) => <td key={c.key} data-label={c.header}><Skeleton height="1em" /></td>)}
              </tr>
            ))
            : rows.map((linha, i) => (
              <tr key={getRowKey(linha, i)} className={onRowClick ? 'kx-table__row--click' : undefined} onClick={onRowClick ? () => onRowClick(linha) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} data-label={c.header} className={[c.align && `kx-align-${c.align}`, c.mono && 'kx-mono'].filter(Boolean).join(' ') || undefined}>
                    {c.render ? c.render(linha) : linha[c.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 ? (empty || <EmptyState title="Sem resultados" description="Não há registos para mostrar." />) : null}
    </div>
  );
}
