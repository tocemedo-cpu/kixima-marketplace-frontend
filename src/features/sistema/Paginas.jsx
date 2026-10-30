import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { listarContratos } from '../../api/endpoints/painel';
import {
  atividadeDaPlataforma, decidirEmpresa, definirEstadoDeUtilizadorAdmin, listarEmpresas, prontidao, registoDeAuditoria,
  taxasDaPlataforma, utilizadoresDaPlataforma,
} from '../../api/endpoints/sistema';
import { useAuth } from '../../auth/AuthContext';
import { ROTULO_DE_PAPEL } from '../../auth/papeis';
import { formatarData, formatarPreco } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Field, Modal, Pagination, Select, Table, Textarea, useToast } from '../../ui';
import { Bloco, Cabecalho, Carregado, Dinheiro, Indicadores } from '../comum/painel';
import { ESTADO_EMPRESA, ROTULO_TIPO_EMPRESA, descrever } from '../comum/estados';

const migalhas = (atual) => [{ label: 'Plataforma', to: '/sistema' }, ...(atual ? [{ label: atual }] : [])];

export function PainelDoSistema() {
  const atividade = useAsync((s) => atividadeDaPlataforma({ signal: s }), []);
  const empresas = useAsync((s) => listarEmpresas({ signal: s }), []);
  const estado = useAsync((s) => prontidao({ signal: s }), []);
  const pendentes = (empresas.data || []).filter((e) => e.status === 'PENDENTE');
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho titulo="Painel da plataforma" sub="Empresas, utilizadores e atividade de toda a KIXIMA." acoes={<Button as={Link} to="/sistema/empresas" variant="primary">Credenciamento</Button>} />
      {pendentes.length ? <Alert tone="warning" title="Empresas à espera de decisão">{pendentes.length} empresa(s) pendente(s). <Link to="/sistema/empresas">Decidir</Link></Alert> : null}
      <Carregado de={atividade} render={(d) => (
        <Indicadores itens={[
          { rotulo: 'Empresas', valor: d.kpis.empresas ?? 0 }, { rotulo: 'Utilizadores', valor: d.kpis.utilizadores ?? 0 },
          { rotulo: 'Ordens', valor: d.kpis.ordens ?? 0 }, { rotulo: 'Pagamentos', valor: d.kpis.pagamentos ?? 0 },
        ]} />
      )} />
      <div className="kx-grade-2">
        <Bloco titulo="Atividade recente" id="s-ativ">
          <Carregado de={atividade} linhas={3} render={(d) => (
            <Table caption="Atividade recente" rows={d.items.slice(0, 8)} getRowKey={(a, i) => `${a.at}-${i}`} empty={<EmptyState icon="list" title="Sem atividade" />} columns={[
              { key: 'module', header: 'Módulo', render: (a) => a.module || a.type || '—' },
              { key: 'title', header: 'Evento', render: (a) => <>{a.title}{a.detail ? <><br /><small className="kx-vazio-texto">{a.detail}</small></> : null}</> },
              { key: 'at', header: 'Quando', render: (a) => formatarData(a.at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
            ]} />
          )} />
        </Bloco>
        <Bloco titulo="Prontidão do sistema" id="s-pront" acao={<Link to="/sistema/prontidao">Detalhe</Link>}>
          <Carregado de={estado} linhas={2} render={(p) => (
            <dl className="kx-def">
              <div><dt>Ambiente</dt><dd>{p.ambiente || '—'}</dd></div>
              <div><dt>Verificações OK</dt><dd>{p.resumo.ok} de {p.resumo.total}</dd></div>
              <div><dt>Avisos</dt><dd>{p.resumo.avisos}</dd></div>
              <div><dt>Falhas</dt><dd>{p.resumo.falhas}</dd></div>
            </dl>
          )} />
        </Bloco>
      </div>
    </div>
  );
}

/** Credenciamento: aprovar ou rejeitar empresas pendentes (PATCH /api/companies/{id}/decision) e consultar as restantes. */
export function Empresas() {
  const toast = useToast();
  const dados = useAsync((s) => listarEmpresas({ signal: s }), []);
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [aprovar, setAprovar] = useState(null);
  const [rejeitar, setRejeitar] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [erroMotivo, setErroMotivo] = useState('');
  const [erro, setErro] = useState('');

  const filtradas = useMemo(() => (dados.data || []).filter((e) => (!tipo || e.type === tipo) && (!estado || e.status === estado)), [dados.data, tipo, estado]);

  async function rejeitarEmpresa() {
    if (!motivo.trim()) { setErroMotivo('Indique o motivo: é enviado à empresa.'); throw new Error(''); }
    try { await decidirEmpresa(rejeitar.id, { approve: false, rejectionReason: motivo.trim() }); toast.success('Empresa rejeitada.'); setMotivo(''); setErroMotivo(''); dados.recarregar(); }
    catch (e) { if (e.message === '') throw e; throw new Error(mensagemDeErro(e)); }
  }

  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Empresas')} titulo="Empresas e credenciamento" sub="Operadoras (compram) e prestadoras e fornecedoras (oferecem). Aprove só depois de verificar os documentos." />
      {erro ? <Alert tone="danger" onClose={() => setErro('')}>{erro}</Alert> : null}
      <div className="kx-filtros-linha">
        <Field label="Tipo"><Select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option><option value="CLIENTE">Operadoras</option><option value="FORNECEDOR">Prestadoras e fornecedoras</option></Select></Field>
        <Field label="Estado"><Select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option>{Object.entries(ESTADO_EMPRESA).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</Select></Field>
      </div>
      <Carregado de={dados} render={() => (
        <Table caption="Empresas" rows={filtradas} empty={<EmptyState icon="building" title="Nenhuma empresa com estes filtros" />} columns={[
          { key: 'name', header: 'Empresa', render: (e) => e.name },
          { key: 'type', header: 'Tipo', render: (e) => ROTULO_TIPO_EMPRESA[e.type] || e.type },
          { key: 'taxId', header: 'NIF', mono: true, render: (e) => e.taxId || '—' },
          { key: 'plan', header: 'Plano', render: (e) => e.plan || '—' },
          { key: 'createdAt', header: 'Registo', render: (e) => formatarData(e.createdAt) },
          { key: 'status', header: 'Estado', render: (e) => { const d = descrever(ESTADO_EMPRESA, e.status); return <Badge tone={d.tom} dot>{d.rotulo}</Badge>; } },
          { key: 'acao', header: 'Decisão', render: (e) => (e.status === 'PENDENTE' ? (
            <span className="kx-acoes"><Button size="sm" variant="primary" onClick={() => setAprovar(e)}>Aprovar</Button><Button size="sm" variant="danger" onClick={() => setRejeitar(e)}>Rejeitar</Button></span>
          ) : <span className="kx-vazio-texto">—</span>) },
        ]} />
      )} />
      <ConfirmDialog open={Boolean(aprovar)} onClose={() => setAprovar(null)} confirmLabel="Aprovar empresa" title={`Aprovar ${aprovar?.name}?`}
        onConfirm={async () => { try { await decidirEmpresa(aprovar.id, { approve: true }); toast.success('Empresa aprovada.'); dados.recarregar(); } catch (e) { throw new Error(mensagemDeErro(e)); } }}>
        A empresa passa a poder usar a plataforma com o plano indicado no registo.
      </ConfirmDialog>
      <ConfirmDialog open={Boolean(rejeitar)} onClose={() => { setRejeitar(null); setMotivo(''); setErroMotivo(''); }} tone="danger" confirmLabel="Rejeitar empresa" title={`Rejeitar ${rejeitar?.name}?`} onConfirm={rejeitarEmpresa}>
        <Field label="Motivo da rejeição" required error={erroMotivo}><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} /></Field>
      </ConfirmDialog>
    </div>
  );
}

