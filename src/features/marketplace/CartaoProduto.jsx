import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatarNota, formatarPreco } from '../../lib/format';
import { Badge, Icon } from '../../ui';

export const ROTULO_DE_TIPO = { PRODUTO: 'Produto', SERVICO: 'Serviço' };

/** Até 3 especificações resumidas, só com os campos que o produto realmente tem (nada é inventado nem preenchido). */
export function especificacoes(produto, max = 3) {
  const marcaModelo = [produto.brand, produto.model].filter(Boolean).join(' ');
  const candidatos = [produto.keySpec, produto.standard, marcaModelo, produto.material, produto.pressure, produto.temperature, produto.power, produto.specialty];
  return candidatos.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean).map((c) => (c.length > 32 ? `${c.slice(0, 31)}…` : c)).slice(0, max);
}

/** Imagem do produto com reserva de espaço (sem saltos) e uma alternativa quando falta ou falha. */
export function ImagemProduto({ produto, alt = '', largura = 320, altura = 240, prioridade = false }) {
  const [falhou, setFalhou] = useState(false);
  if (!produto.imageUrl || falhou) {
    return (
      <span className="kx-img kx-img--vazia" style={{ aspectRatio: `${largura} / ${altura}` }} aria-hidden={alt ? undefined : 'true'} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <Icon name={produto.kind === 'SERVICO' ? 'building' : 'box'} size={36} />
      </span>
    );
  }
  return (
    <img
      className="kx-img"
      src={produto.imageUrl}
      alt={alt}
      width={largura}
      height={altura}
      loading={prioridade ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFalhou(true)}
      style={{ aspectRatio: `${largura} / ${altura}` }}
    />
  );
}

/** Bloco de preço: nunca inventa um valor. Sem preço público mostra "Preço sob cotação". */
export function Preco({ produto, grande = false }) {
  const normal = formatarPreco(produto.unitPrice, produto.currency || 'AOA');
  const promo = formatarPreco(produto.promoPrice, produto.currency || 'AOA');
  if (!normal && !promo) {
    return <p className={`kx-preco kx-preco--cotacao ${grande ? 'kx-preco--grande' : ''}`}>Preço sob cotação</p>;
  }
  return (
    <p className={`kx-preco ${grande ? 'kx-preco--grande' : ''}`}>
      <strong>{promo || normal}</strong>
      {promo && normal ? <s className="kx-preco__antigo"><span className="kx-sr-only">Preço anterior: </span>{normal}</s> : null}
    </p>
  );
}

export function Avaliacao({ produto }) {
  if (!produto.reviewCount) return <span className="kx-avaliacao kx-avaliacao--vazia">Sem avaliações</span>;
  return (
    <span className="kx-avaliacao">
      <Icon name="star" size={14} />
      <span><strong>{formatarNota(produto.rating)}</strong> / 5 <span className="kx-avaliacao__n">({produto.reviewCount})</span></span>
    </span>
  );
}

/** Cartão de produto/serviço em grelha ou lista. Toda a área é clicável (ligação no título, estendida por CSS). */
export default function CartaoProduto({ produto, vista = 'grade' }) {
  const local = [produto.city, produto.country].filter(Boolean).join(', ');
  return (
    <article className={`kx-produto kx-produto--${vista}`}>
      <div className="kx-produto__img"><ImagemProduto produto={produto} /></div>
      <div className="kx-produto__corpo">
        <div className="kx-produto__selos">
          <Badge tone={produto.kind === 'SERVICO' ? 'brand' : 'neutral'}>{ROTULO_DE_TIPO[produto.kind]}</Badge>
          {produto.availability ? <Badge tone="success" dot>{produto.availability}</Badge> : null}
        </div>
        <h3 className="kx-produto__nome">
          <Link to={`/produto/${encodeURIComponent(produto.slug)}`} className="kx-produto__ligacao">{produto.name}</Link>
        </h3>
        {produto.category ? <p className="kx-produto__categoria">{produto.category}</p> : null}
        {vista === 'lista' && produto.description ? <p className="kx-produto__descricao">{produto.description}</p> : null}
        <Preco produto={produto} />
        <p className="kx-produto__fornecedor">
          {produto.supplier?.name ? <span>{produto.supplier.name}</span> : null}
          {produto.supplier?.verified ? <Badge tone="success" dot>Verificado</Badge> : null}
        </p>
        <p className="kx-produto__meta">
          <Avaliacao produto={produto} />
          {local ? <span className="kx-produto__local">{local}</span> : null}
        </p>
        {especificacoes(produto).length ? <ul className="kx-produto__specs" aria-label="Especificações">{especificacoes(produto).map((e) => <li key={e}>{e}</li>)}</ul> : null}
        {produto.certifications?.length ? (
          <p className="kx-produto__certs">{produto.certifications.slice(0, 2).map((c) => <Badge key={c}>{c}</Badge>)}{produto.certifications.length > 2 ? <Badge>+{produto.certifications.length - 2}</Badge> : null}</p>
        ) : null}
        {produto.minQuantity ? <p className="kx-produto__min">Quantidade mínima: {produto.minQuantity}</p> : null}
        {/* Botão visual: a ação real é a ligação do título, esticada a todo o cartão (um só ponto de foco por cartão). */}
        <span className="kx-btn kx-btn--secondary kx-btn--sm kx-produto__detalhes" aria-hidden="true">Ver detalhes</span>
      </div>
    </article>
  );
}
