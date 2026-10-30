// Cadastro público de empresa (onboarding): cria a empresa (pendente de aprovação) e a conta do Administrador da
// Empresa, e envia os documentos de credenciamento exigidos por tipo. Porta fiel do fluxo existente
// (POST /api/companies/register, multipart). Os mínimos e os documentos espelham o backend.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, mensagemDeErro } from '../../api/client';
import { registarEmpresa } from '../../api/endpoints/auth';
import { Alert, Button, Checkbox, Field, Input, Select } from '../../ui';
import AuthLayout from './AuthLayout';
import CampoSenha from './CampoSenha';

export const SENHA_MINIMA_ADMIN = 12; // o administrador da empresa move dinheiro: senha mais longa

const VAZIO = {
  type: 'CLIENTE', name: '', taxId: '', contactEmail: '', contactPhone: '', address: '', adminName: '', adminEmail: '', adminPassword: '',
  employees: '', annualRevenueUsd: '',
  insurer: '', policyNumber: '', coverageAmount: '', policyCurrency: 'AOA', policyValidFrom: '', policyValidUntil: '',
};

// Documentos obrigatórios por tipo de empresa (têm de espelhar o backend).
export const DOCUMENTOS = {
  CLIENTE: [{ type: 'CERTIDAO_COMERCIAL', label: 'Certidão Comercial' }, { type: 'ALVARA_COMERCIAL', label: 'Alvará Comercial' }],
  FORNECEDOR: [{ type: 'ALVARA_COMERCIAL', label: 'Alvará Comercial' }, { type: 'LICENCA_ANPG', label: 'Licença da ANPG' }, { type: 'CERTIDAO_COMERCIAL', label: 'Certidão Comercial' }],
};

const TIPOS = { CLIENTE: 'Operadora (compra)', FORNECEDOR: 'Prestadora e fornecedora (oferece)' };

export function validarRegisto(form, docs, termos) {
  const e = {};
  if (form.name.trim().length < 2) e.name = 'Indique o nome da empresa.';
  if (form.taxId.trim().length < 3) e.taxId = 'Indique o NIF.';
  if (!/^\S+@\S+\.\S+$/.test(form.contactEmail)) e.contactEmail = 'Indique um email de contacto válido.';
  if (form.adminName.trim().length < 2) e.adminName = 'Indique o nome do administrador.';
  if (!/^\S+@\S+\.\S+$/.test(form.adminEmail)) e.adminEmail = 'Indique um email válido.';
  if (form.adminPassword.length < SENHA_MINIMA_ADMIN) e.adminPassword = `A senha precisa de pelo menos ${SENHA_MINIMA_ADMIN} caracteres.`;
  const faltam = (DOCUMENTOS[form.type] || []).filter((d) => !docs[d.type]);
  if (faltam.length) e.docs = `Anexe os documentos: ${faltam.map((d) => d.label).join(', ')}.`;
  if (form.type === 'FORNECEDOR') {
    if (!form.insurer.trim()) e.insurer = 'Indique a seguradora.';
    if (!form.policyNumber.trim()) e.policyNumber = 'Indique o número da apólice.';
    if (!(Number(form.coverageAmount) > 0)) e.coverageAmount = 'Indique o valor da cobertura.';
    if (!form.policyValidFrom) e.policyValidFrom = 'Indique o início da validade.';
    if (!form.policyValidUntil) e.policyValidUntil = 'Indique o fim da validade.';
    else if (form.policyValidFrom && form.policyValidUntil < form.policyValidFrom) e.policyValidUntil = 'O fim da validade é anterior ao início.';
    if (!docs.APOLICE_SEGURO) e.docs = `${e.docs ? `${e.docs} ` : ''}Anexe o documento da apólice de seguro.`;
  }
  if (!termos) e.termos = 'É necessário aceitar os Termos de Uso e a Política de Privacidade.';
  return e;
}

