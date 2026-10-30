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
ENV NGINX_ENVSUBST_FILTER="^(PORT|BACKEND_ORIGIN|BACKEND_HOST|REAL_IP_EXTRA|ORIGEM_SEGREDO)$" \
    PORT=10000 \
    REAL_IP_EXTRA=127.0.0.1
# BACKEND_ORIGIN e BACKEND_HOST são obrigatórios: sem eles o contentor recusa arrancar (ver o guia de implantação).
COPY deploy/10-exigir-backend.sh /docker-entrypoint.d/10-exigir-backend.sh
RUN chmod +x /docker-entrypoint.d/10-exigir-backend.sh
EXPOSE 10000
