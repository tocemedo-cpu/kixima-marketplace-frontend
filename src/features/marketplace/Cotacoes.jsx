import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { encerrarCotacao, listarCotacoes, responderCotacao } from '../../api/endpoints/cotacoes';
import { useAuth } from '../../auth/AuthContext';
import { podeEncerrarCotacao, podeResponderCotacao } from '../../auth/papeis';
import { formatarData, formatarPreco } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Alert, Badge, Breadcrumb, Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Table, Tabs, Textarea, useToast } from '../../ui';

const ESTADOS = {
  ABERTA: { rotulo: 'Aberta', tom: 'warning', ajuda: 'A aguardar resposta do fornecedor' },
  RESPONDIDA: { rotulo: 'Respondida', tom: 'success', ajuda: 'O fornecedor respondeu' },
  FECHADA: { rotulo: 'Fechada', tom: 'neutral', ajuda: 'Pedido encerrado' },
};

function ModalResponder({ cotacao, onFechar, onFeito }) {
  const toast = useToast();
  const [preco, setPreco] = useState('');
  const [prazo, setPrazo] = useState('');
  const [nota, setNota] = useState('');
  const [campos, setCampos] = useState({});
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const c = {};
    const p = Number(preco);
    if (!preco || !Number.isFinite(p) || p <= 0) c.price = 'Indique um preço maior que zero.';
    if (prazo !== '' && (!Number.isInteger(Number(prazo)) || Number(prazo) < 0)) c.leadDays = 'Indique um número inteiro de dias (0 ou mais).';
    setCampos(c); setErro('');
    if (Object.keys(c).length) return;
    setAEnviar(true);
    try {
      await responderCotacao(cotacao.id, { price: p, leadDays: prazo === '' ? undefined : Number(prazo), note: nota.trim() || undefined });
      toast.success('Resposta enviada ao comprador.');
      onFeito();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally { setAEnviar(false); }
  }

  return (
    <Modal open onClose={onFechar} title="Responder ao pedido" closeOnScrim={false}
      footer={<><Button variant="ghost" onClick={onFechar} disabled={aEnviar}>Cancelar</Button><Button variant="primary" type="submit" form="form-resposta" loading={aEnviar}>Enviar resposta</Button></>}>
      <form id="form-resposta" onSubmit={enviar} noValidate className="kx-form">
        <p className="kx-form__resumo">Pedido de <strong>{cotacao.buyerCompany?.name || 'comprador'}</strong>: {cotacao.items.map((i) => `${i.quantity} × ${i.product?.name || 'item'}`).join('; ')}</p>
        {cotacao.note ? <Alert tone="info" title="Nota do comprador">{cotacao.note}</Alert> : null}
        {erro ? <Alert tone="danger">{erro}</Alert> : null}
        <Field label="Preço total proposto" required error={campos.price} hint="Na moeda do catálogo do fornecedor."><Input data-autofocus type="number" inputMode="decimal" min="0" step="any" value={preco} onChange={(e) => setPreco(e.target.value)} /></Field>
        <Field label="Prazo de entrega (dias)" error={campos.leadDays}><Input type="number" inputMode="numeric" min="0" step="1" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Field>
        <Field label="Nota para o comprador"><Textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} /></Field>
      </form>
    </Modal>
  );
}

