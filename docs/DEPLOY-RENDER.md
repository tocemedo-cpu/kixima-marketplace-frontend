# Implantação na fase atual: tudo no Render (frontend + backend Java), mesmo domínio

```
Browser ──https──▶ kixima-marketplace (web: nginx + frontend) ──rede privada──▶ kixima-backend (serviço privado: Java) ──▶ base de dados
   um só endereço público                  /api  /ws                          sem endereço público
```

- **`kixima-marketplace`** é o único serviço com endereço público. Serve o frontend e encaminha `/api` e `/ws` para o backend,
  por isso o cookie de sessão (`httpOnly; Secure; SameSite=Lax`) fica na mesma origem e não há CORS.
- **`kixima-backend`** é o backend Java do repositório `kixima-backend-java`, como **serviço privado**: ninguém na internet lhe
  chega diretamente, e o tráfego entre os dois não sai da rede interna do Render (por isso não há TLS nem segredo partilhado
  entre eles, ao contrário do cenário com VPS em `DEPLOY-RENDER-VPS.md`).
- Tudo está descrito num único `render.yaml` (Blueprint), neste repositório.

O que **não** é Render, porque o Render não o oferece ou o backend o exige: o **armazenamento S3** (ver 2) e o **email**
(API HTTP do Brevo, porque o Render bloqueia o SMTP de saída). A base de dados pode ser a atual ou uma do Render (ver 3).

## 1. Pré-requisitos

1. Conta no Render com acesso GitHub aos **dois** repositórios: `tocemedo-cpu/kixima-marketplace-frontend` e
   `tocemedo-cpu/kixima-backend-java` (Render → Account Settings → GitHub).
2. O `main` do backend tem de ter o commit dos endpoints públicos do catálogo (`11be546` ou posterior).
3. O domínio público (por exemplo `marketplace.exemplo.ao`) para apontar ao Render.
4. **Custo:** serviços privados não existem no plano gratuito. O blueprint usa o plano `starter` nos dois serviços (o Java precisa de
   pelo menos 512 MB; a JVM é limitada a 70 % da memória do contentor).

## 2. Armazenamento S3 (obrigatório em produção)

Em perfil `prod` o backend **recusa arrancar** sem `STORAGE_PROVIDER=s3` e credenciais. Guarda os comprovativos de pagamento,
os documentos do registo de empresas e as imagens do catálogo. Use qualquer serviço S3-compatível (Supabase Storage, Cloudflare R2,
AWS S3…): crie um *bucket* **privado** e preencha `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` e, se não for AWS,
`STORAGE_ENDPOINT` e `STORAGE_REGION`. (Se quiser mesmo ter também isto no Render, a alternativa é um MinIO como serviço privado com
disco persistente: fica para uma fase seguinte, porque exige criar o *bucket* e o backend ainda não foi testado contra ele neste desenho.)

## 3. Base de dados

O backend precisa de `DATABASE_URL_JDBC`, `DATABASE_USER` e `DATABASE_PASSWORD`.

- **A base que já usa (por exemplo o Supabase):** use a ligação por *pooler de sessão* (porta 5432) e preencha os três valores no
  painel. O Render só hospeda os serviços. O formato é `jdbc:postgresql://<host>:5432/<base>?sslmode=require`.
- **Uma base nova do Render (PostgreSQL):** crie-a na mesma região (`frankfurt`) e use o *Internal Database URL* para compor
  `jdbc:postgresql://<host interno>:5432/<base>`. **Atenção:** uma base nova está **vazia**: o backend cria o esquema (com
  `FLYWAY_ENABLED=true` no primeiro arranque), mas **não cria utilizadores nem o primeiro administrador**. Tem de restaurar os dados
  (`pg_dump` da base atual) ou ter um mecanismo de arranque de utilizadores.

## 4. Passo a passo

1. Render → **New → Blueprint** → escolha `kixima-marketplace-frontend` (lê o `render.yaml`).
2. O Render pede os valores marcados `sync: false`:

| Serviço | Variável | Valor |
|---|---|---|
| backend | `APP_URL` | `https://marketplace.exemplo.ao` (entra nos links dos emails: `/convite/:token`, `/recuperar/:token`) |
| backend | `CORS_ORIGINS` | o mesmo domínio público |
| backend | `DATABASE_URL_JDBC`, `DATABASE_USER`, `DATABASE_PASSWORD` | ver 3 |
| backend | `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_ENDPOINT`, `STORAGE_REGION` | ver 2 |
| backend | `EMAIL_FROM`, `BREVO_API_KEY` | remetente **verificado** no Brevo e a chave da API |

   `JWT_SECRET` é gerado pelo Render. As restantes variáveis que já usa (limites, AGT, bancos, etc.) acrescentam-se em *Environment*
   do serviço `kixima-backend`; o blueprint não as apaga.
