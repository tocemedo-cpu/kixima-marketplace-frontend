import { Link } from 'react-router-dom';
import { formatarNota, iniciais } from '../../lib/format';
import { Badge } from '../../ui';

/** Fornecedora verificada: logótipo (ou iniciais), local, nº de ofertas e avaliação. A ligação leva às suas ofertas. */
export default function CartaoFornecedor({ fornecedor: f }) {
  const local = [f.city, f.country].filter(Boolean).join(', ');
  return (
    <article className="kx-fornecedor">
      {f.logoUrl ? <img src={f.logoUrl} alt="" width="48" height="48" loading="lazy" className="kx-fornecedor__logo" /> : <span className="kx-fornecedor__logo kx-fornecedor__logo--iniciais" aria-hidden="true">{iniciais(f.name)}</span>}
      <div>
        <h3 className="kx-fornecedor__nome">
          <Link to={`/produtos?q=${encodeURIComponent(f.name)}`} className="kx-produto__ligacao">{f.name}</Link>
        </h3>
        <p className="kx-fornecedor__meta"><Badge tone="success" dot>Verificado</Badge>{local ? <span>{local}</span> : null}</p>
        <p className="kx-fornecedor__meta">
          {f.productCount !== undefined ? <span>{f.productCount} {f.productCount === 1 ? 'oferta' : 'ofertas'}</span> : null}
          {f.rating ? <span>★ {formatarNota(f.rating)}</span> : null}
        </p>
      </div>
    </article>
  );
}
