// Estados de uma vista: a carregar, vazio e erro. Cada vista de dados deve usar os três.
import Icon from './Icon';
import Button from './Button';

export function Spinner({ label = 'A carregar…', size = 24 }) {
  return (
    <span className="kx-spinner" role="status" style={{ width: size, height: size }}>
      <span className="kx-sr-only">{label}</span>
    </span>
  );
}

/** Esqueleto: reserva o espaço do conteúdo (sem saltos de layout) enquanto carrega. */
export function Skeleton({ lines = 3, height, width = '100%', className = '' }) {
  if (height) return <span className={`kx-skeleton ${className}`.trim()} style={{ height, width }} aria-hidden="true" />;
  return (
    <span className={`kx-skeleton-group ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="kx-skeleton" style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' }} />
      ))}
    </span>
  );
}

export function EmptyState({ icon = 'box', title, description, action }) {
  return (
    <div className="kx-state">
      <span className="kx-state__icon"><Icon name={icon} size={28} /></span>
      <h3 className="kx-state__title">{title}</h3>
      {description ? <p className="kx-state__text">{description}</p> : null}
      {action ? <div className="kx-state__action">{action}</div> : null}
    </div>
  );
}

/** Erro de carregamento: diz o que falhou e oferece repetir. `detalhe` vem do erro normalizado da API. */
export function ErrorState({ title = 'Não foi possível carregar', description, detalhe, onRetry }) {
  return (
    <div className="kx-state kx-state--erro" role="alert">
      <span className="kx-state__icon"><Icon name="alert" size={28} /></span>
      <h3 className="kx-state__title">{title}</h3>
      {description ? <p className="kx-state__text">{description}</p> : null}
      {detalhe ? <p className="kx-state__detail kx-mono">{detalhe}</p> : null}
      {onRetry ? <div className="kx-state__action"><Button onClick={onRetry}>Tentar de novo</Button></div> : null}
    </div>
  );
}
