import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { RequireAuth, RequireRole } from './auth/Guardas';
import { RequisicaoProvider } from './features/comprador/RequisicaoContext';
import AppShell from './layout/AppShell';
import { Spinner } from './ui';

// Cada página é um chunk próprio: quem abre a vitrine não descarrega o marketplace (ligações lentas).
const Vitrine = lazy(() => import('./features/marketplace/Vitrine'));
const Planos = lazy(() => import('./features/publico/Planos'));
const Login = lazy(() => import('./features/auth/Login'));
const Registo = lazy(() => import('./features/auth/Registo'));
const Pesquisa = lazy(() => import('./features/marketplace/Pesquisa'));
const Produto = lazy(() => import('./features/marketplace/Produto'));
const Fornecedores = lazy(() => import('./features/marketplace/Fornecedores'));
const Categorias = lazy(() => import('./features/marketplace/Categorias'));
const Cotacoes = lazy(() => import('./features/marketplace/Cotacoes'));
const Conta = lazy(() => import('./features/comum/Conta'));
const Dev = lazy(() => import('./pages/CatalogoDeComponentes'));

// Atalhos para exportações nomeadas (cada módulo de páginas exporta vários componentes).
const de = (modulo, nome) => lazy(() => modulo().then((m) => ({ default: m[nome] })));
const Categoria = de(() => import('./features/marketplace/Categorias'), 'Categoria');
const Servicos = de(() => import('./features/marketplace/Categorias'), 'Servicos');
const Faq = de(() => import('./features/publico/Paginas'), 'Faq');
const Termos = de(() => import('./features/publico/Paginas'), 'Termos');
const Privacidade = de(() => import('./features/publico/Paginas'), 'Privacidade');
const NaoEncontrada = de(() => import('./features/publico/Paginas'), 'NaoEncontrada');
const AceitarConvite = de(() => import('./features/auth/ConviteERecuperacao'), 'AceitarConvite');
const Recuperar = de(() => import('./features/auth/ConviteERecuperacao'), 'Recuperar');

// Áreas de trabalho por perfil (Fase 5).
const ListaOrdens = lazy(() => import('./features/ordens/ListaOrdens'));
const DetalheOrdem = lazy(() => import('./features/ordens/DetalheOrdem'));
const Requisicao = lazy(() => import('./features/comprador/Requisicao'));
const comprador = (nome) => de(() => import('./features/comprador/Paginas'), nome);
const empresa = (nome) => de(() => import('./features/empresa/Paginas'), nome);
const fornecedor = (nome) => de(() => import('./features/fornecedor/Paginas'), nome);
const financeiro = (nome) => de(() => import('./features/financeiro/Paginas'), nome);
const sistema = (nome) => de(() => import('./features/sistema/Paginas'), nome);
const PainelComprador = comprador('PainelComprador');
const OrdensDoComprador = comprador('OrdensDoComprador');
const PagamentosDoComprador = comprador('PagamentosDoComprador');
const EntregasDoComprador = comprador('EntregasDoComprador');
const RececoesDoComprador = comprador('RececoesDoComprador');
const FornecedorasDoComprador = comprador('FornecedorasDoComprador');
const AtividadesDoComprador = comprador('AtividadesDoComprador');
const PainelDaEmpresa = empresa('PainelDaEmpresa');
const Aprovacoes = empresa('Aprovacoes');
const Utilizadores = empresa('Utilizadores');
const Organizacao = empresa('Organizacao');
const AtividadeDaEmpresa = empresa('AtividadeDaEmpresa');
const RelatoriosDaEmpresa = empresa('RelatoriosDaEmpresa');
const Definicoes = empresa('Definicoes');
const PainelFornecedor = fornecedor('PainelFornecedor');
const CatalogoDoFornecedor = fornecedor('CatalogoDoFornecedor');
const FaturasDoFornecedor = fornecedor('FaturasDoFornecedor');
const PainelFinanceiro = financeiro('PainelFinanceiro');
const FaturasPorPagar = financeiro('FaturasPorPagar');
const HistoricoDePagamentos = financeiro('HistoricoDePagamentos');
const PainelDoSistema = sistema('PainelDoSistema');
const Empresas = sistema('Empresas');
const UtilizadoresDaPlataforma = sistema('UtilizadoresDaPlataforma');
const Auditoria = sistema('Auditoria');
const Taxas = sistema('Taxas');
const Prontidao = sistema('Prontidao');
const Contratos = sistema('Contratos');

// Endereços antigos do marketplace (antes de ser público) continuam a funcionar e levam ao sítio novo.
const RedirecionarPara = ({ para }) => { const { search } = useLocation(); return <Navigate to={`${para}${search}`} replace />; };
const RedirecionarProduto = () => { const { slug } = useParams(); return <Navigate to={`/produto/${slug}`} replace />; };

