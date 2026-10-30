import { useState } from 'react';
import { facetas } from '../api/endpoints/mercado';
import { useAsync } from '../lib/useAsync';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button, TemaSeletor } from '../ui';
import { navegacaoDe } from './navegacao';
import Shell from './Shell';
import UserMenu from './UserMenu';

/** Navegação do visitante: o catálogo primeiro. As categorias vêm da API (facetas públicas). */
function navegacaoPublica(categorias) {
  return [
    {
      label: 'Categorias',
      children: [
        ...categorias.slice(0, 8).map((c) => ({ label: c.name, to: `/categorias/${encodeURIComponent(c.name)}`, description: `${c.count} ${c.count === 1 ? 'oferta' : 'ofertas'}` })),
        { label: 'Todas as categorias', to: '/categorias' },
      ],
    },
    { label: 'Produtos', to: '/produtos' },
    { label: 'Serviços', to: '/servicos' },
    { label: 'Fornecedoras', to: '/fornecedores' },
    { label: 'Cotações', to: '/mercado/cotacoes' },
    { label: 'Planos', to: '/planos' },
    { label: 'Ajuda', to: '/faq' },
  ];
}

const RODAPE = [
  { title: 'Plataforma', links: [{ label: 'Planos e preços', to: '/planos' }, { label: 'Perguntas frequentes', to: '/faq' }] },
  { title: 'Empresas', links: [{ label: 'Registar empresa', to: '/cadastro' }, { label: 'Entrar', to: '/login' }] },
  { title: 'Legal', links: [{ label: 'Termos de uso', to: '/termos' }, { label: 'Política de privacidade', to: '/privacidade' }] },
];

const NOTA = (
  <>
    Plataforma B2B de procurement industrial para Angola. Contacto: <a href="mailto:geral@kixima.net">geral@kixima.net</a>
  </>
);

/** Esqueleto de toda a aplicação: a barra superior muda conforme há ou não sessão. */
export default function AppShell() {
  const { autenticado, user } = useAuth();
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const cats = useAsync((signal) => facetas({}, { signal }).catch(() => null), []);

  // A pesquisa é pública: qualquer visitante pesquisa sem login.
  const pesquisar = (q) => navegar(`/produtos${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);

  const topbar = {
    items: autenticado ? navegacaoDe(user?.role) : navegacaoPublica(cats.data?.categories || []),
    logoTo: '/',
    search: { value: texto, onChange: setTexto, onSubmit: pesquisar, placeholder: 'Pesquisar válvulas, inspeção, tubos, fornecedoras…' },
    actions: autenticado ? (
      <>
        <TemaSeletor />
        <UserMenu />
      </>
    ) : (
      <>
        <TemaSeletor />
        <Button as={Link} to="/login" variant="ondark" size="sm">Entrar</Button>
        <Button as={Link} to="/cadastro" variant="primary" size="sm" className="kx-hide-xs">Registar empresa</Button>
      </>
    ),
  };

  return <Shell topbar={topbar} footer={{ columns: RODAPE, note: NOTA }} />;
}
