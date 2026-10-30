#!/bin/sh
# Arranca o simulador da API em segundo plano antes do nginx. Sem DEMO_SENHA recusa arrancar (não há palavra-passe por omissão).
if [ -z "$DEMO_SENHA" ]; then
  echo "ERRO: defina DEMO_SENHA (a palavra-passe de demonstração dos utilizadores de teste)." >&2
  exit 1
fi
SIMULADOR_HOST=127.0.0.1 SIMULADOR_PORT=4100 node /app/api-simulada.mjs >> /proc/1/fd/1 2>> /proc/1/fd/2 &
