import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { listarOrdens, obterOrdem } from '../../api/endpoints/ordens';
import { atualizarProduto, atualizarStock, criarProduto, desativarProduto, meusProdutos, relatorioDoFornecedor } from '../../api/endpoints/fornecedor';
import { confirmarRecebido } from '../../api/endpoints/painel';
import { useAuth } from '../../auth/AuthContext';
import { formatarData, formatarNumero, formatarPreco } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Field, Input, Modal, Select, Table, Textarea, useToast } from '../../ui';
import { Bloco, Cabecalho, Carregado, Dinheiro, Indicadores, LigacaoOrdem } from '../comum/painel';
import { ESTADO_FATURA, ESTADO_ORDEM, descrever } from '../comum/estados';

const migalhas = (atual) => [{ label: 'Prestadora', to: '/fornecedor' }, ...(atual ? [{ label: atual }] : [])];

export function PainelFornecedor() {
  const relatorio = useAsync((s) => relatorioDoFornecedor({ signal: s }), []);
  const ordens = useAsync((s) => listarOrdens({ signal: s }), []);
  const porAceitar = (ordens.data || []).filter((o) => o.status === 'APROVADA');
  const porDespachar = (ordens.data || []).filter((o) => o.status === 'PAGA' || (o.isCallOff && o.status === 'EM_EXECUCAO' && !o.dispatchedAt));
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho titulo="Painel da prestadora" sub="Ordens recebidas, catálogo e faturação da sua empresa."
        acoes={<><Button as={Link} to="/ordens" variant="primary">Ordens recebidas</Button><Button as={Link} to="/fornecedor/catalogo" variant="secondary">Catálogo</Button></>} />
      {ordens.data ? (porAceitar.length || porDespachar.length) ? (
        <Alert tone="warning" title="Precisa da sua atenção">
          {porAceitar.length ? <>{porAceitar.length} ordem(ns) a aguardar a sua resposta. </> : null}
          {porDespachar.length ? <>{porDespachar.length} ordem(ns) paga(s) a aguardar despacho. </> : null}
          <Link to="/ordens">Abrir ordens</Link>
        </Alert>
      ) : null : null}
      <Carregado de={relatorio} render={(r) => (
        <>
          <Indicadores itens={[
            { rotulo: 'Ordens recebidas', valor: r.totalOrders }, { rotulo: 'Faturação', valor: formatarPreco(r.revenue, 'AOA') || '—' },
            { rotulo: 'Produtos/serviços ativos', valor: `${r.activeProducts} de ${r.totalProducts}` },
            { rotulo: 'Stock baixo', valor: r.lowStock, tom: r.lowStock ? 'warning' : undefined },
          ]} />
          <div className="kx-grade-2">
            <Bloco titulo="Ordens por estado" id="f-estados">
              <ul className="kx-barras">
                {Object.entries(r.statusCounts).map(([estado, n]) => {
                  const max = Math.max(1, ...Object.values(r.statusCounts));
                  return <li key={estado}><span>{ESTADO_ORDEM[estado]?.rotulo || estado}</span><span className="kx-barras__trilho" aria-hidden="true"><span className="kx-barras__valor" style={{ width: `${(n / max) * 100}%` }} /></span><strong>{n}</strong></li>;
                })}
              </ul>
            </Bloco>
            <Bloco titulo="Mais vendidos" id="f-top">
              <Table caption="Mais vendidos" rows={r.topProducts} getRowKey={(p) => p.productId} empty={<EmptyState icon="box" title="Sem vendas ainda" />} columns={[
                { key: 'name', header: 'Produto / serviço', render: (p) => p.name },
                { key: 'quantity', header: 'Qtd.', align: 'right', render: (p) => formatarNumero(p.quantity) },
                { key: 'total', header: 'Total', align: 'right', render: (p) => <Dinheiro valor={p.total} moeda="AOA" /> },
              ]} />
            </Bloco>
          </div>
          {r.janela?.truncada ? <p className="kx-nota-direitos">Relatório limitado pelo plano: janela de {r.janela.meses} meses.</p> : null}
        </>
      )} />
    </div>
  );
}

