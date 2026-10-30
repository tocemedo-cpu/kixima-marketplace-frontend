import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import Footer from './Footer';

/**
 * Esqueleto de página: ligação "Saltar para o conteúdo", barra superior, <main id="conteudo"> e rodapé.
 * Usado como elemento de rota (<Route element={<Shell … />}>); as páginas entram por <Outlet />.
 */
export default function Shell({ topbar, footer, children }) {
  return (
    <div className="kx-shell">
      <a className="kx-skip" href="#conteudo">Saltar para o conteúdo</a>
      <TopBar {...topbar} />
      <main id="conteudo" tabIndex={-1} className="kx-main">
        {children ?? <Outlet />}
      </main>
      <Footer {...footer} />
    </div>
  );
}
