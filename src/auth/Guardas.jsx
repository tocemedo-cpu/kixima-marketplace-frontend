import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button, EmptyState, ErrorState, Spinner } from '../ui';
import { useAuth } from './AuthContext';
import { ROTULO_DE_PAPEL } from './papeis';

/**
 * Rotas privadas. Sem sessão leva ao login guardando o destino (?next=). Enquanto procura a sessão mostra
 * um indicador (nunca o conteúdo privado, nem um flash do login). Se o servidor não respondeu, oferece repetir.
 */
export function RequireAuth() {
  const { estado, sessaoIndeterminada, recarregar } = useAuth();
  const loc = useLocation();

  if (estado === 'carregando') {
    return <div className="kx-centro"><Spinner label="A verificar a sessão…" size={32} /></div>;
  }
  if (estado === 'anonimo' && sessaoIndeterminada) {
    return (
      <div className="kx-container kx-pagina">
        <ErrorState title="Não foi possível verificar a sua sessão" description="O servidor não respondeu. A sua sessão não foi terminada." onRetry={recarregar} />
      </div>
    );
  }
  if (estado === 'anonimo') {
    const next = `${loc.pathname}${loc.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

/** Restringe uma rota a certos papéis. O backend continua a ser quem autoriza; isto só evita ecrãs inúteis. */
export function RequireRole({ roles }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="kx-container kx-pagina">
        <EmptyState
          icon="shield"
          title="Sem acesso a esta área"
          description={`Esta área é para ${roles.map((r) => ROTULO_DE_PAPEL[r] || r).join(' ou ')}. A sua conta é ${ROTULO_DE_PAPEL[user?.role] || 'desconhecida'}.`}
          action={<Button as={Link} to="/" variant="primary">Ir para o marketplace</Button>}
        />
      </div>
    );
  }
  return <Outlet />;
}
