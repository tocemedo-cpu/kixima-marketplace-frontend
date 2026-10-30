import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROTULO_DE_EMPRESA, ROTULO_DE_PAPEL } from '../auth/papeis';
import { iniciais } from '../lib/format';
import { Icon } from '../ui';

/** Menu da conta (disclosure): identifica quem está com sessão, o papel e a empresa; leva à conta e termina a sessão. */
export default function UserMenu() {
  const { user, sair } = useAuth();
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);
  const botao = useRef(null);
  const idPainel = useId();

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  if (!user) return null;
  const papel = ROTULO_DE_PAPEL[user.role] || user.role;

  const aoTeclar = (e) => { if (e.key === 'Escape' && aberto) { setAberto(false); botao.current?.focus(); } };
  const aoSairFoco = (e) => { if (!raiz.current?.contains(e.relatedTarget)) setAberto(false); };
  const terminar = async () => { setAberto(false); await sair(); navegar('/', { replace: true }); };

  return (
    <div ref={raiz} className="kx-user" onKeyDown={aoTeclar} onBlur={aoSairFoco}>
      <button ref={botao} type="button" className="kx-user__btn" aria-label={`Conta de ${user.name}`} aria-expanded={aberto} aria-controls={idPainel} onClick={() => setAberto((v) => !v)}>
        <span className="kx-user__avatar" aria-hidden="true">{iniciais(user.name)}</span>
        <span className="kx-user__nome">{user.name}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      <div id={idPainel} className="kx-user__painel" hidden={!aberto}>
        <div className="kx-user__ident">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
          <span>{papel}{user.companyName ? ` · ${user.companyName}` : ''}</span>
          {user.companyType ? <span className="kx-user__tipo">{ROTULO_DE_EMPRESA[user.companyType] || user.companyType}</span> : null}
        </div>
        <Link to="/conta" className="kx-user__item" onClick={() => setAberto(false)}><Icon name="user" size={16} /> A minha conta</Link>
        <button type="button" className="kx-user__item" onClick={terminar}><Icon name="arrow-right" size={16} /> Terminar sessão</button>
      </div>
    </div>
  );
}
