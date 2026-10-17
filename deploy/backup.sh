#!/usr/bin/env bash
# Tägliches Backup von Datenbank und Bildern (als Nutzer „omsi“, z. B. per systemd-Timer):
#
#   /opt/omsi-mod-hub/backup.sh
#
# - SQLite über ".backup": konsistent auch im laufenden Betrieb
# - Uploads als tar.gz
# - behält BACKUP_KEEP_DAYS Tage
# Wichtig: Diese Backups liegen auf demselben Server. Zusätzlich regelmäßig
# an einen anderen Ort kopieren (siehe docs/DEPLOYMENT.md).
#
# Wiederherstellen (Dienst vorher stoppen):
#   sudo systemctl stop omsi-mod-hub
#   gunzip -c omsi-<zeit>.db.gz > /var/lib/omsi-mod-hub/db/omsi.db
#   tar -xzf uploads-<zeit>.tar.gz -C /var/lib/omsi-mod-hub
#   sudo systemctl start omsi-mod-hub

set -Eeuo pipefail

DATA_DIR="${DATA_DIR:-/var/lib/omsi-mod-hub}"
DB_FILE="${DB_FILE:-$DATA_DIR/db/omsi.db}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

stamp="$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
umask 077

[[ -f "$DB_FILE" ]] || { echo "Datenbank $DB_FILE nicht gefunden." >&2; exit 1; }

tmp="$BACKUP_DIR/omsi-$stamp.db"
sqlite3 "$DB_FILE" ".backup '$tmp'"
# Integrität prüfen, bevor das Backup behalten wird
if [[ "$(sqlite3 "$tmp" 'PRAGMA integrity_check;')" != "ok" ]]; then
  echo "Integritätsprüfung des Backups fehlgeschlagen." >&2
  rm -f "$tmp"
  exit 1
fi
gzip -9 "$tmp"

if [[ -d "$DATA_DIR/uploads" ]]; then
  tar -czf "$BACKUP_DIR/uploads-$stamp.tar.gz" -C "$DATA_DIR" uploads
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'omsi-*.db.gz' -o -name 'uploads-*.tar.gz' \) -mtime +"$BACKUP_KEEP_DAYS" -delete

echo "Backup $stamp erstellt in $BACKUP_DIR"
