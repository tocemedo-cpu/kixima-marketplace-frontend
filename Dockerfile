# KIXIMA Marketplace — frontend servido por nginx (serviço Web Docker no Render).
# Construção: Vite gera o build estático; a imagem final só leva o build e a configuração do nginx.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# A imagem oficial aplica o envsubst a /etc/nginx/templates/**/*.template e escreve o resultado em /etc/nginx/conf.d/.
COPY deploy/templates/ /etc/nginx/templates/
COPY --from=build /app/dist /usr/share/nginx/html
# Só estas variáveis são substituídas (o resto do ficheiro, como $host, fica intacto).
ENV NGINX_ENVSUBST_FILTER="^(PORT|BACKEND_ORIGIN|BACKEND_HOST|REAL_IP_EXTRA|ORIGEM_SEGREDO|NGINX_LOCAL_RESOLVERS)$" \
    PORT=10000 \
    REAL_IP_EXTRA=127.0.0.1
# Valida e deriva a ligação ao backend (BACKEND_HOSTPORT na rede privada do Render, ou BACKEND_ORIGIN + BACKEND_HOST).
# Sem ela o contentor recusa arrancar. Os ficheiros .envsh são lidos pelo entrypoint antes do envsubst.
COPY deploy/10-ambiente-backend.envsh /docker-entrypoint.d/10-ambiente-backend.envsh
RUN chmod +x /docker-entrypoint.d/10-ambiente-backend.envsh
EXPOSE 10000
