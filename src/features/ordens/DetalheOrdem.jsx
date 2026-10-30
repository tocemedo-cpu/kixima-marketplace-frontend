import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import {
  aceitarOrdem, aprovarOrdem, despacharOrdem, historicoDaOrdem, marcarEntregue, obterOrdem, recusarOrdem,
  registarRecepcao, rejeitarOrdem, resolverDivergencia,
} from '../../api/endpoints/ordens';
import { confirmarRecebido } from '../../api/endpoints/painel';
import { useAuth } from '../../auth/AuthContext';
import { formatarData, formatarNumero } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, Field, Modal, Select, Table, Textarea, useToast } from '../../ui';
import { Bloco, Cabecalho, Carregado, Dinheiro, EstadoDaOrdem, Indicadores } from '../comum/painel';
import { ESTADO_FATURA, descrever } from '../comum/estados';
import { acoesDisponiveis } from './acoes';

const ROTULO_ACAO = {
  aprovar: 'Aprovar ordem', rejeitar: 'Rejeitar', aceitar: 'Aceitar ordem', recusar: 'Recusar', despachar: 'Registar despacho',
  entregue: 'Marcar como entregue', receber: 'Registar receção', resolver: 'Resolver divergência', confirmar: 'Confirmar receção do valor',
};

/** Modal de uma ação que precisa de texto (justificação, notas) ou escolha. Falhas do servidor ficam visíveis e o modal não fecha. */
export function DialogoDeAcao({ acao, ordem, onFechar, onFeito }) {
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [escolha, setEscolha] = useState(acao === 'receber' ? 'conforme' : 'ACEITE');
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const obrigaMotivo = acao === 'rejeitar' || acao === 'recusar' || (acao === 'receber' && escolha === 'divergencia');
  const rotuloMotivo = { rejeitar: 'Justificação da rejeição', recusar: 'Motivo da recusa', receber: 'Descreva a divergência', resolver: 'Notas (opcional)' }[acao] || 'Notas';

  async function enviar(e) {
    e.preventDefault();
    if (obrigaMotivo && !texto.trim()) { setErro('Indique o motivo: fica registado no histórico da ordem.'); return; }
    setAEnviar(true); setErro('');
    try {
      const t = texto.trim() || undefined;
      if (acao === 'rejeitar') await rejeitarOrdem(ordem.id, { reason: t });
      else if (acao === 'recusar') await recusarOrdem(ordem.id, { reason: t });
      else if (acao === 'receber') await registarRecepcao(ordem.id, { conforme: escolha === 'conforme', notes: t });
      else if (acao === 'resolver') await resolverDivergencia(ordem.id, { outcome: escolha, notes: t });
      toast.success('Operação registada.');
      onFeito();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally { setAEnviar(false); }
  }

  return (
    <Modal open onClose={aEnviar ? () => {} : onFechar} title={`${ROTULO_ACAO[acao]} · ${ordem.reference}`} closeOnScrim={false}
      footer={<><Button variant="ghost" onClick={onFechar} disabled={aEnviar}>Cancelar</Button><Button variant={acao === 'rejeitar' || acao === 'recusar' ? 'danger' : 'primary'} type="submit" form="form-acao-ordem" loading={aEnviar}>{ROTULO_ACAO[acao]}</Button></>}>
      <form id="form-acao-ordem" onSubmit={enviar} noValidate className="kx-form">
        {acao === 'receber' ? (
          <Field label="Resultado da receção">
            <Select value={escolha} onChange={(e) => setEscolha(e.target.value)}>
              <option value="conforme">Recebida conforme</option>
              <option value="divergencia">Recebida com divergência</option>
            </Select>
          </Field>
        ) : null}
        {acao === 'resolver' ? (
          <Field label="Desfecho">
            <Select value={escolha} onChange={(e) => setEscolha(e.target.value)}>
              <option value="ACEITE">Aceitar a entrega como está (conclui a ordem)</option>
              <option value="REPOSICAO">Pedir reposição (volta a execução)</option>
            </Select>
          </Field>
        ) : null}
        <Field label={rotuloMotivo} required={obrigaMotivo} error={erro && obrigaMotivo && !texto.trim() ? erro : undefined}>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} />
        </Field>
        {erro && !(obrigaMotivo && !texto.trim()) ? <Alert tone="danger">{erro}</Alert> : null}
      </form>
    </Modal>
  );
}

