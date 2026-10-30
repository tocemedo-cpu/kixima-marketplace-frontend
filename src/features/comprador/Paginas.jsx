import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  atividadesDoComprador, entregasDoComprador, fornecedoresDoComprador, ordensDoComprador, pagamentosDoComprador,
  painelComprador, perfilDoComprador, rececoesDoComprador,
} from '../../api/endpoints/painel';
import { formatarData, formatarNumero, formatarPreco } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Badge, Button, EmptyState, Pagination, Table } from '../../ui';
import { Bloco, Cabecalho, Carregado, Dinheiro, EstadoDaOrdem, Indicadores, LigacaoOrdem } from '../comum/painel';
import { ESTADO_FATURA, descrever } from '../comum/estados';
import { useRequisicao } from './RequisicaoContext';

const migalhas = (atual) => [{ label: 'Compras', to: '/comprador' }, ...(atual ? [{ label: atual }] : [])];
const nomeDe = (p) => p?.name || '—';

/** Painel do comprador: números do servidor (nenhum calculado aqui) e atalhos para o trabalho do dia. */
export function PainelComprador() {
  const painel = useAsync((s) => painelComprador({ signal: s }), []);
  const perfil = useAsync((s) => perfilDoComprador({ signal: s }), []);
  const { total } = useRequisicao();
  const k = painel.data?.kpis;
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho titulo="Painel do comprador" sub={perfil.data ? `${perfil.data.company.name} · ${perfil.data.user.name}` : 'As suas compras num relance.'}
        acoes={<><Button as={Link} to="/produtos" variant="primary">Procurar no catálogo</Button><Button as={Link} to="/comprador/requisicao" variant="secondary">Requisição{total ? ` (${total})` : ''}</Button></>} />
      <Carregado de={painel} render={() => (
        <Indicadores itens={[
          { rotulo: 'Em andamento', valor: k.emAndamento },
          { rotulo: 'A aguardar pagamento', valor: k.aguardandoPagamento?.count ?? 0, nota: formatarPreco(k.aguardandoPagamento?.total, 'AOA') || undefined, tom: k.aguardandoPagamento?.count ? 'warning' : undefined },
          { rotulo: 'Em entrega', valor: k.emEntrega?.count ?? 0, nota: formatarPreco(k.emEntrega?.total, 'AOA') || undefined },
          { rotulo: 'Recebidas no mês', valor: k.recebidasMes, tom: 'success' },
        ]} />
      )} />
      <div className="kx-grade-2">
        <Bloco titulo="Ordens por fase" id="c-fases">
          <Carregado de={painel} linhas={2} render={(d) => {
            const max = Math.max(1, ...d.minhasOrdens.map((f) => f.count));
            return (
              <ul className="kx-barras">
                {d.minhasOrdens.map((f) => (
                  <li key={f.label}><span>{f.label}</span><span className="kx-barras__trilho" aria-hidden="true"><span className="kx-barras__valor" style={{ width: `${(f.count / max) * 100}%` }} /></span><strong>{f.count}</strong></li>
                ))}
              </ul>
            );
          }} />
        </Bloco>
        <Bloco titulo="Resumo do ano" id="c-ano" acao={<Link to="/comprador/ordens">Ver ordens</Link>}>
          <Carregado de={perfil} linhas={2} render={(p) => (
            <dl className="kx-def">
              <div><dt>Ordens no ano</dt><dd>{formatarNumero(p.summary.ordersYear)}</dd></div>
              <div><dt>Total comprado</dt><dd><Dinheiro valor={p.summary.totalBought} moeda="AOA" /></dd></div>
              <div><dt>Fornecedoras</dt><dd>{formatarNumero(p.summary.suppliers)}</dd></div>
              <div><dt>Itens recebidos</dt><dd>{formatarNumero(p.summary.itemsReceived)}</dd></div>
            </dl>
          )} />
        </Bloco>
      </div>
      <Bloco titulo="Ordens recentes" id="c-recentes" acao={<Link to="/ordens">Todas as ordens</Link>}>
        <Carregado de={perfil} linhas={3} render={(p) => (
          <Table caption="Ordens recentes" rows={p.recent} getRowKey={(r) => r.reference} empty={<EmptyState icon="file" title="Ainda não há ordens" description="Crie a primeira requisição a partir do catálogo." />}
            columns={[
              { key: 'reference', header: 'Referência', mono: true, render: (r) => r.reference },
              { key: 'supplier', header: 'Fornecedora', render: (r) => r.supplier || '—' },
              { key: 'status', header: 'Estado', render: (r) => <EstadoDaOrdem estado={r.status} /> },
              { key: 'at', header: 'Data', render: (r) => formatarData(r.at) },
            ]} />
        )} />
      </Bloco>
    </div>
  );
}

