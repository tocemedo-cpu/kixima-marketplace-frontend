import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { pedirCotacao } from '../../api/endpoints/cotacoes';
import { Alert, Button, Field, Input, Modal, Textarea, useToast } from '../../ui';

/**
 * Pedido de cotação de UM produto/serviço (POST /api/quotes — só COMPRADOR). Mostra erros do servidor
 * campo a campo e nunca finge que enviou: só fecha e confirma depois da resposta 201.
 */
export default function PedirCotacao({ produto, aberto, onFechar }) {
  const toast = useToast();
  const [quantidade, setQuantidade] = useState('1');
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState('');
  const [campos, setCampos] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const qtd = Number(quantidade);
  const qtdInvalida = !Number.isInteger(qtd) || qtd < 1;
  const minimo = produto.minQuantity ? Number(produto.minQuantity) : null;
  const abaixoDoMinimo = minimo && !qtdInvalida && qtd < minimo;

  const fechar = () => { onFechar(); setErro(''); setCampos({}); setEnviado(false); };

  async function enviar(e) {
    e.preventDefault();
    setErro(''); setCampos({});
    if (qtdInvalida) { setCampos({ quantity: 'Indique uma quantidade inteira de 1 ou mais.' }); return; }
    setEnviando(true);
    try {
      await pedirCotacao({ supplierCompanyId: produto.supplierId, note: nota.trim() || undefined, items: [{ productId: produto.id, quantity: qtd }] });
      toast.success('Pedido de cotação enviado ao fornecedor.');
      setEnviado(true);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={fechar}
      title={enviado ? 'Pedido enviado' : 'Pedir cotação'}
      closeOnScrim={!nota && !enviando}
      footer={enviado ? (
        <>
          <Button variant="ghost" onClick={fechar}>Fechar</Button>
          <Button as={Link} to="/mercado/cotacoes" variant="primary" onClick={fechar}>Ver os meus pedidos</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={fechar} disabled={enviando}>Cancelar</Button>
          <Button variant="primary" type="submit" form="form-cotacao" loading={enviando}>Enviar pedido</Button>
        </>
      )}
    >
      {enviado ? (
        <Alert tone="success" title="O fornecedor foi notificado">
          Acompanhe a resposta (preço e prazo) em “Cotações”. Receberá a resposta na própria plataforma.
        </Alert>
      ) : (
        <form id="form-cotacao" onSubmit={enviar} noValidate className="kx-form">
          <p className="kx-form__resumo"><strong>{produto.name}</strong><br />Fornecedor: {produto.supplier?.name || '—'}</p>
          {erro ? <Alert tone="danger">{erro}</Alert> : null}
          <Field label="Quantidade" required hint={minimo ? `Quantidade mínima do fornecedor: ${minimo}` : undefined} error={campos.quantity}>
            <Input data-autofocus type="number" inputMode="numeric" min="1" step="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </Field>
          {abaixoDoMinimo ? <Alert tone="warning">Abaixo da quantidade mínima ({minimo}); o fornecedor pode recusar ou propor outra condição.</Alert> : null}
          <Field label="Nota para o fornecedor" hint="Opcional: prazo desejado, local de entrega, especificações.">
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} />
          </Field>
        </form>
      )}
    </Modal>
  );
}
