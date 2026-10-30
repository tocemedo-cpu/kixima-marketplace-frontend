# Implantação (fase seguinte, opcional): frontend no Render + backend Java na VPS, no mesmo domínio

> **A fase atual é só Render:** ver [`DEPLOY-RENDER.md`](DEPLOY-RENDER.md). Este guia aplica-se quando o backend passar para a VPS.

```
Browser ──https──▶ Render (marketplace.exemplo.ao) ──▶ nginx (Docker) ──https──▶ VPS (origem.exemplo.ao) ──▶ Java :4001
                                  serve o frontend         /api  /ws             proxy com TLS                 PostgreSQL
```

O frontend usa caminhos relativos (`/api/...`) e a sessão é um cookie `httpOnly; Secure; SameSite=Lax`. Por isso o browser tem de
ver **uma só origem**. O serviço Web do Render (nginx num contentor Docker) serve o build e encaminha `/api` e `/ws` para a VPS.
Um *Static Site* do Render não serve: o Render não documenta que as reescritas reencaminhem `POST`, cabeçalhos e cookies, e
não faz WebSocket.

Tudo o que está neste guia foi **testado** com o mesmo template do nginx contra o backend Java real (login de cada papel,
cookie, recarregar, ligação direta a rotas, CSP sem violações, backend em baixo, WebSocket, IP do cliente) e com o backend em
perfil `prod` (cookie `Secure`, CORS com o domínio público). O que não se pode testar fora do Render/VPS está marcado como
**verificar no primeiro deploy**.

## 1. Domínios

| Nome | Aponta para | Para quê |
|---|---|---|
| `marketplace.exemplo.ao` (o domínio que as pessoas usam) | Render | Site e API, mesma origem |
| `origem.exemplo.ao` | IP da VPS | Só o Render fala com ele (TLS obrigatório) |

Troque `exemplo.ao` pelo seu domínio. O nome de origem **não** é o domínio público: é uma porta de serviço entre o Render e a VPS.

## 2. VPS: backend e proxy com TLS

### 2.1 Variáveis do backend (perfil `prod`)

| Variável | Valor |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `PORT` | `4001` (só escuta em localhost; feche a porta ao exterior) |
| `DATABASE_URL_JDBC`, `DATABASE_USER`, `DATABASE_PASSWORD` | os da sua base PostgreSQL |
| `JWT_SECRET` | segredo longo e aleatório (o backend recusa valores fracos) |
| `APP_URL` | `https://marketplace.exemplo.ao` (entra nos links dos emails: `/convite/:token`, `/recuperar/:token`) |
| `CORS_ORIGINS` | `https://marketplace.exemplo.ao` |
| `STORAGE_PROVIDER=s3`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` (+ `STORAGE_ENDPOINT`, `STORAGE_REGION` se não for AWS) | **obrigatórias em produção**: sem elas o backend não arranca (guarda de arranque). Servem os comprovativos, documentos de registo e imagens |

Mantenha as restantes variáveis que já usa (email, planos, etc.). Esta versão do backend **não traz migrações novas**.
Os valores de segredos nunca vão para o repositório.

### 2.2 Proxy com TLS na VPS (nginx)

O tráfego Render → VPS atravessa a internet: **tem de ser HTTPS** (o nginx do Render recusa-se a arrancar com `http://`
e valida o certificado). Certificado, por exemplo com `certbot --nginx -d origem.exemplo.ao`.

```nginx
server {
  listen 443 ssl;
  http2 on;
  server_name origem.exemplo.ao marketplace.exemplo.ao;   # o Render repassa o Host do domínio público
  # ssl_certificate / ssl_certificate_key: os do certbot para origem.exemplo.ao

  # Só aceita pedidos do nginx do Render (o segredo é o mesmo que ORIGEM_SEGREDO no Render).
  # Sem isto, qualquer pessoa a falar diretamente com a origem poderia forjar o X-Forwarded-For.
  if ($http_x_origem_segredo != "COLE-AQUI-O-SEGREDO") { return 403; }

  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:4001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    # PASSA o X-Forwarded-For tal como veio do Render (um só endereço: o do cliente). NÃO use $proxy_add_x_forwarded_for:
    # acrescentaria o IP do Render e o limitador do backend (que usa o último salto) trataria todos os utilizadores como um só.
    proxy_set_header X-Forwarded-For $http_x_forwarded_for;
    proxy_set_header X-Real-IP $http_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Connection "";
  }
  location /ws { proxy_pass http://127.0.0.1:4001; proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";
    proxy_set_header Host $host; proxy_read_timeout 3600s; }
}
```

Firewall: abra só 80/443 (e SSH). Opcional: restrinja o 443 aos IPs de saída do Render da sua região (publicados na documentação
do Render), além do segredo.

## 3. Render

1. **New → Web Service** apontando para o repositório `kixima-marketplace-frontend` com *Runtime: Docker* e *Health Check Path*
   `/healthz` (ou use o `render.yaml` depois de apagar o serviço `kixima-backend` e de trocar `BACKEND_HOSTPORT` pelas variáveis abaixo).
2. Variáveis de ambiente do serviço:

