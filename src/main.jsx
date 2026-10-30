import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { TemaProvider } from './design/TemaContext';
import { ToastProvider } from './ui';

// Fontes self-hosted (sem CDN externo): Sora (títulos), Inter (corpo), IBM Plex Mono (referências).
import '@fontsource-variable/sora';
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
// Ordem importa: os três fundos (valores) → tokens semânticos → base → componentes → layout.
import './design/temas.css';
import './design/tokens.css';
import './design/base.css';
import './ui/ui.css';
import './layout/layout.css';
import './pages/pages.css';
import './features/painel.css';
import './features/marketplace/vitrine.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <TemaProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </TemaProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
