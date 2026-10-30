// Catálogo do sistema de design (Fase 3). Mostra cada componente nos seus estados, nos três fundos.
// Os valores de demonstração (linhas de tabela, nomes) são GENÉRICOS e existem só para exemplificar o
// componente: não são dados do KIXIMA.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert, Badge, Breadcrumb, Button, Card, CardBody, CardFooter, CardHeader, Checkbox, ConfirmDialog, EmptyState, ErrorState,
  Field, Fio, Icon, Input, Logo, Modal, NOMES_DE_ICONES, Pagination, Select, Skeleton, Spinner, Switch, Table, Tabs, Textarea, useToast,
} from '../ui';
import './catalogo.css';

const CORES = [
  ['--kx-bg', 'Fundo da página'], ['--kx-bg-2', 'Faixas de apoio'], ['--kx-surface', 'Superfície'], ['--kx-surface-2', 'Superfície 2'],
  ['--kx-line', 'Linha'], ['--kx-ink', 'Títulos'], ['--kx-text', 'Texto'], ['--kx-text-muted', 'Texto secundário'],
  ['--kx-primary', 'Acção principal'], ['--kx-brand', 'Vermelho de marca'], ['--kx-accent', 'Ocre (decoração)'], ['--kx-success', 'Sucesso'],
  ['--kx-warning', 'Aviso'], ['--kx-danger', 'Erro'], ['--kx-shell', 'Barra escura'], ['--kx-focus', 'Anel de foco'],
];

const COLUNAS = [
  { key: 'nome', header: 'Descrição', sortable: true },
  { key: 'ref', header: 'Referência', mono: true, sortable: true },
  { key: 'estado', header: 'Estado', render: (l) => <Badge tone={l.tom} dot>{l.estado}</Badge> },
  { key: 'qtd', header: 'Quantidade', align: 'right', mono: true },
];
const LINHAS = [
  { id: 1, nome: 'Linha de exemplo A', ref: 'EX-0001', estado: 'Concluído', tom: 'success', qtd: 12 },
  { id: 2, nome: 'Linha de exemplo B', ref: 'EX-0002', estado: 'Em curso', tom: 'warning', qtd: 4 },
  { id: 3, nome: 'Linha de exemplo C', ref: 'EX-0003', estado: 'Recusado', tom: 'danger', qtd: 30 },
];

