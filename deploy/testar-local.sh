#!/bin/bash
# Monta o nginx do Render localmente (sem Docker): mesmo template, mesmo envsubst da imagem oficial.
# Requer nginx e envsubst (gettext) instalados. Para parar: kill $(pgrep -x nginx)
# uso: nginx-local.sh <porta> <BACKEND_ORIGIN> <BACKEND_HOST>
set -e
FE="$(cd "$(dirname "$0")/.." && pwd)"   # raiz do repositório (precisa de `npm run build` feito)
W=/tmp/nginx-render; rm -rf $W; mkdir -p $W/conf.d/snippets $W/logs $W/tmp
export PORT=$1 BACKEND_ORIGIN=$2 BACKEND_HOST=$3 REAL_IP_EXTRA=${REAL_IP_EXTRA:-127.0.0.1} ORIGEM_SEGREDO=${ORIGEM_SEGREDO:-}
VARS='${PORT} ${BACKEND_ORIGIN} ${BACKEND_HOST} ${REAL_IP_EXTRA} ${ORIGEM_SEGREDO}'
envsubst "$VARS" < $FE/deploy/templates/default.conf.template > $W/conf.d/default.conf
for f in $FE/deploy/templates/snippets/*.template; do envsubst "$VARS" < $f > $W/conf.d/snippets/$(basename ${f%.template}); done
sed -i "s#access_log /dev/stdout kixima;#access_log $W/logs/access.log kixima;#; s#/etc/nginx/conf.d/snippets/#$W/conf.d/snippets/#g; s#root /usr/share/nginx/html;#root $FE/dist;#" $W/conf.d/default.conf
cat > $W/nginx.conf <<CONF
worker_processes 1; pid $W/nginx.pid; error_log $W/logs/error.log info; daemon on;
events { worker_connections 256; }
http {
  include /etc/nginx/mime.types; default_type application/octet-stream;
  
  client_body_temp_path $W/tmp/b; proxy_temp_path $W/tmp/p; fastcgi_temp_path $W/tmp/f; uwsgi_temp_path $W/tmp/u; scgi_temp_path $W/tmp/s;
  include $W/conf.d/*.conf;
}
CONF
nginx -t -c $W/nginx.conf 2>&1 | tail -2
nginx -c $W/nginx.conf
