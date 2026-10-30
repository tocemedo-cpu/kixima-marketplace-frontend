// Que ações de uma ordem a interface OFERECE a cada pessoa. A regra é só de apresentação: quem decide é o backend
// (PoController + PoService), que responde 403/409 se a pessoa ou o estado não servirem — e a interface mostra essa mensagem.
// Mantém-se alinhada com a máquina de estados documentada em docs/api/09-fluxos-de-negocio.md.

/**
 * @param {{ role: string, companyId: string }} user
 * @param {{ status: string, buyerCompanyId: string, supplierCompanyId: string, isCallOff?: boolean, dispatchedAt?: string|null, invoice?: any }} ordem
 * @returns {string[]} códigos de ação: aprovar, rejeitar, aceitar, recusar, despachar, entregue, receber, resolver, pagar, confirmar
 */
export function acoesDisponiveis(user, ordem) {
  if (!user || !ordem) return [];
  const compradora = user.companyId === ordem.buyerCompanyId;
  const fornecedora = user.companyId === ordem.supplierCompanyId;
  const comoFornecedora = fornecedora && (user.role === 'FORNECEDOR' || user.role === 'COMPANY_ADMIN');
  const s = ordem.status;
  const acoes = [];

  // O administrador da empresa compradora é quem aprova; não compra nem paga por omissão (papéis separados).
  if (compradora && user.role === 'COMPANY_ADMIN' && s === 'AGUARDANDO_APROVACAO') acoes.push('aprovar', 'rejeitar');
  if (comoFornecedora && s === 'APROVADA') acoes.push('aceitar', 'recusar');
  if (comoFornecedora && (s === 'PAGA' || (ordem.isCallOff && s === 'EM_EXECUCAO' && !ordem.dispatchedAt))) acoes.push('despachar');
  if (comoFornecedora && s === 'EM_EXECUCAO' && ordem.dispatchedAt) acoes.push('entregue');
  if (compradora && user.role === 'COMPRADOR' && s === 'ENTREGUE') acoes.push('receber');
  if (compradora && user.role === 'COMPRADOR' && s === 'RECEBIDA_COM_DIVERGENCIA' && !ordem.divergenceResolution) acoes.push('resolver');
  if (compradora && user.role === 'FINANCEIRO' && s === 'AGUARDANDO_PAGAMENTO' && ordem.invoice?.status === 'PENDENTE') acoes.push('pagar');
  const pag = ordem.invoice?.payment;
  if (fornecedora && ['FORNECEDOR', 'COMPANY_ADMIN', 'FINANCEIRO'].includes(user.role) && pag && !pag.receivedAt) acoes.push('confirmar');
  return acoes;
}