/** Mesma estrutura para as vistas /api/buyer/* (kpis + items): título, indicadores e tabela. */
function VistaDoComprador({ titulo, sub, atual, carregar, indicadores, colunas, vazio, caption }) {
  const dados = useAsync((s) => carregar(s), []);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas(atual)} titulo={titulo} sub={sub} />
      <Carregado de={dados} render={(d) => (
        <>
          <Indicadores itens={indicadores(d.kpis)} />
          <Table caption={caption} rows={d.items} getRowKey={(r, i) => r.id ?? i} columns={colunas} empty={vazio} />
        </>
      )} />
    </div>
  );
}

export const OrdensDoComprador = () => {
  const [pagina, setPagina] = useState(1);
  const dados = useAsync((s) => ordensDoComprador({ page: pagina, limit: 15 }, { signal: s }), [pagina]);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Ordens')} titulo="As minhas ordens" sub="Histórico de compras da sua empresa, com o estado de cada ordem." acoes={<Button as={Link} to="/ordens" variant="secondary">Filtrar por estado</Button>} />
      <Carregado de={dados} render={(d) => (
        <>
          <Indicadores itens={[
            { rotulo: 'Ordens', valor: d.kpis.total }, { rotulo: 'Valor total', valor: formatarPreco(d.kpis.valorTotal, 'AOA') || '—' },
            { rotulo: 'Em andamento', valor: d.kpis.emAndamento }, { rotulo: 'Concluídas', valor: d.kpis.concluidas, tom: 'success' }, { rotulo: 'Canceladas', valor: d.kpis.canceladas },
          ]} />
          <Table caption="Ordens do comprador" rows={d.items} columns={[
            { key: 'reference', header: 'Referência', mono: true, render: (o) => <LigacaoOrdem id={o.id} referencia={o.reference} /> },
            { key: 'supplier', header: 'Fornecedora', render: (o) => nomeDe(o.supplier) },
            { key: 'itemsCount', header: 'Linhas', align: 'right', render: (o) => o.itemsCount },
            { key: 'totalAmount', header: 'Total', align: 'right', render: (o) => <Dinheiro valor={o.totalAmount} moeda={o.currency} /> },
            { key: 'status', header: 'Estado', render: (o) => <EstadoDaOrdem estado={o.status} /> },
            { key: 'createdAt', header: 'Data', render: (o) => formatarData(o.createdAt) },
          ]} empty={<EmptyState icon="file" title="Ainda não há ordens" description="Crie uma requisição a partir do catálogo." action={<Button as={Link} to="/produtos" variant="primary">Ir ao catálogo</Button>} />} />
          <Pagination page={d.page} pages={d.pages} onChange={setPagina} label="Páginas de ordens" />
        </>
      )} />
    </div>
  );
};

