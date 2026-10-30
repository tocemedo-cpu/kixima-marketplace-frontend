#!/bin/sh
# Falha cedo e com uma mensagem clara se faltar a ligação ao backend, em vez de arrancar um site que só dá 503.
set -e
if [ -z "$BACKEND_ORIGIN" ] || [ -z "$BACKEND_HOST" ]; then
  echo "ERRO: defina BACKEND_ORIGIN (ex.: https://origem.exemplo.ao) e BACKEND_HOST (ex.: origem.exemplo.ao)." >&2
  exit 1
fi
case "$BACKEND_ORIGIN" in
  https://*) ;;
  http://127.0.0.1*|http://localhost*) echo "AVISO: BACKEND_ORIGIN sem TLS (só aceitável em testes locais)." >&2 ;;
  *) echo "ERRO: BACKEND_ORIGIN tem de começar por https:// (o tráfego Render -> VPS atravessa a internet)." >&2; exit 1 ;;
esac
case "$BACKEND_ORIGIN" in */) echo "ERRO: BACKEND_ORIGIN não pode acabar em barra." >&2; exit 1 ;; esac
