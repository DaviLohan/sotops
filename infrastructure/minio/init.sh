#!/bin/bash
# Prepara o MinIO de produção: bucket da aplicação e um usuário só da API, com acesso apenas a
# esse bucket (a API nunca usa a credencial raiz). Idempotente: pode rodar a cada subida.
# A imagem do MinIO não traz sed nem grep: só bash e o mc.
set -euo pipefail

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
mc mb --ignore-existing "local/$S3_BUCKET"

policy=$(</init/api-policy.json)
printf '%s' "${policy//__BUCKET__/$S3_BUCKET}" > /tmp/api-policy.json
mc admin policy create local efed-api /tmp/api-policy.json
# Recriar o usuário só troca a senha; anexar uma política já anexada não é erro aqui.
mc admin user add local "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
mc admin policy attach local efed-api --user "$S3_ACCESS_KEY" >/dev/null 2>&1 || true
info=$(mc admin user info local "$S3_ACCESS_KEY")
[[ "$info" == *efed-api* ]] || { echo "Política efed-api não ficou anexada." >&2; exit 1; }
echo "MinIO pronto: bucket $S3_BUCKET e usuário da API."
