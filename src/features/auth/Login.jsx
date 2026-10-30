import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, mensagemDeErro } from '../../api/client';
import { reenviar2fa } from '../../api/endpoints/auth';
import { useAuth } from '../../auth/AuthContext';
import { paginaInicial } from '../../auth/papeis';
import { destinoSeguro } from '../../lib/format';
import { Alert, Button, Field, Input } from '../../ui';
import AuthLayout from './AuthLayout';
import CampoSenha from './CampoSenha';

export default function Login() {
  const { autenticado, user, entrar, verificar2fa } = useAuth();
  const navegar = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [campos, setCampos] = useState({});
  const [aEnviar, setAEnviar] = useState(false);
  const [aviso, setAviso] = useState('');
  // 2.º passo (2FA): { challenge, metodo: 'TOTP'|'EMAIL', enviadoPara }
  const [desafio, setDesafio] = useState(null);
  const [codigo, setCodigo] = useState('');
  const campoCodigo = useRef(null);

  useEffect(() => { if (desafio) campoCodigo.current?.focus(); }, [desafio]);

  if (autenticado) return <Navigate to={destinoSeguro(next, paginaInicial(user?.role))} replace />;

  const irPara = (u) => navegar(destinoSeguro(next, paginaInicial(u.role)), { replace: true });

  async function submeter(e) {
    e.preventDefault();
    setErro(''); setCampos({});
    const c = {};
    if (!email.trim()) c.email = 'Indique o seu email.';
    if (!senha) c.password = 'Indique a sua senha.';
    if (Object.keys(c).length) { setCampos(c); return; }
    setAEnviar(true);
    try {
      const r = await entrar(email.trim(), senha);
      if (r.requires2fa) { setDesafio(r); setCodigo(''); } else irPara(r.user);
    } catch (err) {
      if (err instanceof ApiError && err.isValidation) setCampos({ email: err.fieldErrors.email ? 'Indique um email válido.' : undefined, password: err.fieldErrors.password ? 'Indique a sua senha.' : undefined });
      setErro(mensagemDeErro(err));
    } finally { setAEnviar(false); }
  }

  async function submeterCodigo(e) {
    e.preventDefault();
    setErro('');
    setAEnviar(true);
    try {
      irPara(await verificar2fa(desafio.challenge, codigo.trim()));
    } catch (err) {
      setErro(mensagemDeErro(err));
      setCodigo('');
      campoCodigo.current?.focus();
    } finally { setAEnviar(false); }
  }

  async function reenviar() {
    setErro(''); setAviso('');
    try {
      const r = await reenviar2fa(desafio.challenge);
      setDesafio((d) => ({ ...d, enviadoPara: r.enviadoPara || d.enviadoPara }));
      setAviso('Enviámos um novo código.');
    } catch (err) { setErro(mensagemDeErro(err)); }
  }

  if (desafio) {
    return (
      <AuthLayout titulo="Verificação em dois passos" subtitulo={desafio.metodo === 'EMAIL' ? <>Enviámos um código de 6 dígitos para <strong>{desafio.enviadoPara}</strong>.</> : 'Introduza o código de 6 dígitos da sua aplicação de autenticação.'}>
        <form onSubmit={submeterCodigo} noValidate className="kx-form">
          {erro ? <Alert tone="danger">{erro}</Alert> : null}
          {aviso ? <Alert tone="success">{aviso}</Alert> : null}
          <Field label="Código" required hint="Seis dígitos, sem espaços.">
            <Input ref={campoCodigo} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} />
          </Field>
          <Button type="submit" variant="primary" size="lg" loading={aEnviar} disabled={codigo.length !== 6}>Verificar e entrar</Button>
          <div className="kx-form__linha">
            {desafio.metodo === 'EMAIL' ? <Button variant="ghost" size="sm" onClick={reenviar}>Reenviar código</Button> : <span />}
            <Button variant="ghost" size="sm" onClick={() => { setDesafio(null); setErro(''); setAviso(''); setSenha(''); }}>Voltar</Button>
          </div>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout titulo="Entrar" subtitulo="Aceda à sua conta KIXIMA.">
      <form onSubmit={submeter} noValidate className="kx-form">
        {sp.get('aviso') === 'catalogo' ? <Alert tone="info">Inicie sessão para pesquisar o catálogo e pedir cotações.</Alert> : null}
        {erro ? <Alert tone="danger">{erro}</Alert> : null}
        <Field label="Email" required error={campos.email}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label="Senha" required error={campos.password}>
          <CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={aEnviar}>Entrar</Button>
        <div className="kx-form__linha">
          <Link to="/recuperar">Esqueci a senha</Link>
          <span>Ainda não tem conta? <Link to="/cadastro">Registar empresa</Link></span>
        </div>
      </form>
    </AuthLayout>
  );
}
