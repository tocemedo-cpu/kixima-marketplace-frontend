import { useEffect, useState } from 'react';
import { Button, Checkbox, Field, Input } from '../../ui';

const MAX_CATEGORIAS = 8;

/**
 * Painel de filtros. É controlado pela URL: cada alteração chama `onAlterar({ chave: valor })`. As facetas
 * (categorias, tipos, certificações, limites de preço) vêm do backend, já com as contagens do filtro actual.
 */
export default function Filtros({ filtros, facetas, onAlterar, onLimpar, aCarregar = false, ocultar = [] }) {
  const [verTodas, setVerTodas] = useState(false);
  const [min, setMin] = useState(filtros.minPrice || '');
  const [max, setMax] = useState(filtros.maxPrice || '');
  useEffect(() => { setMin(filtros.minPrice || ''); setMax(filtros.maxPrice || ''); }, [filtros.minPrice, filtros.maxPrice]);

  const categorias = facetas?.categories || [];
  const visiveis = verTodas ? categorias : categorias.slice(0, MAX_CATEGORIAS);
  const certsActivas = new Set((filtros.certifications || '').split(',').filter(Boolean));
  const limites = facetas?.priceBounds;
  const paises = facetas?.countries || [];

  const alternarCert = (nome) => {
    const novo = new Set(certsActivas);
    if (novo.has(nome)) novo.delete(nome); else novo.add(nome);
    onAlterar({ certifications: [...novo].join(',') });
  };
  const aplicarPreco = (e) => { e.preventDefault(); onAlterar({ minPrice: min === '' ? null : min, maxPrice: max === '' ? null : max }); };
  const precoInvalido = min !== '' && max !== '' && Number(min) > Number(max);

  return (
    <div className="kx-filtros" aria-busy={aCarregar}>
      {ocultar.includes('kind') ? null : (
      <fieldset className="kx-filtros__grupo">
        <legend>Tipo</legend>
        {[['', 'Todos'], ['PRODUTO', 'Produtos'], ['SERVICO', 'Serviços']].map(([valor, rotulo]) => {
          const n = facetas?.kinds?.find((k) => k.name === valor)?.count;
          return (
            <label key={valor || 'todos'} className="kx-radio">
              <input type="radio" name="tipo" checked={(filtros.kind || '') === valor} onChange={() => onAlterar({ kind: valor || null })} />
              <span>{rotulo}</span>{valor && n !== undefined ? <span className="kx-filtros__n">{n}</span> : null}
            </label>
          );
        })}
      </fieldset>
      )}

      {categorias.length && !ocultar.includes('category') ? (
        <fieldset className="kx-filtros__grupo">
          <legend>Categoria</legend>
          <label className="kx-radio">
            <input type="radio" name="categoria" checked={!filtros.category} onChange={() => onAlterar({ category: null })} />
            <span>Todas as categorias</span>
          </label>
          {visiveis.map((c) => (
            <label key={c.name} className="kx-radio">
              <input type="radio" name="categoria" checked={filtros.category === c.name} onChange={() => onAlterar({ category: c.name })} />
              <span>{c.name}</span><span className="kx-filtros__n">{c.count}</span>
            </label>
          ))}
          {categorias.length > MAX_CATEGORIAS ? (
            <Button size="sm" variant="ghost" onClick={() => setVerTodas((v) => !v)}>{verTodas ? 'Ver menos' : `Ver todas (${categorias.length})`}</Button>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset className="kx-filtros__grupo">
        <legend>Fornecedor</legend>
        <Checkbox label="Apenas fornecedores verificados" checked={Boolean(filtros.verified)} onChange={(e) => onAlterar({ verified: e.target.checked || null })} />
        <Checkbox label="Em promoção" checked={Boolean(filtros.promo)} onChange={(e) => onAlterar({ promo: e.target.checked || null })} />
      </fieldset>

      {paises.length > 1 ? (
        <fieldset className="kx-filtros__grupo">
          <legend>País</legend>
          <label className="kx-radio"><input type="radio" name="pais" checked={!filtros.country} onChange={() => onAlterar({ country: null })} /><span>Todos</span></label>
          {paises.map((p) => (
            <label key={p.name} className="kx-radio"><input type="radio" name="pais" checked={filtros.country === p.name} onChange={() => onAlterar({ country: p.name })} /><span>{p.name}</span><span className="kx-filtros__n">{p.count}</span></label>
          ))}
        </fieldset>
      ) : null}

      {facetas?.certifications?.length ? (
        <fieldset className="kx-filtros__grupo">
          <legend>Certificações</legend>
          {facetas.certifications.map((c) => (
            <Checkbox key={c.name} label={`${c.name} (${c.count})`} checked={certsActivas.has(c.name)} onChange={() => alternarCert(c.name)} />
          ))}
        </fieldset>
      ) : null}

      <form className="kx-filtros__grupo" onSubmit={aplicarPreco} noValidate>
        <p className="kx-filtros__titulo">Preço</p>
        <div className="kx-filtros__preco">
          <Field label="Mínimo"><Input type="number" inputMode="decimal" min="0" step="any" value={min} onChange={(e) => setMin(e.target.value)} placeholder={limites ? String(limites.min) : ''} /></Field>
          <Field label="Máximo" error={precoInvalido ? 'O máximo tem de ser maior que o mínimo.' : undefined}><Input type="number" inputMode="decimal" min="0" step="any" value={max} onChange={(e) => setMax(e.target.value)} placeholder={limites ? String(limites.max) : ''} /></Field>
        </div>
        <Button type="submit" size="sm" disabled={precoInvalido}>Aplicar preço</Button>
      </form>

      <Button variant="ghost" size="sm" onClick={onLimpar}>Limpar filtros</Button>
    </div>
  );
}
