// Papéis do backend (enum PersonaRole — 5 valores) e o que a interface faz com cada um.
// A AUTORIZAÇÃO é sempre do backend; aqui só se decide o que mostrar.
export const PAPEIS = ['COMPRADOR', 'COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO', 'ADMIN_SISTEMA'];

export const ROTULO_DE_PAPEL = {
  COMPRADOR: 'Comprador',
  COMPANY_ADMIN: 'Administrador da Empresa',
  FORNECEDOR: 'Fornecedor',
  FINANCEIRO: 'Financeiro',
  ADMIN_SISTEMA: 'Admin do Sistema KIXIMA',
};

export const ROTULO_DE_EMPRESA = { CLIENTE: 'Operadora', FORNECEDOR: 'Prestadora' };

/** Quem pode criar um pedido de cotação (POST /api/quotes → @RequireRole COMPRADOR). */
export const podePedirCotacao = (role) => role === 'COMPRADOR';
/** Quem pode responder a pedidos recebidos (PATCH /api/quotes/{id}/respond → FORNECEDOR, COMPANY_ADMIN). */
export const podeResponderCotacao = (role) => role === 'FORNECEDOR' || role === 'COMPANY_ADMIN';
/** Quem pode encerrar um pedido (PATCH /api/quotes/{id}/close → COMPRADOR). */
export const podeEncerrarCotacao = (role) => role === 'COMPRADOR';

/** Para onde vai cada papel depois de entrar: o painel da sua área de trabalho. */
export const PAGINA_INICIAL = {
  COMPRADOR: '/comprador',
  COMPANY_ADMIN: '/empresa',
  FORNECEDOR: '/fornecedor',
  FINANCEIRO: '/financeiro',
  ADMIN_SISTEMA: '/sistema',
};
export const paginaInicial = (role) => PAGINA_INICIAL[role] || '/';
