import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import Footer from './Footer';

/** Só existe no build do ambiente de teste isolado (VITE_AMBIENTE_TESTE=1): nunca aparece em produção. */
export const AMBIENTE_DE_TESTE = import.meta.env.VITE_AMBIENTE_TESTE === '1';

function AvisoDeTeste() {
  return (
    <div className="kx-aviso-teste" role="note">
      <strong>Ambiente de teste isolado.</strong> Dados de demonstração e API simulada: nada aqui é real e nada fica guardado depois de o serviço reiniciar.
    </div>
  );
}

/**
 * Esqueleto de página: ligação "Saltar para o conteúdo", barra superior, <main id="conteudo"> e rodapé.
 * Usado como elemento de rota (<Route element={<Shell … />}>); as páginas entram por <Outlet />.
 */
export default function Shell({ topbar, footer, children }) {
  return (
    <div className="kx-shell">
      <a className="kx-skip" href="#conteudo">Saltar para o conteúdo</a>
      {AMBIENTE_DE_TESTE ? <AvisoDeTeste /> : null}
      <TopBar {...topbar} />
      <main id="conteudo" tabIndex={-1} className="kx-main">
        {children ?? <Outlet />}
      </main>
      <Footer {...footer} />
    </div>
  );
}
