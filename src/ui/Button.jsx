import { forwardRef } from 'react';
import Icon from './Icon';

/**
 * Botão. `variant`: primary (acção principal da vista, uma por ecrã), secondary, ghost, danger.
 * Com `as={Link}` (ou 'a') comporta-se como ligação mantendo o mesmo aspecto.
 * `loading` mostra o indicador e bloqueia novos cliques sem tirar o botão da ordem de tabulação.
 */
const Button = forwardRef(function Button(
  { as: Tag = 'button', variant = 'secondary', size = 'md', loading = false, leftIcon, rightIcon, disabled, className = '', children, ...resto },
  ref,
) {
  const bloqueado = disabled || loading;
  const props = { ...resto };
  if (Tag === 'button') {
    props.type = props.type || 'button';
    props.disabled = disabled; // só `disabled` real; `loading` usa aria-disabled para manter o foco
  } else if (bloqueado) {
    props['aria-disabled'] = 'true';
    props.tabIndex = -1;
  }
  if (loading) { props['aria-busy'] = 'true'; props['aria-disabled'] = 'true'; }
  const aoClicar = (e) => {
    if (loading || (Tag !== 'button' && disabled)) { e.preventDefault(); return; }
    resto.onClick?.(e);
  };
  return (
    <Tag
      ref={ref}
      {...props}
      onClick={aoClicar}
      className={`kx-btn kx-btn--${variant} kx-btn--${size} ${className}`.trim()}
    >
      {loading ? <span className="kx-spinner kx-spinner--inline" aria-hidden="true" /> : leftIcon ? <Icon name={leftIcon} size={size === 'lg' ? 20 : 18} /> : null}
      {children != null ? <span className="kx-btn__label">{children}</span> : null}
      {!loading && rightIcon ? <Icon name={rightIcon} size={size === 'lg' ? 20 : 18} /> : null}
    </Tag>
  );
});

export default Button;
