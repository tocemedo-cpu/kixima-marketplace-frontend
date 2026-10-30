import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { aprovarOrdem, listarOrdens } from '../../api/endpoints/ordens';
import {
  atividadesDaEmpresa, cancelarConvite, convidar, convitesDaEmpresa, definicoesDaEmpresa, definirEstadoDeUtilizador,
  guardarDefinicoes, ordensDoComprador, organizacao, painelDaEmpresa, relatoriosDaEmpresa, reenviarConvite, utilizadoresDaEmpresa,
} from '../../api/endpoints/painel';
import { useAuth } from '../../auth/AuthContext';
import { ROTULO_DE_PAPEL } from '../../auth/papeis';
import { formatarData, formatarPreco } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Field, Input, Modal, Select, Switch, Table, useToast } from '../../ui';
import { Bloco, Cabecalho, Carregado, Dinheiro, EstadoDaOrdem, Indicadores, LigacaoOrdem } from '../comum/painel';
import { ESTADO_EMPRESA, ROTULO_TIPO_EMPRESA, descrever } from '../comum/estados';
import { DialogoDeAcao } from '../ordens/DetalheOrdem';

const migalhas = (atual) => [{ label: 'Empresa', to: '/empresa' }, ...(atual ? [{ label: atual }] : [])];

export function PainelDaEmpresa() {
  const painel = useAsync((s) => painelDaEmpresa({ signal: s }), []);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho titulo="Painel da empresa" sub="Aprove ordens, gira a equipa e acompanhe a atividade da sua empresa."
        acoes={<><Button as={Link} to="/empresa/aprovacoes" variant="primary">Aprovações</Button><Button as={Link} to="/empresa/utilizadores" variant="secondary">Equipa</Button></>} />
      <Carregado de={painel} render={(d) => (
        <>
          <Indicadores itens={[
            { rotulo: 'Ordens a aprovar', valor: d.kpis.aprovarPO, tom: d.kpis.aprovarPO ? 'warning' : undefined },
            { rotulo: 'Pedidos', valor: d.kpis.pedidos }, { rotulo: 'Em execução', valor: d.kpis.emExecucao },
            { rotulo: 'Volume de negócios', valor: formatarPreco(d.kpis.volumeNegocios, 'AOA') || '—' },
          ]} />
          <div className="kx-grade-2">
            <Bloco titulo="Volume por mês" id="e-volume">
              {d.volume.length ? (() => {
                const max = Math.max(1, ...d.volume.map((v) => v.value));
                return <ul className="kx-barras">{d.volume.map((v) => <li key={v.label}><span>{v.label}</span><span className="kx-barras__trilho" aria-hidden="true"><span className="kx-barras__valor" style={{ width: `${(v.value / max) * 100}%` }} /></span><strong>{formatarPreco(v.value, 'AOA')}</strong></li>)}</ul>;
              })() : <p className="kx-vazio-texto">Sem movimento nos últimos meses.</p>}
            </Bloco>
            <Bloco titulo="Resumo" id="e-resumo">
              <dl className="kx-def">
                <div><dt>Utilizadores ativos</dt><dd>{d.resumo.usuariosAtivos ?? '—'}</dd></div>
                <div><dt>Contratos ativos</dt><dd>{d.resumo.contratosAtivos ?? '—'} / {d.resumo.totalContratos ?? '—'}</dd></div>
                <div><dt>Ordens concluídas</dt><dd>{d.resumo.concluidas ?? '—'}</dd></div>
              </dl>
            </Bloco>
          </div>
          <Bloco titulo="Ordens recentes" id="e-recentes" acao={<Link to="/ordens">Todas as ordens</Link>}>
            <Table caption="Ordens recentes" rows={d.recent} getRowKey={(r) => r.reference} empty={<EmptyState icon="file" title="Sem ordens recentes" />}
              columns={[
                { key: 'reference', header: 'Referência', mono: true, render: (r) => r.reference },
                { key: 'party', header: 'Parte', render: (r) => r.party || '—' },
                { key: 'status', header: 'Estado', render: (r) => <EstadoDaOrdem estado={r.status} /> },
                { key: 'at', header: 'Data', render: (r) => formatarData(r.at) },
              ]} />
          </Bloco>
        </>
      )} />
    </div>
  );
}

