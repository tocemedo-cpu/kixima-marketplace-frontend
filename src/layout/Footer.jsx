import { Link } from 'react-router-dom';
import { Fio, Logo } from '../ui';

/**
 * Rodapé institucional: preto, com o fio Samakaka no topo. Só mostra o que for passado em `columns` e `note`
 * (nada de moradas, telefones ou números inventados). `columns`: [{ title, links: [{ label, to }] }].
 */
export default function Footer({ columns = [], note }) {
  return (
    <footer className="kx-footer">
      <Fio />
      <div className="kx-container kx-footer__inner">
        <div className="kx-footer__brand">
          <Logo reversed size={30} />
          {note ? <p>{note}</p> : null}
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="kx-footer__col">
            <h2 className="kx-footer__title">{col.title}</h2>
            <ul>
              {col.links.map((l) => <li key={l.to}><Link to={l.to}>{l.label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="kx-footer__legal">
        <div className="kx-container">© {new Date().getFullYear()} KIXIMA. Todos os direitos reservados.</div>
      </div>
    </footer>
  );
}
