import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { faturasFinanceiro, faturasPendentes, historicoDePagamentos, pagamentosFinanceiro, pagarFatura, resumoFinanceiro } from '../../api/endpoints/painel';
import { formatarData, formatarPreco } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, EmptyState, Field, Input, Modal, Table, useToast } from '../../ui';
import { Bloco, Cabecalho, Carregado, Dinheiro, Indicadores, LigacaoOrdem } from '../comum/painel';
import { ESTADO_FATURA, descrever } from '../comum/estados';

const migalhas = (atual) => [{ label: 'Financeiro', to: '/financeiro' }, ...(atual ? [{ label: atual }] : [])];
const TIPOS_COMPROVATIVO = ['application/pdf', 'image/png', 'image/jpeg'];
const LIMITE_MB = 10;

const EstadoFatura = ({ estado }) => { const e = descrever(ESTADO_FATURA, estado); return <Badge tone={e.tom} dot>{e.rotulo}</Badge>; };

export function PainelFinanceiro() {
  const dados = useAsync((s) => resumoFinanceiro({ signal: s }), []);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho titulo="Painel financeiro" sub="Faturas por pagar, pagamentos feitos e prazos a vencer." acoes={<Button as={Link} to="/financeiro/faturas" variant="primary">Pagar faturas</Button>} />
      <Carregado de={dados} render={(d) => (
        <>
          <Indicadores itens={[
            { rotulo: 'Por pagar', valor: formatarPreco(d.kpis.pagamentosPendentes, 'AOA') || '—', nota: `${d.kpis.pagamentosPendentesCount} fatura(s)`, tom: d.kpis.pagamentosPendentesCount ? 'warning' : undefined },
            { rotulo: 'A vencer em 7 dias', valor: d.kpis.aVencer7, tom: d.kpis.aVencer7 ? 'warning' : undefined },
            { rotulo: 'Pago no mês', valor: formatarPreco(d.kpis.pagosMes, 'AOA') || '—', tom: 'success' },
            { rotulo: 'Faturas recebidas', valor: d.kpis.faturasRecebidas },
          ]} />
          <div className="kx-grade-2">
            <Bloco titulo="Faturas e pagamentos por mês" id="fin-serie">
              <Table caption="Série mensal" rows={d.series} getRowKey={(s) => s.label} columns={[
                { key: 'label', header: 'Mês', render: (s) => s.label },
                { key: 'faturas', header: 'Faturas', align: 'right', render: (s) => formatarPreco(s.faturas, 'AOA') },
                { key: 'pagamentos', header: 'Pagamentos', align: 'right', render: (s) => formatarPreco(s.pagamentos, 'AOA') },
              ]} />
            </Bloco>
            <Bloco titulo="Por pagar" id="fin-pend" acao={<Link to="/financeiro/faturas">Ver todas</Link>}>
              <Table caption="Faturas por pagar" rows={d.pendentes} empty={<EmptyState icon="check" title="Nada por pagar" />} columns={[
                { key: 'reference', header: 'Fatura', mono: true, render: (f) => f.reference },
                { key: 'supplier', header: 'Fornecedora', render: (f) => f.supplier || '—' },
                { key: 'dueAt', header: 'Vence', render: (f) => formatarData(f.dueAt) },
                { key: 'amount', header: 'Valor', align: 'right', render: (f) => <Dinheiro valor={f.amount} moeda={f.currency} /> },
              ]} />
            </Bloco>
          </div>
        </>
      )} />
    </div>
  );
}

function ModalPagar({ fatura, onFechar, onFeito }) {
  const toast = useToast();
  const ref = useRef(null);
  const [ficheiro, setFicheiro] = useState(null);
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  function escolher(e) {
    const f = e.target.files?.[0] || null;
    setFicheiro(null);
    if (!f) return;
    if (!TIPOS_COMPROVATIVO.includes(f.type)) { setErro('O comprovativo tem de ser um PDF ou uma imagem (PNG ou JPG).'); return; }
    if (f.size > LIMITE_MB * 1024 * 1024) { setErro(`O comprovativo não pode passar de ${LIMITE_MB} MB.`); return; }
    setErro(''); setFicheiro(f);
  }

  async function pagar(e) {
    e.preventDefault();
    if (!ficheiro) { setErro('Anexe o comprovativo do pagamento: é obrigatório.'); return; }
    setAEnviar(true); setErro('');
    try { await pagarFatura(fatura.id, ficheiro); toast.success(`Fatura ${fatura.reference} paga.`); onFeito(); }
    catch (err) { setErro(mensagemDeErro(err)); } finally { setAEnviar(false); }
  }

  return (
    <Modal open onClose={aEnviar ? () => {} : onFechar} title={`Pagar ${fatura.reference}`} closeOnScrim={false}
      footer={<><Button variant="ghost" onClick={onFechar} disabled={aEnviar}>Cancelar</Button><Button variant="primary" type="submit" form="form-pagar" loading={aEnviar}>Registar pagamento</Button></>}>
      <form id="form-pagar" onSubmit={pagar} noValidate className="kx-form">
        <p>Valor a pagar: <strong><Dinheiro valor={fatura.amount} moeda={fatura.currency} /></strong>. Faça a transferência e anexe aqui o comprovativo.</p>
        <Field label="Comprovativo (PDF, PNG ou JPG, até 10 MB)" required hint={ficheiro ? `${ficheiro.name}` : undefined}>
          <Input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={escolher} />
        </Field>
        {erro ? <Alert tone="danger">{erro}</Alert> : null}
      </form>
    </Modal>
  );
}