/** Ordens à espera de decisão do Administrador da empresa (aprovar sem justificação; rejeitar com justificação obrigatória). */
export function Aprovacoes() {
  const toast = useToast();
  const pendentes = useAsync((s) => ordensDoComprador({ status: 'AGUARDANDO_APROVACAO', limit: 50 }, { signal: s }), []);
  const historico = useAsync((s) => listarOrdens({ signal: s }), []);
  const [rejeitar, setRejeitar] = useState(null);
  const [aprovar, setAprovar] = useState(null);

  const decididas = useMemo(() => (historico.data || [])
    .filter((o) => o.approvedAt || o.rejectedAt)
    .sort((a, b) => new Date(b.rejectedAt || b.approvedAt) - new Date(a.rejectedAt || a.approvedAt)), [historico.data]);
  const recarregar = () => { pendentes.recarregar(); historico.recarregar(); };

  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Aprovações')} titulo="Aprovações" sub="Decida as ordens de compra emitidas pela sua empresa. Cada decisão fica no histórico da ordem." />
      <Bloco titulo="A aguardar a sua decisão" id="ap-pendentes">
        <Carregado de={pendentes} render={(d) => (
          <Table caption="Ordens a aprovar" rows={d.items} empty={<EmptyState icon="check" title="Nada por aprovar" description="Quando um comprador emitir uma ordem, ela aparece aqui." />}
            columns={[
              { key: 'reference', header: 'Ordem', mono: true, render: (o) => <LigacaoOrdem id={o.id} referencia={o.reference} /> },
              { key: 'supplier', header: 'Fornecedora', render: (o) => o.supplier?.name || '—' },
              { key: 'itemsCount', header: 'Linhas', align: 'right', render: (o) => o.itemsCount },
              { key: 'totalAmount', header: 'Total', align: 'right', render: (o) => <Dinheiro valor={o.totalAmount} moeda={o.currency} /> },
              { key: 'createdAt', header: 'Emitida', render: (o) => formatarData(o.createdAt) },
              { key: 'acoes', header: 'Decisão', render: (o) => (
                <span className="kx-acoes">
                  <Button size="sm" variant="primary" onClick={() => setAprovar(o)}>Aprovar</Button>
                  <Button size="sm" variant="danger" onClick={() => setRejeitar(o)}>Rejeitar</Button>
                </span>
              ) },
            ]} />
        )} />
      </Bloco>
      <Bloco titulo="Histórico de decisões" id="ap-historico">
        <Carregado de={historico} render={() => (
          <Table caption="Decisões anteriores" rows={decididas} empty={<EmptyState icon="list" title="Sem decisões registadas" />}
            columns={[
              { key: 'reference', header: 'Ordem', mono: true, render: (o) => <LigacaoOrdem id={o.id} referencia={o.reference} /> },
              { key: 'decisao', header: 'Decisão', render: (o) => (o.rejectedAt ? <Badge tone="danger" dot>Rejeitada</Badge> : <Badge tone="success" dot>Aprovada</Badge>) },
              { key: 'quando', header: 'Em', render: (o) => formatarData(o.rejectedAt || o.approvedAt) },
              { key: 'totalAmount', header: 'Total', align: 'right', render: (o) => <Dinheiro valor={o.totalAmount} moeda={o.currency} /> },
              { key: 'justificacao', header: 'Justificação', render: (o) => o.rejectionReason || <span className="kx-vazio-texto">—</span> },
              { key: 'status', header: 'Estado atual', render: (o) => <EstadoDaOrdem estado={o.status} /> },
            ]} />
        )} />
      </Bloco>

      <ConfirmDialog open={Boolean(aprovar)} onClose={() => setAprovar(null)} confirmLabel="Aprovar ordem" title={`Aprovar ${aprovar?.reference}?`}
        onConfirm={async () => { try { await aprovarOrdem(aprovar.id); toast.success('Ordem aprovada.'); recarregar(); } catch (e) { throw new Error(mensagemDeErro(e)); } }}>
        A ordem segue para a fornecedora, que a aceita ou recusa. Pode consultar a ficha antes de decidir.
      </ConfirmDialog>
      {rejeitar ? <DialogoDeAcao acao="rejeitar" ordem={rejeitar} onFechar={() => setRejeitar(null)} onFeito={() => { setRejeitar(null); recarregar(); }} /> : null}
    </div>
  );
}

const PAPEIS_CONVIDAVEIS = ['COMPRADOR', 'FORNECEDOR', 'FINANCEIRO'];

