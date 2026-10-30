// Navegação horizontal por papel. Só decide o que MOSTRAR: cada rota está protegida por RequireRole no frontend
// e, sobretudo, pelas permissões do backend. Os papéis não herdam menus uns dos outros (o Administrador da empresa
// não vê as áreas de compra nem de pagamento por omissão).
const MERCADO = {
  label: 'Mercado',
  children: [
    { label: 'Produtos', to: '/produtos', description: 'Pesquisar no catálogo industrial' },
    { label: 'Serviços', to: '/servicos', description: 'Inspeção, ensaios, engenharia, transporte' },
    { label: 'Categorias', to: '/categorias', description: 'Procurement por categoria' },
    { label: 'Fornecedoras verificadas', to: '/fornecedores', description: 'Empresas credenciadas na plataforma' },
    { label: 'Cotações', to: '/mercado/cotacoes', description: 'Pedidos e respostas' },
  ],
};

export const NAV_POR_PAPEL = {
  COMPRADOR: [
    { label: 'Painel', to: '/comprador', end: true },
    MERCADO,
    {
      label: 'Compras',
      children: [
        { label: 'Requisição', to: '/comprador/requisicao', description: 'Linhas a emitir como ordem' },
        { label: 'Ordens', to: '/comprador/ordens', description: 'Histórico e estado' },
        { label: 'Pagamentos', to: '/comprador/pagamentos', description: 'Faturas das ordens' },
        { label: 'Entregas', to: '/comprador/entregas', description: 'Acompanhamento' },
        { label: 'Receções', to: '/comprador/rececoes', description: 'Conforme ou com divergência' },
      ],
    },
    { label: 'Fornecedoras', to: '/comprador/fornecedores' },
    { label: 'Contratos', to: '/contratos' },
    { label: 'Atividade', to: '/comprador/atividade' },
  ],
  COMPANY_ADMIN: [
    { label: 'Painel', to: '/empresa', end: true },
    { label: 'Aprovações', to: '/empresa/aprovacoes' },
    { label: 'Ordens', to: '/ordens' },
    { label: 'Equipa', to: '/empresa/utilizadores' },
    {
      label: 'Empresa',
      children: [
        { label: 'Organização', to: '/empresa/organizacao', description: 'Dados da empresa' },
        { label: 'Atividade', to: '/empresa/atividade', description: 'Ordens e contratos' },
        { label: 'Relatórios', to: '/empresa/relatorios', description: 'Números agregados' },
        { label: 'Definições', to: '/empresa/definicoes', description: 'Preferências' },
        { label: 'Contratos', to: '/contratos', description: 'Contratos-quadro' },
      ],
    },
    { label: 'Mercado', to: '/produtos' },
  ],
  FORNECEDOR: [
    { label: 'Painel', to: '/fornecedor', end: true },
    { label: 'Ordens recebidas', to: '/ordens' },
    { label: 'Catálogo', to: '/fornecedor/catalogo' },
    { label: 'Faturas', to: '/fornecedor/faturas' },
    { label: 'Cotações', to: '/mercado/cotacoes' },
    { label: 'Contratos', to: '/contratos' },
    { label: 'Mercado', to: '/produtos' },
  ],
  FINANCEIRO: [
    { label: 'Painel', to: '/financeiro', end: true },
    { label: 'Faturas por pagar', to: '/financeiro/faturas' },
    { label: 'Pagamentos', to: '/financeiro/pagamentos' },
    { label: 'Ordens', to: '/ordens' },
    { label: 'Contratos', to: '/contratos' },
  ],
  ADMIN_SISTEMA: [
    { label: 'Painel', to: '/sistema', end: true },
    { label: 'Empresas', to: '/sistema/empresas' },
    { label: 'Utilizadores', to: '/sistema/utilizadores' },
    { label: 'Ordens', to: '/ordens' },
    { label: 'Contratos', to: '/contratos' },
    {
      label: 'Plataforma',
      children: [
        { label: 'Auditoria', to: '/sistema/auditoria', description: 'Quem fez o quê' },
        { label: 'Taxas', to: '/sistema/taxas', description: 'Taxas da plataforma' },
        { label: 'Prontidão', to: '/sistema/prontidao', description: 'Verificações do servidor' },
      ],
    },
    { label: 'Mercado', to: '/produtos' },
  ],
};

export const navegacaoDe = (role) => NAV_POR_PAPEL[role] || [
  { label: 'Início', to: '/', end: true }, { label: 'Produtos', to: '/produtos' }, { label: 'Cotações', to: '/mercado/cotacoes' },
];