const VAZIO = { name: '', kind: 'PRODUTO', category: '', unitPrice: '', description: '', stockQuantity: '', leadTimeDays: '' };

function ModalProduto({ produto, onFechar, onFeito }) {
  const toast = useToast();
  const editar = Boolean(produto);
  const [v, setV] = useState(() => (produto ? {
    name: produto.name, kind: produto.kind, category: produto.category || '', unitPrice: produto.unitPrice ?? '', description: produto.description || '',
    stockQuantity: produto.stockQuantity ?? '', leadTimeDays: produto.leadTimeDays ?? '',
  } : VAZIO));
  const [campos, setCampos] = useState({});
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    const c = {};
    if (v.name.trim().length < 2) c.name = 'Indique o nome.';
    if (!v.category.trim()) c.category = 'Indique a categoria.';
    if (v.unitPrice === '' || !(Number(v.unitPrice) >= 0)) c.unitPrice = 'Indique o preço unitário (0 ou mais).';
    for (const k of ['stockQuantity', 'leadTimeDays']) if (v[k] !== '' && !(Number.isInteger(Number(v[k])) && Number(v[k]) >= 0)) c[k] = 'Indique um número inteiro (0 ou mais).';
    setCampos(c); setErro('');
    if (Object.keys(c).length) return;
    const corpo = { name: v.name.trim(), kind: v.kind, category: v.category.trim(), unitPrice: Number(v.unitPrice), description: v.description.trim() || undefined };
    if (v.stockQuantity !== '') corpo.stockQuantity = Number(v.stockQuantity);
    if (v.leadTimeDays !== '') corpo.leadTimeDays = Number(v.leadTimeDays);
    setAEnviar(true);
    try {
      if (editar) await atualizarProduto(produto.id, corpo); else await criarProduto(corpo);
      toast.success(editar ? 'Alterações guardadas.' : 'Publicado no catálogo.');
      onFeito();
    } catch (err) {
      setErro(mensagemDeErro(err));
      setCampos(Object.fromEntries(Object.entries(err.fieldErrors || {}).map(([k, m]) => [k, [].concat(m)[0]])));
    } finally { setAEnviar(false); }
  }

  return (
    <Modal open onClose={aEnviar ? () => {} : onFechar} title={editar ? `Editar ${produto.name}` : 'Novo produto ou serviço'} closeOnScrim={false}
      footer={<><Button variant="ghost" onClick={onFechar} disabled={aEnviar}>Cancelar</Button><Button variant="primary" type="submit" form="form-produto" loading={aEnviar}>{editar ? 'Guardar' : 'Publicar'}</Button></>}>
      <form id="form-produto" onSubmit={enviar} noValidate className="kx-form">
        <Field label="Nome" required error={campos.name}><Input value={v.name} onChange={set('name')} /></Field>
        <div className="kx-form kx-form--duas">
          <Field label="Tipo"><Select value={v.kind} onChange={set('kind')}><option value="PRODUTO">Produto</option><option value="SERVICO">Serviço</option></Select></Field>
          <Field label="Categoria" required error={campos.category}><Input value={v.category} onChange={set('category')} /></Field>
        </div>
        <div className="kx-form kx-form--duas">
          <Field label="Preço unitário (Kz)" required error={campos.unitPrice}><Input type="number" min={0} step="any" inputMode="decimal" value={v.unitPrice} onChange={set('unitPrice')} /></Field>
          <Field label="Prazo de entrega (dias)" error={campos.leadTimeDays}><Input type="number" min={0} step={1} inputMode="numeric" value={v.leadTimeDays} onChange={set('leadTimeDays')} /></Field>
        </div>
        {v.kind === 'PRODUTO' ? <Field label="Stock" error={campos.stockQuantity}><Input type="number" min={0} step={1} inputMode="numeric" value={v.stockQuantity} onChange={set('stockQuantity')} /></Field> : null}
        <Field label="Descrição" error={campos.description}><Textarea value={v.description} onChange={set('description')} maxLength={2000} /></Field>
        {erro ? <Alert tone="danger">{erro}</Alert> : null}
      </form>
    </Modal>
  );
}

