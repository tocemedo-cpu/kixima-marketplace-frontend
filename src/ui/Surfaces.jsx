// Superfícies e sinais: Card, Badge, Alert, Fio, Breadcrumb.
import { Link } from 'react-router-dom';
import Icon from './Icon';

export function Card({ as: Tag = 'section', raised = false, interactive = false, className = '', children, ...resto }) {
  return (
    <Tag className={`kx-card ${raised ? 'kx-card--raised' : ''} ${interactive ? 'kx-card--interactive' : ''} ${className}`.trim()} {...resto}>
      {children}
    </Tag>
  );
}
export function CardHeader({ title, subtitle, actions, as: Tag = 'h3' }) {
  return (
    <header className="kx-card__header">
      <div>
        <Tag className="kx-card__title">{title}</Tag>
        {subtitle ? <p className="kx-card__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="kx-card__actions">{actions}</div> : null}
    </header>
  );
}
export function CardBody({ className = '', children }) {
  return <div className={`kx-card__body ${className}`.trim()}>{children}</div>;
}
export function CardFooter({ className = '', children }) {
  return <footer className={`kx-card__footer ${className}`.trim()}>{children}</footer>;
}

/** Selo de estado. O texto comunica o estado; a cor só reforça (nunca é o único sinal). */
export function Badge({ tone = 'neutral', dot = false, className = '', children }) {
  return (
    <span className={`kx-badge kx-badge--${tone} ${className}`.trim()}>
      {dot ? <span className="kx-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

const ICONE_ALERTA = { success: 'check', warning: 'alert', danger: 'alert', info: 'info' };

/** Mensagem em linha. danger/warning anunciam-se logo (role="alert"); as outras de forma não intrusiva. */
export function Alert({ tone = 'info', title, onClose, className = '', children }) {
  const urgente = tone === 'danger' || tone === 'warning';
  return (
    <div className={`kx-alert kx-alert--${tone} ${className}`.trim()} role={urgente ? 'alert' : 'status'}>
      <Icon name={ICONE_ALERTA[tone] || 'info'} size={20} className="kx-alert__icon" />
      <div className="kx-alert__body">
        {title ? <strong className="kx-alert__title">{title}</strong> : null}
        <div>{children}</div>
      </div>
      {onClose ? (
        <button type="button" className="kx-alert__close" onClick={onClose} aria-label="Fechar mensagem">
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}

/** Fio Samakaka (4px) — assinatura da marca. Decorativo. */
export function Fio({ className = '' }) {
  return <span className={`kx-fio ${className}`.trim()} aria-hidden="true" />;
}

export function Breadcrumb({ items }) {
  return (
    <nav aria-label="Localização" className="kx-breadcrumb">
      <ol>
        {items.map((it, i) => {
          const ultimo = i === items.length - 1;
          return (
            <li key={`${it.label}-${i}`}>
              {ultimo || !(it.to || it.href) ? <span aria-current={ultimo ? 'page' : undefined}>{it.label}</span> : it.to ? <Link to={it.to}>{it.label}</Link> : <a href={it.href}>{it.label}</a>}
              {!ultimo ? <Icon name="chevron-right" size={14} className="kx-breadcrumb__sep" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