export function UtilizadoresDaPlataforma() {
  const { user } = useAuth();
  const toast = useToast();
  const dados = useAsync((s) => utilizadoresDaPlataforma({ signal: s }), []);
  const [alvo, setAlvo] = useState(null);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Utilizadores')} titulo="Utilizadores da plataforma" sub="Todas as contas, de todas as empresas." />
      <Carregado de={dados} render={(lista) => (
        <Table caption="Utilizadores" rows={lista} columns={[
          { key: 'name', header: 'Nome', render: (u) => u.name },
          { key: 'email', header: 'Email', render: (u) => u.email },
          { key: 'role', header: 'Função', render: (u) => ROTULO_DE_PAPEL[u.role] || u.role },
          { key: 'companyName', header: 'Empresa', render: (u) => u.companyName || '—' },
          { key: 'active', header: 'Estado', render: (u) => (u.active ? <Badge tone="success" dot>Ativo</Badge> : <Badge tone="neutral" dot>Inativo</Badge>) },
          { key: 'acao', header: 'Ação', render: (u) => (u.id === user.id ? <span className="kx-vazio-texto">É você</span> : <Button size="sm" variant={u.active ? 'danger' : 'secondary'} onClick={() => setAlvo(u)}>{u.active ? 'Desativar' : 'Reativar'}</Button>) },
        ]} />
      )} />
      <ConfirmDialog open={Boolean(alvo)} onClose={() => setAlvo(null)} tone={alvo?.active ? 'danger' : 'primary'} confirmLabel={alvo?.active ? 'Desativar' : 'Reativar'} title={`${alvo?.active ? 'Desativar' : 'Reativar'} ${alvo?.name}?`}
        onConfirm={async () => { try { await definirEstadoDeUtilizadorAdmin(alvo.id, !alvo.active); toast.success('Estado atualizado.'); dados.recarregar(); } catch (e) { throw new Error(mensagemDeErro(e)); } }}>
        {alvo?.active ? 'A conta deixa de poder iniciar sessão.' : 'A conta volta a poder iniciar sessão.'}
      </ConfirmDialog>
    </div>
  );
}

