# API do backend Java usada por este frontend

Fonte: o backend `kixima-backend-java` (Spring Boot), lido em modo leitura, e verificado contra uma instância real
com base de testes. A montra pública do catálogo exigiu **4 endpoints novos, só de leitura, no backend Java**
(`PublicCatalogController`, autorizados expressamente pelo responsável do projeto); tudo o resto usa endpoints que já
existiam. O que falta para o plano completo está em "Dependências do backend" no fim.

## Convenções

- **Origem:** todos os pedidos são relativos (`/api/…`). Em desenvolvimento o Vite faz proxy para o backend
  (`API_PROXY_TARGET`, omissão `http://localhost:4001`); em produção o frontend deve ser servido pela mesma origem
  (ou atrás de um proxy que encaminhe `/api` e `/ws`), porque a sessão é um cookie.
- **Sessão:** cookie `kixima_sessao` (`HttpOnly`, `SameSite`), definido por `POST /api/auth/login`. O JavaScript não
  o lê. O corpo do login também traz um `token`, que este frontend **ignora de propósito**.
- **Erros:** `{ "error": { "code", "message", "details?" } }`. Códigos vistos: `UNAUTHORIZED` 401, `FORBIDDEN` 403,
  `NOT_FOUND`/`ROUTE_NOT_FOUND` 404, `VALIDATION_ERROR` 422 (com `details.fieldErrors`), `SERVICO_INDISPONIVEL` 503,
  `INTERNAL_ERROR` 500. O cliente (`src/api/client.js`) normaliza-os num `ApiError` e junta `REDE`, `TEMPO_ESGOTADO`
  e `RESPOSTA_INESPERADA` (validação das respostas, `src/api/schema.js`).
- **Repetições:** só `GET`, até 2 vezes, em rede/502/503/504. Nunca `POST/PUT/PATCH/DELETE`.
- **401:** fora dos endpoints de autenticação significa sessão expirada → o `AuthContext` limpa o estado e a rota
  privada leva ao login.

## Montra pública do catálogo (sem sessão) — endpoints novos no backend

Servem a homepage, as categorias, a pesquisa, os serviços, as fornecedoras e a ficha do produto para **qualquer
visitante**. São `GET`, sem cookie, em `src/api/endpoints/mercado.js`. Substituem, nas páginas do marketplace, os
endpoints autenticados `/api/marketplace/*` e `/api/catalog/slug/*` (que continuam a exigir sessão).

| Método e caminho | Parâmetros | Notas |
|---|---|---|
| `GET /api/public/catalog/search` | os da pesquisa autenticada: `q`, `category`, `kind`, `certifications`, `availability`, `verified`, `promo`, `country`, `province`, `city`, `specialty`, `minRating`, `minPrice`, `maxPrice`, `sort`, `page`, `limit` (≤48) | `{ items, total, page, pages, limit }`. Parâmetro inválido → `422` |
| `GET /api/public/catalog/facets` | os mesmos filtros | Categorias, tipos, países, certificações e limites de preço, com contagens (só agregados) |
| `GET /api/public/catalog/suppliers` | `limit` (1–24, omissão 8) | Fornecedoras **verificadas e aprovadas**: `id, name, logoUrl, city, country, rating, productCount`. `limit` fora do intervalo → `422` |
| `GET /api/public/catalog/products/{slug}` | — | Ficha completa (imagens e documentos técnicos incluídos). `404` se não existir, estiver retirado **ou a fornecedora não estiver aprovada** |
| `GET /api/public/catalog/products/{slug}/reviews` | — | Avaliações; o autor sai como «Nome I.» e nunca o identificador da conta |

**O que a montra garante (testado no backend e no E2E):**

- Só produtos **ativos** de fornecedoras com estado **APROVADA**.
- **Lista branca de campos.** Nunca saem: `sku`, `manufacturerCode`, `supplierNotes`, `stockQuantity`, `warehouse`, `minStock`,
  `viewCount`, `active`, `updatedAt`, `unspscCode`, `isFavorite`, nem `searchRank`/`destaque` da fornecedora. A disponibilidade
  vê-se em `availability`, não em stock exato.