export function FaturasPorPagar() {
  const dados = useAsync((s) => faturasPendentes({ signal: s }), []);
  const resumo = useAsync((s) => faturasFinanceiro(undefined, { signal: s }), []);
  const [aPagar, setAPagar] = useState(null);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Faturas')} titulo="Faturas por pagar" sub="Pague cada fatura com o respetivo comprovativo. O servidor regista quem pagou e quando." />
      {resumo.data ? <Indicadores itens={[
        { rotulo: 'Pendentes', valor: resumo.data.kpis.pendentes ?? 0, tom: resumo.data.kpis.pendentes ? 'warning' : undefined },
        { rotulo: 'Valor pendente', valor: formatarPreco(resumo.data.kpis.valorPendente, 'AOA') || '—' },
        { rotulo: 'A vencer em 7 dias', valor: resumo.data.kpis.aVencer7 ?? 0 }, { rotulo: 'Vencidas', valor: resumo.data.kpis.vencidas ?? 0, tom: resumo.data.kpis.vencidas ? 'danger' : undefined },
      ]} /> : null}
      <Carregado de={dados} render={(lista) => (
        <Table caption="Faturas por pagar" rows={lista} empty={<EmptyState icon="check" title="Nenhuma fatura por pagar" description="Quando uma fornecedora aceitar uma ordem, a fatura aparece aqui." />} columns={[
          { key: 'reference', header: 'Fatura', mono: true, render: (f) => f.reference },
          { key: 'po', header: 'Ordem', render: (f) => (f.purchaseOrder ? <LigacaoOrdem id={f.purchaseOrder.id} referencia={f.purchaseOrder.reference} /> : '—') },
          { key: 'issuedAt', header: 'Emitida', render: (f) => formatarData(f.issuedAt) },
          { key: 'dueAt', header: 'Vence', render: (f) => formatarData(f.dueAt) },
          { key: 'amount', header: 'Valor', align: 'right', render: (f) => <Dinheiro valor={f.amount} moeda={f.currency} /> },
          { key: 'status', header: 'Estado', render: (f) => <EstadoFatura estado={f.status} /> },
          { key: 'acao', header: 'Ação', render: (f) => <Button size="sm" variant="primary" onClick={() => setAPagar(f)}>Pagar</Button> },
        ]} />
      )} />
      {aPagar ? <ModalPagar fatura={aPagar} onFechar={() => setAPagar(null)} onFeito={() => { setAPagar(null); dados.recarregar(); resumo.recarregar(); }} /> : null}
    </div>
  );
}

export function HistoricoDePagamentos() {
  const historico = useAsync((s) => historicoDePagamentos({ signal: s }), []);
  const resumo = useAsync((s) => pagamentosFinanceiro(undefined, { signal: s }), []);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Pagamentos')} titulo="Histórico de pagamentos" sub="Todos os pagamentos feitos pela sua empresa, com o comprovativo e a confirmação da fornecedora." />
      {resumo.data ? <Indicadores itens={[
        { rotulo: 'A pagar', valor: formatarPreco(resumo.data.kpis.aPagar, 'AOA') || '—', tom: resumo.data.kpis.aPagar ? 'warning' : undefined },
        { rotulo: 'Pago no mês', valor: formatarPreco(resumo.data.kpis.pagosMes, 'AOA') || '—', tom: 'success' },
        { rotulo: 'Vencidos', valor: resumo.data.kpis.vencidos ?? 0, tom: resumo.data.kpis.vencidos ? 'danger' : undefined }, { rotulo: 'Total', valor: resumo.data.kpis.total ?? 0 },
      ]} /> : null}
      <Carregado de={historico} render={(lista) => (
        <Table caption="Pagamentos" rows={lista} empty={<EmptyState icon="file" title="Ainda sem pagamentos" />} columns={[
          { key: 'ref', header: 'Fatura', mono: true, render: (p) => p.invoice?.reference || '—' },
          { key: 'processedAt', header: 'Pago em', render: (p) => formatarData(p.processedAt) },
          { key: 'amount', header: 'Valor', align: 'right', render: (p) => <Dinheiro valor={p.amount} moeda={p.currency} /> },
          { key: 'canal', header: 'Canal', render: (p) => (p.canal || '—').replaceAll('_', ' ').toLowerCase() },
          { key: 'proof', header: 'Comprovativo', render: (p) => p.proofName || '—' },
          { key: 'recebido', header: 'Fornecedora', render: (p) => (p.receivedAt ? <Badge tone="success" dot>Recebido</Badge> : <Badge tone="warning" dot>Por confirmar</Badge>) },
        ]} />
      )} />
    </div>
  );
}
