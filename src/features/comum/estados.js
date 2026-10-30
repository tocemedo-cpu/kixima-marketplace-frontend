// Rótulos e tons dos estados que o backend devolve. Os valores (chaves) são os do enum do servidor;
// os rótulos são só tradução para a interface. Um estado novo no servidor aparece com o próprio código, sem partir.
export const ESTADO_ORDEM = {
  AGUARDANDO_APROVACAO: { rotulo: 'A aguardar aprovação', tom: 'warning' },
  APROVADA: { rotulo: 'Aprovada', tom: 'info' },
  REJEITADA: { rotulo: 'Rejeitada', tom: 'danger' },
  ACEITE_FORNECEDOR: { rotulo: 'Aceite pela fornecedora', tom: 'info' },
  RECUSADA_FORNECEDOR: { rotulo: 'Recusada pela fornecedora', tom: 'danger' },
  AGUARDANDO_PAGAMENTO: { rotulo: 'A aguardar pagamento', tom: 'warning' },
  PAGA: { rotulo: 'Paga', tom: 'info' },
  EM_EXECUCAO: { rotulo: 'Em execução', tom: 'info' },
  ENTREGUE: { rotulo: 'Entregue', tom: 'info' },
  RECEBIDA_CONFORME: { rotulo: 'Recebida conforme', tom: 'success' },
  RECEBIDA_COM_DIVERGENCIA: { rotulo: 'Recebida com divergência', tom: 'warning' },
  CONCLUIDA: { rotulo: 'Concluída', tom: 'success' },
};

export const ESTADO_FATURA = {
  PENDENTE: { rotulo: 'Pendente', tom: 'warning' },
  PAGA: { rotulo: 'Paga', tom: 'success' },
  VENCIDA: { rotulo: 'Vencida', tom: 'danger' },
  CANCELADA: { rotulo: 'Cancelada', tom: 'neutral' },
};

export const ESTADO_EMPRESA = {
  PENDENTE: { rotulo: 'Pendente', tom: 'warning' },
  APROVADA: { rotulo: 'Aprovada', tom: 'success' },
  REJEITADA: { rotulo: 'Rejeitada', tom: 'danger' },
  SUSPENSA: { rotulo: 'Suspensa', tom: 'danger' },
};

export const ROTULO_TIPO_EMPRESA = { CLIENTE: 'Operadora', FORNECEDOR: 'Prestadora e fornecedora' };

/** { rotulo, tom } para um código; desconhecido → o próprio código, tom neutro. */
export const descrever = (mapa, codigo) => mapa[codigo] || { rotulo: codigo || '—', tom: 'neutral' };