export function CatalogoDoFornecedor() {
  const { user } = useAuth();
  const toast = useToast();
  const dados = useAsync((s) => meusProdutos(user.companyId, { signal: s }), [user.companyId]);
  const [modal, setModal] = useState(null); // { produto } | 'novo'
  const [aRetirar, setARetirar] = useState(null);
  const [erro, setErro] = useState('');
  const lista = dados.data || [];

  async function stock(p, valor) {
    setErro('');
    try { await atualizarStock(p.id, { stockQuantity: valor }); toast.success('Stock atualizado.'); dados.recarregar(); } catch (e) { setErro(mensagemDeErro(e)); }
  }

  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Catálogo')} titulo="Catálogo da empresa" sub="Produtos e serviços que a sua empresa oferece no marketplace."
        acoes={<Button variant="primary" onClick={() => setModal('novo')}>Novo produto ou serviço</Button>} />
      {erro ? <Alert tone="danger" onClose={() => setErro('')}>{erro}</Alert> : null}
      <Carregado de={dados} render={() => (
        <Table caption="Catálogo da empresa" rows={lista} empty={<EmptyState icon="box" title="O catálogo está vazio" description="Publique o primeiro produto ou serviço." action={<Button variant="primary" onClick={() => setModal('novo')}>Novo produto ou serviço</Button>} />}
          columns={[
            { key: 'name', header: 'Nome', render: (p) => <Link to={`/produto/${p.slug}`}>{p.name}</Link> },
            { key: 'kind', header: 'Tipo', render: (p) => (p.kind === 'SERVICO' ? 'Serviço' : 'Produto') },
            { key: 'category', header: 'Categoria', render: (p) => p.category || '—' },
            { key: 'unitPrice', header: 'Preço', align: 'right', render: (p) => formatarPreco(p.unitPrice, p.currency || 'AOA') || <span className="kx-vazio-texto">Sob cotação</span> },
            { key: 'stock', header: 'Stock', render: (p) => (p.kind === 'SERVICO' ? <span className="kx-vazio-texto">—</span> : (
              <Input className="kx-quant" type="number" min={0} step={1} inputMode="numeric" aria-label={`Stock de ${p.name}`} defaultValue={p.stockQuantity ?? ''}
                onBlur={(e) => { const n = e.target.value === '' ? null : Number(e.target.value); if (n !== null && Number.isInteger(n) && n >= 0 && n !== p.stockQuantity) stock(p, n); }} />
            )) },
            { key: 'active', header: 'Estado', render: (p) => (p.active ? <Badge tone="success" dot>Ativo</Badge> : <Badge tone="neutral" dot>Retirado</Badge>) },
            { key: 'acoes', header: 'Ações', render: (p) => (
              <span className="kx-acoes">
                <Button size="sm" onClick={() => setModal({ produto: p })}>Editar</Button>
                {p.active ? <Button size="sm" variant="ghost" onClick={() => setARetirar(p)}>Retirar</Button> : null}
              </span>
            ) },
          ]} />
      )} />
      {modal ? <ModalProduto produto={modal === 'novo' ? null : modal.produto} onFechar={() => setModal(null)} onFeito={() => { setModal(null); dados.recarregar(); }} /> : null}
      <ConfirmDialog open={Boolean(aRetirar)} onClose={() => setARetirar(null)} tone="danger" confirmLabel="Retirar do catálogo" title={`Retirar ${aRetirar?.name}?`}
        onConfirm={async () => { try { await desativarProduto(aRetirar.id); toast.success('Retirado do catálogo.'); dados.recarregar(); } catch (e) { throw new Error(mensagemDeErro(e)); } }}>
        O produto deixa de aparecer no marketplace. As ordens já emitidas não são afetadas.
      </ConfirmDialog>
    </div>
  );
}