export default function Registo() {
  const [sp] = useSearchParams();
  const tipo = sp.get('tipo');
  const [form, setForm] = useState(() => (tipo === 'CLIENTE' || tipo === 'FORNECEDOR' ? { ...VAZIO, type: tipo } : VAZIO));
  const [docs, setDocs] = useState({});
  const [termos, setTermos] = useState(false);
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [feito, setFeito] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fornecedora = form.type === 'FORNECEDOR';

  async function submeter(e) {
    e.preventDefault();
    setErro('');
    const v = validarRegisto(form, docs, termos);
    setErros(v);
    if (Object.keys(v).length) {
      setErro('Reveja os campos assinalados.');
      return;
    }
    const fd = new FormData();
    ['type', 'name', 'taxId', 'contactEmail', 'contactPhone', 'address', 'adminName', 'adminEmail', 'adminPassword', 'employees', 'annualRevenueUsd'].forEach((k) => fd.append(k, form[k]));
    fd.append('termsAccepted', 'true');
    DOCUMENTOS[form.type].forEach((d) => fd.append(d.type, docs[d.type]));
    if (fornecedora) {
      ['insurer', 'policyNumber', 'coverageAmount', 'policyCurrency', 'policyValidFrom', 'policyValidUntil'].forEach((k) => fd.append(k, form[k]));
      fd.append('APOLICE_SEGURO', docs.APOLICE_SEGURO);
    }
    setAEnviar(true);
    try {
      setFeito(await registarEmpresa(fd));
    } catch (err) {
      if (err instanceof ApiError && err.isValidation) {
        setErros(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, Array.isArray(m) ? m.join(' ') : String(m)])));
      }
      setErro(mensagemDeErro(err));
    } finally { setAEnviar(false); }
  }

  if (feito) {
    return (
      <AuthLayout titulo="Cadastro submetido" largura="md">
        <Alert tone="success" title="Recebemos o cadastro">
          O cadastro de <strong>{feito.name}</strong> está <strong>pendente de aprovação (due diligence)</strong>. Assim que a KIXIMA aprovar, poderá entrar com o email e a senha que definiu para o administrador.
        </Alert>
        <p><Button as={Link} to="/login" variant="primary">Voltar ao login</Button></p>
      </AuthLayout>
    );
  }

  const ficheiro = (tipoDoc, rotulo) => (
    <Field key={tipoDoc} label={rotulo} required hint="PDF ou imagem.">
      <Input type="file" accept=".pdf,image/*" onChange={(e) => setDocs((d) => ({ ...d, [tipoDoc]: e.target.files?.[0] || undefined }))} />
    </Field>
  );

  return (
    <AuthLayout titulo="Registar empresa" subtitulo="Submeta os dados e documentos para o credenciamento. A conta fica ativa depois da aprovação." largura="lg">
      <form onSubmit={submeter} noValidate className="kx-form kx-form--duas">
        {erro ? <div className="kx-form__todas"><Alert tone="danger">{erro}</Alert></div> : null}

        <fieldset className="kx-form__grupo">
          <legend>A empresa</legend>
          <Field label="Tipo de empresa" required><Select value={form.type} onChange={(e) => { set('type')(e); setDocs({}); }}>{Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</Select></Field>
          <Field label="Nome da empresa" required error={erros.name}><Input value={form.name} onChange={set('name')} autoComplete="organization" /></Field>
          <Field label="NIF" required error={erros.taxId}><Input value={form.taxId} onChange={set('taxId')} /></Field>
          <Field label="Email de contacto" required error={erros.contactEmail}><Input type="email" value={form.contactEmail} onChange={set('contactEmail')} autoComplete="email" /></Field>
          <Field label="Telefone"><Input type="tel" value={form.contactPhone} onChange={set('contactPhone')} autoComplete="tel" /></Field>
          <Field label="Morada"><Input value={form.address} onChange={set('address')} autoComplete="street-address" /></Field>
          <Field label="N.º de trabalhadores"><Input type="number" min="0" value={form.employees} onChange={set('employees')} /></Field>
          <Field label="Facturação anual (USD)"><Input type="number" min="0" step="1000" value={form.annualRevenueUsd} onChange={set('annualRevenueUsd')} /></Field>
        </fieldset>

        <fieldset className="kx-form__grupo">
          <legend>O administrador da empresa</legend>
          <Field label="Nome" required error={erros.adminName}><Input value={form.adminName} onChange={set('adminName')} autoComplete="name" /></Field>
          <Field label="Email" required error={erros.adminEmail}><Input type="email" value={form.adminEmail} onChange={set('adminEmail')} autoComplete="username" /></Field>
          <Field label="Senha" required hint={`Pelo menos ${SENHA_MINIMA_ADMIN} caracteres.`} error={erros.adminPassword}><CampoSenha autoComplete="new-password" value={form.adminPassword} onChange={set('adminPassword')} /></Field>
        </fieldset>

        {fornecedora ? (
          <fieldset className="kx-form__grupo">
            <legend>Apólice de seguro (Fornecedor → KIXIMA)</legend>
            <Field label="Seguradora" required error={erros.insurer}><Input value={form.insurer} onChange={set('insurer')} /></Field>
            <Field label="N.º da apólice" required error={erros.policyNumber}><Input value={form.policyNumber} onChange={set('policyNumber')} /></Field>
            <Field label="Valor da cobertura" required error={erros.coverageAmount}><Input type="number" min="0" step="any" value={form.coverageAmount} onChange={set('coverageAmount')} /></Field>
            <Field label="Moeda"><Select value={form.policyCurrency} onChange={set('policyCurrency')}><option value="AOA">AOA (Kwanza)</option><option value="USD">USD</option><option value="EUR">EUR</option></Select></Field>
            <Field label="Válida desde" required error={erros.policyValidFrom}><Input type="date" value={form.policyValidFrom} onChange={set('policyValidFrom')} /></Field>
            <Field label="Válida até" required error={erros.policyValidUntil}><Input type="date" value={form.policyValidUntil} onChange={set('policyValidUntil')} /></Field>
          </fieldset>
        ) : null}

        <fieldset className="kx-form__grupo kx-form__todas">
          <legend>Documentos de credenciamento</legend>
          {DOCUMENTOS[form.type].map((d) => ficheiro(d.type, d.label))}
          {fornecedora ? ficheiro('APOLICE_SEGURO', 'Apólice de seguro') : null}
          {erros.docs ? <p className="kx-field__error" role="alert">{erros.docs}</p> : null}
        </fieldset>

        <div className="kx-form__todas">
          <Checkbox label={<>Li e aceito os <Link to="/termos" target="_blank">Termos de Uso</Link> e a <Link to="/privacidade" target="_blank">Política de Privacidade</Link>.</>} checked={termos} onChange={(e) => setTermos(e.target.checked)} />
          {erros.termos ? <p className="kx-field__error" role="alert">{erros.termos}</p> : null}
        </div>

        <div className="kx-form__todas kx-form__linha">
          <Button type="submit" variant="primary" size="lg" loading={aEnviar}>Submeter cadastro</Button>
          <span>Já tem conta? <Link to="/login">Entrar</Link></span>
        </div>
      </form>
    </AuthLayout>
  );
}