export function Auditoria() {
  const [pagina, setPagina] = useState(1);
  const [acao, setAcao] = useState('');
  const dados = useAsync((s) => registoDeAuditoria({ page: pagina, ...(acao ? { action: acao } : {}) }, { signal: s }), [pagina, acao]);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Auditoria')} titulo="Registo de auditoria" sub="Quem fez o quê e quando. O servidor guarda cada ação sensível; este registo só se lê." />
      <div className="kx-filtros-linha">
        <Field label="Ação"><Select value={acao} onChange={(e) => { setAcao(e.target.value); setPagina(1); }}><option value="">Todas</option>{(dados.data?.actions || []).map((a) => <option key={a.action} value={a.action}>{a.action} ({a.count})</option>)}</Select></Field>
      </div>
      <Carregado de={dados} render={(d) => (
        <>
          <Table caption="Registo de auditoria" rows={d.items} empty={<EmptyState icon="shield" title="Sem registos" />} columns={[
            { key: 'createdAt', header: 'Quando', render: (a) => formatarData(a.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
            { key: 'action', header: 'Ação', mono: true, render: (a) => a.action },
            { key: 'entity', header: 'Entidade', render: (a) => [a.entityType, a.entityRef].filter(Boolean).join(' · ') || '—' },
            { key: 'actor', header: 'Autor', render: (a) => (a.actorName ? `${a.actorName}${a.actorRole ? ` (${ROTULO_DE_PAPEL[a.actorRole] || a.actorRole})` : ''}` : '—') },
          ]} />
          <p className="kx-nota-direitos">{d.total} registo(s) no total.</p>
          <Pagination page={d.page} pages={d.pages} onChange={setPagina} label="Páginas do registo" />
        </>
      )} />
    </div>
  );
}

export function Taxas() {
  const dados = useAsync((s) => taxasDaPlataforma({ signal: s }), []);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Taxas')} titulo="Taxas da plataforma" sub="Taxas KIXIMA calculadas e cobradas pelo servidor sobre as transações. Mostra-se apenas o que a API devolve." />
      <Carregado de={dados} render={(d) => (
        <>
          <Indicadores itens={[
            { rotulo: 'Taxas', valor: d.kpis.total ?? 0 }, { rotulo: 'Total (Kz)', valor: formatarPreco(d.kpis.totalAOA, 'AOA') || '—' },
            { rotulo: 'Por cobrar (Kz)', valor: formatarPreco(d.kpis.pendingAOA, 'AOA') || '—', tom: d.kpis.pendingAOA ? 'warning' : undefined }, { rotulo: 'Cobradas', valor: d.kpis.cobradas ?? 0, tom: 'success' },
          ]} />
          <Table caption="Taxas" rows={d.fees} empty={<EmptyState icon="file" title="Ainda não há taxas" description="Surgem quando há ordens e faturas sujeitas a taxa." />} columns={[
            { key: 'createdAt', header: 'Data', render: (f) => formatarData(f.createdAt) },
            { key: 'amount', header: 'Valor', align: 'right', render: (f) => <Dinheiro valor={f.amount} moeda={f.currency || 'AOA'} /> },
            { key: 'status', header: 'Estado', render: (f) => f.status || '—' },
          ]} />
        </>
      )} />
    </div>
  );
}