function ModalConvidar({ onFechar, onFeito }) {
  const { user } = useAuth();
  const toast = useToast();
  const [v, setV] = useState({ name: '', email: '', role: user.companyType === 'FORNECEDOR' ? 'FORNECEDOR' : 'COMPRADOR' });
  const [erro, setErro] = useState('');
  const [campos, setCampos] = useState({});
  const [aEnviar, setAEnviar] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    const c = {};
    if (v.name.trim().length < 2) c.name = 'Indique o nome da pessoa.';
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) c.email = 'Indique um email válido.';
    setCampos(c); setErro('');
    if (Object.keys(c).length) return;
    setAEnviar(true);
    try { await convidar({ role: v.role, name: v.name.trim(), email: v.email.trim() }); toast.success('Convite enviado por email. Vale 7 dias.'); onFeito(); }
    catch (err) { setErro(mensagemDeErro(err)); setCampos(err.fieldErrors ? Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, [].concat(m)[0]])) : {}); }
    finally { setAEnviar(false); }
  }
  return (
    <Modal open onClose={aEnviar ? () => {} : onFechar} title="Convidar utilizador" closeOnScrim={false}
      footer={<><Button variant="ghost" onClick={onFechar} disabled={aEnviar}>Cancelar</Button><Button variant="primary" type="submit" form="form-convite" loading={aEnviar}>Enviar convite</Button></>}>
      <form id="form-convite" onSubmit={enviar} noValidate className="kx-form">
        <Field label="Nome" required error={campos.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="off" /></Field>
        <Field label="Email" required error={campos.email}><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoComplete="off" /></Field>
        <Field label="Função" hint="A pessoa define a sua própria senha ao aceitar o convite." error={campos.role}>
          <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
            {PAPEIS_CONVIDAVEIS.map((r) => <option key={r} value={r}>{ROTULO_DE_PAPEL[r]}</option>)}
          </Select>
        </Field>
        {erro ? <Alert tone="danger">{erro}</Alert> : null}
      </form>
    </Modal>
  );
}

export function Utilizadores() {
  const { user } = useAuth();
  const toast = useToast();
  const utilizadores = useAsync((s) => utilizadoresDaEmpresa({ signal: s }), []);
  const convites = useAsync((s) => convitesDaEmpresa({ signal: s }), []);
  const [convidando, setConvidando] = useState(false);
  const [alvo, setAlvo] = useState(null);
  const [erro, setErro] = useState('');

  async function convite(fn, id, msg) {
    setErro('');
    try { await fn(id); toast.success(msg); convites.recarregar(); } catch (e) { setErro(mensagemDeErro(e)); }
  }

  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Utilizadores')} titulo="Utilizadores e permissões" sub="A equipa da sua empresa. Cada pessoa tem uma função; o convite chega por email e vale 7 dias."
        acoes={<Button variant="primary" onClick={() => setConvidando(true)}>Convidar utilizador</Button>} />
      {erro ? <Alert tone="danger" onClose={() => setErro('')}>{erro}</Alert> : null}
      <Bloco titulo="Equipa" id="u-equipa">
        <Carregado de={utilizadores} render={(lista) => (
          <Table caption="Utilizadores da empresa" rows={lista} columns={[
            { key: 'name', header: 'Nome', render: (u) => u.name },
            { key: 'email', header: 'Email', render: (u) => u.email },
            { key: 'role', header: 'Função', render: (u) => ROTULO_DE_PAPEL[u.role] || u.role },
            { key: 'active', header: 'Estado', render: (u) => (u.active ? <Badge tone="success" dot>Ativo</Badge> : <Badge tone="neutral" dot>Inativo</Badge>) },
            { key: 'createdAt', header: 'Desde', render: (u) => formatarData(u.createdAt) },
            { key: 'acao', header: 'Ação', render: (u) => (u.id === user.id ? <span className="kx-vazio-texto">É você</span>
              : <Button size="sm" variant={u.active ? 'danger' : 'secondary'} onClick={() => setAlvo(u)}>{u.active ? 'Desativar' : 'Reativar'}</Button>) },
          ]} />
        )} />
      </Bloco>
      <Bloco titulo="Convites pendentes" id="u-convites">
        <Carregado de={convites} linhas={2} render={(lista) => (
          <Table caption="Convites" rows={lista} empty={<EmptyState icon="user" title="Sem convites pendentes" description="Convide colegas para trabalharem na plataforma." />} columns={[
            { key: 'email', header: 'Email', render: (c) => c.email },
            { key: 'role', header: 'Função', render: (c) => ROTULO_DE_PAPEL[c.role] || c.role },
            { key: 'status', header: 'Estado', render: (c) => c.status },
            { key: 'expiresAt', header: 'Expira', render: (c) => formatarData(c.expiresAt) },
            { key: 'acao', header: 'Ações', render: (c) => (
              <span className="kx-acoes">
                <Button size="sm" onClick={() => convite(reenviarConvite, c.id, 'Convite reenviado.')}>Reenviar</Button>
                <Button size="sm" variant="ghost" onClick={() => convite(cancelarConvite, c.id, 'Convite cancelado.')}>Cancelar</Button>
              </span>
            ) },
          ]} />
        )} />
      </Bloco>
      {convidando ? <ModalConvidar onFechar={() => setConvidando(false)} onFeito={() => { setConvidando(false); convites.recarregar(); }} /> : null}
      <ConfirmDialog open={Boolean(alvo)} onClose={() => setAlvo(null)} tone={alvo?.active ? 'danger' : 'primary'} confirmLabel={alvo?.active ? 'Desativar' : 'Reativar'}
        title={`${alvo?.active ? 'Desativar' : 'Reativar'} ${alvo?.name}?`}
        onConfirm={async () => { try { await definirEstadoDeUtilizador(alvo.id, !alvo.active); toast.success('Estado atualizado.'); utilizadores.recarregar(); } catch (e) { throw new Error(mensagemDeErro(e)); } }}>
        {alvo?.active ? 'A pessoa deixa de poder iniciar sessão. Pode reativar mais tarde.' : 'A pessoa volta a poder iniciar sessão.'}
      </ConfirmDialog>
    </div>
  );
}

