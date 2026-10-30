// Aceitar convite (/convite/:token) e recuperar a senha (/recuperar e /recuperar/:token). Estes caminhos são os
// que o backend põe nos emails, por isso NÃO se podem mudar.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, mensagemDeErro } from '../../api/client';
import { aceitarConvite, consultarConvite, pedirRecuperacao, redefinirSenha } from '../../api/endpoints/auth';
import { ROTULO_DE_PAPEL } from '../../auth/papeis';
import { useAsync } from '../../lib/useAsync';
import { Alert, Button, Checkbox, ErrorState, Field, Input, Skeleton } from '../../ui';
import AuthLayout from './AuthLayout';
import CampoSenha from './CampoSenha';

const PERFIS_SENSIVEIS = ['COMPANY_ADMIN', 'FINANCEIRO', 'ADMIN_SISTEMA'];
/** Perfis que movem dinheiro: o servidor exige-lhes uma senha mais longa. O rótulo diz o mesmo número que a validação. */
export const minimoSenha = (role) => (PERFIS_SENSIVEIS.includes(role) ? 12 : 10);
export const SENHA_MINIMA_RECUPERACAO = 10;

export function AceitarConvite() {
  const { token } = useParams();
  const convite = useAsync((signal) => consultarConvite(token, { signal }), [token]);
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [termos, setTermos] = useState(false);
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [feito, setFeito] = useState(false);

  useEffect(() => { if (convite.data?.name) setNome((n) => n || convite.data.name); }, [convite.data]);

  if (convite.status === 'carregando') return <AuthLayout titulo="Convite"><Skeleton lines={4} /></AuthLayout>;
  if (convite.status === 'erro') {
    const invalido = convite.error instanceof ApiError && [401, 404, 410].includes(convite.error.status);
    return (
      <AuthLayout titulo="Convite">
        {invalido
          ? <Alert tone="warning" title="Este convite já não é válido">O link expirou, foi cancelado ou já foi usado. Peça um novo convite ao administrador da sua empresa.</Alert>
          : <ErrorState description={mensagemDeErro(convite.error)} detalhe={convite.error?.code} onRetry={convite.recarregar} />}
        <p><Link to="/login">Ir para o login</Link></p>
      </AuthLayout>
    );
  }

  const inv = convite.data;
  const minimo = minimoSenha(inv.role);

  async function submeter(e) {
    e.preventDefault();
    const v = {};
    if (nome.trim().length < 2) v.name = 'Indique o seu nome.';
    if (senha.length < minimo) v.password = `A senha precisa de pelo menos ${minimo} caracteres.`;
    if (!termos) v.termos = 'É necessário aceitar os Termos de Uso e a Política de Privacidade.';
    setErros(v); setErro('');
    if (Object.keys(v).length) return;
    setAEnviar(true);
    try {
      await aceitarConvite(token, { name: nome.trim(), email: inv.email, password: senha, termsAccepted: true });
      setFeito(true);
    } catch (err) { setErro(mensagemDeErro(err)); } finally { setAEnviar(false); }
  }

  if (feito) {
    return (
      <AuthLayout titulo="Conta criada">
        <Alert tone="success" title="Pode entrar">A sua conta está ativa. Entre com o email do convite e a senha que definiu.</Alert>
        <p><Button as={Link} to="/login" variant="primary">Entrar</Button></p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout titulo="Aceitar convite" subtitulo={inv.role ? <>Foi convidado como <strong>{ROTULO_DE_PAPEL[inv.role] || inv.role}</strong>.</> : undefined}>
      <form onSubmit={submeter} noValidate className="kx-form">
        {erro ? <Alert tone="danger">{erro}</Alert> : null}
        <Field label="Nome" required error={erros.name}><Input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></Field>
        <Field label="Email"><Input value={inv.email || ''} readOnly autoComplete="username" /></Field>
        <Field label="Senha" required hint={`Pelo menos ${minimo} caracteres.`} error={erros.password}><CampoSenha autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
        <div>
          <Checkbox label={<>Li e aceito os <Link to="/termos" target="_blank">Termos de Uso</Link> e a <Link to="/privacidade" target="_blank">Política de Privacidade</Link>.</>} checked={termos} onChange={(e) => setTermos(e.target.checked)} />
          {erros.termos ? <p className="kx-field__error" role="alert">{erros.termos}</p> : null}
        </div>
        <Button type="submit" variant="primary" size="lg" loading={aEnviar}>Criar conta</Button>
      </form>
    </AuthLayout>
  );
}

export function Recuperar() {
  const { token } = useParams();
  return token ? <NovaSenha token={token} /> : <PedirLink />;
}

function PedirLink() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function submeter(e) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErro('Indique um email válido.'); return; }
    setErro(''); setAEnviar(true);
    try { await pedirRecuperacao(email.trim()); setEnviado(true); } catch (err) { setErro(mensagemDeErro(err)); } finally { setAEnviar(false); }
  }

  if (enviado) {
    return (
      <AuthLayout titulo="Verifique o seu email">
        {/* Resposta igual exista ou não a conta: não revela que emails estão registados. */}
        <Alert tone="success">Se existir uma conta com este email, enviámos um link para definir uma nova senha. O link é de uso único e vale 1 hora.</Alert>
        <p><Link to="/login">Voltar ao login</Link></p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout titulo="Recuperar senha" subtitulo="Indique o email da sua conta e enviamos-lhe um link para definir uma nova senha.">
      <form onSubmit={submeter} noValidate className="kx-form">
        {erro ? <Alert tone="danger">{erro}</Alert> : null}
        <Field label="Email" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
        <Button type="submit" variant="primary" size="lg" loading={aEnviar}>Enviar link</Button>
        <p><Link to="/login">Voltar ao login</Link></p>
      </form>
    </AuthLayout>
  );
}

function NovaSenha({ token }) {
  const navegar = useNavigate();
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    if (!feito) return undefined;
    const t = setTimeout(() => navegar('/login', { replace: true }), 2500);
    return () => clearTimeout(t);
  }, [feito, navegar]);

  async function submeter(e) {
    e.preventDefault();
    const v = {};
    if (senha.length < SENHA_MINIMA_RECUPERACAO) v.senha = `A senha precisa de pelo menos ${SENHA_MINIMA_RECUPERACAO} caracteres.`;
    if (senha !== confirma) v.confirma = 'As senhas não coincidem.';
    setErros(v); setErro('');
    if (Object.keys(v).length) return;
    setAEnviar(true);
    try { await redefinirSenha(token, senha); setFeito(true); } catch (err) { setErro(mensagemDeErro(err)); } finally { setAEnviar(false); }
  }

  if (feito) {
    return (
      <AuthLayout titulo="Senha atualizada">
        <Alert tone="success">A sua senha foi atualizada. A levá-lo para o login…</Alert>
        <p><Link to="/login">Ir já para o login</Link></p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout titulo="Definir nova senha" subtitulo="Escolha uma senha nova para a sua conta.">
      <form onSubmit={submeter} noValidate className="kx-form">
        {erro ? <Alert tone="danger">{erro} <Link to="/recuperar">Pedir um novo link</Link></Alert> : null}
        <Field label="Nova senha" required hint={`Pelo menos ${SENHA_MINIMA_RECUPERACAO} caracteres.`} error={erros.senha}><CampoSenha autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
        <Field label="Confirmar nova senha" required error={erros.confirma}><CampoSenha autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} /></Field>
        <Button type="submit" variant="primary" size="lg" loading={aEnviar}>Guardar nova senha</Button>
      </form>
    </AuthLayout>
  );
}
