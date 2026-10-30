import { Link } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { Badge, Breadcrumb, Card, ErrorState, Skeleton } from '../../ui';
import { formatarNumero, formatarPreco } from '../../lib/format';
import { ESTADO_ORDEM, descrever } from './estados';

/** Cabeçalho de página de trabalho: migalhas + título + subtítulo + ações à direita. */
export function Cabecalho({ migalhas, titulo, sub, acoes }) {
  return (
    <>
      {migalhas ? <Breadcrumb items={migalhas} /> : null}
      <header className="kx-pagina__cabeca kx-cabeca-acoes">
        <div>
          <h1>{titulo}</h1>
          {sub ? <p className="kx-pagina__sub">{sub}</p> : null}
        </div>
        {acoes ? <div className="kx-cabeca-acoes__botoes">{acoes}</div> : null}
      </header>
    </>
  );
}

/** Indicadores de topo. itens: [{ rotulo, valor, nota?, tom? }]. `valor` já formatado (texto) ou número. */
export function Indicadores({ itens, rotulo = 'Indicadores' }) {
  return (
    <ul className="kx-kpis" aria-label={rotulo}>
      {itens.map((i) => (
        <li key={i.rotulo} className={`kx-kpi ${i.tom ? `kx-kpi--${i.tom}` : ''}`.trim()}>
          <span className="kx-kpi__rotulo">{i.rotulo}</span>
          <strong className="kx-kpi__valor">{typeof i.valor === 'number' ? formatarNumero(i.valor) : i.valor}</strong>
          {i.nota ? <span className="kx-kpi__nota">{i.nota}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Bloco com título, para agrupar uma tabela ou uma lista. */
export function Bloco({ titulo, acao, children, id }) {
  return (
    <Card className="kx-bloco" aria-labelledby={id}>
      <div className="kx-bloco__cabeca">
        <h2 id={id} className="kx-bloco__titulo">{titulo}</h2>
        {acao || null}
      </div>
      {children}
    </Card>
  );
}

/**
 * Estados de uma vista carregada com `useAsync`: esqueleto enquanto carrega, erro com “Tentar de novo”, e só então o
 * conteúdo. `render(data, recarregar)`.
 */
export function Carregado({ de, render, linhas = 4 }) {
  if (de.status === 'carregando' && !de.data) return <div aria-busy="true"><Skeleton lines={linhas} /></div>;
  if (de.status === 'erro' && !de.data) return <ErrorState description={mensagemDeErro(de.error)} detalhe={de.error?.code} onRetry={de.recarregar} />;
  return <div aria-busy={de.aAtualizar || undefined}>{render(de.data, de.recarregar)}</div>;
}

export function EstadoDaOrdem({ estado }) {
  const e = descrever(ESTADO_ORDEM, estado);
  return <Badge tone={e.tom} dot>{e.rotulo}</Badge>;
}

export const Dinheiro = ({ valor, moeda }) => formatarPreco(valor, moeda) || '—';

/** Ligação para a ficha de uma ordem. */
export const LigacaoOrdem = ({ id, referencia }) => <Link to={`/ordens/${id}`} className="kx-mono">{referencia}</Link>;