function CronologiaDaOrdem({ o }) {
  const passos = [
    ['Criada', o.createdAt], ['Aprovada', o.approvedAt], ['Aceite pela fornecedora', o.acceptedAt], ['Paga', o.paidAt],
    ['Despachada', o.dispatchedAt], ['Entregue', o.deliveredAt], ['Recebida', o.receivedAt],
  ];
  const extra = [['Rejeitada', o.rejectedAt, o.rejectionReason], ['Recusada pela fornecedora', o.refusedAt, o.refusalReason]].filter(([, d]) => d);
  return (
    <ol className="kx-linha-tempo" aria-label="Cronologia da ordem">
      {passos.map(([rotulo, d]) => (
        <li key={rotulo} data-feito={Boolean(d)}>
          <span>{rotulo}<small>{d ? formatarData(d, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Ainda não'}</small></span>
        </li>
      ))}
      {extra.map(([rotulo, d, motivo]) => (
        <li key={rotulo} data-feito="true"><span>{rotulo}<small>{formatarData(d)}{motivo ? ` — ${motivo}` : ''}</small></span></li>
      ))}
    </ol>
  );
}

export default function DetalheOrdem() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const ordem = useAsync((signal) => obterOrdem(id, { signal }), [id]);
  const historico = useAsync((signal) => historicoDaOrdem(id, { signal }).catch(() => []), [id]);
  const [dialogo, setDialogo] = useState(null);
  const [aFazer, setAFazer] = useState('');
  const [erro, setErro] = useState('');

  const recarregar = () => { ordem.recarregar(); historico.recarregar(); };

  async function direta(acao, fn) {
    setAFazer(acao); setErro('');
    try { await fn(); toast.success('Operação registada.'); recarregar(); } catch (e) { setErro(mensagemDeErro(e)); } finally { setAFazer(''); }
  }

  return (
    <div className="kx-container kx-pagina">
      <Carregado de={ordem} render={(o) => {
        const acoes = acoesDisponiveis(user, o);
        const fatura = o.invoice;
        const pagamento = fatura?.payment;
        const estFatura = fatura ? descrever(ESTADO_FATURA, fatura.status) : null;
        const executar = (a) => {
          if (a === 'aprovar') return direta(a, () => aprovarOrdem(o.id));
          if (a === 'aceitar') return direta(a, () => aceitarOrdem(o.id));
          if (a === 'despachar') return direta(a, () => despacharOrdem(o.id));
          if (a === 'entregue') return direta(a, () => marcarEntregue(o.id));
          if (a === 'confirmar') return direta(a, () => confirmarRecebido(pagamento.id));
          return setDialogo(a);
        };
        return (
          <>
            <Cabecalho
              migalhas={[{ label: 'Ordens', to: '/ordens' }, { label: o.reference }]}
              titulo={o.reference}
              sub={<EstadoDaOrdem estado={o.status} />}
              acoes={acoes.filter((a) => a !== 'pagar').map((a) => (
                <Button key={a} variant={a === 'rejeitar' || a === 'recusar' ? 'danger' : (['aprovar', 'aceitar', 'receber'].includes(a) ? 'primary' : 'secondary')}
                  onClick={() => executar(a)} loading={aFazer === a} disabled={Boolean(aFazer)}>{ROTULO_ACAO[a]}</Button>
              ))}
            />
            {erro ? <Alert tone="danger" onClose={() => setErro('')}>{erro}</Alert> : null}
            {acoes.includes('pagar') ? (
              <Alert tone="info" title="Fatura por pagar">
                O pagamento exige comprovativo. <Link to="/financeiro/faturas">Ir às faturas pendentes</Link>.
              </Alert>
            ) : null}
            {o.status === 'RECEBIDA_COM_DIVERGENCIA' && o.divergenceResolution ? (
              <Alert tone="success" title="Divergência resolvida">{o.divergenceResolution === 'ACEITE' ? 'Entrega aceite.' : 'Reposição pedida.'} {o.divergenceResolutionNotes || ''}</Alert>
            ) : null}

            <Indicadores itens={[
              { rotulo: 'Total', valor: <Dinheiro valor={o.totalAmount} moeda={o.currency} /> },
              { rotulo: 'Linhas', valor: o.items?.length ?? 0 },
              { rotulo: 'Origem', valor: o.isCallOff ? 'Contrato-quadro' : 'Requisição' },
              { rotulo: 'Criada em', valor: formatarData(o.createdAt) },
            ]} />

            <div className="kx-grade-2">
              <Bloco titulo="Partes" id="b-partes">
                <dl className="kx-def">
                  <div><dt>Compradora</dt><dd>{o.buyerCompany?.name || '—'}{o.buyerCompany?.taxId ? <><br /><small className="kx-mono">NIF {o.buyerCompany.taxId}</small></> : null}</dd></div>
                  <div><dt>Fornecedora</dt><dd>{o.supplierCompany?.name || '—'}{o.supplierCompany?.taxId ? <><br /><small className="kx-mono">NIF {o.supplierCompany.taxId}</small></> : null}</dd></div>
                  <div><dt>Emitida por</dt><dd>{o.createdBy?.name || '—'}</dd></div>
                  <div><dt>Aprovada por</dt><dd>{o.approvedBy?.name || '—'}</dd></div>
                </dl>
              </Bloco>
              <Bloco titulo="Cronologia" id="b-cron"><CronologiaDaOrdem o={o} /></Bloco>
            </div>

            <Bloco titulo="Linhas da ordem" id="b-linhas">
              <Table caption="Linhas da ordem" rows={o.items || []} columns={[
                { key: 'nome', header: 'Produto / serviço', render: (l) => l.product?.name || l.productId },
                { key: 'quantity', header: 'Quantidade', align: 'right', render: (l) => formatarNumero(l.quantity) },
                { key: 'unitPrice', header: 'Preço unitário', align: 'right', render: (l) => <Dinheiro valor={l.unitPrice} moeda={o.currency} /> },
                { key: 'lineTotal', header: 'Total da linha', align: 'right', render: (l) => <Dinheiro valor={l.lineTotal} moeda={o.currency} /> },
              ]} />
              <p className="kx-nota-direitos">Os preços e impostos são calculados pelo servidor no momento da emissão.</p>
            </Bloco>

            <div className="kx-grade-2">
              <Bloco titulo="Fatura e pagamento" id="b-fatura">
                {fatura ? (
                  <dl className="kx-def">
                    <div><dt>Fatura</dt><dd className="kx-mono">{fatura.reference}</dd></div>
                    <div><dt>Estado</dt><dd><Badge tone={estFatura.tom} dot>{estFatura.rotulo}</Badge></dd></div>
                    <div><dt>Valor líquido</dt><dd><Dinheiro valor={fatura.netAmount} moeda={fatura.currency} /></dd></div>
                    <div><dt>Imposto</dt><dd><Dinheiro valor={fatura.taxAmount} moeda={fatura.currency} /></dd></div>
                    <div><dt>Retenção</dt><dd><Dinheiro valor={fatura.withholdingAmount} moeda={fatura.currency} /></dd></div>
                    <div><dt>Total da fatura</dt><dd><strong><Dinheiro valor={fatura.amount} moeda={fatura.currency} /></strong></dd></div>
                    <div><dt>Emitida</dt><dd>{formatarData(fatura.issuedAt)}</dd></div>
                    <div><dt>Vence</dt><dd>{formatarData(fatura.dueAt)}</dd></div>
                    {pagamento ? <div><dt>Pagamento</dt><dd>{pagamento.status === 'PROCESSADO' ? 'Processado' : pagamento.status}{pagamento.proofName ? ` · comprovativo ${pagamento.proofName}` : ''}</dd></div> : null}
                    {pagamento ? <div><dt>Valor recebido pela fornecedora</dt><dd>{pagamento.receivedAt ? `Confirmado em ${formatarData(pagamento.receivedAt)}` : 'Por confirmar'}</dd></div> : null}
                  </dl>
                ) : <p className="kx-vazio-texto">A fatura é emitida quando a fornecedora aceita a ordem.</p>}
              </Bloco>
              <Bloco titulo="Histórico" id="b-hist">
                <Carregado de={historico} linhas={2} render={(h) => (h.length ? (
                  <ol className="kx-linha-tempo">
                    {h.map((e) => <li key={e.id} data-feito="true"><span>{e.action.replaceAll('_', ' ').toLowerCase()}<small>{e.actorName || '—'} · {formatarData(e.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span></li>)}
                  </ol>
                ) : <p className="kx-vazio-texto">Sem eventos registados para esta ordem.</p>)} />
              </Bloco>
            </div>

            {dialogo ? <DialogoDeAcao acao={dialogo} ordem={o} onFechar={() => setDialogo(null)} onFeito={() => { setDialogo(null); recarregar(); }} /> : null}
          </>
        );
      }} />
    </div>
  );
}