- **Preço público:** `unitPrice`/`promoPrice` quando existem (o backend não tem um indicador «preço visível»; a
  presença do preço é o que a montra mostra). Sem preço: `null` e a interface escreve «Preço sob cotação».
- **Só leitura e sem efeitos:** não conta visualizações, não aceita `POST/PUT/PATCH/DELETE` (sem sessão → `401`), não expõe favoritos.
- `Cache-Control: public, max-age=30`. O limitador de pedidos por IP (`/api/**`) continua a aplicar-se.
- **Continuam a exigir sessão:** `/api/marketplace/*`, `/api/catalog*`, `/api/quotes`, ordens, painéis e tudo o que é empresarial
  (verificado no E2E: `401` sem cookie).

**Mudança no backend (não commitada):** `marketplace/PublicCatalogController.java` (novo), `MarketplaceService.Filtros` ganhou
`soAprovadas`, `MarketplaceController.parseFilters` passou a ter uma versão reutilizável, `security/PublicPaths` regista
`GET /api/public/catalog/**`, e `PublicCatalogControllerTest` cobre 8 cenários (campos proibidos, fornecedora não aprovada,
produto retirado, `401` nos endpoints protegidos, cache, validação).

### Rotas do frontend (todas públicas, exceto cotações)

`/` homepage · `/produtos` pesquisa e filtros · `/servicos` · `/categorias` · `/categorias/:nome` · `/fornecedores` ·
`/produto/:slug` · `/planos`, `/faq`, `/termos`, `/privacidade`. Exigem sessão: `/mercado/cotacoes`, `/conta`, `/ordens`,
`/contratos` e as áreas por perfil. Os endereços antigos `/mercado`, `/mercado/pesquisa`, `/mercado/produto/:slug` e
`/mercado/fornecedores` redirecionam para os novos.

## Endpoints usados

| Método e caminho | Quem | O que o frontend usa | Código |
|---|---|---|---|
| `GET /api/public/stats` | público | `empresasVerificadas`, `fornecedoresQualificados`, `ordensProcessadas`, `pagamentoSlaDias` | `endpoints/publico.js` |
| `GET /api/public/feedback` | público | `feedback[]`, `total`, `average` (avaliações aprovadas) | idem |
| `GET /api/planos` | público | `planos[]` (`preco`, `features`) e `taxaPorTransacao` | idem |
| `POST /api/auth/login` | público | `{ user, mfaPendente }` ou `{ requires2fa, challenge, metodo, enviadoPara }` | `endpoints/auth.js` |
| `POST /api/auth/2fa/verify` | público | `{ challenge, code }` → `{ user }` | idem |
| `POST /api/auth/2fa/reenviar` | público | `{ challenge }` → `{ enviadoPara }` | idem |
| `GET /api/auth/me` | sessão | `user` (`id, name, email, role, companyId, companyName, companyType, companyPlan, mfaPendente`) | idem |
| `POST /api/auth/logout` | sessão | — | idem |
| `POST /api/auth/forgot-password` | público | `{ email }`; resposta neutra | idem |
| `POST /api/auth/reset-password` | público | `{ token, password }` | idem |
| `GET /api/companies/invite/{token}` | público | `role`, `email`, `name` | idem |
| `POST /api/companies/invite/{token}/accept` | público | `{ name, email, password, termsAccepted }` | idem |
| `POST /api/companies/register` | público | multipart: dados da empresa, administrador, documentos (por tipo) e, em prestadoras, apólice | idem |
| `GET /api/marketplace/search` | qualquer papel | filtros abaixo; `items[]`, `total`, `page`, `pages`, `limit` | `endpoints/mercado.js` |
| `GET /api/marketplace/facets` | qualquer papel | `categories`, `kinds`, `countries`, `certifications`, `priceBounds` | idem |
| `GET /api/marketplace/suppliers` | qualquer papel | fornecedores verificados em destaque | idem |
| `GET /api/catalog/slug/{slug}` | qualquer papel | ficha completa (campos, imagens, documentos) | idem |
| `GET /api/catalog/{id}/reviews` | qualquer papel | `rating`, `comment`, `authorName`, `createdAt` | idem |
| `GET /api/quotes` | qualquer papel | comprador vê os seus; fornecedor/administrador da empresa os recebidos | `endpoints/cotacoes.js` |
| `POST /api/quotes` | **COMPRADOR** | `{ supplierCompanyId, note?, items:[{productId, quantity}] }` → 201 | idem |
| `PATCH /api/quotes/{id}/respond` | **FORNECEDOR, COMPANY_ADMIN** | `{ price>0, leadDays>=0?, note? }` | idem |
| `PATCH /api/quotes/{id}/close` | **COMPRADOR** | — | idem |

