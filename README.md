# KIXIMA Marketplace 2.0 — frontend

Plataforma B2B de procurement industrial para Angola. Frontend **React 18 + Vite 5** sobre o **backend Java
(Spring Boot) existente**, que continua a ser a única fonte de dados, autenticação e permissões. Este repositório é
independente do `kixima-frontend-java` (que serve só de referência e não é alterado).

> **Estado: Fases 4 a 7 + homepage de marketplace público — catálogo à vista sem login, autenticação e áreas de trabalho por perfil.** Funciona contra o
> backend Java real (`docs/API-USADA.md` lista cada endpoint, permissão, erro e dependência em falta). O catálogo do
> sistema de design (Fase 3) está em `/design`, só em desenvolvimento.

## Testar o frontend sozinho (sem backend)

O frontend pode ser experimentado isoladamente, com uma API simulada e um aviso visível («Ambiente de teste isolado»): ver
[`docs/TESTE-ISOLADO.md`](docs/TESTE-ISOLADO.md) (`npm run simulador`, `render.teste.yaml`, roteiro de teste por papel).

## Homepage e catálogo públicos

Qualquer visitante, sem conta, abre a homepage, pesquisa, filtra, vê categorias, serviços, fornecedoras verificadas e a ficha
de cada produto. A autenticação só é pedida nas operações empresariais (cotações, requisição, ordens e painéis). A homepage segue
a estrutura aprovada: **1** cabeçalho horizontal (logótipo, pesquisa central, entrar, registar empresa) · **3** navegação
(Categorias, Produtos, Serviços, Fornecedoras, Cotações, Planos, Ajuda) · hero com categorias, mensagem e cotação · **4** categorias
· **5** produtos em destaque · **6** publicados recentemente · **7** fornecedoras verificadas · **8** serviços industriais · **9** faixa de
cotação · **10** confiança e vantagens · **11** rodapé. Uma secção sem dados desaparece: nada é inventado.

| Rota | O que mostra |
|---|---|
| `/` | Homepage |
| `/produtos`, `/servicos` | Pesquisa com filtros, ordenação, vista em grelha/lista e paginação (estado na URL) |
| `/categorias`, `/categorias/:nome` | Todas as categorias; página de uma categoria |
| `/fornecedores` | Fornecedoras verificadas |
| `/produto/:slug` | Ficha do produto; visitantes veem «Entrar para pedir cotação» |

Estas páginas usam os endpoints novos `GET /api/public/catalog/*` do backend Java (ver `docs/API-USADA.md`).

## Áreas de trabalho por perfil (Fase 5)

Depois do login cada papel aterra no seu painel. O menu horizontal muda com o papel e **os papéis não herdam menus
uns dos outros**; cada rota está protegida por `RequireRole` e, acima de tudo, pelo backend (403/409 aparecem como mensagem).

| Papel (backend) | Rótulo | Rotas |
|---|---|---|
| `COMPRADOR` | Comprador (operadora) | `/comprador` painel · `/comprador/requisicao` · `/comprador/ordens` · `/comprador/pagamentos` · `/comprador/entregas` · `/comprador/rececoes` · `/comprador/fornecedores` · `/comprador/atividade` |
| `COMPANY_ADMIN` | Administrador da empresa (**aprovador**) | `/empresa` painel · `/empresa/aprovacoes` (com histórico de decisões e justificação) · `/empresa/utilizadores` (equipa e convites) · `/empresa/organizacao` · `/empresa/atividade` · `/empresa/relatorios` · `/empresa/definicoes` |
| `FORNECEDOR` (e `COMPANY_ADMIN` de uma prestadora) | Prestadora e fornecedora | `/fornecedor` painel · `/fornecedor/catalogo` (criar, editar, stock, retirar) · `/fornecedor/faturas` |
| `FINANCEIRO` | Financeiro | `/financeiro` painel · `/financeiro/faturas` (pagar com comprovativo) · `/financeiro/pagamentos` |
| `ADMIN_SISTEMA` | Admin do Sistema KIXIMA | `/sistema` painel · `/sistema/empresas` (credenciamento) · `/sistema/utilizadores` · `/sistema/auditoria` · `/sistema/taxas` · `/sistema/prontidao` |
| todos | partilhadas | `/ordens` lista · `/ordens/:id` ficha com as ações permitidas ao papel e ao estado · `/contratos` |

A ficha da ordem (`/ordens/:id`) é o centro do fluxo: aprovar/rejeitar, aceitar/recusar, despachar, entregar, receção
conforme ou com divergência, resolver divergência, confirmar o valor recebido. As ações oferecidas dependem do papel,
da empresa (compradora ou fornecedora) e do estado (`src/features/ordens/acoes.js`, com testes). Os valores
(preços, IVA, retenções, totais) vêm sempre do servidor; o cliente só envia produto e quantidade.

## Páginas (Fase 4)

| Zona | Rotas | Dados |
|---|---|---|
| Vitrine pública | `/`, `/planos`, `/faq`, `/termos`, `/privacidade` | `GET /api/public/stats`, `/api/public/feedback`, `/api/planos` |
| Autenticação | `/login` (com 2FA), `/cadastro`, `/convite/:token`, `/recuperar`, `/recuperar/:token` | `/api/auth/*`, `/api/companies/register`, `/api/companies/invite/*` |
| Marketplace (com sessão) | `/mercado`, `/mercado/pesquisa`, `/mercado/produto/:slug`, `/mercado/fornecedores`, `/mercado/cotacoes`, `/conta` | `/api/marketplace/*`, `/api/catalog/*`, `/api/quotes` |

Os caminhos `/convite/:token` e `/recuperar/:token` são os que o backend põe nos emails: não se mudam. Todos os
endpoints usados, as permissões e as dependências do backend estão em [`docs/API-USADA.md`](docs/API-USADA.md).