export const PagamentosDoComprador = () => (
  <VistaDoComprador atual="Pagamentos" titulo="Pagamentos" sub="Faturas das suas ordens e o que falta pagar. O pagamento é feito pelo Financeiro da empresa."
    caption="Pagamentos das ordens" carregar={(s) => pagamentosDoComprador(undefined, { signal: s })}
    indicadores={(k) => [{ rotulo: 'A pagar', valor: formatarPreco(k.aPagar, 'AOA') || '—', tom: k.aPagar ? 'warning' : undefined }, { rotulo: 'Pagos', valor: formatarPreco(k.concluidos, 'AOA') || '—', tom: 'success' }, { rotulo: 'Em atraso', valor: formatarPreco(k.atrasados, 'AOA') || '—', tom: k.atrasados ? 'danger' : undefined }, { rotulo: 'Total das ordens', valor: formatarPreco(k.totalPO, 'AOA') || '—' }]}
    colunas={[
      { key: 'invoiceRef', header: 'Fatura', mono: true, render: (p) => p.invoiceRef },
      { key: 'reference', header: 'Ordem', render: (p) => <LigacaoOrdem id={p.poId} referencia={p.reference} /> },
      { key: 'supplier', header: 'Fornecedora', render: (p) => nomeDe(p.supplier) },
      { key: 'dueAt', header: 'Vence', render: (p) => formatarData(p.dueAt) },
      { key: 'amount', header: 'Valor', align: 'right', render: (p) => <Dinheiro valor={p.amount} moeda={p.currency} /> },
      { key: 'open', header: 'Em aberto', align: 'right', render: (p) => <Dinheiro valor={p.open} moeda={p.currency} /> },
      { key: 'status', header: 'Estado', render: (p) => { const e = descrever(ESTADO_FATURA, p.status); return <Badge tone={e.tom} dot>{e.rotulo}</Badge>; } },
    ]}
    vazio={<EmptyState icon="file" title="Sem faturas" description="As faturas surgem quando a fornecedora aceita uma ordem." />} />
);

export const EntregasDoComprador = () => (
  <VistaDoComprador atual="Entregas" titulo="Entregas" sub="Acompanhe o caminho de cada ordem até à sua empresa." caption="Entregas das ordens"
    carregar={(s) => entregasDoComprador(undefined, { signal: s })}
    indicadores={(k) => [{ rotulo: 'Em trânsito', valor: k.emTransito }, { rotulo: 'Em preparação', valor: k.emPreparacao }, { rotulo: 'Entregues', valor: k.entregues, tom: 'success' }, { rotulo: 'Canceladas', valor: k.canceladas }]}
    colunas={[
      { key: 'reference', header: 'Ordem', render: (e) => <LigacaoOrdem id={e.id} referencia={e.reference} /> },
      { key: 'supplier', header: 'Fornecedora', render: (e) => nomeDe(e.supplier) },
      { key: 'label', header: 'Fase', render: (e) => e.label },
      { key: 'progress', header: 'Progresso', render: (e) => <span className="kx-progresso" role="img" aria-label={`${e.progress}%`}><span style={{ width: `${Math.max(0, Math.min(100, e.progress))}%` }} /></span> },
      { key: 'dispatchedAt', header: 'Despachada', render: (e) => formatarData(e.dispatchedAt) },
      { key: 'deliveredAt', header: 'Entregue', render: (e) => formatarData(e.deliveredAt) },
    ]}
    vazio={<EmptyState icon="box" title="Sem entregas" description="Quando uma ordem for despachada, o acompanhamento aparece aqui." />} />
);

