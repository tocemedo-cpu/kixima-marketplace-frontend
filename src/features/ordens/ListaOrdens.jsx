import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { ESTADOS_ORDEM, listarOrdens } from '../../api/endpoints/ordens';
import { useAuth } from '../../auth/AuthContext';
import { formatarData } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Dinheiro, Cabecalho, EstadoDaOrdem, Indicadores } from '../comum/painel';
import { ESTADO_ORDEM } from '../comum/estados';
import { EmptyState, ErrorState, Field, Input, Pagination, Select, Table } from '../../ui';

const POR_PAGINA = 15;

const TEXTOS = {
  COMPRADOR: ['Ordens de compra', 'As ordens emitidas pela sua empresa, do pedido à receção.'],
  COMPANY_ADMIN: ['Ordens da empresa', 'Todas as ordens da sua empresa. As que aguardam decisão estão em Aprovações.'],
  FORNECEDOR: ['Ordens recebidas', 'Ordens de compra dirigidas à sua empresa: aceite, despache e acompanhe cada uma.'],
  FINANCEIRO: ['Ordens e faturas', 'As ordens da sua empresa, com o estado de pagamento.'],
  ADMIN_SISTEMA: ['Ordens da plataforma', 'Todas as ordens, de todas as empresas.'],
};

/** Lista de ordens para qualquer papel (GET /api/purchase-orders já devolve só as da empresa da sessão). */
export default function ListaOrdens() {
  const { user } = useAuth();
  const dados = useAsync((signal) => listarOrdens({ signal }), []);
  const [estado, setEstado] = useState('');
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const [titulo, sub] = TEXTOS[user.role] || TEXTOS.COMPRADOR;

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return (dados.data || []).filter((o) => (!estado || o.status === estado) && (!q || o.reference.toLowerCase().includes(q)));
  }, [dados.data, estado, texto]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visiveis = filtradas.slice((Math.min(pagina, paginas) - 1) * POR_PAGINA, Math.min(pagina, paginas) * POR_PAGINA);

  const contar = (...estados) => (dados.data || []).filter((o) => estados.includes(o.status)).length;
  const colunas = [
    { key: 'reference', header: 'Referência', mono: true, render: (o) => <Link to={`/ordens/${o.id}`}>{o.reference}</Link> },
    { key: 'createdAt', header: 'Data', render: (o) => formatarData(o.createdAt) },
    { key: 'items', header: 'Linhas', align: 'right', render: (o) => o.items?.length ?? '—' },
    { key: 'totalAmount', header: 'Total', align: 'right', render: (o) => <Dinheiro valor={o.totalAmount} moeda={o.currency} /> },
    { key: 'status', header: 'Estado', render: (o) => <EstadoDaOrdem estado={o.status} /> },
  ];

  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={[{ label: 'Ordens' }]} titulo={titulo} sub={sub} />
      {dados.data ? (
        <Indicadores itens={[
          { rotulo: 'Total de ordens', valor: dados.data.length },
          { rotulo: 'A aguardar aprovação', valor: contar('AGUARDANDO_APROVACAO'), tom: contar('AGUARDANDO_APROVACAO') ? 'warning' : undefined },
          { rotulo: 'Em curso', valor: contar('APROVADA', 'AGUARDANDO_PAGAMENTO', 'PAGA', 'EM_EXECUCAO', 'ENTREGUE') },
          { rotulo: 'Concluídas', valor: contar('RECEBIDA_CONFORME', 'CONCLUIDA'), tom: 'success' },
        ]} />
      ) : null}

      <div className="kx-filtros-linha">
        <Field label="Procurar por referência">
          <Input type="search" value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(1); }} placeholder="PO-2026-…" />
        </Field>
        <Field label="Estado">
          <Select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
            <option value="">Todos os estados</option>
            {ESTADOS_ORDEM.map((e) => <option key={e} value={e}>{ESTADO_ORDEM[e].rotulo}</option>)}
          </Select>
        </Field>
      </div>

      {dados.status === 'erro' && !dados.data ? <ErrorState description={mensagemDeErro(dados.error)} detalhe={dados.error?.code} onRetry={dados.recarregar} /> : (
        <>
          <Table caption="Ordens de compra" columns={colunas} rows={visiveis} loading={dados.status === 'carregando' && !dados.data}
            empty={<EmptyState icon="file" title={dados.data?.length ? 'Nenhuma ordem com estes filtros' : 'Ainda não há ordens'}
              description={dados.data?.length ? 'Altere o estado ou a referência.' : (user.role === 'COMPRADOR' ? 'Crie uma requisição a partir do catálogo.' : 'Quando houver ordens da sua empresa, aparecem aqui.')} />} />
          <Pagination page={Math.min(pagina, paginas)} pages={paginas} onChange={setPagina} label="Páginas de ordens" />
        </>
      )}
    </div>
  );
}