function Carregando() {
  return <div className="kx-centro"><Spinner label="A carregar a página…" size={32} /></div>;
}

export default function App() {
  return (
    <RequisicaoProvider>
    <Suspense fallback={<Carregando />}>
      <Routes>
        <Route element={<AppShell />}>
          {/* Públicas */}
          <Route path="/" element={<Vitrine />} />
          {/* O catálogo é público: qualquer visitante explora, pesquisa, filtra e abre produtos e fornecedoras */}
          <Route path="/produtos" element={<Pesquisa />} />
          <Route path="/servicos" element={<Servicos />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/categorias/:nome" element={<Categoria />} />
          <Route path="/produto/:slug" element={<Produto />} />
          <Route path="/fornecedores" element={<Fornecedores />} />
          <Route path="/mercado" element={<RedirecionarPara para="/" />} />
          <Route path="/mercado/pesquisa" element={<RedirecionarPara para="/produtos" />} />
          <Route path="/mercado/produto/:slug" element={<RedirecionarProduto />} />
          <Route path="/mercado/fornecedores" element={<RedirecionarPara para="/fornecedores" />} />
          <Route path="/planos" element={<Planos />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Registo />} />
          {/* Caminhos dos emails do backend: não mudar */}
          <Route path="/convite/:token" element={<AceitarConvite />} />
          <Route path="/recuperar" element={<Recuperar />} />
          <Route path="/recuperar/:token" element={<Recuperar />} />

          {/* Operações empresariais: exigem sessão */}
          <Route element={<RequireAuth />}>
            <Route path="/mercado/cotacoes" element={<Cotacoes />} />
            <Route path="/conta" element={<Conta />} />

            {/* Partilhadas: o servidor devolve só o que a empresa da sessão pode ver */}
            <Route path="/ordens" element={<ListaOrdens />} />
            <Route path="/ordens/:id" element={<DetalheOrdem />} />
            <Route path="/contratos" element={<Contratos />} />

            <Route element={<RequireRole roles={['COMPRADOR']} />}>
              <Route path="/comprador" element={<PainelComprador />} />
              <Route path="/comprador/requisicao" element={<Requisicao />} />
              <Route path="/comprador/ordens" element={<OrdensDoComprador />} />
              <Route path="/comprador/pagamentos" element={<PagamentosDoComprador />} />
              <Route path="/comprador/entregas" element={<EntregasDoComprador />} />
              <Route path="/comprador/rececoes" element={<RececoesDoComprador />} />
              <Route path="/comprador/fornecedores" element={<FornecedorasDoComprador />} />
              <Route path="/comprador/atividade" element={<AtividadesDoComprador />} />
            </Route>

            <Route element={<RequireRole roles={['COMPANY_ADMIN']} />}>
              <Route path="/empresa" element={<PainelDaEmpresa />} />
              <Route path="/empresa/aprovacoes" element={<Aprovacoes />} />
              <Route path="/empresa/utilizadores" element={<Utilizadores />} />
              <Route path="/empresa/organizacao" element={<Organizacao />} />
              <Route path="/empresa/atividade" element={<AtividadeDaEmpresa />} />
              <Route path="/empresa/relatorios" element={<RelatoriosDaEmpresa />} />
              <Route path="/empresa/definicoes" element={<Definicoes />} />
            </Route>

            <Route element={<RequireRole roles={['FORNECEDOR', 'COMPANY_ADMIN']} />}>
              <Route path="/fornecedor" element={<PainelFornecedor />} />
              <Route path="/fornecedor/catalogo" element={<CatalogoDoFornecedor />} />
              <Route path="/fornecedor/faturas" element={<FaturasDoFornecedor />} />
            </Route>

            <Route element={<RequireRole roles={['FINANCEIRO']} />}>
              <Route path="/financeiro" element={<PainelFinanceiro />} />
              <Route path="/financeiro/faturas" element={<FaturasPorPagar />} />
              <Route path="/financeiro/pagamentos" element={<HistoricoDePagamentos />} />
            </Route>

            <Route element={<RequireRole roles={['ADMIN_SISTEMA']} />}>
              <Route path="/sistema" element={<PainelDoSistema />} />
              <Route path="/sistema/empresas" element={<Empresas />} />
              <Route path="/sistema/utilizadores" element={<UtilizadoresDaPlataforma />} />
              <Route path="/sistema/auditoria" element={<Auditoria />} />
              <Route path="/sistema/taxas" element={<Taxas />} />
              <Route path="/sistema/prontidao" element={<Prontidao />} />
            </Route>
          </Route>

          {/* Catálogo do sistema de design (Fase 3) — só em desenvolvimento */}
          {import.meta.env.DEV ? <Route path="/design" element={<Dev />} /> : null}
          <Route path="*" element={<NaoEncontrada />} />
        </Route>
      </Routes>
    </Suspense>
    </RequisicaoProvider>
  );
}
