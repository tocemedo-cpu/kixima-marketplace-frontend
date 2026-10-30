import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { avaliacoesDoProduto, produtoPorSlug } from '../../api/endpoints/mercado';
import { useAuth } from '../../auth/AuthContext';
import { podePedirCotacao, ROTULO_DE_PAPEL } from '../../auth/papeis';
import { formatarData, formatarNota, formatarNumero } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Alert, Badge, Breadcrumb, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Icon, Skeleton, useToast } from '../../ui';
import { Avaliacao, ImagemProduto, Preco, ROTULO_DE_TIPO } from './CartaoProduto';
import PedirCotacao from './PedirCotacao';
import { useRequisicao } from '../comprador/RequisicaoContext';

// Só se mostram as especificações que o fornecedor preencheu: nunca uma linha vazia ou inventada.
const ESPECIFICACOES = [
  ['Marca', 'brand'], ['Fabricante', 'manufacturer'], ['Modelo', 'model'], ['Referência (SKU)', 'sku'], ['Código do fabricante', 'manufacturerCode'],
  ['País de origem', 'countryOfOrigin'], ['Material', 'material'], ['Especificação principal', 'keySpec'], ['Norma', 'standard'],
  ['Peso', 'weight'], ['Altura', 'height'], ['Largura', 'width'], ['Comprimento', 'length'],
  ['Pressão', 'pressure'], ['Temperatura', 'temperature'], ['Potência', 'power'], ['Tensão', 'voltage'],
  ['Unidade de medida', 'measurementUnit'], ['Garantia', 'warranty'], ['Incoterm', 'incoterm'],
];

function Texto({ titulo, children }) {
  if (!children) return null;
  return <section className="kx-ficha__bloco"><h2>{titulo}</h2><p>{children}</p></section>;
}

function EsqueletoDeProduto() {
  return (
    <div className="kx-container kx-pagina" aria-hidden="true">
      <Skeleton height="1.2em" width="40%" />
      <div className="kx-ficha" style={{ marginTop: 24 }}>
        <Skeleton height="360px" />
        <Skeleton lines={7} />
      </div>
    </div>
  );
}