| Variável | Exemplo | Notas |
|---|---|---|
| `BACKEND_ORIGIN` | `https://origem.exemplo.ao` | HTTPS, **sem barra final** |
| `BACKEND_HOST` | `origem.exemplo.ao` | só o nome (SNI e validação do certificado) |
| `ORIGEM_SEGREDO` | valor longo e aleatório | o mesmo que no nginx da VPS; gere com `openssl rand -hex 32` |
| `REAL_IP_EXTRA` | `127.0.0.1` | só altere se o passo 5.3 o pedir |

   Sem `BACKEND_ORIGIN`/`BACKEND_HOST` (e sem `BACKEND_HOSTPORT`) o contentor recusa-se a arrancar com uma mensagem clara; com `http://` também.
3. **Settings → Custom Domains**: adicione `marketplace.exemplo.ao` e crie o registo DNS que o Render indicar. O HTTPS é do Render.

## 4. O que o nginx do Render faz

- Serve o build com **fallback de SPA** (qualquer rota do React devolve `index.html`; um ficheiro em falta em `/assets/` dá 404 e não HTML).
- Encaminha `/api/*` e `/ws` para a VPS com o URI intacto, `Host` público, `X-Forwarded-Proto` e **IP real do cliente**.
- Se a VPS estiver em baixo, `/api` responde `503` com o JSON `SERVICO_INDISPONIVEL`, que o frontend já mostra com «Tentar de novo».
- Cabeçalhos de segurança (CSP restritiva, HSTS, `nosniff`, `frame-ancestors 'none'`), cache longa nos ficheiros com hash,
  `no-cache` no `index.html`. As fotografias do catálogo (`/catalog/*.jpg`) vêm do próprio build.
- `/healthz` (saúde do serviço) e `/backend-health` (diagnóstico do caminho até à VPS: `200` = ligado).

## 5. Verificar no primeiro deploy

1. `https://marketplace.exemplo.ao/healthz` → `ok`.
2. `https://marketplace.exemplo.ao/backend-health` → `200`. Se der `502`: confirme DNS e certificado de `origem.exemplo.ao`,
   `BACKEND_ORIGIN`/`BACKEND_HOST`, o segredo (`403` na VPS) e que o backend está a correr.
3. **IP do cliente (importante).** Abra o site a partir de uma rede diferente (por exemplo, dados móveis) e veja nos *Logs* do
   Render a linha do seu pedido: `IP.DO.CLIENTE xff="…" host=… "GET /api/…"`.
   - O primeiro campo deve ser **o seu IP público**. Está correto.
   - Se for um IP do Render, acrescente esse intervalo em `REAL_IP_EXTRA` (um CIDR) e volte a fazer deploy. Sem isto, todos os
     utilizadores partilhariam o limite de pedidos do backend (600 pedidos e 60 tentativas de login por 15 minutos, **no total**).
4. Entre com um utilizador: o cookie `kixima_sessao` deve ficar `Secure`, `HttpOnly`, `SameSite=Lax`; recarregue a página
   e a sessão mantém-se.
5. Pagar uma fatura com comprovativo e submeter o registo de uma empresa (carregam ficheiros): confirma `client_max_body_size`
   e o armazenamento S3 do backend.
6. Abra uma ligação direta (por exemplo `/categorias/Válvulas`): deve abrir o site, não um erro.

## 6. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `/api/...` dá `503 SERVICO_INDISPONIVEL` | A VPS não responde ao Render: ver `/backend-health`, firewall, certificado |
| Login funciona mas a sessão perde-se | Site aberto em `http://` (o cookie é `Secure`) ou `APP_URL` do backend diferente do domínio público |
| «Demasiados pedidos» para toda a gente | O IP do cliente não está a chegar ao backend: passo 5.3 e confirme `X-Forwarded-For $http_x_forwarded_for` na VPS |
| `403` em tudo na VPS | O segredo do nginx da VPS não coincide com `ORIGEM_SEGREDO` |
| Backend não arranca em `prod` | Falta `STORAGE_PROVIDER=s3` e credenciais, `JWT_SECRET` fraco, ou `APP_URL`/`CORS_ORIGINS` |
| Imagem externa bloqueada | A CSP só admite imagens `self`, `data:`, `blob:` e `https:` (edite `deploy/templates/snippets/seguranca.conf.template`) |

## 7. Reverter

No Render, *Manual Deploy → Rollback* para o deploy anterior. A VPS não precisa de ser alterada para voltar atrás.

## 8. Testar localmente

```bash
npm run build
deploy/testar-local.sh 8080 http://127.0.0.1:4001 127.0.0.1   # nginx com o mesmo template (precisa de nginx e gettext)
# ou com Docker:
docker build -t kixima-marketplace .
docker run --rm -p 8080:10000 -e BACKEND_ORIGIN=https://origem.exemplo.ao -e BACKEND_HOST=origem.exemplo.ao \
  -e ORIGEM_SEGREDO=teste kixima-marketplace
```

O `testar-local.sh` aceita `http://` para o backend local (a imagem Docker só aceita `http://127.0.0.1`/`localhost`, para testes).