function Secao({ id, titulo, children, descricao }) {
  return (
    <section id={id} className="cat-secao" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`}>{titulo}</h2>
      {descricao ? <p className="cat-secao__desc">{descricao}</p> : null}
      {children}
    </section>
  );
}

export default function CatalogoDeComponentes() {
  const toast = useToast();
  const { hash } = useLocation();
  const [aba, setAba] = useState('visao');
  const [pagina, setPagina] = useState(3);
  const [ordem, setOrdem] = useState({ key: 'ref', dir: 'asc' });
  const [modal, setModal] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [texto, setTexto] = useState('');

  // Navegação por âncoras dentro da página (o react-router não rola até ao hash sozinho).
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  const linhas = [...LINHAS].sort((a, b) => {
    const r = String(a[ordem.key]).localeCompare(String(b[ordem.key]), 'pt', { numeric: true });
    return ordem.dir === 'asc' ? r : -r;
  });
  const aoOrdenar = (key) => setOrdem((o) => (o.key === key ? { key, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const simularCarga = () => { setCarregando(true); setTimeout(() => setCarregando(false), 1500); };

  return (
    <div className="kx-container cat">
      <Breadcrumb items={[{ label: 'KIXIMA', href: '/' }, { label: 'Sistema de design' }]} />
      <header className="cat-hero">
        <h1>Sistema de design KIXIMA Marketplace</h1>
        <p>
          Tokens, três fundos, o fio Samakaka e os componentes da Fase 3. Troque o fundo no seletor da barra superior: a
          estrutura não muda, só os valores das variáveis.
        </p>
      </header>

      <Secao id="marca" titulo="Marca" descricao="Sempre os activos oficiais. A versão invertida vai sobre fundos escuros; o fio Samakaka tem sempre 4 px.">
        <div className="cat-grid cat-grid--2">
          <Card><CardBody className="cat-marca"><Logo size={44} /></CardBody></Card>
          <div className="cat-marca cat-marca--escuro"><Logo reversed size={44} /></div>
        </div>
        <div className="cat-fio-demo"><Fio /></div>
      </Secao>

      <Secao id="cores" titulo="Cores e fundos" descricao="Os componentes só usam estes tokens semânticos. O ocre é decorativo: nunca se usa como texto sobre fundo claro.">
        <ul className="cat-cores">
          {CORES.map(([v, nome]) => (
            <li key={v}>
              <span className="cat-cor" style={{ background: `var(${v})` }} aria-hidden="true" />
              <span className="cat-cor__nome">{nome}</span>
              <code>{v}</code>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao id="tipografia" titulo="Tipografia" descricao="Sora nos títulos, Inter no texto corrente, IBM Plex Mono em referências e cabeçalhos de tabela.">
        <Card><CardBody>
          <h1>Título 1 — Procurement industrial</h1>
          <h2>Título 2 — Fornecedores verificados</h2>
          <h3>Título 3 — Pedido de cotação</h3>
          <p>Texto corrente em Inter, com espaçamento confortável e linhas de leitura até 70 caracteres para cansar menos a vista.</p>
          <p className="kx-mono">REFERÊNCIA-0000 · IBM Plex Mono</p>
        </CardBody></Card>
      </Secao>

      <Secao id="botoes" titulo="Botões">
        <Card><CardBody className="cat-linha">
          <Button variant="primary">Acção principal</Button>
          <Button>Secundário</Button>
          <Button variant="ghost">Discreto</Button>
          <Button variant="danger" leftIcon="trash">Eliminar</Button>
          <Button variant="primary" rightIcon="arrow-right">Continuar</Button>
          <Button variant="primary" loading>A guardar</Button>
          <Button disabled>Indisponível</Button>
          <Button size="sm">Pequeno</Button>
          <Button size="lg" variant="primary">Grande</Button>
        </CardBody></Card>
      </Secao>

      <Secao id="formularios" titulo="Formulários" descricao="Cada campo liga rótulo, ajuda e erro ao controlo (aria-describedby / aria-invalid).">
        <Card><CardBody>
          <form className="cat-grid cat-grid--2" onSubmit={(e) => e.preventDefault()}>
            <Field label="Nome da empresa" hint="Como aparece nos documentos" required><Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva aqui" /></Field>
            <Field label="Categoria"><Select defaultValue=""><option value="" disabled>Escolha uma categoria</option><option>Categoria A</option><option>Categoria B</option></Select></Field>
            <Field label="NIF" error="Indique um NIF válido." required><Input defaultValue="123" /></Field>
            <Field label="Campo desactivado"><Input disabled defaultValue="Só leitura" /></Field>
            <Field label="Observações" className="cat-span"><Textarea placeholder="Notas para o fornecedor" /></Field>
            <Checkbox label="Aceito os termos de utilização" defaultChecked />
            <Switch label="Receber notificações por e-mail" defaultChecked />
          </form>
        </CardBody></Card>
      </Secao>

      <Secao id="cartoes" titulo="Cartões, selos e alertas">
        <div className="cat-grid cat-grid--3">
          <Card raised interactive>
            <CardHeader title="Cartão com cabeçalho" subtitle="Subtítulo de apoio" actions={<Badge tone="success" dot>Verificado</Badge>} />
            <CardBody>Conteúdo do cartão. Use <code>interactive</code> quando o cartão inteiro é uma ligação.</CardBody>
            <CardFooter><Button size="sm" variant="ghost">Ver mais</Button><Button size="sm" variant="primary">Pedir cotação</Button></CardFooter>
          </Card>
          <Card><CardBody className="cat-pilha">
            <Badge>Neutro</Badge><Badge tone="brand">Marca</Badge><Badge tone="success" dot>Sucesso</Badge>
            <Badge tone="warning" dot>Aviso</Badge><Badge tone="danger" dot>Erro</Badge>
          </CardBody></Card>
          <div className="cat-pilha">
            <Alert tone="success" title="Guardado">As alterações foram guardadas.</Alert>
            <Alert tone="warning" title="Atenção">Faltam documentos por validar.</Alert>
            <Alert tone="danger" title="Erro" onClose={() => {}}>Não foi possível concluir o pedido.</Alert>
            <Alert tone="info">Mensagem informativa.</Alert>
          </div>
        </div>
      </Secao>

      <Secao id="tabela" titulo="Tabela" descricao="Ordenável, com estados de carga e vazio. Em ecrãs estreitos cada linha vira um cartão. Dados genéricos de demonstração.">
        <div className="cat-pilha">
          <div className="cat-linha"><Button size="sm" onClick={simularCarga}>Simular carregamento</Button></div>
          <Table caption="Tabela de demonstração" columns={COLUNAS} rows={linhas} sort={ordem} onSort={aoOrdenar} loading={carregando} />
          <Table caption="Tabela vazia" columns={COLUNAS} rows={[]} empty={<EmptyState icon="search" title="Sem resultados" description="Altere os filtros ou a pesquisa." />} />
          <Pagination page={pagina} pages={12} onChange={setPagina} />
        </div>
      </Secao>

      <Secao id="abas" titulo="Abas">
        <Tabs
          label="Exemplo de abas"
          value={aba}
          onChange={setAba}
          items={[
            { id: 'visao', label: 'Visão geral', content: <p>Conteúdo da primeira aba. Use as setas do teclado para navegar.</p> },
            { id: 'docs', label: 'Documentos', content: <p>Conteúdo da segunda aba.</p> },
            { id: 'hist', label: 'Histórico', content: <p>Conteúdo da terceira aba.</p> },
          ]}
        />
      </Secao>

      <Secao id="sobreposicoes" titulo="Modal, confirmação e notificações" descricao="Foco preso no diálogo, Esc fecha, o foco volta ao botão que o abriu.">
        <div className="cat-linha">
          <Button onClick={() => setModal(true)}>Abrir modal</Button>
          <Button variant="danger" onClick={() => setConfirmar(true)}>Operação com confirmação</Button>
          <Button onClick={() => toast.success('Pedido enviado.')}>Toast de sucesso</Button>
          <Button onClick={() => toast.error('Não foi possível enviar o pedido.')}>Toast de erro</Button>
          <Button onClick={() => toast.info('Sessão a expirar em breve.')}>Toast informativo</Button>
        </div>
        <Modal open={modal} onClose={() => setModal(false)} title="Título do modal" footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button><Button variant="primary" onClick={() => setModal(false)}>Guardar</Button></>}>
          <Field label="Campo dentro do modal"><Input data-autofocus placeholder="O foco começa aqui" /></Field>
        </Modal>
        <ConfirmDialog
          open={confirmar}
          onClose={() => setConfirmar(false)}
          onConfirm={() => new Promise((ok) => setTimeout(ok, 900)).then(() => toast.success('Operação concluída.'))}
          title="Confirmar operação"
          confirmLabel="Sim, confirmar"
          tone="danger"
        >
          Esta acção não pode ser anulada. Quer continuar?
        </ConfirmDialog>
      </Secao>

      <Secao id="estados" titulo="Estados de uma vista" descricao="Toda a vista de dados trata: a carregar, vazio e erro.">
        <div className="cat-grid cat-grid--3">
          <Card><CardBody className="cat-pilha"><Skeleton lines={4} /><Skeleton height="120px" /><div className="cat-linha"><Spinner /><span>A carregar…</span></div></CardBody></Card>
          <Card><EmptyState title="Ainda não há nada aqui" description="Quando existirem registos, aparecem nesta lista." action={<Button variant="primary" leftIcon="plus">Criar o primeiro</Button>} /></Card>
          <Card><ErrorState description="O servidor não respondeu a tempo." detalhe="SERVICO_INDISPONIVEL" onRetry={() => toast.info('A tentar de novo…')} /></Card>
        </div>
      </Secao>

      <Secao id="icones" titulo="Ícones">
        <ul className="cat-icones">
          {NOMES_DE_ICONES.map((n) => <li key={n}><Icon name={n} size={22} /><code>{n}</code></li>)}
        </ul>
      </Secao>
    </div>
  );
}