**Filtros de `GET /api/marketplace/search`:** `q`, `category`, `kind` (`PRODUTO`\|`SERVICO`), `certifications`
(lista separada por vírgulas), `availability`, `verified`, `promo`, `country`, `province`, `city`, `specialty`,
`minRating`, `minPrice`, `maxPrice`, `sort` (`relevantes`, `recentes`, `avaliacao`, `preco_asc`, `preco_desc`,
`solicitados`, `vendidos`), `page`, `limit`. Valores inválidos dão 422 com `fieldErrors`. O frontend só envia os
que a interface expõe e só se forem válidos.

**Permissões:** o frontend esconde o que o papel não pode fazer (botão "Pedir cotação" só para COMPRADOR, "Responder"
só para FORNECEDOR e COMPANY_ADMIN, "Encerrar" só para COMPRADOR). A autorização efectiva é **sempre** do backend,
que responde 403 se alguém contornar a interface.

## Endpoints da Fase 5 — áreas de trabalho por perfil

Todos verificados contra o backend Java real (base de testes descartável) e cobertos por fixtures reais
(`src/test/fixtures/`) e pelo teste de contrato `src/api/endpoints/fase5.test.js`, que falha se a resposta mudar de forma.
Camada: `src/api/endpoints/{ordens,painel,fornecedor,sistema}.js`. "Quem" é o que o **backend** impõe (`@RequireRole`).

### Ordens de compra (PoController) — `src/api/endpoints/ordens.js`

| Método e caminho | Quem | Corpo | Notas |
|---|---|---|---|
| `GET /api/purchase-orders` | todos os papéis | — | O servidor devolve só as ordens da empresa da sessão (ADMIN_SISTEMA vê todas). Lista simples, sem paginação: filtra e pagina o frontend |
| `GET /api/purchase-orders/{id}` | todos | — | Traz linhas com produto, `buyerCompany`, `supplierCompany`, `invoice` (com `payment`), `createdBy`, `approvedBy` |
| `GET /api/purchase-orders/{id}/history` | todos | — | Eventos de auditoria da ordem |
| `POST /api/purchase-orders` | COMPRADOR, COMPANY_ADMIN | `{ supplierCompanyId, items:[{productId, quantity}] }` | Cria em `AGUARDANDO_APROVACAO`. **O cliente nunca envia preços**: o servidor recalcula valor, IVA e retenção. 422 se `items` vazio |
| `PATCH …/{id}/approve` | COMPANY_ADMIN (compradora) | — | `AGUARDANDO_APROVACAO → APROVADA` |
| `PATCH …/{id}/reject` | COMPANY_ADMIN (compradora) | `{ reason? }` | `→ REJEITADA`. O backend aceita sem motivo; **a interface exige justificação** |
| `PATCH …/{id}/accept` | FORNECEDOR, COMPANY_ADMIN (fornecedora) | — | `APROVADA → AGUARDANDO_PAGAMENTO` e gera a fatura (`FAT-AAAA-NNNNNN`, vence em 7 dias); em contrato-quadro vai direto a `EM_EXECUCAO` |
| `PATCH …/{id}/refuse` | FORNECEDOR, COMPANY_ADMIN (fornecedora) | `{ reason }` | `APROVADA → RECUSADA_FORNECEDOR`. Motivo obrigatório |
| `PATCH …/{id}/dispatch` | FORNECEDOR, COMPANY_ADMIN (fornecedora) | — | `PAGA → EM_EXECUCAO` (contrato-quadro: já em execução, regista `dispatchedAt`) |
| `PATCH …/{id}/delivered` | FORNECEDOR, COMPANY_ADMIN (fornecedora) | — | `EM_EXECUCAO → ENTREGUE` |
| `PATCH …/{id}/reception` | COMPRADOR, COMPANY_ADMIN (compradora) | `{ conforme: boolean, notes? }` | `ENTREGUE → RECEBIDA_CONFORME` ou `RECEBIDA_COM_DIVERGENCIA` |
| `PATCH …/{id}/resolve-divergence` | COMPRADOR, COMPANY_ADMIN (compradora) | `{ outcome: 'ACEITE'|'REPOSICAO', notes? }` | `ACEITE → CONCLUIDA`; `REPOSICAO → EM_EXECUCAO` |