export function Organizacao() {
  const dados = useAsync((s) => organizacao({ signal: s }), []);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Organização')} titulo="Organização" sub="Os dados da empresa registados na plataforma." />
      <Carregado de={dados} render={({ company: c, summary: s }) => {
        const e = descrever(ESTADO_EMPRESA, c.status);
        return (
          <>
            <Indicadores itens={[{ rotulo: 'Utilizadores', valor: s.users }, { rotulo: 'Contratos', valor: s.contracts }, { rotulo: 'Documentos', valor: s.documents }, { rotulo: 'Certificações', valor: s.certifications }]} />
            <Bloco titulo={c.name} id="o-dados" acao={<Badge tone={e.tom} dot>{e.rotulo}</Badge>}>
              <dl className="kx-def">
                <div><dt>Tipo</dt><dd>{ROTULO_TIPO_EMPRESA[c.type] || c.type}</dd></div>
                <div><dt>NIF</dt><dd className="kx-mono">{c.taxId || '—'}</dd></div>
                <div><dt>Plano</dt><dd>{c.plan || '—'}</dd></div>
                <div><dt>Email</dt><dd>{c.contactEmail || '—'}</dd></div>
                <div><dt>Telefone</dt><dd>{c.contactPhone || '—'}</dd></div>
                <div><dt>Localização</dt><dd>{[c.address, c.city, c.province, c.country].filter(Boolean).join(', ') || '—'}</dd></div>
                {c.type === 'FORNECEDOR' ? <div><dt>Banco / IBAN</dt><dd>{[c.bankName, c.iban].filter(Boolean).join(' · ') || '—'}</dd></div> : null}
              </dl>
            </Bloco>
          </>
        );
      }} />
    </div>
  );
}

export function AtividadeDaEmpresa() {
  const dados = useAsync((s) => atividadesDaEmpresa(undefined, { signal: s }), []);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Atividade')} titulo="Atividade da empresa" sub="O que aconteceu nas ordens e contratos da sua empresa." />
      <Carregado de={dados} render={(d) => (
        <>
          <Indicadores itens={[{ rotulo: 'Total', valor: d.kpis.total ?? 0 }, { rotulo: 'Concluídas', valor: d.kpis.concluidas ?? 0, tom: 'success' }, { rotulo: 'Pendentes', valor: d.kpis.pendentes ?? 0, tom: d.kpis.pendentes ? 'warning' : undefined }, { rotulo: 'Atrasadas', valor: d.kpis.atrasadas ?? 0, tom: d.kpis.atrasadas ? 'danger' : undefined }]} />
          <Table caption="Atividade" rows={d.items} getRowKey={(a, i) => `${a.at}-${i}`} empty={<EmptyState icon="list" title="Sem atividade" />} columns={[
            { key: 'title', header: 'Atividade', render: (a) => a.title },
            { key: 'module', header: 'Módulo', render: (a) => a.module || '—' },
            { key: 'party', header: 'Parte', render: (a) => a.party || '—' },
            { key: 'responsavel', header: 'Responsável', render: (a) => a.responsavel || '—' },
            { key: 'status', header: 'Estado', render: (a) => a.status || '—' },
            { key: 'at', header: 'Data', render: (a) => formatarData(a.at) },
          ]} />
        </>
      )} />
    </div>
  );
}