**Não migrado ainda do frontend original** (fica para as fases seguintes ou pedido seu): Supplier Development e
Parcerias, Notícias, Carreiras, Recursos, EN/FR, cesta e checkout, comparação de fornecedores, favoritos e pesquisas
guardadas, notificações e chat em tempo real, e todas as áreas por perfil.

## Como correr

```bash
npm install
npm run dev        # http://localhost:5174 — catálogo do sistema de design em /design
npm test           # vitest: API, autenticação, páginas por papel, componentes, temas, contraste WCAG AA
npm run build      # build de produção em dist/
```

O servidor de desenvolvimento reencaminha `/api` e `/ws` para o backend Java (`http://localhost:4001` por omissão),
mantendo a mesma origem — o cookie de sessão `httpOnly` funciona sem CORS. Para outro anfitrião:

```bash
API_PROXY_TARGET=http://192.168.1.20:4001 npm run dev
```

Contra o backend Java local lembre-se de o arrancar com o perfil `dev` (`SPRING_PROFILES_ACTIVE=dev`), senão o CORS
fica restrito como em produção. Não há segredos nem credenciais neste repositório.

**Produção:** a sessão é um cookie `httpOnly`, por isso o frontend é servido na MESMA origem da API. O repositório traz o
`Dockerfile`, o nginx (`deploy/`) e o `render.yaml`. Fase atual, **tudo no Render** (frontend + backend Java privado): ver
[`docs/DEPLOY-RENDER.md`](docs/DEPLOY-RENDER.md). Backend na VPS (fase seguinte):
[`docs/DEPLOY-RENDER-VPS.md`](docs/DEPLOY-RENDER-VPS.md). O backend precisa de `APP_URL`/`CORS_ORIGINS` com o domínio real. As imagens do catálogo (`/catalog/*.jpg`, referenciadas pela base de dados)
vivem em `public/catalog/` e são servidas pelo próprio frontend.

## Estrutura

```
src/
  design/    temas.css (os 3 fundos), tokens.css (tokens semânticos), base.css, TemaContext.jsx, testes de contraste
  ui/        componentes: Button, Field/Input/Select/Textarea/Checkbox/Switch, Card, Badge, Alert, Table, Tabs,
             Pagination, Modal/ConfirmDialog, Toast, Skeleton/Spinner/EmptyState/ErrorState, Breadcrumb, Logo, Icon, Fio
  layout/    TopBar (navegação horizontal + pesquisa + gaveta móvel), Footer, Shell
  pages/     CatalogoDeComponentes (Fase 3)
  assets/brand/  logótipo oficial (mestres 460x410 e cópias de 240 px usadas na interface)
public/      tema-init.js (aplica o fundo guardado antes do primeiro paint; ficheiro externo por causa da CSP)
```

## Regras do sistema de design

- **Os componentes só usam tokens semânticos** (`--kx-*`, em `design/tokens.css`), nunca as cores cruas de
  `temas.css`. Um fundo novo ou um ajuste de contraste é uma alteração só em `temas.css`.
- **Três fundos** — Claro, Escuro 1, Escuro 2 — do Manual de Marca v1.0 (Proposta 04 · Bancada). Sem escolha guardada
  segue o `prefers-color-scheme`; a escolha vive em `localStorage` (`kixima.tema`) e em `<html data-tema>`.
- **Contraste WCAG AA** garantido por teste: `src/design/contraste.test.js` lê os valores reais de `temas.css` e falha
  se algum par de texto deixar de ter 4,5:1 (3:1 para o anel de foco).
- **Marca:** só os activos oficiais. O logótipo segue o fundo (normal no Claro, invertido nos Escuros); a barra
  superior e o rodapé usam sempre o invertido. O **fio Samakaka** (4 px, losangos vermelho / ocre / marfim / vermelho)
  está em `--kx-samakaka` e não se altera.
- **O ocre é decorativo**: nunca como cor de texto sobre fundo claro (não passa AA).
- **Acessibilidade:** foco visível em tudo, ligação "saltar para o conteúdo", alvos tácteis ≥ 44 px, diálogos com
  foco preso, `prefers-reduced-motion` respeitado, tabelas que viram cartões no telemóvel.
- **Tipografia:** Sora (títulos), Inter (corpo), IBM Plex Mono (referências e cabeçalhos de tabela), self-hosted via
  `@fontsource` — sem CDN externo.

## Dependências (justificação)

| Pacote | Para quê |
|---|---|
| `react`, `react-dom`, `react-router-dom` | base da aplicação (mesmas versões do frontend original) |
| `@fontsource*` | fontes da marca, self-hosted |
| `vite`, `@vitejs/plugin-react` | build e servidor de desenvolvimento |
| `vitest` (3.x), `jsdom`, `@testing-library/*` | testes de componentes. O vitest 3 é o que suporta o Vite 5 em uso; o 4 pede Vite ≥ 6 |

Nenhuma outra dependência foi acrescentada (sem biblioteca de UI, de estado, de formulários ou de ícones).

## Decisões já tomadas

- O catálogo, a pesquisa, as categorias, os serviços, as fornecedoras e as fichas são **públicos** (endpoints novos
  `GET /api/public/catalog/*`, só leitura, lista branca de campos). As **cotações** e tudo o que é empresarial exigem login.
- O `COMPANY_ADMIN` é o aprovador de requisições e ordens (não existe papel MANAGER no sistema).
- Os papéis são os do backend: `COMPRADOR`, `COMPANY_ADMIN`, `FORNECEDOR`, `FINANCEIRO`, `ADMIN_SISTEMA`.
- Nenhum valor de taxa fica escrito no código: mostra-se apenas o que a API devolver.
