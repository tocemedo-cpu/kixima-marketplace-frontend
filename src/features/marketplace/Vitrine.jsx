import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { facetas, fornecedoresVerificados, pesquisar } from '../../api/endpoints/mercado';
import { useAuth } from '../../auth/AuthContext';
import { formatarNumero } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Badge, Button, ErrorState, Icon, Skeleton } from '../../ui';
import { Avaliacoes, Numeros } from '../publico/Confianca';
import CartaoFornecedor from './CartaoFornecedor';
import CartaoProduto from './CartaoProduto';

const SEGMENTOS = ['Oil & Gas', 'Equipamentos industriais', 'Segurança industrial', 'Manutenção', 'Serviços técnicos'];

const VANTAGENS = [
  { icone: 'shield', titulo: 'Credenciamento rigoroso', texto: 'Credenciamento com documentos e certificações antes da primeira transacção.' },
  { icone: 'check', titulo: 'Aprovação e controlo', texto: 'Cada ordem de compra passa pela aprovação do Administrador da sua empresa.' },
  { icone: 'file', titulo: 'Pagamento rastreável', texto: 'Fatura, pagamento e comprovativo registados, da ordem à entrega.' },
  { icone: 'building', titulo: 'Feito para Angola', texto: 'Preços em Kwanzas, IVA e retenções aplicados pelo servidor, fornecedoras locais.' },
];

const Esqueleto = ({ n = 5 }) => <ul className="kx-resultados kx-resultados--grade" aria-hidden="true">{Array.from({ length: n }, (_, i) => <li key={i}><Skeleton height="260px" /></li>)}</ul>;

function Seccao({ id, numero, titulo, sub, ligacao, children }) {
  return (
    <section className="kx-seccao kx-vit-seccao" aria-labelledby={`${id}-t`} data-seccao={numero}>
      <header className="kx-seccao__cabeca">
        <div><h2 id={`${id}-t`}>{titulo}</h2>{sub ? <p className="kx-vit-sub">{sub}</p> : null}</div>
        {ligacao ? <Link to={ligacao.to} className="kx-seccao__ligacao">{ligacao.rotulo} <Icon name="arrow-right" size={16} /></Link> : null}
      </header>
      {children}
    </section>
  );
}

/** Estados de uma secção alimentada pela API: esqueleto, erro com repetição, ou o conteúdo. Vazio ⇒ a secção não aparece. */
function Dados({ de, esqueleto, vazio, children }) {
  if (de.status === 'carregando' && !de.data) return esqueleto || <Skeleton lines={2} />;
  if (de.status === 'erro' && !de.data) return <ErrorState title="Não foi possível carregar esta secção" description={mensagemDeErro(de.error)} onRetry={de.recarregar} />;
  return vazio?.(de.data) ? null : children(de.data);
}

const caminhoCategoria = (nome) => `/categorias/${encodeURIComponent(nome)}`;

/** Fotografia de uma categoria: a do primeiro produto dessa categoria que tenha imagem. Sem imagem, o ícone. */
function imagemDaCategoria(nome, produtos) {
  return produtos.find((p) => p.category === nome && p.imageUrl)?.imageUrl || null;
}

/**
 * Homepage do marketplace. Pública (sem sessão): catálogo à vista desde o primeiro ecrã. Tudo o que aparece vem da API;
 * uma secção sem dados desaparece em vez de ser preenchida com exemplos.
 */
