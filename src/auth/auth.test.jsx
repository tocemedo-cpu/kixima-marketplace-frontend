import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { RequireAuth, RequireRole } from './Guardas';
import fxMe from '../test/fixtures/auth-me.json';

const resp = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const erro = (status, code = 'ERRO') => resp({ error: { code, message: 'msg' } }, status);
let fetchMock;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

function Sonda() {
  const a = useAuth();
  return (
    <div>
      <p data-testid="estado">{a.estado}{a.sessaoIndeterminada ? '+indeterminada' : ''}</p>
      <p data-testid="nome">{a.user?.name || '-'}</p>
      <button onClick={() => a.entrar('a@x.co', 'p').then((r) => { document.title = r.requires2fa ? '2fa' : 'ok'; })}>entrar</button>
      <button onClick={() => a.verificar2fa('c', '123456')}>verificar</button>
      <button onClick={a.sair}>sair</button>
    </div>
  );
}
const montar = (ui = <Sonda />) => render(<MemoryRouter><AuthProvider>{ui}</AuthProvider></MemoryRouter>);

describe('AuthProvider', () => {
  it('sem marca de sessão não faz nenhum pedido (evita um 401 garantido) e fica anónimo', () => {
    montar();
    expect(screen.getByTestId('estado')).toHaveTextContent('anonimo');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('com marca, pergunta /api/auth/me e fica autenticado', async () => {
    localStorage.setItem('kixima.sessao', '1');
    fetchMock.mockImplementation(() => Promise.resolve(resp(fxMe)));
    montar();
    expect(screen.getByTestId('estado')).toHaveTextContent('carregando');
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('autenticado'));
    expect(screen.getByTestId('nome')).toHaveTextContent(fxMe.user.name);
  });

  it('um 401 em /me limpa a marca e fica anónimo', async () => {
    localStorage.setItem('kixima.sessao', '1');
    fetchMock.mockImplementation(() => Promise.resolve(erro(401, 'UNAUTHORIZED')));
    montar();
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('anonimo'));
    expect(localStorage.getItem('kixima.sessao')).toBeNull();
  });

  it('um 503 em /me NÃO termina a sessão: mantém a marca e fica indeterminada', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      localStorage.setItem('kixima.sessao', '1');
      fetchMock.mockImplementation(() => Promise.resolve(erro(503, 'SERVICO_INDISPONIVEL')));
      montar();
      await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('indeterminada'), { timeout: 4000 });
      expect(localStorage.getItem('kixima.sessao')).toBe('1');
    } finally { vi.useRealTimers(); }
  });

  it('login guarda a marca, nunca o token; logout limpa tudo', async () => {
    fetchMock.mockImplementation((url) => Promise.resolve(url === '/api/auth/login' ? resp({ token: 'SEGREDO', user: fxMe.user }) : resp({})));
    montar();
    await userEvent.click(screen.getByText('entrar'));
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('autenticado'));
    expect(localStorage.getItem('kixima.sessao')).toBe('1');
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('SEGREDO');
    expect(JSON.stringify(Object.entries(sessionStorage))).not.toContain('SEGREDO');
    await userEvent.click(screen.getByText('sair'));
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('anonimo'));
    expect(localStorage.getItem('kixima.sessao')).toBeNull();
    expect(fetchMock.mock.calls.at(-1)[0]).toBe('/api/auth/logout');
  });

  it('login com 2FA fica anónimo até verificar o código', async () => {
    fetchMock.mockImplementation((url) => Promise.resolve(url === '/api/auth/login' ? resp({ requires2fa: true, challenge: 'c', metodo: 'TOTP' }) : resp({ user: fxMe.user })));
    montar();
    await userEvent.click(screen.getByText('entrar'));
    await waitFor(() => expect(document.title).toBe('2fa'));
    expect(screen.getByTestId('estado')).toHaveTextContent('anonimo');
    await userEvent.click(screen.getByText('verificar'));
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('autenticado'));
  });

  it('sessão que expira a meio (401 noutra chamada) devolve o estado a anónimo', async () => {
    localStorage.setItem('kixima.sessao', '1');
    fetchMock.mockImplementation((url) => Promise.resolve(url === '/api/auth/me' ? resp(fxMe) : erro(401, 'UNAUTHORIZED')));
    const { api } = await import('../api/client');
    montar();
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('autenticado'));
    await api.get('/api/quotes').catch(() => {});
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('anonimo'));
  });
});

describe('guardas', () => {
  const rotas = (extra) => (
    <Routes>
      <Route path="/login" element={<p>PÁGINA DE LOGIN</p>} />
      <Route element={<RequireAuth />}>
        <Route path="/privada" element={<p>CONTEÚDO PRIVADO</p>} />
        <Route element={<RequireRole roles={['FORNECEDOR']} />}><Route path="/fornecedor" element={<p>ÁREA DO FORNECEDOR</p>} /></Route>
      </Route>
      {extra}
    </Routes>
  );
  const ir = (rota) => render(<MemoryRouter initialEntries={[rota]}><AuthProvider>{rotas()}</AuthProvider></MemoryRouter>);

  it('sem sessão leva ao login, guardando o destino', async () => {
    ir('/privada?x=1');
    expect(await screen.findByText('PÁGINA DE LOGIN')).toBeInTheDocument();
    expect(screen.queryByText('CONTEÚDO PRIVADO')).not.toBeInTheDocument();
  });

  it('com sessão mostra o conteúdo; o papel errado vê "Sem acesso" e não a área', async () => {
    localStorage.setItem('kixima.sessao', '1');
    fetchMock.mockImplementation(() => Promise.resolve(resp(fxMe)));
    const { unmount } = ir('/privada');
    expect(await screen.findByText('CONTEÚDO PRIVADO')).toBeInTheDocument();
    unmount();
    ir('/fornecedor');
    expect(await screen.findByText('Sem acesso a esta área')).toBeInTheDocument();
    expect(screen.queryByText('ÁREA DO FORNECEDOR')).not.toBeInTheDocument();
  });

  it('enquanto procura a sessão não mostra o conteúdo privado nem redirecciona', async () => {
    localStorage.setItem('kixima.sessao', '1');
    fetchMock.mockImplementation(() => new Promise(() => {}));
    ir('/privada');
    expect(await screen.findByText('A verificar a sessão…')).toBeInTheDocument();
    expect(screen.queryByText('PÁGINA DE LOGIN')).not.toBeInTheDocument();
  });
});
