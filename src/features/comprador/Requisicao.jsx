import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { criarOrdem } from '../../api/endpoints/ordens';
import { formatarPreco } from '../../lib/format';
import { Alert, Button, ConfirmDialog, EmptyState, Input, Table, useToast } from '../../ui';
import { Bloco, Cabecalho } from '../comum/painel';
import { useRequisicao } from './RequisicaoContext';

/**
 * Requisição: as linhas escolhidas no catálogo, agrupadas por fornecedora (uma ordem de compra tem uma só fornecedora).
 * Emitir cria a ordem em “A aguardar aprovação”; o Administrador da empresa decide. O servidor recalcula tudo.
 */
export default function Requisicao() {
  const { linhas, alterarQuantidade, remover, removerFornecedor } = useRequisicao();
  const navegar = useNavigate();
  const toast = useToast();
  const [aEmitir, setAEmitir] = useState(null);
  const [erro, setErro] = useState('');

  const grupos = [...linhas.reduce((m, l) => m.set(l.supplierId, [...(m.get(l.supplierId) || []), l]), new Map())];

  async function emitir(supplierId, itens) {
    const ordem = await criarOrdem({ supplierCompanyId: supplierId, items: itens.map((l) => ({ productId: l.productId, quantity: l.quantity })) });
    removerFornecedor(supplierId);
    toast.success(`Ordem ${ordem.reference} emitida. Segue para aprovação.`);
    navegar(`/ordens/${ordem.id}`);
  }

  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={[{ label: 'Compras', to: '/comprador' }, { label: 'Requisição' }]} titulo="Requisição" sub="Reveja as linhas e emita a ordem de compra. O Administrador da sua empresa aprova antes de seguir para a fornecedora." />
      {erro ? <Alert tone="danger" onClose={() => setErro('')}>{erro}</Alert> : null}
      {grupos.length === 0 ? (
        <EmptyState icon="box" title="A requisição está vazia" description="Abra um produto ou serviço com preço no catálogo e use “Adicionar à requisição”."
          action={<Button as={Link} to="/produtos" variant="primary">Ir ao catálogo</Button>} />
      ) : grupos.map(([supplierId, itens]) => {
        const moedas = new Set(itens.map((l) => l.currency));
        const total = moedas.size === 1 ? itens.reduce((s, l) => s + l.quantity * Number(l.unitPrice), 0) : null;
        return (
          <Bloco key={supplierId} id={`req-${supplierId}`} titulo={itens[0].supplierName || 'Fornecedora'}
            acao={<Button size="sm" variant="ghost" onClick={() => removerFornecedor(supplierId)}>Remover estas linhas</Button>}>
            <Table caption={`Linhas para ${itens[0].supplierName}`} rows={itens} getRowKey={(l) => l.productId} columns={[
              { key: 'name', header: 'Produto / serviço', render: (l) => <Link to={`/produto/${l.slug}`}>{l.name}</Link> },
              { key: 'unitPrice', header: 'Preço visto', align: 'right', render: (l) => formatarPreco(l.unitPrice, l.currency) },
              { key: 'quantity', header: 'Quantidade', render: (l) => (
                <Input className="kx-quant" type="number" min={1} step={1} inputMode="numeric" aria-label={`Quantidade de ${l.name}`} value={l.quantity}
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1) alterarQuantidade(l.productId, n); }} />
              ) },
              { key: 'x', header: 'Ações', render: (l) => <Button size="sm" variant="ghost" onClick={() => remover(l.productId)}>Remover</Button> },
            ]} />
            <p className="kx-nota-direitos">
              {total !== null ? <>Estimativa com os preços que viu: <strong>{formatarPreco(total, [...moedas][0])}</strong>. </> : null}
              O valor final, os impostos e as retenções são calculados pelo servidor ao emitir.
            </p>
            <div className="kx-acoes-ordem"><Button variant="primary" onClick={() => setAEmitir([supplierId, itens])}>Emitir ordem de compra</Button></div>
          </Bloco>
        );
      })}
      <ConfirmDialog open={Boolean(aEmitir)} onClose={() => setAEmitir(null)} confirmLabel="Emitir ordem" title="Emitir ordem de compra?"
        onConfirm={async () => { try { await emitir(...aEmitir); } catch (e) { throw new Error(mensagemDeErro(e)); } }}>
        Vai ser criada uma ordem com {aEmitir?.[1].length} linha(s) para {aEmitir?.[1][0].supplierName}. Fica a aguardar a aprovação do Administrador da empresa.
      </ConfirmDialog>
    </div>
  );
}
