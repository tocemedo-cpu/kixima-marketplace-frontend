import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Fio, Icon, Logo, Modal } from '../ui';

// Uma ligação está activa quando o caminho coincide (e, se tiver #âncora, a âncora também). O NavLink só
// compara o caminho, por isso várias âncoras da mesma página ficavam todas marcadas como activas.
export function ligacaoActiva(to, end, loc) {
  const [caminho, hash] = to.split('#');
  const base = caminho.endsWith('/') && caminho.length > 1 ? caminho.slice(0, -1) : caminho;
  const igual = loc.pathname === base || loc.pathname === `${base}/`;
  const dentro = !end && (loc.pathname.startsWith(`${base}/`) || base === '');
  const caminhoOk = igual || dentro;
  return hash ? caminhoOk && loc.hash === `#${hash}` : caminhoOk;
}

function Ligacao({ to, end, className, children, ...resto }) {
  const loc = useLocation();
  const activa = ligacaoActiva(to, end, loc);
  return (
    <Link to={to} aria-current={activa ? 'page' : undefined} className={className(activa)} {...resto}>
      {children}
    </Link>
  );
}

/**
 * Barra superior: faixa escura (marca, pesquisa central, acções) + fio Samakaka + navegação horizontal clara.
 * Abaixo de 900px a navegação passa para uma gaveta lateral aberta pelo botão de menu.
 *
 *   items:   [{ label, to, end?, children?: [{ label, to, description? }] }]
 *   search:  { value, onChange(texto), onSubmit(texto), placeholder? }  (omitir para não mostrar pesquisa)
 *   actions: nós React à direita (seletor de fundo, conta, notificações…)
 */
export default function TopBar({ items = [], search, actions, logoTo = '/' }) {
  const [gaveta, setGaveta] = useState(false);
  const idPesquisa = useId();

  const submeter = (e) => { e.preventDefault(); search?.onSubmit?.(search.value ?? ''); };

  return (
    <header className="kx-topbar">
      <div className="kx-topbar__main">
        <div className="kx-container kx-topbar__row">
          <button type="button" className="kx-topbar__burger" onClick={() => setGaveta(true)} aria-label="Abrir menu" aria-expanded={gaveta}>
            <Icon name="menu" size={22} />
          </button>
          <Link to={logoTo} className="kx-topbar__logo" aria-label="KIXIMA — página inicial">
            <Logo reversed size={30} />
          </Link>

          {search ? (
            <form className="kx-search" role="search" onSubmit={submeter}>
              <label htmlFor={idPesquisa} className="kx-sr-only">Pesquisar produtos, serviços e fornecedores</label>
              <input
                id={idPesquisa}
                type="search"
                className="kx-search__input"
                value={search.value ?? ''}
                onChange={(e) => search.onChange?.(e.target.value)}
                placeholder={search.placeholder || 'Pesquisar produtos, serviços e fornecedores'}
                autoComplete="off"
              />
              <button type="submit" className="kx-search__btn" aria-label="Pesquisar"><Icon name="search" size={20} /></button>
            </form>
          ) : <span className="kx-topbar__spacer" />}

          <div className="kx-topbar__actions">{actions}</div>
        </div>
      </div>
      <Fio />
      <nav className="kx-nav" aria-label="Principal">
        <ul className="kx-container kx-nav__list">
          {items.map((it) => <NavEntry key={it.label} item={it} />)}
        </ul>
      </nav>

      <Modal open={gaveta} onClose={() => setGaveta(false)} title="Menu" placement="left" size="sm">
        <nav aria-label="Principal (móvel)" className="kx-drawer-nav">
          {items.map((it) => (
            <div key={it.label} className="kx-drawer-nav__group">
              {it.children?.length ? (
                <>
                  <p className="kx-drawer-nav__title">{it.label}</p>
                  {it.children.map((c) => <Ligacao key={c.to} to={c.to} onClick={() => setGaveta(false)} className={(a) => `kx-drawer-nav__link ${a ? 'active' : ''}`}>{c.label}</Ligacao>)}
                </>
              ) : (
                <Ligacao to={it.to} end={it.end} onClick={() => setGaveta(false)} className={(a) => `kx-drawer-nav__link ${a ? 'active' : ''}`}>{it.label}</Ligacao>
              )}
            </div>
          ))}
        </nav>
      </Modal>
    </header>
  );
}

// Entrada da navegação: ligação simples ou menu suspenso (padrão "disclosure": botão + lista de ligações).
function NavEntry({ item }) {
  if (!item.children?.length) {
    return (
      <li>
        <Ligacao to={item.to} end={item.end} className={(a) => `kx-nav__link ${a ? 'is-active' : ''}`}>{item.label}</Ligacao>
      </li>
    );
  }
  return <NavMenu item={item} />;
}

function NavMenu({ item }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);
  const botao = useRef(null);
  const idLista = useId();

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const aoTeclar = (e) => {
    if (e.key === 'Escape' && aberto) { setAberto(false); botao.current?.focus(); }
  };
  // Quando o foco sai do menu (Tab), fecha.
  const aoSairFoco = (e) => { if (!raiz.current?.contains(e.relatedTarget)) setAberto(false); };

  return (
    <li ref={raiz} className="kx-nav__menu" onKeyDown={aoTeclar} onBlur={aoSairFoco}>
      <button ref={botao} type="button" className="kx-nav__link kx-nav__trigger" aria-expanded={aberto} aria-controls={idLista} onClick={() => setAberto((v) => !v)}>
        {item.label}
        <Icon name="chevron-down" size={14} />
      </button>
      <ul id={idLista} className="kx-nav__panel" hidden={!aberto}>
        {item.children.map((c) => (
          <li key={c.to}>
            <Ligacao to={c.to} className={(a) => `kx-nav__sublink ${a ? 'active' : ''}`} onClick={() => setAberto(false)}>
              <span>{c.label}</span>
              {c.description ? <small>{c.description}</small> : null}
            </Ligacao>
          </li>
        ))}
      </ul>
    </li>
  );
}
