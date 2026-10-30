import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DOCUMENTOS, SENHA_MINIMA_ADMIN, validarRegisto } from './Registo';
import { minimoSenha } from './ConviteERecuperacao';
import { comPapel, erroApi, json, montarApp, PAINEL_COMPRADOR, PAINEL_FORNECEDOR } from '../../test/utils';
import fxLogin from '../../test/fixtures/auth-login.json';

const preencherLogin = async (email = 'comprador@petroangola.co.ao', senha = 'x-senha') => {
  await userEvent.type(await screen.findByLabelText(/^Email/), email);
  await userEvent.type(screen.getByLabelText(/^Senha/), senha);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar', exact: true }));
};
const PAGINA_MERCADO = {...PAINEL_COMPRADOR,  'GET /api/public/catalog/facets': { categories: [], kinds: [] }, 'GET /api/public/catalog/search': { items: [], total: 0, page: 1, pages: 1, limit: 8 }, 'GET /api/public/catalog/suppliers': [] };

describe('login', () => {
  it('valida campos vazios no cliente, sem chamar a API', async () => {
    const { chamadas } = montarApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar', exact: true }));
    expect(screen.getByText('Indique o seu email.')).toBeInTheDocument();
    expect(screen.getByText('Indique a sua senha.')).toBeInTheDocument();
    expect(chamadas.some((c) => c.url === '/api/auth/login')).toBe(false);
  });

  it('credenciais erradas mostram a mensagem do servidor e ficam no login', async () => {
    montarApp('/login', { rotas: { 'POST /api/auth/login': erroApi(401, 'UNAUTHORIZED', 'Credenciais inválidas.') } });
    await preencherLogin();
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciais inválidas.');
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
  });

  it('sucesso: vai para o destino guardado em ?next= (e só destinos internos)', async () => {
    montarApp('/login?next=%2Fmercado%2Fcotacoes', { rotas: { 'POST /api/auth/login': { ...fxLogin, token: 'x' }, 'GET /api/quotes': [] } });
    await preencherLogin();
    expect(await screen.findByRole('heading', { level: 1, name: 'Pedidos de cotação' })).toBeInTheDocument();
  });

  it('um ?next= externo é ignorado: vai para o painel do papel', async () => {
    montarApp('/login?next=https%3A%2F%2Fevil.example%2F', { rotas: { 'POST /api/auth/login': fxLogin, ...PAGINA_MERCADO } });
    await preencherLogin();
    expect(await screen.findByRole('heading', { level: 1, name: 'Painel do comprador' })).toBeInTheDocument();
  });

  it('erro de rede mostra mensagem de ligação, não um erro técnico', async () => {
    montarApp('/login', { rotas: { 'POST /api/auth/login': () => { throw new TypeError('Failed to fetch'); } } });
    await preencherLogin();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Sem ligação ao servidor/);
  });

  it('com 2FA (TOTP): pede o código, só aceita 6 dígitos e conclui a sessão', async () => {
    const { chamadas } = montarApp('/login', { rotas: { 'POST /api/auth/login': { requires2fa: true, challenge: 'desafio-1', metodo: 'TOTP' }, 'POST /api/auth/2fa/verify': fxLogin, ...PAGINA_MERCADO } });
    await preencherLogin();
    expect(await screen.findByRole('heading', { name: 'Verificação em dois passos' })).toBeInTheDocument();
    const codigo = screen.getByLabelText(/^Código/);
    const verificar = screen.getByRole('button', { name: 'Verificar e entrar' });
    expect(verificar).toBeDisabled();
    await userEvent.type(codigo, '12ab34');             // letras são descartadas
    expect(codigo).toHaveValue('1234');
    await userEvent.type(codigo, '56');
    expect(verificar).toBeEnabled();
    await userEvent.click(verificar);
    expect(await screen.findByRole('heading', { level: 1, name: 'Painel do comprador' })).toBeInTheDocument();
    const v = chamadas.find((c) => c.url === '/api/auth/2fa/verify');
    expect(JSON.parse(v.corpo)).toEqual({ challenge: 'desafio-1', code: '123456' });
  });

  it('2FA por email mostra para onde foi enviado e permite reenviar; código errado volta a pedir', async () => {
    const { chamadas } = montarApp('/login', { rotas: { 'POST /api/auth/login': { requires2fa: true, challenge: 'c2', metodo: 'EMAIL', enviadoPara: 'a****@petroangola.co.ao' }, 'POST /api/auth/2fa/reenviar': { enviadoPara: 'a****@petroangola.co.ao' }, 'POST /api/auth/2fa/verify': erroApi(401, 'UNAUTHORIZED', 'Código inválido ou expirado.') } });
    await preencherLogin();
    expect(await screen.findByText('a****@petroangola.co.ao')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar código' }));
    expect(await screen.findByText('Enviámos um novo código.')).toBeInTheDocument();
    expect(chamadas.some((c) => c.url === '/api/auth/2fa/reenviar')).toBe(true);
    await userEvent.type(screen.getByLabelText(/^Código/), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Verificar e entrar' }));
    expect(await screen.findByText('Código inválido ou expirado.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Código/)).toHaveValue('');
  });

  it('quem já tem sessão e abre o login é enviado para o painel do seu papel', async () => {
    montarApp('/login', { sessao: comPapel('FORNECEDOR'), rotas: PAINEL_FORNECEDOR });
    expect(await screen.findByRole('heading', { level: 1, name: 'Painel da prestadora' })).toBeInTheDocument();
  });

  it('nunca guarda a senha nem o token no armazenamento do browser', async () => {
    montarApp('/login', { rotas: { 'POST /api/auth/login': { ...fxLogin, token: 'TOKEN-SECRETO' }, ...PAGINA_MERCADO } });
    await preencherLogin('comprador@petroangola.co.ao', 'SENHA-SECRETA');
    await screen.findByRole('heading', { level: 1, name: 'Painel do comprador' });
    const guardado = JSON.stringify([...Object.entries(localStorage), ...Object.entries(sessionStorage)]);
    expect(guardado).not.toContain('TOKEN-SECRETO'); expect(guardado).not.toContain('SENHA-SECRETA');
  });
});

describe('registo de empresa', () => {
  const docsOk = { CERTIDAO_COMERCIAL: new File(['x'], 'a.pdf'), ALVARA_COMERCIAL: new File(['x'], 'b.pdf'), LICENCA_ANPG: new File(['x'], 'c.pdf'), APOLICE_SEGURO: new File(['x'], 'd.pdf') };
  const base = { type: 'CLIENTE', name: 'Empresa X', taxId: '5400000001', contactEmail: 'a@x.co', adminName: 'Admin', adminEmail: 'b@x.co', adminPassword: 'uma-senha-bem-longa', insurer: '', policyNumber: '', coverageAmount: '', policyValidFrom: '', policyValidUntil: '' };

  it('documentos por tipo (espelham o backend)', () => {
    expect(DOCUMENTOS.CLIENTE.map((d) => d.type)).toEqual(['CERTIDAO_COMERCIAL', 'ALVARA_COMERCIAL']);
    expect(DOCUMENTOS.FORNECEDOR.map((d) => d.type)).toEqual(['ALVARA_COMERCIAL', 'LICENCA_ANPG', 'CERTIDAO_COMERCIAL']);
  });

  it('validarRegisto: operadora válida não tem erros; sem docs/termos/senha curta tem', () => {
    expect(validarRegisto(base, docsOk, true)).toEqual({});
    const e = validarRegisto({ ...base, adminPassword: 'curta' }, {}, false);
    expect(e.adminPassword).toContain(String(SENHA_MINIMA_ADMIN)); expect(e.docs).toMatch(/Certidão Comercial/); expect(e.termos).toBeTruthy();
  });

  it('validarRegisto: prestadora exige apólice (dados, datas coerentes e documento)', () => {
    const e = validarRegisto({ ...base, type: 'FORNECEDOR', policyValidFrom: '2026-12-01', policyValidUntil: '2026-01-01' }, { ...docsOk, APOLICE_SEGURO: undefined }, true);
    expect(Object.keys(e)).toEqual(expect.arrayContaining(['insurer', 'policyNumber', 'coverageAmount', 'policyValidUntil', 'docs']));
    expect(e.policyValidUntil).toMatch(/anterior ao início/);
    expect(validarRegisto({ ...base, type: 'FORNECEDOR', insurer: 'S', policyNumber: '1', coverageAmount: '100', policyValidFrom: '2026-01-01', policyValidUntil: '2027-01-01' }, docsOk, true)).toEqual({});
  });

  it('?tipo=FORNECEDOR pré-selecciona prestadora e mostra os campos da apólice', async () => {
    montarApp('/cadastro?tipo=FORNECEDOR');
    expect(await screen.findByRole('group', { name: /Apólice de seguro/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Licença da ANPG', { exact: false })).toBeInTheDocument();
  });

  it('envia multipart com os campos e documentos, mostra "pendente de aprovação"', async () => {
    const { chamadas } = montarApp('/cadastro?tipo=CLIENTE', { rotas: { 'POST /api/companies/register': json({ id: 'c1', name: 'Empresa X' }, 201) } });
    await userEvent.type(await screen.findByLabelText(/Nome da empresa/), 'Empresa X');
    await userEvent.type(screen.getByLabelText(/^NIF/), '5400000001');
    await userEvent.type(screen.getByLabelText(/Email de contacto/), 'a@x.co');
    await userEvent.type(screen.getByLabelText(/^Nome \*/), 'Admin Teste');
    await userEvent.type(screen.getByLabelText(/^Email \*/), 'b@x.co');
    await userEvent.type(screen.getByLabelText(/^Senha/), 'uma-senha-bem-longa');
    await userEvent.upload(screen.getByLabelText(/Certidão Comercial/), new File(['pdf'], 'certidao.pdf', { type: 'application/pdf' }));
    await userEvent.upload(screen.getByLabelText(/Alvará Comercial/), new File(['pdf'], 'alvara.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Submeter cadastro' }));
    expect(await screen.findByText('Recebemos o cadastro')).toBeInTheDocument();
    const fd = chamadas.find((c) => c.url === '/api/companies/register').corpo;
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('type')).toBe('CLIENTE'); expect(fd.get('termsAccepted')).toBe('true'); expect(fd.get('adminPassword')).toBe('uma-senha-bem-longa');
    expect(fd.get('CERTIDAO_COMERCIAL').name).toBe('certidao.pdf'); expect(fd.get('ALVARA_COMERCIAL').name).toBe('alvara.pdf');
    expect(fd.has('APOLICE_SEGURO')).toBe(false); expect(fd.has('insurer')).toBe(false);
  });

  it('erros 422 do servidor aparecem no campo certo', async () => {
    montarApp('/cadastro?tipo=CLIENTE', { rotas: { 'POST /api/companies/register': erroApi(422, 'VALIDATION_ERROR', 'Dados inválidos.', { formErrors: [], fieldErrors: { taxId: ['NIF já registado.'] } }) } });
    await userEvent.type(await screen.findByLabelText(/Nome da empresa/), 'Empresa X');
    await userEvent.type(screen.getByLabelText(/^NIF/), '5400000001');
    await userEvent.type(screen.getByLabelText(/Email de contacto/), 'a@x.co');
    await userEvent.type(screen.getByLabelText(/^Nome \*/), 'Admin Teste');
    await userEvent.type(screen.getByLabelText(/^Email \*/), 'b@x.co');
    await userEvent.type(screen.getByLabelText(/^Senha/), 'uma-senha-bem-longa');
    await userEvent.upload(screen.getByLabelText(/Certidão Comercial/), new File(['p'], 'a.pdf'));
    await userEvent.upload(screen.getByLabelText(/Alvará Comercial/), new File(['p'], 'b.pdf'));
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Submeter cadastro' }));
    expect(await screen.findByText('NIF já registado.')).toBeInTheDocument();
  });
});

describe('convite e recuperação', () => {
  it('perfis que movem dinheiro exigem senha mais longa', () => {
    expect(minimoSenha('COMPRADOR')).toBe(10); expect(minimoSenha('FORNECEDOR')).toBe(10);
    for (const r of ['COMPANY_ADMIN', 'FINANCEIRO', 'ADMIN_SISTEMA']) expect(minimoSenha(r)).toBe(12);
  });

  it('convite válido: pré-preenche, exige o mínimo do perfil e os termos, e cria a conta', async () => {
    const { chamadas } = montarApp('/convite/tok123', { rotas: { 'GET /api/companies/invite/tok123': { role: 'FINANCEIRO', email: 'fin@x.co', name: 'Fátima' }, 'POST /api/companies/invite/tok123/accept': json({ ok: true }, 201) } });
    expect(await screen.findByText(/Foi convidado como/)).toHaveTextContent('Financeiro');
    expect(screen.getByLabelText(/^Nome/)).toHaveValue('Fátima'); expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    await userEvent.type(screen.getByLabelText(/^Senha/), 'curta-demais');   // 12 caracteres? "curta-demais" tem 12
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('É necessário aceitar os Termos de Uso e a Política de Privacidade.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('Pode entrar')).toBeInTheDocument();
    expect(JSON.parse(chamadas.find((c) => c.url.endsWith('/accept')).corpo)).toEqual({ name: 'Fátima', email: 'fin@x.co', password: 'curta-demais', termsAccepted: true });
  });

  it('convite inválido ou expirado explica o que fazer', async () => {
    montarApp('/convite/velho', { rotas: { 'GET /api/companies/invite/velho': erroApi(401, 'UNAUTHORIZED', 'Convite inválido.') } });
    expect(await screen.findByText('Este convite já não é válido')).toBeInTheDocument();
  });

  it('recuperar: a resposta é igual exista ou não a conta (não revela emails registados)', async () => {
    montarApp('/recuperar', { rotas: { 'POST /api/auth/forgot-password': { ok: true, message: 'x' } } });
    await userEvent.type(await screen.findByLabelText(/^Email/), 'qualquer@x.co');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText(/Se existir uma conta com este email/)).toBeInTheDocument();
  });

  it('nova senha: exige 10 caracteres e confirmação igual; token inválido dá saída', async () => {
    const { chamadas } = montarApp('/recuperar/tok', { rotas: { 'POST /api/auth/reset-password': erroApi(401, 'UNAUTHORIZED', 'Link inválido ou expirado.') } });
    await userEvent.type(await screen.findByLabelText(/^Nova senha/), 'curta');
    await userEvent.type(screen.getByLabelText(/^Confirmar/), 'outra');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nova senha' }));
    expect(screen.getByText('A senha precisa de pelo menos 10 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(chamadas.some((c) => c.url === '/api/auth/reset-password')).toBe(false);
    await userEvent.clear(screen.getByLabelText(/^Nova senha/)); await userEvent.clear(screen.getByLabelText(/^Confirmar/));
    await userEvent.type(screen.getByLabelText(/^Nova senha/), 'senha-longa-123'); await userEvent.type(screen.getByLabelText(/^Confirmar/), 'senha-longa-123');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nova senha' }));
    expect(await screen.findByText(/Link inválido ou expirado/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toBeInTheDocument();
    await waitFor(() => expect(chamadas.find((c) => c.url === '/api/auth/reset-password')).toBeTruthy());
  });
});