/**
 * Faturas e pagamentos da fornecedora. O backend não tem uma lista própria de faturas da fornecedora: a fatura vem na
 * ficha de cada ordem. Por isso carrega-se a ficha das ordens já aceites (no máximo 30, em paralelo) — dependência
 * documentada em docs/API-USADA.md.
 */
export function FaturasDoFornecedor() {
  const toast = useToast();
  const dados = useAsync(async (signal) => {
    const lista = await listarOrdens({ signal });
    const aceites = lista.filter((o) => o.acceptedAt).sort((a, b) => new Date(b.acceptedAt) - new Date(a.acceptedAt)).slice(0, 30);
    const fichas = await Promise.all(aceites.map((o) => obterOrdem(o.id, { signal })));
    return fichas.filter((o) => o.invoice);
  }, []);
  const [erro, setErro] = useState('');
  const [a, setA] = useState('');
  const linhas = useMemo(() => dados.data || [], [dados.data]);

  async function confirmar(pagamentoId) {
    setA(pagamentoId); setErro('');
    try { await confirmarRecebido(pagamentoId); toast.success('Receção do valor confirmada.'); dados.recarregar(); } catch (e) { setErro(mensagemDeErro(e)); } finally { setA(''); }
  }

  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Faturas e pagamentos')} titulo="Faturas e pagamentos" sub="As faturas emitidas às suas ordens aceites e o pagamento de cada uma." />
      {erro ? <Alert tone="danger" onClose={() => setErro('')}>{erro}</Alert> : null}
      <Carregado de={dados} render={() => (
        <>
          <Indicadores itens={[
            { rotulo: 'Faturas', valor: linhas.length },
            { rotulo: 'Por pagar', valor: linhas.filter((o) => o.invoice.status === 'PENDENTE').length, tom: linhas.some((o) => o.invoice.status === 'PENDENTE') ? 'warning' : undefined },
            { rotulo: 'Pagas', valor: linhas.filter((o) => o.invoice.status === 'PAGA').length, tom: 'success' },
            { rotulo: 'A confirmar receção', valor: linhas.filter((o) => o.invoice.payment && !o.invoice.payment.receivedAt).length },
          ]} />
          <Table caption="Faturas" rows={linhas} empty={<EmptyState icon="file" title="Ainda sem faturas" description="A fatura é emitida quando aceita uma ordem." />} columns={[
            { key: 'ref', header: 'Fatura', mono: true, render: (o) => o.invoice.reference },
            { key: 'po', header: 'Ordem', render: (o) => <LigacaoOrdem id={o.id} referencia={o.reference} /> },
            { key: 'buyer', header: 'Cliente', render: (o) => o.buyerCompany?.name || '—' },
            { key: 'due', header: 'Vence', render: (o) => formatarData(o.invoice.dueAt) },
            { key: 'amount', header: 'Total', align: 'right', render: (o) => <Dinheiro valor={o.invoice.amount} moeda={o.invoice.currency} /> },
            { key: 'status', header: 'Estado', render: (o) => { const e = descrever(ESTADO_FATURA, o.invoice.status); return <Badge tone={e.tom} dot>{e.rotulo}</Badge>; } },
            { key: 'pag', header: 'Pagamento', render: (o) => {
              const p = o.invoice.payment;
              if (!p) return <span className="kx-vazio-texto">Por pagar</span>;
              return p.receivedAt ? `Recebido ${formatarData(p.receivedAt)}` : <Button size="sm" variant="primary" loading={a === p.id} onClick={() => confirmar(p.id)}>Confirmar receção</Button>;
            } },
          ]} />
        </>
      )} />
    </div>
  );
}
