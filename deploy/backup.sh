#!/usr/bin/env bash
# Tägliches Backup von Datenbank und Bildern (als Nutzer „omsi“, z. B. per systemd-Timer):
#
#   /opt/omsi-mod-hub/backup.sh
#
# - PostgreSQL über pg_dump (Custom-Format, konsistent im laufenden Betrieb)
# - Uploads als tar.gz
# - behält BACKUP_KEEP_DAYS Tage
# Wichtig: Diese Backups liegen auf demselben Server. Zusätzlich regelmäßig
# an einen anderen Ort kopieren (siehe docs/DEPLOYMENT.md).
#
# Wiederherstellen (Dienst vorher stoppen):
#   sudo systemctl stop omsi-mod-hub
#   set -a; . /etc/omsi-mod-hub/env; set +a
#   pg_restore --clean --if-exists --no-owner -d "${DATABASE_URL%%\?*}" omsi-<zeit>.dump
#   tar -xzf uploads-<zeit>.tar.gz -C /var/lib/omsi-mod-hub
#   sudo systemctl start omsi-mod-hub

set -Eeuo pipefail

ENV_FILE="${ENV_FILE:-/etc/omsi-mod-hub/env}"
DATA_DIR="${DATA_DIR:-/var/lib/omsi-mod-hub}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

# DATABASE_URL aus der Konfiguration lesen, falls nicht schon gesetzt
if [[ -z "${DATABASE_URL:-}" && -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi
[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL ist nicht gesetzt ($ENV_FILE)." >&2; exit 1; }
# pg_dump kennt Prisma-spezifische Parameter wie ?schema= nicht
PG_URL="${DATABASE_URL%%\?*}"

stamp="$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
umask 077

dump="$BACKUP_DIR/omsi-$stamp.dump"
pg_dump --format=custom --no-owner --file "$dump" "$PG_URL"
# Prüfen, ob das Archiv lesbar ist, bevor es behalten wird
if ! pg_restore --list "$dump" >/dev/null; then
  echo "Backup-Datei ist nicht lesbar." >&2
  rm -f "$dump"
  exit 1
fi

if [[ -d "$DATA_DIR/uploads" ]]; then
  tar -czf "$BACKUP_DIR/uploads-$stamp.tar.gz" -C "$DATA_DIR" uploads
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'omsi-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime +"$BACKUP_KEEP_DAYS" -delete

echo "Backup $stamp erstellt in $BACKUP_DIR"