export default function Produto() {
  const { slug } = useParams();
  const { user, autenticado } = useAuth();
  const [cotando, setCotando] = useState(false);
  const requisicao = useRequisicao();
  const toastReq = useToast();
  const produto = useAsync((signal) => produtoPorSlug(slug, { signal }), [slug]);
  const p = produto.data;
  const avaliacoes = useAsync((signal) => (p ? avaliacoesDoProduto(slug, { signal }) : Promise.resolve([])), [p?.id, slug]);

  if (produto.status === 'carregando' && !p) return <EsqueletoDeProduto />;
  if (produto.status === 'erro' && !p) {
    const naoExiste = produto.error?.status === 404;
    return (
      <div className="kx-container kx-pagina">
        {naoExiste
          ? <EmptyState icon="search" title="Produto não encontrado" description="Este produto ou serviço já não existe ou foi retirado do catálogo." action={<Button as={Link} to="/produtos" variant="primary">Voltar ao catálogo</Button>} />
          : <ErrorState description={mensagemDeErro(produto.error)} detalhe={produto.error?.code} onRetry={produto.recarregar} />}
      </div>
    );
  }

  const imagens = [...(p.images || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const principal = imagens.find((i) => i.isPrimary) || imagens[0];
  const capa = principal ? { ...p, imageUrl: principal.url } : p;
  const linhas = ESPECIFICACOES.map(([rotulo, chave]) => [rotulo, p[chave]]).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const local = [p.city, p.province, p.country].filter(Boolean).join(', ');
  const pode = podePedirCotacao(user?.role);

  return (
    <div className="kx-container kx-pagina">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Produtos', to: '/produtos' }, ...(p.category ? [{ label: p.category, to: `/categorias/${encodeURIComponent(p.category)}` }] : []), { label: p.name }]} />

      <div className="kx-ficha">
        <div className="kx-ficha__galeria">
          <ImagemProduto produto={capa} alt={p.name} largura={640} altura={480} prioridade />
          {imagens.length > 1 ? (
            <ul className="kx-ficha__miniaturas" aria-label="Mais imagens">
              {imagens.map((i) => <li key={i.id}><ImagemProduto produto={{ ...p, imageUrl: i.url }} alt="" largura={96} altura={72} /></li>)}
            </ul>
          ) : null}
        </div>

        <div className="kx-ficha__resumo">
          <div className="kx-produto__selos">
            <Badge tone={p.kind === 'SERVICO' ? 'brand' : 'neutral'}>{ROTULO_DE_TIPO[p.kind]}</Badge>
            {p.availability ? <Badge tone="success" dot>{p.availability}</Badge> : null}
            {p.supplier?.verified ? <Badge tone="success" dot>Fornecedor verificado</Badge> : null}
          </div>
          <h1>{p.name}</h1>
          {p.category ? <p className="kx-produto__categoria">{p.category}{p.subcategory ? ` › ${p.subcategory}` : ''}</p> : null}
          <p className="kx-ficha__avaliacao"><Avaliacao produto={p} /></p>
          {p.description ? <p>{p.description}</p> : null}

          <Card className="kx-ficha__compra">
            <CardBody>
              <Preco produto={p} grande />
              <dl className="kx-ficha__dados">
                {p.minQuantity ? <><dt>Quantidade mínima</dt><dd>{formatarNumero(p.minQuantity)}</dd></> : null}
                {p.maxQuantity ? <><dt>Quantidade máxima</dt><dd>{formatarNumero(p.maxQuantity)}</dd></> : null}
                {p.availability ? <><dt>Disponibilidade</dt><dd>{p.availability}</dd></> : null}
                {p.leadTimeDays !== null && p.leadTimeDays !== undefined ? <><dt>Prazo de entrega</dt><dd>{p.leadTimeDays} {p.leadTimeDays === 1 ? 'dia' : 'dias'}</dd></> : null}
                {local ? <><dt>Localização</dt><dd>{local}</dd></> : null}
              </dl>
              {pode ? (
                <>
                  {p.unitPrice !== null && p.unitPrice !== undefined && p.supplier ? (
                    <Button variant="primary" size="lg" className="kx-ficha__cta" leftIcon="plus"
                      onClick={() => {
                        requisicao.adicionar({ productId: p.id, slug: p.slug, name: p.name, supplierId: p.supplierId, supplierName: p.supplier.name, unitPrice: Number(p.promoPrice ?? p.unitPrice), currency: p.currency || 'AOA', quantity: Math.max(1, Number(p.minQuantity) || 1) });
                        toastReq.success('Adicionado à requisição.');
                      }}>Adicionar à requisição</Button>
                  ) : null}
                  <Button variant={p.unitPrice !== null && p.unitPrice !== undefined ? 'secondary' : 'primary'} size="lg" className="kx-ficha__cta" onClick={() => setCotando(true)} leftIcon="file">Pedir cotação</Button>
                </>
              ) : !autenticado ? (
                <div className="kx-ficha__visitante">
                  <Button as={Link} to={`/login?next=${encodeURIComponent(`/produto/${slug}`)}`} variant="primary" size="lg" className="kx-ficha__cta" leftIcon="file">Entrar para pedir cotação</Button>
                  <Button as={Link} to="/cadastro" size="lg" className="kx-ficha__cta">Registar a empresa</Button>
                  <p className="kx-ficha__nota">Pode explorar o catálogo sem conta. Pedir cotações e emitir ordens exige uma conta empresarial de Comprador.</p>
                </div>
              ) : (
                <Alert tone="info">
                  Os pedidos de cotação são feitos por contas de Comprador. A sua conta é <strong>{ROTULO_DE_PAPEL[user?.role] || 'de outro tipo'}</strong>.
                </Alert>
              )}
            </CardBody>
          </Card>

          {p.supplier ? (
            <Card className="kx-ficha__fornecedor">
              <CardBody>
                <p className="kx-ficha__rotulo">Fornecedor</p>
                <p><strong>{p.supplier.name}</strong>{p.supplier.verified ? <> <Badge tone="success" dot>Verificada</Badge></> : null}</p>
                <p><Link to={`/produtos?q=${encodeURIComponent(p.supplier.name)}`}>Ver as ofertas desta fornecedora</Link></p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="kx-ficha__detalhes">
        <div>
          <Texto titulo="Descrição completa">{p.fullDescription}</Texto>
          <Texto titulo="Aplicações">{p.applications}</Texto>
          <Texto titulo="Benefícios">{p.benefits}</Texto>
          <Texto titulo="Notas do fornecedor">{p.supplierNotes}</Texto>
          {p.certifications?.length ? <section className="kx-ficha__bloco"><h2>Certificações</h2><p className="kx-produto__certs">{p.certifications.map((c) => <Badge key={c}>{c}</Badge>)}</p></section> : null}
          {p.documents?.length ? (
            <section className="kx-ficha__bloco">
              <h2>Documentos</h2>
              <ul className="kx-docs">
                {p.documents.map((d) => <li key={d.id}><a href={d.fileUrl} target="_blank" rel="noopener noreferrer"><Icon name="file" size={16} /> {d.originalName || 'Documento'} <span className="kx-sr-only">(abre noutra janela)</span></a></li>)}
              </ul>
            </section>
          ) : null}
        </div>

        {linhas.length ? (
          <Card>
            <CardHeader title="Especificações" as="h2" />
            <CardBody>
              <dl className="kx-especificacoes">
                {linhas.map(([r, v]) => <div key={r}><dt>{r}</dt><dd>{v}</dd></div>)}
                {p.unspscCode ? <div><dt>UNSPSC</dt><dd>{p.unspscCode}{p.unspscTitle ? ` — ${p.unspscTitle}` : ''}</dd></div> : null}
              </dl>
            </CardBody>
          </Card>
        ) : null}
      </div>

      <section className="kx-ficha__bloco" aria-labelledby="titulo-avaliacoes">
        <h2 id="titulo-avaliacoes">Avaliações</h2>
        {avaliacoes.status === 'erro' ? <ErrorState title="Não foi possível carregar as avaliações" description={mensagemDeErro(avaliacoes.error)} onRetry={avaliacoes.recarregar} />
          : avaliacoes.status === 'carregando' ? <Skeleton lines={2} />
            : !avaliacoes.data?.length ? <p className="kx-vazio-texto">Ainda não há avaliações para este {p.kind === 'SERVICO' ? 'serviço' : 'produto'}.</p>
              : (
                <ul className="kx-avaliacoes">
                  {avaliacoes.data.map((a) => (
                    <li key={a.id}>
                      <p><strong>{formatarNota(a.rating)} / 5</strong> · {a.authorName || 'Utilizador verificado'} · {formatarData(a.createdAt)}</p>
                      {a.comment ? <p>{a.comment}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
      </section>

      {pode ? <PedirCotacao produto={p} aberto={cotando} onFechar={() => setCotando(false)} /> : null}
    </div>
  );
}