Ciclo completo percorrido na verificação ponta a ponta: emitir → aprovar → aceitar → pagar → despachar → entregar →
confirmar valor → receção com divergência → resolver → `CONCLUIDA`.

### Painéis e listas por perfil — `src/api/endpoints/painel.js`

| Método e caminho | Quem | Usado em |
|---|---|---|
| `GET /api/dashboard/comprador` | COMPRADOR | Painel do comprador (indicadores e ordens por fase) |
| `GET /api/buyer/orders` (`status`, `q`, `page`, `limit`) | COMPRADOR, COMPANY_ADMIN | Ordens do comprador (paginadas no servidor); pendentes de aprovação (`status=AGUARDANDO_APROVACAO`) |
| `GET /api/buyer/payments` · `/deliveries` · `/receptions` · `/suppliers` · `/activities` · `/profile` | COMPRADOR, COMPANY_ADMIN | Pagamentos, entregas, receções, fornecedoras, atividade, resumo do ano |
| `GET /api/company-admin/dashboard` · `/organizacao` · `/activities` · `/reports` | COMPANY_ADMIN | Painel, organização, atividade, relatórios da empresa |
| `GET` e `PUT /api/company-admin/settings` | COMPANY_ADMIN | Definições da empresa (seis interruptores guardados no servidor) |
| `GET /api/companies/users` · `PATCH /api/companies/users/{id}/status` `{active}` | COMPANY_ADMIN | Equipa: listar, ativar/desativar |
| `GET/POST /api/companies/invites` · `POST …/invites/{id}/resend` · `…/cancel` | COMPANY_ADMIN | Convites por email (`{role,name,email}`, `role ∈ COMPRADOR/FORNECEDOR/FINANCEIRO`, validade 7 dias). **Não se criam utilizadores com senha pelo frontend** (`POST /api/companies/users` existe mas não é usado) |
| `GET /api/financeiro/overview` · `/invoices` · `/payments` | FINANCEIRO, COMPANY_ADMIN | Painel e vistas do Financeiro |
| `GET /api/payments/invoices/pending` · `GET /api/payments/history` | FINANCEIRO, COMPANY_ADMIN | Faturas por pagar, histórico |
| `POST /api/payments/invoices/{id}/pay` | FINANCEIRO, COMPANY_ADMIN (compradora) | **Multipart**, campo `proof` (PDF/PNG/JPG, ≤10 MB validado no cliente). Sem ficheiro → 422 |
| `PATCH /api/payments/{id}/confirm-received` | FORNECEDOR, COMPANY_ADMIN, FINANCEIRO | Fornecedora confirma que recebeu o valor |
| `GET /api/contracts` · `GET /api/contracts/{id}` | todos | Contratos-quadro da empresa (ADMIN_SISTEMA vê todos) |

### Fornecedora — `src/api/endpoints/fornecedor.js`

| Método e caminho | Quem | Notas |
|---|---|---|
| `GET /api/catalog?supplierId=` | todos | Devolve o catálogo **de toda a plataforma**; a área da fornecedora filtra pela própria empresa. O servidor só deixa alterar produtos da própria empresa |
| `POST /api/catalog` | FORNECEDOR, COMPANY_ADMIN | Aceita JSON. Obrigatórios: `name` (≥2), `category`, `unitPrice`. Imagens/documentos (multipart) **não** estão na interface ainda |
| `PUT /api/catalog/{id}` | idem | Atualização parcial |
| `DELETE /api/catalog/{id}` | idem | **Desativa** (`active:false`), não apaga |
| `PATCH /api/catalog/{id}/stock` | idem | `{ stockQuantity?, minStock?, warehouse?, availability? }`; campos ausentes não alteram |
| `GET /api/reports/fornecedor` | FORNECEDOR, COMPANY_ADMIN | Painel: totais, ordens por estado, mais vendidos. O plano limita a janela (`janela.truncada`) |
| `GET /api/catalog/movements` · `/documents` | FORNECEDOR, COMPANY_ADMIN | Contrato verificado; sem página própria ainda |