export const RececoesDoComprador = () => (
  <VistaDoComprador atual="Receções" titulo="Receções" sub="Confirme o que chegou. Registe a receção na ficha da ordem: conforme ou com divergência." caption="Receções"
    carregar={(s) => rececoesDoComprador(undefined, { signal: s })}
    indicadores={(k) => [{ rotulo: 'A receber', valor: k.aReceber, tom: k.aReceber ? 'warning' : undefined }, { rotulo: 'Recebidas', valor: k.recebidos, tom: 'success' }, { rotulo: 'Com divergência', valor: k.divergencia, tom: k.divergencia ? 'danger' : undefined }, { rotulo: 'Total', valor: k.total }]}
    colunas={[
      { key: 'reference', header: 'Ordem', render: (r) => <LigacaoOrdem id={r.poId} referencia={r.reference} /> },
      { key: 'item', header: 'Item', render: (r) => r.item || '—' },
      { key: 'quantity', header: 'Quantidade', align: 'right', render: (r) => (r.quantity ? formatarNumero(r.quantity) : '—') },
      { key: 'supplier', header: 'Fornecedora', render: (r) => nomeDe(r.supplier) },
      { key: 'receivedAt', header: 'Recebida em', render: (r) => formatarData(r.receivedAt) },
      { key: 'receptionStatus', header: 'Resultado', render: (r) => r.receptionStatus || r.status },
      { key: 'acao', header: 'Ação', render: (r) => <Button as={Link} to={`/ordens/${r.poId}`} size="sm" variant="secondary">Abrir ordem</Button> },
    ]}
    vazio={<EmptyState icon="box" title="Sem receções" description="As ordens entregues aguardam aqui a sua confirmação." />} />
);

export const FornecedorasDoComprador = () => (
  <VistaDoComprador atual="Fornecedoras" titulo="As minhas fornecedoras" sub="Fornecedoras com quem a sua empresa já transacionou." caption="Fornecedoras"
    carregar={(s) => fornecedoresDoComprador(undefined, { signal: s })}
    indicadores={(k) => [{ rotulo: 'Total', valor: k.total ?? 0 }, { rotulo: 'Ativas', valor: k.ativos ?? 0 }, { rotulo: 'Homologadas', valor: k.homologados ?? 0 }, { rotulo: 'Novas', valor: k.novos ?? 0 }]}
    colunas={[
      { key: 'name', header: 'Empresa', render: (f) => <>{f.name}{f.verified ? <> <Badge tone="success" dot>Verificada</Badge></> : null}</> },
      { key: 'category', header: 'Categoria', render: (f) => f.category || '—' },
      { key: 'city', header: 'Local', render: (f) => [f.city, f.country].filter(Boolean).join(', ') || '—' },
      { key: 'productCount', header: 'Catálogo', align: 'right', render: (f) => f.productCount ?? '—' },
      { key: 'rating', header: 'Avaliação', align: 'right', render: (f) => (f.rating ? Number(f.rating).toLocaleString('pt-AO', { maximumFractionDigits: 1 }) : '—') },
    ]}
    vazio={<EmptyState icon="building" title="Ainda sem fornecedoras" description="Aparecem aqui depois da primeira ordem." action={<Button as={Link} to="/fornecedores" variant="primary">Ver fornecedoras verificadas</Button>} />} />
);

export const AtividadesDoComprador = () => (
  <VistaDoComprador atual="Atividade" titulo="Atividade" sub="Tarefas e acontecimentos das suas ordens." caption="Atividade"
    carregar={(s) => atividadesDoComprador(undefined, { signal: s })}
    indicadores={(k) => [{ rotulo: 'As minhas tarefas', valor: k.minhasTarefas ?? 0 }, { rotulo: 'A aguardar', valor: k.aguardando ?? 0 }, { rotulo: 'Concluídas', valor: k.concluidas ?? 0, tom: 'success' }, { rotulo: 'Atrasadas', valor: k.atrasadas ?? 0, tom: k.atrasadas ? 'danger' : undefined }]}
    colunas={[
      { key: 'title', header: 'Atividade', render: (a) => (a.poId ? <Link to={`/ordens/${a.poId}`}>{a.title}</Link> : a.title) },
      { key: 'desc', header: 'Detalhe', render: (a) => a.desc || '—' },
      { key: 'status', header: 'Estado', render: (a) => a.status || '—' },
      { key: 'at', header: 'Data', render: (a) => formatarData(a.at) },
    ]}
    vazio={<EmptyState icon="list" title="Sem atividade" description="As suas tarefas aparecem aqui." />} />
);
