import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { facetas as apiFacetas, pesquisar } from '../../api/endpoints/mercado';
import { mensagemDeErro } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import { formatarNumero } from '../../lib/format';
import { Breadcrumb, Button, EmptyState, ErrorState, Icon, Modal, Pagination, Select, Skeleton } from '../../ui';
import CartaoProduto from './CartaoProduto';
import Filtros from './Filtros';
import { POR_PAGINA, ROTULO_DE_ORDENACAO, comAlteracao, etiquetasActivas, filtrosDaUrl, paginaDaUrl, vistaDaUrl } from './filtros';

function EsqueletoDeResultados({ vista }) {
  return (
    <ul className={`kx-resultados kx-resultados--${vista}`} aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className={`kx-produto kx-produto--${vista}`}>
          <Skeleton height="180px" />
          <div className="kx-produto__corpo"><Skeleton lines={4} /></div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Pesquisa no catálogo (pública): filtros, ordenação, vista em grelha ou lista, paginação. Tudo guardado na URL.
 * `fixo` serve as páginas de categoria e de serviços: { filtros: { category?, kind? }, titulo, sub, migalhas }.
 * Os filtros fixos juntam-se aos da URL, não aparecem como etiquetas removíveis e o seu grupo some do painel.
 */
export default function Pesquisa({ fixo }) {
  const [sp, setSp] = useSearchParams();
  const doUrl = useMemo(() => filtrosDaUrl(sp), [sp]);
  const filtros = useMemo(() => ({ ...doUrl, ...(fixo?.filtros || {}) }), [doUrl, fixo]);
  const ocultar = Object.keys(fixo?.filtros || {});
  const pagina = paginaDaUrl(sp);
  const vista = vistaDaUrl(sp);
  const ordem = filtros.sort || 'relevantes';
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const topo = useRef(null);

  const chave = JSON.stringify([filtros, pagina]);
  const resultados = useAsync((signal) => pesquisar({ ...filtros, page: pagina, limit: POR_PAGINA }, { signal }), [chave]);
  const chaveFacetas = JSON.stringify(filtros);
  const facetas = useAsync((signal) => apiFacetas(filtros, { signal }), [chaveFacetas]);

  const alterar = (alteracao, opcoes) => setSp(comAlteracao(sp, alteracao, opcoes));
  const limpar = () => setSp(new URLSearchParams(vista === 'lista' ? { vista: 'lista' } : {}));
  const etiquetas = etiquetasActivas(doUrl);

  // Ao mudar de página, volta ao início dos resultados (e só então; não rouba o foco no primeiro carregamento).
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    topo.current?.scrollIntoView({ block: 'start' });
  }, [pagina]);

  const dados = resultados.data;
  const removerEtiqueta = (e) => {
    if (e.chave === 'certifications') {
      const resto = (filtros.certifications || '').split(',').filter((c) => c && c !== e.valor).join(',');
      alterar({ certifications: resto || null });
    } else alterar({ [e.chave]: null });
  };

  const painel = (
    <Filtros filtros={filtros} facetas={facetas.data} aCarregar={facetas.status === 'carregando'} onAlterar={alterar} onLimpar={limpar} ocultar={ocultar} />
  );

  return (
    <div className="kx-container kx-pagina">
      <Breadcrumb items={fixo?.migalhas || [{ label: 'Início', to: '/' }, { label: 'Produtos e serviços' }]} />
      <header className="kx-pagina__cabeca">
        <h1>{filtros.q ? <>Resultados para “{filtros.q}”</> : (fixo?.titulo || 'Produtos e serviços')}</h1>
        <p className="kx-pagina__sub">{fixo?.sub || 'Produtos e serviços industriais de fornecedoras credenciadas. Sem preço público, peça uma cotação à fornecedora.'}</p>
      </header>

      <div className="kx-pesquisa">
        <aside className="kx-pesquisa__filtros" aria-label="Filtros">
          <h2 className="kx-filtros__cabeca"><Icon name="filter" size={18} /> Filtros</h2>
          {facetas.status === 'erro' && !facetas.data ? <p className="kx-filtros__erro" role="status">Não foi possível carregar os filtros. Pode continuar a pesquisar.</p> : painel}
        </aside>

        <section className="kx-pesquisa__lista" aria-label="Resultados" ref={topo}>
          <div className="kx-barra">
            <Button className="kx-barra__filtros" onClick={() => setFiltrosAbertos(true)} leftIcon="filter">
              Filtros{etiquetas.length ? ` (${etiquetas.length})` : ''}
            </Button>
            <p className="kx-barra__total" role="status" aria-live="polite">
              {dados ? <><strong>{formatarNumero(dados.total)}</strong> {dados.total === 1 ? 'resultado' : 'resultados'}</> : resultados.status === 'carregando' ? 'A pesquisar…' : ''}
            </p>
            <div className="kx-barra__controlos">
              <label className="kx-barra__ordem">
                <span className="kx-sr-only">Ordenar por</span>
                <Select value={ordem} onChange={(e) => alterar({ sort: e.target.value === 'relevantes' ? null : e.target.value })} aria-label="Ordenar por">
                  {Object.entries(ROTULO_DE_ORDENACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </Select>
              </label>
              <div className="kx-vista" role="group" aria-label="Tipo de vista">
                <button type="button" className={vista === 'grade' ? 'is-active' : ''} aria-pressed={vista === 'grade'} onClick={() => alterar({ vista: null }, { manterPagina: true })} aria-label="Vista em grelha"><Icon name="grid" size={18} /></button>
                <button type="button" className={vista === 'lista' ? 'is-active' : ''} aria-pressed={vista === 'lista'} onClick={() => alterar({ vista: 'lista' }, { manterPagina: true })} aria-label="Vista em lista"><Icon name="list" size={18} /></button>
              </div>
            </div>
          </div>

          {etiquetas.length ? (
            <ul className="kx-etiquetas" aria-label="Filtros activos">
              {etiquetas.map((e) => (
                <li key={`${e.chave}-${e.valor || ''}`}>
                  <button type="button" className="kx-etiqueta" onClick={() => removerEtiqueta(e)} aria-label={`Remover filtro: ${e.rotulo}`}>{e.rotulo} <Icon name="close" size={12} /></button>
                </li>
              ))}
              <li><Button size="sm" variant="ghost" onClick={limpar}>Limpar tudo</Button></li>
            </ul>
          ) : null}

          {resultados.status === 'erro' && !dados ? (
            <ErrorState description={mensagemDeErro(resultados.error)} detalhe={resultados.error?.code} onRetry={resultados.recarregar} />
          ) : resultados.status === 'carregando' && !dados ? (
            <EsqueletoDeResultados vista={vista} />
          ) : dados && dados.items.length === 0 ? (
            <EmptyState
              icon="search"
              title="Nada encontrado"
              description={etiquetas.length ? 'Nenhum produto ou serviço corresponde a estes filtros. Tente retirar algum filtro.' : 'O catálogo ainda não tem produtos ou serviços.'}
              action={etiquetas.length ? <Button variant="primary" onClick={limpar}>Limpar filtros</Button> : null}
            />
          ) : dados ? (
            <>
              {resultados.status === 'erro' ? <p className="kx-filtros__erro" role="alert">{mensagemDeErro(resultados.error)} <Button size="sm" onClick={resultados.recarregar}>Tentar de novo</Button></p> : null}
              <ul className={`kx-resultados kx-resultados--${vista} ${resultados.aAtualizar ? 'is-a-atualizar' : ''}`} aria-busy={resultados.aAtualizar}>
                {dados.items.map((p) => <li key={p.id}><CartaoProduto produto={p} vista={vista} /></li>)}
              </ul>
              <Pagination page={dados.page} pages={dados.pages} onChange={(n) => setSp(comAlteracao(sp, { page: n === 1 ? null : n }, { manterPagina: true }))} label="Páginas de resultados" />
            </>
          ) : null}
        </section>
      </div>

      <Modal open={filtrosAbertos} onClose={() => setFiltrosAbertos(false)} title="Filtros" placement="left" size="sm"
        footer={<Button variant="primary" onClick={() => setFiltrosAbertos(false)}>{dados ? `Ver ${formatarNumero(dados.total)} resultados` : 'Fechar'}</Button>}>
        {painel}
      </Modal>
    </div>
  );
}
