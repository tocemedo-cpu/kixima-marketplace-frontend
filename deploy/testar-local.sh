#!/bin/bash
# Monta o nginx do Render localmente (sem Docker): mesmo template e mesmo script de ambiente da imagem.
# Requer nginx e envsubst (gettext). Primeiro: npm run build. Para parar: kill $(pgrep -x nginx)
#
#   BACKEND_HOSTPORT=127.0.0.1:4001 deploy/testar-local.sh 8080                       # como na rede privada do Render
#   BACKEND_ORIGIN=https://origem.exemplo.ao BACKEND_HOST=origem.exemplo.ao deploy/testar-local.sh 8080   # origem externa
set -e
FE="$(cd "$(dirname "$0")/.." && pwd)"
export PORT="${1:-8080}" REAL_IP_EXTRA="${REAL_IP_EXTRA:-127.0.0.1}" ORIGEM_SEGREDO="${ORIGEM_SEGREDO:-}"
. "$FE/deploy/10-ambiente-backend.envsh"            # valida e deriva BACKEND_ORIGIN, BACKEND_HOST, NGINX_LOCAL_RESOLVERS
W="${NGINX_TMP:-/tmp/nginx-render}"; rm -rf "$W"; mkdir -p "$W/conf.d/snippets" "$W/logs" "$W/tmp"
VARS='${PORT} ${BACKEND_ORIGIN} ${BACKEND_HOST} ${REAL_IP_EXTRA} ${ORIGEM_SEGREDO} ${NGINX_LOCAL_RESOLVERS}'
envsubst "$VARS" < "$FE/deploy/templates/default.conf.template" > "$W/conf.d/default.conf"
for f in "$FE"/deploy/templates/snippets/*.template; do envsubst "$VARS" < "$f" > "$W/conf.d/snippets/$(basename "${f%.template}")"; done
sed -i "s#access_log /dev/stdout kixima;#access_log $W/logs/access.log kixima;#; s#/etc/nginx/conf.d/snippets/#$W/conf.d/snippets/#g; s#root /usr/share/nginx/html;#root $FE/dist;#" "$W/conf.d/default.conf"
cat > "$W/nginx.conf" <<CONF
worker_processes 1; pid $W/nginx.pid; error_log $W/logs/error.log info; daemon on;
events { worker_connections 256; }
http {
  include /etc/nginx/mime.types; default_type application/octet-stream;
  client_body_temp_path $W/tmp/b; proxy_temp_path $W/tmp/p; fastcgi_temp_path $W/tmp/f; uwsgi_temp_path $W/tmp/u; scgi_temp_path $W/tmp/s;
  include $W/conf.d/*.conf;
}
CONF
nginx -t -c "$W/nginx.conf"
nginx -c "$W/nginx.conf"
echo "nginx em http://127.0.0.1:$PORT  ->  $BACKEND_ORIGIN"
