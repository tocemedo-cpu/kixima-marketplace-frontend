import { Link } from 'react-router-dom';
import { Fio, Logo } from '../../ui';

/** Moldura das páginas de autenticação: painel de marca (escuro, com o fio Samakaka) + cartão do formulário. */
export default function AuthLayout({ titulo, subtitulo, children, largura = 'md' }) {
  return (
    <div className="kx-auth">
      <aside className="kx-auth__marca" aria-hidden="false">
        <div className="kx-auth__marca-in">
          <Link to="/" className="kx-auth__logo" aria-label="KIXIMA — página inicial"><Logo reversed size={40} /></Link>
          <h2 className="kx-auth__lema">Procurement industrial, do pedido ao pagamento.</h2>
          <ul className="kx-auth__pontos">
            <li>Fornecedores credenciados, com due diligence feita uma vez</li>
            <li>Ordens de compra rastreáveis ponta a ponta</li>
            <li>Pagamento com prazo definido e registo integral</li>
          </ul>
        </div>
        <Fio />
      </aside>
      <section className="kx-auth__painel">
        <div className={`kx-auth__cartao kx-auth__cartao--${largura}`}>
          <h1 className="kx-auth__titulo">{titulo}</h1>
          {subtitulo ? <p className="kx-auth__sub">{subtitulo}</p> : null}
          {children}
        </div>
      </section>
    </div>
  );
}
