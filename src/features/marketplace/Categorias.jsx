import { Link, useParams } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { facetas, pesquisar } from '../../api/endpoints/mercado';
import { formatarNumero } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Breadcrumb, EmptyState, ErrorState, Icon, Skeleton } from '../../ui';
import Pesquisa from './Pesquisa';

/** Todas as categorias do catálogo, com a contagem e a fotografia do primeiro produto de cada uma (se tiver). */
export default function Categorias() {
  const cats = useAsync((s) => facetas({}, { signal: s }), []);
  const produtos = useAsync((s) => pesquisar({ limit: 48, page: 1 }, { signal: s }), []);
  const imagem = (nome) => produtos.data?.items.find((p) => p.category === nome && p.imageUrl)?.imageUrl;
  return (
    <div className="kx-container kx-pagina">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Categorias' }]} />
      <header className="kx-pagina__cabeca">
        <h1>Categorias</h1>
        <p className="kx-pagina__sub">Equipamentos, materiais, segurança industrial, manutenção e serviços técnicos para Oil &amp; Gas.</p>
      </header>
      {cats.status === 'carregando' && !cats.data ? <Skeleton lines={4} />
        : cats.status === 'erro' && !cats.data ? <ErrorState description={mensagemDeErro(cats.error)} detalhe={cats.error?.code} onRetry={cats.recarregar} />
          : !cats.data.categories.length ? <EmptyState icon="box" title="Ainda não há categorias" description="Aparecem quando as fornecedoras publicarem produtos e serviços." />
            : (
              <ul className="kx-vit-categorias kx-vit-categorias--pagina">
                {cats.data.categories.map((c) => (
                  <li key={c.name}>
                    <Link to={`/categorias/${encodeURIComponent(c.name)}`} className="kx-vit-categoria">
                      {imagem(c.name) ? <img src={imagem(c.name)} alt="" width="72" height="72" loading="lazy" /> : <span className="kx-vit-categoria__icone" aria-hidden="true"><Icon name="box" size={28} /></span>}
                      <span><strong>{c.name}</strong><small>{formatarNumero(c.count)} {c.count === 1 ? 'oferta' : 'ofertas'}</small></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
    </div>
  );
}

/** Página de uma categoria: a pesquisa com a categoria fixa (os restantes filtros continuam à mão). */
export function Categoria() {
  const { nome } = useParams();
  return (
    <Pesquisa
      key={nome}
      fixo={{
        filtros: { category: nome },
        titulo: nome,
        sub: `Produtos e serviços da categoria ${nome} de fornecedoras credenciadas.`,
        migalhas: [{ label: 'Início', to: '/' }, { label: 'Categorias', to: '/categorias' }, { label: nome }],
      }}
    />
  );
}

/** Todos os serviços industriais (a pesquisa com o tipo fixo em «Serviço»). */
export function Servicos() {
  return (
    <Pesquisa
      fixo={{
        filtros: { kind: 'SERVICO' },
        titulo: 'Serviços industriais',
        sub: 'Inspeção, ensaios, engenharia, transporte e formação técnica. A maioria é cotada à medida: peça cotação à fornecedora.',
        migalhas: [{ label: 'Início', to: '/' }, { label: 'Serviços' }],
      }}
    />
  );
}