export default function Cotacoes() {
  const { user } = useAuth();
  const toast = useToast();
  const lista = useAsync((signal) => listarCotacoes(undefined, { signal }), []);
  const [aba, setAba] = useState('TODAS');
  const [aResponder, setAResponder] = useState(null);
  const [aEncerrar, setAEncerrar] = useState(null);

  const comprador = podeEncerrarCotacao(user?.role);
  const fornecedor = podeResponderCotacao(user?.role);
  const dados = lista.data || [];
  const visiveis = useMemo(() => (aba === 'TODAS' ? dados : dados.filter((c) => c.status === aba)), [dados, aba]);
  const contar = (e) => dados.filter((c) => c.status === e).length;

  const colunas = [
    { key: 'createdAt', header: 'Data', render: (c) => formatarData(c.createdAt) },
    { key: 'parte', header: fornecedor ? 'Comprador' : 'Fornecedor', render: (c) => (fornecedor ? c.buyerCompany?.name : c.supplierCompany?.name) || '—' },
    { key: 'items', header: 'Itens', render: (c) => (
      <ul className="kx-lista-simples">{c.items.map((i) => <li key={i.id}>{i.quantity} × {i.product?.name || 'item'}</li>)}</ul>
    ) },
    { key: 'status', header: 'Estado', render: (c) => <Badge tone={ESTADOS[c.status].tom} dot>{ESTADOS[c.status].rotulo}</Badge> },
    { key: 'resposta', header: 'Resposta', render: (c) => (c.status === 'ABERTA' ? <span className="kx-vazio-texto">Sem resposta ainda</span> : (
      <span>
        {formatarPreco(c.responsePrice, c.items[0]?.product?.currency || 'AOA') || '—'}
        {c.responseLeadDays !== null && c.responseLeadDays !== undefined ? <> · {c.responseLeadDays} {c.responseLeadDays === 1 ? 'dia' : 'dias'}</> : null}
        {c.responseNote ? <><br /><small>{c.responseNote}</small></> : null}
      </span>
    )) },
    { key: 'acoes', header: 'Ações', render: (c) => (
      <span className="kx-acoes">
        {fornecedor && c.status === 'ABERTA' ? <Button size="sm" variant="primary" onClick={() => setAResponder(c)}>Responder</Button> : null}
        {comprador && c.status !== 'FECHADA' ? <Button size="sm" onClick={() => setAEncerrar(c)}>Encerrar</Button> : null}
      </span>
    ) },
  ];

  return (
    <div className="kx-container kx-pagina">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Cotações' }]} />
      <header className="kx-pagina__cabeca">
        <h1>Pedidos de cotação</h1>
        <p className="kx-pagina__sub">{fornecedor ? 'Pedidos recebidos de compradores. Responda com preço e prazo.' : 'Os pedidos da sua empresa e as respostas dos fornecedores.'}</p>
      </header>

      {lista.status === 'carregando' && !lista.data ? <Table caption="A carregar" columns={colunas} rows={[]} loading />
        : lista.status === 'erro' && !lista.data ? <ErrorState description={mensagemDeErro(lista.error)} detalhe={lista.error?.code} onRetry={lista.recarregar} />
          : (
            <Tabs
              label="Estado dos pedidos"
              value={aba}
              onChange={setAba}
              items={[['TODAS', 'Todos', dados.length], ['ABERTA', 'Abertos', contar('ABERTA')], ['RESPONDIDA', 'Respondidos', contar('RESPONDIDA')], ['FECHADA', 'Fechados', contar('FECHADA')]].map(([id, rotulo, n]) => ({
                id,
                label: `${rotulo} (${n})`,
                content: (
                  <Table
                    caption={`Pedidos de cotação: ${rotulo}`}
                    columns={colunas}
                    rows={visiveis}
                    empty={<EmptyState icon="file" title={dados.length ? 'Nenhum pedido neste estado' : 'Ainda não há pedidos de cotação'}
                      description={dados.length ? undefined : (comprador ? 'Abra um produto ou serviço do catálogo e use “Pedir cotação”.' : 'Quando um comprador pedir uma cotação, aparece aqui.')}
                      action={!dados.length && comprador ? <Button as={Link} to="/produtos" variant="primary">Ir ao catálogo</Button> : null} />}
                  />
                ),
              }))}
            />
          )}

      {aResponder ? <ModalResponder cotacao={aResponder} onFechar={() => setAResponder(null)} onFeito={() => { setAResponder(null); lista.recarregar(); }} /> : null}
      <ConfirmDialog
        open={Boolean(aEncerrar)}
        onClose={() => setAEncerrar(null)}
        onConfirm={async () => { await encerrarCotacao(aEncerrar.id); toast.success('Pedido encerrado.'); lista.recarregar(); }}
        title="Encerrar pedido de cotação?"
        confirmLabel="Encerrar pedido"
      >
        O fornecedor deixa de poder responder a este pedido. Esta ação não pode ser anulada.
      </ConfirmDialog>
    </div>
  );
}