### Admin do Sistema — `src/api/endpoints/sistema.js`

| Método e caminho | Notas |
|---|---|
| `GET /api/companies` | Todas as empresas (`type`: `CLIENTE` = Operadora, `FORNECEDOR` = Prestadora; `status`: `PENDENTE/APROVADA/REJEITADA/…`) |
| `PATCH /api/companies/{id}/decision` | `{ approve: boolean, rejectionReason? }`. A interface exige motivo ao rejeitar |
| `GET /api/admin/users` · `PATCH /api/admin/users/{id}/status` | Contas de toda a plataforma |
| `GET /api/admin/activities` | Contadores e linha de atividade |
| `GET /api/admin/audit-logs` (`page`, `limit`, `action`, `q`) | Auditoria paginada, com a lista de ações e contagens para o filtro |
| `GET /api/admin/platform-fees` | Taxas da plataforma; mostra-se só o que a API devolve |
| `GET /api/admin/prontidao` | Verificações do servidor (`ok`/`aviso`/`falha`) |

### Erros observados (backend real)

| Situação | Resposta |
|---|---|
| Papel errado | `403 FORBIDDEN` — "Esta ação requer um dos seguintes perfis: COMPANY_ADMIN." |
| Transição inválida | `409 CONFLICT` — "PO no estado "CONCLUIDA" não pode ser aprovada." |
| Recurso inexistente | `404 NOT_FOUND` — "Ordem de compra não encontrado." (a frase vem assim do servidor) |
| Corpo inválido | `422 VALIDATION_ERROR` com `details.fieldErrors` (mensagens do Zod em inglês, p.ex. "Array must contain at least 1 element(s)") |
| Pagar sem comprovativo | `422 VALIDATION_ERROR` — "Anexe o comprovativo da transferência (PDF ou imagem)…" |
| Convidar para além do plano | `400 PLANO_INSUFICIENTE` (`details.planoNecessario`) — "O plano CORE inclui 5 lugares (utilizadores). Já tem 5. O plano PRO aumenta este limite." |

A interface mostra sempre a mensagem do servidor (nunca a esconde nem finge sucesso) e mantém o diálogo aberto para a pessoa corrigir.

### Regras de apresentação por papel (a autorização efetiva é do backend)

| Papel | Pode fazer na interface | Não herda |
|---|---|---|
| COMPRADOR | Requisição → emitir ordem; receção e resolução de divergência; pedir cotação; ver pagamentos/entregas | Aprovar, pagar |
| COMPANY_ADMIN | Aprovar/rejeitar ordens; equipa e convites; organização, atividade, relatórios, definições; como administrador de uma **fornecedora** também aceita/recusa/despacha/entrega e gere o catálogo | Comprar, receber, pagar (o backend permitiria `pay` e `buyer/*`; a interface não os oferece por omissão) |
| FORNECEDOR | Aceitar/recusar/despachar/entregar; catálogo e stock; faturas e confirmar receção do valor; responder a cotações | Qualquer área da compradora |
| FINANCEIRO | Pagar faturas com comprovativo; histórico e indicadores | Aprovar, comprar |
| ADMIN_SISTEMA | Credenciar empresas; contas; auditoria, taxas, prontidão; ver ordens e contratos | Atuar em ordens de uma empresa |

## Dependências do backend (documentadas; não simuladas)

