# Ambiente de teste isolado do frontend (sem backend real)

Para ver e experimentar o frontend **sozinho**, antes de o ligar ao backend Java. É um serviço à parte, com um aviso visível em
todos os ecrãs («Ambiente de teste isolado»), que usa uma **API simulada**. A ligação ao backend real (`render.yaml`,
`DEPLOY-RENDER.md`) não é afetada: este ambiente pode ser criado e apagado à vontade.

```
Browser ──https──▶ kixima-marketplace-teste (nginx, o mesmo da produção) ──localhost──▶ API simulada (Node)
```

## O que a API simulada é, e o que não é

| É | Não é |
|---|---|
| Respostas **reais** do backend Java, capturadas numa base de testes (`src/test/fixtures`), com a mesma forma, os mesmos erros e a mesma mensagem de permissões (`403 FORBIDDEN`, `409 CONFLICT`, `422 VALIDATION_ERROR`…) | O backend: não aplica as regras reais de negócio (preços finais, IVA, retenções, limites de plano, permissões finas por área, 2FA, emails, auditoria completa, AGT) |
| Estado **em memória**: o que fizer (emitir, aprovar, pagar, convidar, criar produtos…) mantém-se até o serviço reiniciar, e volta ao início | Persistente: nada fica guardado depois de reiniciar |
| Sessão por cookie `httpOnly`, 401 sem sessão, 403 por papel | Seguro como produção: só serve para testar a interface |

Simulado e com estado: login e sessão, montra pública (pesquisa, filtros, facetas, fichas), ordens de compra (emitir, aprovar, rejeitar,
aceitar, recusar, despachar, entregar, receção, divergência, histórico), faturas e pagamentos com comprovativo, confirmação do valor, cotações,
catálogo da fornecedora (criar, editar, stock, retirar), equipa e convites, credenciamento de empresas e auditoria das ações feitas.
Os painéis agregados (relatórios, atividade, indicadores) são **instantâneos fixos**, exceto ordens, aprovações, faturas e pagamentos,
que são recalculados. O que o frontend chame e não esteja simulado responde `404 NAO_SIMULADO` (nunca finge).

Os dados são a **demonstração do backend** (empresas «Petro Angola Operações» e «Fornecedora Industrial Kianda»); as empresas e contas criadas
pelos testes automáticos («Teste E2E») são filtradas e não aparecem.

## Utilizadores de teste

Um por papel; a palavra-passe é a que **você** definir em `DEMO_SENHA` (não existe valor por omissão e não está no repositório).

| Papel | Email | O que testar |
|---|---|---|
| Comprador | `comprador@petroangola.co.ao` | catálogo → requisição → emitir ordem; receção; cotações |
| Administrador da empresa | `admin@petroangola.co.ao` | aprovar/rejeitar (com justificação), equipa e convites |
| Fornecedora | `fornecedor@kianda.co.ao` | aceitar/recusar, despachar, entregar, catálogo, faturas |
| Financeiro | `financeiro@petroangola.co.ao` | pagar fatura com comprovativo, histórico |
| Admin do Sistema | `admin@kixima.co.ao` | credenciar empresas, auditoria, utilizadores |

## Correr no Render (um serviço à parte)

1. Render → **New → Blueprint** → este repositório → em *Blueprint file path* escreva `render.teste.yaml`.
2. Defina `DEMO_SENHA` (a palavra-passe de teste que quiser).
3. Abra o endereço do serviço. O plano gratuito dorme com a inatividade: o primeiro pedido demora.
4. Quando acabar: apague o serviço. O deploy real (`render.yaml`) é independente.

## Correr no seu computador

```bash
npm install
npm run build                      # produção; para ver o aviso de teste: VITE_AMBIENTE_TESTE=1 npm run build
DEMO_SENHA=a-sua-senha npm run simulador          # API simulada em http://127.0.0.1:4100
API_PROXY_TARGET=http://localhost:4100 npm run dev # frontend em http://localhost:5174 a falar com o simulador
```

Com o nginx da produção (como no Render): `BACKEND_HOSTPORT=127.0.0.1:4100 deploy/testar-local.sh 8080` depois de
`VITE_AMBIENTE_TESTE=1 npm run build` e de arrancar o simulador.

## Roteiro de teste sugerido (ponta a ponta)

1. **Visitante:** homepage → pesquisar «válvula» → filtrar → categoria → ficha → «Entrar para pedir cotação» (volta à mesma ficha após o login).
2. **Comprador:** ficha → *Adicionar à requisição* → *Emitir ordem de compra* (fica «A aguardar aprovação»).
3. **Administrador da empresa:** *Aprovações* → rejeitar sem justificação (é bloqueado) → aprovar.
4. **Fornecedora:** abrir a ordem → *Aceitar ordem* (surge a fatura).
5. **Financeiro:** *Faturas por pagar* → *Pagar* sem comprovativo (é bloqueado) → com comprovativo.
6. **Fornecedora:** *Registar despacho* → *Marcar como entregue* → *Confirmar receção do valor*.
7. **Comprador:** *Registar receção* com divergência → *Resolver divergência*.
8. **Admin do Sistema:** *Auditoria* mostra as ações; *Empresas* → registar uma empresa pela página pública e decidi-la.
9. Repetir em telemóvel (largura 390 px) e nos três fundos (Claro, Escuro 1, Escuro 2).

## Verificação feita

- `teste-isolado/api-simulada.test.js` (22 testes): login e palavra-passe, permissões por papel, montra sem campos internos, ciclo completo da
  ordem com os mesmos erros do backend, cotações, catálogo, convites, credenciamento, auditoria, estado independente por instância.
- Os três percursos ponta a ponta (cada papel, montra pública, sessão/CSP através do nginx) passam contra este ambiente, e o aviso de teste
  fica visível, sem problemas de acessibilidade nem rolagem horizontal, em 3 fundos e em ecrã largo e telemóvel.
- A imagem Docker (`Dockerfile.teste`) não foi construída aqui (sem Docker); o nginx, o simulador e os scripts foram testados fora de contentor.

## Quando passar à integração

Siga `DEPLOY-RENDER.md` (backend Java privado + frontend). O frontend é o mesmo; só muda o que está atrás de `/api`.
