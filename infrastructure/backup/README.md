# Backups do PostgreSQL

O serviço `backup` do `docker-compose.yml` gera um dump lógico (`pg_dump --format=custom`) a cada
`BACKUP_INTERVAL_SECONDS` (padrão: 24 h) em `infrastructure/backup/data/` e apaga os arquivos com
mais de `BACKUP_RETENTION_DAYS` dias (padrão: 14). Cada arquivo é validado com `pg_restore --list`
antes de ser publicado; dumps incompletos nunca ficam na pasta.

> Os dumps ficam no mesmo servidor do banco. **Copie-os para outro local** (outro servidor ou
> armazenamento de objetos) — sem isso, a perda do servidor leva junto os backups. A cópia externa
> automatizada e o backup das evidências (MinIO) estão previstos para a Fase 6.

## Backup sob demanda

```bash
docker compose exec backup sh -c \
  'pg_dump --format=custom --no-owner --file=/backups/${PGDATABASE}_manual_$(date -u +%Y%m%dT%H%M%SZ).dump'
```

## Restauração

Restaurar substitui os dados atuais. Faça sempre em um banco vazio e valide antes de apontar a
aplicação para ele.

```bash
# 1. Pare quem escreve no banco.
docker compose stop api web

# 2. Restaure em um banco novo.
docker compose exec postgres createdb -U efed efed_restore
docker compose exec backup pg_restore --no-owner --dbname=efed_restore /backups/ARQUIVO.dump

# 3. Confira (contagens, último registro de auditoria) e troque os bancos.
docker compose exec postgres psql -U efed -d postgres \
  -c 'ALTER DATABASE efed RENAME TO efed_old;' \
  -c 'ALTER DATABASE efed_restore RENAME TO efed;'

# 4. Suba a aplicação novamente.
docker compose up -d api web
```

Teste a restauração periodicamente: backup que nunca foi restaurado não é backup.