const TOM_VERIFICACAO = { ok: 'success', aviso: 'warning', falha: 'danger' };

export function Prontidao() {
  const dados = useAsync((s) => prontidao({ signal: s }), []);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={migalhas('Prontidão')} titulo="Prontidão para produção" sub="Verificações do servidor: base de dados, segurança, email, pagamentos." acoes={<Button onClick={dados.recarregar}>Verificar de novo</Button>} />
      <Carregado de={dados} render={(p) => (
        <>
          <Indicadores itens={[{ rotulo: 'Verificações', valor: p.resumo.total }, { rotulo: 'OK', valor: p.resumo.ok, tom: 'success' }, { rotulo: 'Avisos', valor: p.resumo.avisos, tom: p.resumo.avisos ? 'warning' : undefined }, { rotulo: 'Falhas', valor: p.resumo.falhas, tom: p.resumo.falhas ? 'danger' : undefined }]} />
          {p.grupos.map((g, i) => (
            <Bloco key={g.grupo} id={`pr-${i}`} titulo={g.grupo}>
              <ul className="kx-lista-simples">
                {g.checks.map((c, j) => (
                  <li key={c.id || j} style={{ padding: '.4rem 0' }}>
                    <Badge tone={TOM_VERIFICACAO[c.estado] || 'neutral'} dot>{c.estado}</Badge> <strong>{c.titulo}</strong>
                    {c.detalhe ? <><br /><small className="kx-vazio-texto">{c.detalhe}</small></> : null}
                    {c.acao && c.estado !== 'ok' ? <><br /><small>{c.acao}</small></> : null}
                  </li>
                ))}
              </ul>
            </Bloco>
          ))}
        </>
      )} />
    </div>
  );
}

/** Contratos-quadro: todos os papéis; o servidor devolve só os da empresa da sessão (ADMIN_SISTEMA vê todos). */
export function Contratos() {
  const dados = useAsync((s) => listarContratos({ signal: s }), []);
  return (
    <div className="kx-container kx-pagina">
      <Cabecalho migalhas={[{ label: 'Contratos' }]} titulo="Contratos-quadro" sub="Acordos de fornecimento com preço e prazo. As ordens emitidas ao abrigo de um contrato não precisam de nova aprovação." />
      <Carregado de={dados} render={(lista) => (
        <Table caption="Contratos" rows={lista} empty={<EmptyState icon="file" title="Sem contratos" description="Os contratos-quadro da sua empresa aparecem aqui." />} columns={[
          { key: 'reference', header: 'Contrato', mono: true, render: (c) => c.reference },
          { key: 'client', header: 'Cliente', render: (c) => c.clientCompany?.name || '—' },
          { key: 'supplier', header: 'Fornecedora', render: (c) => c.supplierCompany?.name || '—' },
          { key: 'validUntil', header: 'Válido até', render: (c) => formatarData(c.validUntil) },
          { key: 'totalValue', header: 'Valor', align: 'right', render: (c) => <Dinheiro valor={c.totalValue} moeda={c.currency} /> },
          { key: 'usedValue', header: 'Utilizado', align: 'right', render: (c) => <Dinheiro valor={c.usedValue} moeda={c.currency} /> },
          { key: 'status', header: 'Estado', render: (c) => c.status },
        ]} />
      )} />
    </div>
  );
}