3. Aguarde o deploy do backend; depois o do frontend (o frontend recebe do Render o endereço interno do backend em `BACKEND_HOSTPORT`).
4. `kixima-marketplace` → **Settings → Custom Domains** → `marketplace.exemplo.ao` e crie o registo DNS indicado. O HTTPS é do Render.

## 5. Verificar no primeiro deploy

1. `https://marketplace.exemplo.ao/healthz` → `ok`.
2. `https://marketplace.exemplo.ao/backend-health` → `200`. Se der `502`: veja os logs do `kixima-backend` (provavelmente falta uma
   variável obrigatória, ou a base não responde) e os do frontend (nome interno do backend).
3. **Nome interno do backend.** No arranque o contentor do frontend regista a linha `Backend na rede privada do Render: http://…`.
   O nginx resolve esse nome com o DNS do contentor. Se o `/backend-health` falhar com «could not be resolved» nos logs, defina no
   frontend `BACKEND_ORIGIN=http://<endereço interno completo do backend>` e `BACKEND_HOST` com o nome (apagando `BACKEND_HOSTPORT`);
   o endereço aparece em `kixima-backend → Info → Internal address`. *Este é o único ponto que não consegui simular fora do Render.*
4. **IP do cliente.** Abra o site a partir de dados móveis e veja nos *Logs* do frontend a linha do seu pedido: o primeiro campo
   deve ser o seu IP público. Se for um IP do Render, acrescente esse intervalo em `REAL_IP_EXTRA` (um CIDR) e volte a fazer deploy.
   Sem isto, todos os utilizadores partilhariam o limite de pedidos do backend (600 pedidos e 60 tentativas de login por 15 minutos).
5. Entre com um utilizador: o cookie `kixima_sessao` fica `Secure`, `HttpOnly`, `SameSite=Lax`, e a sessão mantém-se ao recarregar.
6. Submeta um registo de empresa com documentos e pague uma fatura com comprovativo (confirma o armazenamento S3 e o limite de 25 MB).
7. Abra uma ligação direta, por exemplo `/categorias/Válvulas`: deve abrir o site.
8. Um email de convite ou de recuperação de senha chega com o link para o domínio público (confirma `APP_URL` e o Brevo).

## 6. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Backend não arranca | Falta `STORAGE_*`, base inacessível, ou `APP_URL`/`CORS_ORIGINS` por definir (a guarda de produção diz qual) |
| `/api/...` dá `503 SERVICO_INDISPONIVEL` | O backend ainda está a arrancar, ou caiu: veja os seus logs |
| Login funciona e a sessão perde-se | Site aberto em `http://` (o cookie é `Secure`) ou `APP_URL` diferente do domínio público |
| «Demasiados pedidos» para toda a gente | O IP do cliente não chega ao backend: passo 5.4 |
| Emails não chegam | `EMAIL_FROM` não está verificado no Brevo, ou falta `BREVO_API_KEY` |
| `kixima-backend` não aparece no Blueprint | O Render não tem acesso ao repositório `kixima-backend-java` |

## 7. Reverter

No Render, *Manual Deploy → Rollback* em cada serviço. Para voltar a um estado anterior ao blueprint, suspenda o serviço.

## 8. Passar mais tarde para a VPS

Quando o backend for para a VPS, no `render.yaml` apague o serviço `kixima-backend` e, no serviço `kixima-marketplace`, troque
`BACKEND_HOSTPORT` por `BACKEND_ORIGIN`, `BACKEND_HOST` e `ORIGEM_SEGREDO`. O resto (proxy com TLS, segredo, IP do cliente) está em
[`DEPLOY-RENDER-VPS.md`](DEPLOY-RENDER-VPS.md). O frontend não muda.

## 9. Testar localmente

```bash
npm run build
BACKEND_HOSTPORT=127.0.0.1:4001 deploy/testar-local.sh 8080     # nginx com o mesmo template e o mesmo script de ambiente
docker build -t kixima-marketplace . && docker run --rm -p 8080:10000 -e BACKEND_HOSTPORT=host.docker.internal:4001 kixima-marketplace
```