| Necessidade do plano | Situação | O que o frontend faz |
|---|---|---|
| Catálogo e fornecedoras **públicos** (sem login) | **Resolvido:** `GET /api/public/catalog/*` (ver secção acima). Cotações continuam a exigir sessão | A homepage, categorias, pesquisa, serviços, fornecedoras e fichas são públicas |
| Pedido de cotação em texto livre («O que precisa?») | Não existe: `POST /api/quotes` exige fornecedora e produtos concretos | A área «Peça uma cotação» explica o processo e leva ao catálogo ou ao registo; não finge enviar |
| Perfil público de fornecedora com catálogo próprio (`/fornecedores/:id`) | Não existe endpoint de perfil | O cartão da fornecedora leva à pesquisa pelo nome dela (`/produtos?q=…`) |
| Fotografia por categoria | A API não a tem | Usa a fotografia do primeiro produto da categoria; sem imagem, um ícone |
| Directório completo de fornecedoras | `GET /api/public/catalog/suppliers` devolve até 24, sem paginação nem pesquisa própria | Mostra essa lista e encaminha a pesquisa por nome para o catálogo (o nome é pesquisável em `q`) |
| Perfil público do fornecedor (descrição, certificações, documentos, contactos) | Não existe endpoint | A ficha do produto mostra o que vem no produto (nome, verificado, localização, certificações do produto) |
| Pesquisa por fabricante, SKU e referência comercial | O `search_text` cobre nome, descrição, categoria, especialidade, marca, modelo, título UNSPSC, cidade, palavras-chave, etiquetas e nome do fornecedor; **não** cobre `manufacturer`, `sku` nem `manufacturerCode` | Pesquisa por marca, categoria, serviço e fornecedor; não promete fabricante/referência |
| Filtro por marca como parâmetro próprio | Não existe (só via `q`) | Sem filtro de marca |
| `GET /api/catalog` com paginação | Devolve lista inteira | Usa `marketplace/search`, que pagina |
| Papel MANAGER | Não existe (5 papéis: COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA) | O COMPANY_ADMIN é o aprovador, conforme decidido |
| Lista de faturas da fornecedora | Não existe: a fatura só vem na ficha de cada ordem (`GET /api/purchase-orders/{id}`) | "Faturas" da fornecedora carrega a ficha das ordens aceites (máx. 30, em paralelo). Com muitas ordens precisa de um endpoint próprio |
| Pagamentos/entregas **da fornecedora** (listas agregadas) | `/api/buyer/*` é só do lado comprador | A fornecedora usa a lista de ordens e a ficha de cada uma |
| Aprovação com limite de valor (`approvalCap`) e limites de orçamento | O utilizador traz `approvalCap`; a regra é aplicada pelo servidor ao aprovar | Não replica a regra: mostra o erro do servidor |
| Decisões de aprovação por utilizador / motivo da aprovação | O histórico só guarda a justificação da **rejeição** (`rejectionReason`); a aprovação não tem campo de motivo | O histórico de decisões mostra data, decisão e justificação da rejeição |
| Exportar relatórios (PDF/CSV/Excel) | `company-admin/reports` devolve só números e um catálogo de nomes | Mostra os números; não finge exportação |
| Imagens e documentos técnicos do catálogo (multipart) | Existem (`POST /api/catalog/{id}/image`, `/media`) | Não incluídos na interface da Fase 5 (a ficha mostra as imagens já existentes) |
| Notificações em tempo real, chat e suporte (STOMP/WebSocket) | Existem (`/ws`) | Fora do âmbito desta entrega; o proxy `/ws` está pronto |
| Cesta/checkout de várias fornecedoras numa só ordem | Uma ordem tem **uma** fornecedora | A requisição agrupa por fornecedora e emite uma ordem por grupo |
| Mensagens de validação em português | O Zod do backend devolve texto em inglês em `fieldErrors` | A interface valida antes de enviar; mostra o texto do servidor só se escapar |
| Criar contrato-quadro / consolidar faturação | `POST /api/contracts`, `…/consolidate-billing` existem | Contratos só em leitura nesta entrega |
| Paginação em `GET /api/purchase-orders` | Devolve a lista inteira | Filtra e pagina no cliente (15 por página) |
| Comissão de 1,5 % | Não existe; a Taxa KIXIMA é 8 USD/PO + 15 USD/fatura, e 0,20 % acima do limiar (valores da API) | Mostra apenas o que `GET /api/planos` devolve |

**Verificado no backend real:** `GET /api/catalog/slug/{slug}` com um slug inexistente devolve `404` com `{ error: { code: "NOT_FOUND", message: "Produto não encontrado." } }`, que a ficha trata com "Produto não encontrado".
