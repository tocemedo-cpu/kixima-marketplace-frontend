import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ROTULO_DE_EMPRESA, ROTULO_DE_PAPEL } from '../../auth/papeis';
import { Alert, Breadcrumb, Button, Card, CardBody, CardHeader } from '../../ui';

/** A minha conta: os dados da sessão (GET /api/auth/me). As áreas de trabalho por perfil entram na Fase 5. */
export default function Conta() {
  const { user } = useAuth();
  return (
    <div className="kx-container kx-pagina">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'A minha conta' }]} />
      <header className="kx-pagina__cabeca"><h1>A minha conta</h1></header>
      {user.mfaPendente ? (
        <Alert tone="warning" title="Segurança da conta">A verificação em dois passos ainda não está ativa na sua conta. Recomendamos ativá-la.</Alert>
      ) : null}
      <Card className="kx-conta">
        <CardHeader title={user.name} subtitle={user.email} as="h2" />
        <CardBody>
          <dl className="kx-ficha__dados">
            <dt>Perfil</dt><dd>{ROTULO_DE_PAPEL[user.role] || user.role}</dd>
            {user.companyName ? <><dt>Empresa</dt><dd>{user.companyName}{user.companyType ? ` (${ROTULO_DE_EMPRESA[user.companyType] || user.companyType})` : ''}</dd></> : null}
            {user.companyPlan ? <><dt>Plano</dt><dd>{user.companyPlan}</dd></> : null}
          </dl>
          <p><Button as={Link} to="/" variant="primary">Ir para o mercado</Button></p>
        </CardBody>
      </Card>
    </div>
  );
}
