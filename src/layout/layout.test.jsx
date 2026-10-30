import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TopBar from './TopBar';
import Footer from './Footer';
import Shell from './Shell';

const ITENS = [
  { label: 'Início', to: '/', end: true },
  { label: 'Secção', children: [{ label: 'Primeira', to: '/a', description: 'Descrição' }, { label: 'Segunda', to: '/b' }] },
];

const montar = (ui, rota = '/') => render(<MemoryRouter initialEntries={[rota]}>{ui}</MemoryRouter>);

describe('TopBar', () => {
  it('mostra a marca como ligação à página inicial e a navegação principal', () => {
    montar(<TopBar items={ITENS} />);
    expect(screen.getByRole('link', { name: 'KIXIMA — página inicial' })).toHaveAttribute('href', '/');
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
  });

  it('a pesquisa é um formulário "search" com rótulo e entrega o texto ao submeter', async () => {
    const onSubmit = vi.fn();
    montar(<TopBar items={ITENS} search={{ value: 'válvula', onChange: () => {}, onSubmit }} />);
    expect(screen.getByRole('search')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pesquisar' }));
    expect(onSubmit).toHaveBeenCalledWith('válvula');
  });

  it('sem pesquisa configurada não desenha o campo', () => {
    montar(<TopBar items={ITENS} />);
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
  });

  it('menu suspenso: abre por clique, expõe aria-expanded e fecha com Esc devolvendo o foco', async () => {
    montar(<TopBar items={ITENS} />);
    const gatilho = screen.getByRole('button', { name: 'Secção' });
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(gatilho);
    expect(gatilho).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /Primeira/ })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');
    expect(gatilho).toHaveFocus();
  });

  it('menu suspenso fecha ao clicar fora', async () => {
    montar(<><TopBar items={ITENS} /><button>fora</button></>);
    const gatilho = screen.getByRole('button', { name: 'Secção' });
    await userEvent.click(gatilho);
    await userEvent.click(screen.getByRole('button', { name: 'fora' }));
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');
  });

  it('o botão de menu abre a gaveta móvel com todas as ligações', async () => {
    montar(<TopBar items={ITENS} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const gaveta = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(gaveta).getByRole('link', { name: 'Início' })).toBeInTheDocument();
    expect(within(gaveta).getByRole('link', { name: 'Primeira' })).toBeInTheDocument();
    await userEvent.click(within(gaveta).getByRole('link', { name: 'Segunda' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Footer e Shell', () => {
  it('o rodapé só mostra o que lhe é passado', () => {
    montar(<Footer columns={[{ title: 'Ajuda', links: [{ label: 'FAQ', to: '/faq' }] }]} note="Nota institucional." />);
    expect(screen.getByRole('navigation', { name: 'Ajuda' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq');
    expect(screen.getByText('Nota institucional.')).toBeInTheDocument();
    expect(screen.getByText(/Todos os direitos reservados/)).toBeInTheDocument();
  });

  it('o Shell tem "saltar para o conteúdo" e um <main> focável como alvo', () => {
    montar(<Shell topbar={{ items: ITENS }} footer={{}}><p>Conteúdo</p></Shell>);
    expect(screen.getByRole('link', { name: 'Saltar para o conteúdo' })).toHaveAttribute('href', '#conteudo');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'conteudo');
    expect(main).toHaveTextContent('Conteúdo');
  });
});

describe('ligação activa com âncoras', () => {
  it('só a âncora da localização actual fica activa; o caminho sem âncora fica activo na página', async () => {
    const { ligacaoActiva } = await import('./TopBar');
    const loc = { pathname: '/design', hash: '#cores' };
    expect(ligacaoActiva('/design', true, loc)).toBe(true);
    expect(ligacaoActiva('/design#cores', false, loc)).toBe(true);
    expect(ligacaoActiva('/design#marca', false, loc)).toBe(false);
    expect(ligacaoActiva('/outra', false, loc)).toBe(false);
    expect(ligacaoActiva('/design', false, { pathname: '/design/x', hash: '' })).toBe(true);
    expect(ligacaoActiva('/design', true, { pathname: '/design/x', hash: '' })).toBe(false);
  });
});
