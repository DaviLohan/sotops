#!/bin/sh
# Executado uma única vez, na criação do volume do PostgreSQL de DESENVOLVIMENTO.
# Cria os bancos isolados usados pelos testes de integração e end-to-end.
set -eu

for database in "${POSTGRES_DB}_test" "${POSTGRES_DB}_e2e"; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE DATABASE "$database" OWNER "$POSTGRES_USER";
SQL
done