export function RelatoriosDaEmpresa() {
  const dados = useAsync((s) => relatoriosDaEmpresa({ signal: s }), []);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Relatórios')} titulo="Relatórios" sub="Números agregados pelo servidor para a sua empresa." />
      <Carregado de={dados} render={(d) => (
        <>
          <Indicadores itens={[{ rotulo: 'Ordens', valor: d.kpis.ordens ?? 0 }, { rotulo: 'Contratos', valor: d.kpis.contratos ?? 0 }, { rotulo: 'Faturado', valor: formatarPreco(d.kpis.faturado, 'AOA') || '—' }]} />
          <Bloco titulo="Receitas e despesas por mês" id="r-series">
            <Table caption="Série mensal" rows={d.series} getRowKey={(r) => r.label} columns={[
              { key: 'label', header: 'Mês', render: (r) => r.label },
              { key: 'receitas', header: 'Receitas', align: 'right', render: (r) => formatarPreco(r.receitas, 'AOA') },
              { key: 'despesas', header: 'Despesas', align: 'right', render: (r) => formatarPreco(r.despesas, 'AOA') },
              { key: 'contratos', header: 'Contratos', align: 'right', render: (r) => r.contratos },
            ]} />
          </Bloco>
          <Bloco titulo="Relatórios disponíveis" id="r-catalogo">
            <ul className="kx-lista-simples">
              {d.catalog.map((r) => <li key={r.key}><strong>{r.name}</strong>{r.desc ? <> — <span className="kx-vazio-texto">{r.desc}</span></> : null}</li>)}
            </ul>
            <p className="kx-nota-direitos">A exportação destes relatórios depende de endpoints que o backend Java ainda não expõe; aqui só se mostram os números.</p>
          </Bloco>
        </>
      )} />
    </div>
  );
}

const ROTULO_DEF = {
  aprovacaoObrigatoria: ['Aprovação obrigatória das ordens', 'Cada ordem de compra passa pela aprovação do Administrador antes de seguir.'],
  assinaturaDigital: ['Assinatura digital', 'Assinar documentos digitalmente.'],
  historicoAlteracoes: ['Histórico de alterações', 'Guardar o registo de quem alterou o quê.'],
  backupAutomatico: ['Cópia de segurança automática', 'Guardar cópias periódicas dos dados da empresa.'],
  lembretesPrazos: ['Lembretes de prazos', 'Avisar antes de faturas e entregas vencerem.'],
  valoresSemImpostos: ['Mostrar valores sem impostos', 'Apresentar os totais antes de impostos.'],
};

export function Definicoes() {
  const toast = useToast();
  const dados = useAsync((s) => definicoesDaEmpresa({ signal: s }), []);
  const [a, setA] = useState('');
  const [erro, setErro] = useState('');
  async function alterar(atual, chave, valor) {
    setA(chave); setErro('');
    try { await guardarDefinicoes({ ...atual, [chave]: valor }); toast.success('Definição guardada.'); dados.recarregar(); }
    catch (e) { setErro(mensagemDeErro(e)); } finally { setA(''); }
  }
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Definições')} titulo="Definições da empresa" sub="Preferências guardadas no servidor para toda a empresa." />
      {erro ? <Alert tone="danger" onClose={() => setErro('')}>{erro}</Alert> : null}
      <Carregado de={dados} render={(d) => (
        <Bloco titulo="Preferências" id="d-prefs">
          <ul className="kx-lista-simples">
            {Object.entries(ROTULO_DEF).map(([chave, [rotulo, ajuda]]) => (
              <li key={chave} style={{ padding: '.6rem 0' }}>
                <Switch label={<>{rotulo}<br /><small className="kx-vazio-texto">{ajuda}</small></>} checked={Boolean(d[chave])} disabled={Boolean(a)} onChange={(e) => alterar(d, chave, e.target.checked)} />
              </li>
            ))}
          </ul>
        </Bloco>
      )} />
    </div>
  );
}
