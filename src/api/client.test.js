import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, definirAoSessaoExpirada, eCancelamento, mensagemDeErro, request } from './client';

const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); definirAoSessaoExpirada(null); });

describe('pedidos', () => {
  it('envia o cookie (credentials include), Accept JSON e ignora parâmetros vazios', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await api.get('/api/x', { q: 'válvula', page: 2, vazio: '', nulo: null, indef: undefined, falso: false, zero: 0 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/x?q=v%C3%A1lvula&page=2&zero=0');
    expect(init.credentials).toBe('include');
    expect(init.headers.Accept).toBe('application/json');
  });

  it('corpo JSON leva Content-Type; FormData não (o browser define o boundary)', async () => {
    fetchMock.mockResolvedValue(json({}));
    await api.post('/api/x', { a: 1 });
    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
    expect(fetchMock.mock.calls[0][1].body).toBe('{"a":1}');
    const fd = new FormData(); fd.append('a', '1');
    await api.postForm('/api/y', fd);
    expect(fetchMock.mock.calls[1][1].headers['Content-Type']).toBeUndefined();
    expect(fetchMock.mock.calls[1][1].body).toBe(fd);
  });

  it('204 devolve null', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await api.delete('/api/x')).toBeNull();
  });

  it('nunca envia Authorization nem lê cookies', async () => {
    fetchMock.mockResolvedValue(json({}));
    await api.get('/api/x');
    expect(Object.keys(fetchMock.mock.calls[0][1].headers).map((h) => h.toLowerCase())).not.toContain('authorization');
  });
});

describe('erros normalizados', () => {
  it('lê { error: { code, message, details } } do backend', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: { formErrors: [], fieldErrors: { email: ['Invalid'] } } } }, 422));
    const e = await api.post('/api/auth/login', {}).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 422, code: 'VALIDATION_ERROR', message: 'Dados inválidos.' });
    expect(e.isValidation).toBe(true);
    expect(e.fieldErrors).toEqual({ email: ['Invalid'] });
  });

  it('corpo que não é JSON (ex.: página de erro de um proxy) dá um erro genérico por estado', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 500, headers: { 'Content-Type': 'text/html' } }));
    const e = await api.post('/api/x', {}).catch((x) => x);
    expect(e).toMatchObject({ status: 500, code: 'HTTP_500' });
    expect(mensagemDeErro(e)).toMatch(/servidor teve um problema/);
  });

  it('mensagens: 4xx usa a do servidor; 5xx e rede usam texto genérico', () => {
    expect(mensagemDeErro(new ApiError({ status: 401, message: 'Credenciais inválidas.' }))).toBe('Credenciais inválidas.');
    expect(mensagemDeErro(new ApiError({ status: 503, code: 'SERVICO_INDISPONIVEL', message: 'detalhe técnico' }))).not.toMatch(/técnico/);
    expect(mensagemDeErro(new ApiError({ code: 'REDE' }))).toMatch(/Sem ligação/);
    expect(mensagemDeErro(new Error('x'))).toBe('Ocorreu um erro inesperado.');
  });
});

describe('sessão expirada', () => {
  it('um 401 numa chamada normal avisa o AuthContext', async () => {
    const aviso = vi.fn(); definirAoSessaoExpirada(aviso);
    fetchMock.mockResolvedValue(json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, 401));
    await api.get('/api/public/catalog/search').catch(() => {});
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it.each(['/api/auth/login', '/api/auth/2fa/verify', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/companies/invite/abc/accept', '/api/companies/register'])('um 401 em %s NÃO é sessão expirada', async (caminho) => {
    const aviso = vi.fn(); definirAoSessaoExpirada(aviso);
    fetchMock.mockResolvedValue(json({ error: { code: 'UNAUTHORIZED', message: 'Credenciais inválidas.' } }, 401));
    await api.post(caminho, {}).catch(() => {});
    expect(aviso).not.toHaveBeenCalled();
  });
});

describe('repetições', () => {
  it('GET repete em 503 com espera crescente e acaba por devolver o sucesso', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({}, 502)).mockResolvedValueOnce(json({ ok: 1 }));
    const p = api.get('/api/x');
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(600);
    expect(await p).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('GET desiste ao fim das repetições com o último erro', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => Promise.resolve(json({ error: { code: 'SERVICO_INDISPONIVEL', message: 'x' } }, 503))); // uma Response nova por chamada (o corpo só lê uma vez)
    const p = api.get('/api/x').catch((e) => e);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toMatchObject({ status: 503, code: 'SERVICO_INDISPONIVEL' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('POST nunca repete sozinho (não é idempotente)', async () => {
    fetchMock.mockResolvedValue(json({}, 503));
    await api.post('/api/quotes', {}).catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('4xx não repete', async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    await api.get('/api/x').catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falha de rede num POST dá REDE à primeira', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const e = await api.post('/api/x', {}).catch((x) => x);
    expect(e).toMatchObject({ code: 'REDE', status: 0 });
    expect(e.isNetwork).toBe(true);
  });
});

describe('tempo limite e cancelamento', () => {
  it('sem resposta a tempo dá TEMPO_ESGOTADO', async () => {
    fetchMock.mockImplementation((_u, init) => new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('abortado', 'AbortError')))));
    const e = await request('POST', '/api/x', { body: {}, tempoLimite: 20 }).catch((x) => x);
    expect(e).toMatchObject({ code: 'TEMPO_ESGOTADO' });
  });

  it('cancelar pelo chamador relança o AbortError (e não é um ApiError)', async () => {
    const ctl = new AbortController();
    fetchMock.mockImplementation((_u, init) => new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('abortado', 'AbortError')))));
    const p = api.get('/api/x', undefined, { signal: ctl.signal }).catch((x) => x);
    ctl.abort();
    const e = await p;
    expect(eCancelamento(e)).toBe(true);
    expect(e).not.toBeInstanceOf(ApiError);
  });
});