export default function Vitrine() {
  const { autenticado, user } = useAuth();
  const cats = useAsync((s) => facetas({}, { signal: s }), []);
  // Fotografias das categorias (a do primeiro produto de cada uma) e os produtos em destaque (só produtos; os serviços têm a sua secção).
  const catalogo = useAsync((s) => pesquisar({ sort: 'relevantes', limit: 48, page: 1 }, { signal: s }), []);
  const relevantes = useAsync((s) => pesquisar({ kind: 'PRODUTO', sort: 'relevantes', limit: 10, page: 1 }, { signal: s }), []);
  const recentes = useAsync((s) => pesquisar({ sort: 'recentes', limit: 12, page: 1 }, { signal: s }), []);
  const servicos = useAsync((s) => pesquisar({ kind: 'SERVICO', sort: 'relevantes', limit: 5, page: 1 }, { signal: s }), []);
  const fornecedoras = useAsync((s) => fornecedoresVerificados(8, { signal: s }), []);

  const categorias = cats.data?.categories || [];
  const todos = catalogo.data?.items || [];
  const destaques = relevantes.data?.items || [];
  const idsDestaque = useMemo(() => new Set(destaques.map((p) => p.id)), [destaques]);
  // «Recentes» não repete o que já aparece em destaque nem nos serviços; num catálogo pequeno a secção não aparece.
  const idsServicos = new Set((servicos.data?.items || []).map((p) => p.id));
  const novos = (recentes.data?.items || []).filter((p) => !idsDestaque.has(p.id) && !idsServicos.has(p.id)).slice(0, 10);
  const comprador = user?.role === 'COMPRADOR';

  return (
    <div className="kx-pagina kx-pagina--larga kx-vitrine">
      {/* 4 (hero) — categorias à esquerda, mensagem ao centro, cotação à direita */}
      <section className="kx-vit-hero" aria-label="Destaque">
        <div className="kx-container kx-vit-hero__grade">
          <nav className="kx-vit-trilho" aria-label="Categorias">
            <p className="kx-vit-trilho__titulo">Categorias</p>
            {cats.status === 'carregando' && !cats.data ? <Skeleton lines={6} /> : (
              <ul>
                {categorias.slice(0, 9).map((c) => <li key={c.name}><Link to={caminhoCategoria(c.name)}><span>{c.name}</span><span className="kx-vit-trilho__n">{c.count}</span></Link></li>)}
                <li><Link to="/categorias" className="kx-vit-trilho__todas">Ver todas as categorias <Icon name="arrow-right" size={14} /></Link></li>
              </ul>
            )}
          </nav>

          <div className="kx-vit-banner">
            <p className="kx-eyebrow">Marketplace B2B · Angola</p>
            <h1>Procurement industrial para Oil &amp; Gas em Angola</h1>
            <p className="kx-vit-banner__texto">Equipamentos, materiais, segurança industrial, manutenção e serviços técnicos — de fornecedoras verificadas.</p>
            <ul className="kx-vit-chips" aria-label="Segmentos">{SEGMENTOS.map((s) => <li key={s}>{s}</li>)}</ul>
            <div className="kx-heroi__acoes">
              <Button as={Link} to="/produtos" variant="primary" size="lg" rightIcon="arrow-right">Explorar o catálogo</Button>
              <Button as={Link} to="/servicos" variant="ondark" size="lg">Ver serviços</Button>
            </div>
          </div>

          <aside className="kx-vit-rfq" aria-labelledby="rfq-t">
            <h2 id="rfq-t">Peça uma cotação</h2>
            <ol>
              <li>Encontre o produto ou serviço no catálogo.</li>
              <li>Peça cotação à fornecedora, com quantidade e nota.</li>
              <li>Compare a resposta e emita a ordem de compra.</li>
            </ol>
            {comprador ? <Button as={Link} to="/produtos" variant="primary">Procurar e pedir cotação</Button>
              : autenticado ? <Button as={Link} to="/mercado/cotacoes" variant="primary">Ver cotações</Button>
                : (<><Button as={Link} to="/cadastro" variant="primary">Registar a empresa</Button><p className="kx-vit-rfq__nota">Para enviar pedidos precisa de uma conta empresarial. <Link to="/login">Entrar</Link></p></>)}
          </aside>
        </div>
      </section>

      <div className="kx-container">
        {/* 4 — categorias de procurement industrial */}
        <Dados de={cats} esqueleto={<Skeleton lines={3} />} vazio={(d) => !d.categories.length}>
          {(d) => (
            <Seccao id="categorias" numero="4" titulo="Categorias de procurement industrial" ligacao={{ to: '/categorias', rotulo: 'Todas as categorias' }}>
              <ul className="kx-vit-categorias">
                {d.categories.slice(0, 8).map((c) => {
                  const img = imagemDaCategoria(c.name, todos);
                  return (
                    <li key={c.name}>
                      <Link to={caminhoCategoria(c.name)} className="kx-vit-categoria">
                        {img ? <img src={img} alt="" width="72" height="72" loading="lazy" /> : <span className="kx-vit-categoria__icone" aria-hidden="true"><Icon name="box" size={28} /></span>}
                        <span><strong>{c.name}</strong><small>{formatarNumero(c.count)} {c.count === 1 ? 'oferta' : 'ofertas'}</small></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Seccao>
          )}
        </Dados>

        {/* 5 — produtos em destaque */}
        <Dados de={relevantes} esqueleto={<Esqueleto />} vazio={(d) => !d.items.length}>
          {() => (
            <Seccao id="destaques" numero="5" titulo="Produtos em destaque" sub="Os mais relevantes do catálogo, ordenados pela plataforma." ligacao={{ to: '/produtos', rotulo: 'Ver todos' }}>
              <ul className="kx-resultados kx-resultados--grade kx-vit-grade">{destaques.map((p) => <li key={p.id}><CartaoProduto produto={p} /></li>)}</ul>
            </Seccao>
          )}
        </Dados>

        {/* 6 — publicados recentemente */}
        {novos.length ? (
          <Seccao id="recentes" numero="6" titulo="Publicados recentemente" ligacao={{ to: '/produtos?sort=recentes', rotulo: 'Ver os mais recentes' }}>
            <ul className="kx-vit-carrossel">{novos.map((p) => <li key={p.id}><CartaoProduto produto={p} /></li>)}</ul>
          </Seccao>
        ) : null}

        {/* 7 — fornecedoras verificadas */}
        <Dados de={fornecedoras} vazio={(d) => !d.length}>
          {(d) => (
            <Seccao id="fornecedoras" numero="7" titulo="Fornecedoras verificadas" sub="Empresas credenciadas, com documentos e certificações validados." ligacao={{ to: '/fornecedores', rotulo: 'Ver fornecedoras' }}>
              <ul className="kx-fornecedores">{d.map((f) => <li key={f.id}><CartaoFornecedor fornecedor={f} /></li>)}</ul>
            </Seccao>
          )}
        </Dados>

        {/* 8 — serviços industriais */}
        <Dados de={servicos} esqueleto={<Esqueleto />} vazio={(d) => !d.items.length}>
          {(d) => (
            <Seccao id="servicos" numero="8" titulo="Serviços industriais" sub="Inspeção, ensaios, engenharia, transporte e formação técnica." ligacao={{ to: '/servicos', rotulo: 'Ver todos os serviços' }}>
              <ul className="kx-resultados kx-resultados--grade kx-vit-grade">{d.items.map((p) => <li key={p.id}><CartaoProduto produto={p} /></li>)}</ul>
            </Seccao>
          )}
        </Dados>
      </div>

      {/* 9 — faixa de cotação */}
      <section className="kx-vit-faixa" aria-labelledby="faixa-cotacao-t" data-seccao="9">
        <div className="kx-container kx-vit-faixa__interior">
          <div>
            <h2 id="faixa-cotacao-t">Não encontrou o que procura? Peça cotações às fornecedoras</h2>
            <ol className="kx-vit-passos"><li>Descreva o que precisa</li><li>Receba preço e prazo</li><li>Compare e emita a ordem de compra</li></ol>
          </div>
          <Button as={Link} to={autenticado ? '/produtos' : '/cadastro'} variant="primary" size="lg" rightIcon="arrow-right">{autenticado ? 'Procurar e pedir cotação' : 'Registar a empresa'}</Button>
        </div>
      </section>

      <div className="kx-container">
        {/* 10 — confiança e vantagens */}
        <Seccao id="confianca" numero="10" titulo="Porquê comprar na KIXIMA">
          <ul className="kx-vit-vantagens">
            {VANTAGENS.map((v) => <li key={v.titulo}><span className="kx-vantagem__icone"><Icon name={v.icone} size={22} /></span><div><h3>{v.titulo}</h3><p>{v.texto}</p></div></li>)}
          </ul>
          {cats.data?.certifications?.length ? (
            <p className="kx-vit-certs">Certificações presentes no catálogo: {cats.data.certifications.slice(0, 6).map((c) => <Badge key={c.name}>{c.name}</Badge>)}</p>
          ) : null}
          <Numeros />
          <Avaliacoes ocultarVazio />
        </Seccao>
      </div>
    </div>
  );
}
