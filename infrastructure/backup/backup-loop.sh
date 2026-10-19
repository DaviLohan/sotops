#!/bin/sh
# Backup lógico periódico do PostgreSQL (formato custom do pg_dump, compactado).
# Um arquivo só é considerado válido depois de verificado com pg_restore --list.
set -eu

: "${BACKUP_INTERVAL_SECONDS:=86400}"
: "${BACKUP_RETENTION_DAYS:=14}"
BACKUP_DIR=/backups

mkdir -p "$BACKUP_DIR"

while true; do
  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  partial="$BACKUP_DIR/.${PGDATABASE}_${timestamp}.dump.partial"
  final="$BACKUP_DIR/${PGDATABASE}_${timestamp}.dump"

  if pg_dump --format=custom --no-owner --file="$partial" && pg_restore --list "$partial" >/dev/null; then
    mv "$partial" "$final"
    echo "{\"level\":\"info\",\"msg\":\"backup concluido\",\"file\":\"$final\",\"bytes\":$(wc -c <"$final")}"
    find "$BACKUP_DIR" -name "${PGDATABASE}_*.dump" -mtime "+$BACKUP_RETENTION_DAYS" -delete
  else
    rm -f "$partial"
    echo "{\"level\":\"error\",\"msg\":\"backup falhou\",\"timestamp\":\"$timestamp\"}" >&2
  fi

  sleep "$BACKUP_INTERVAL_SECONDS"
done
