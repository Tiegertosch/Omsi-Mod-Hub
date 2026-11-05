#!/usr/bin/env bash
# Tägliches Backup von Datenbank und Bildern (als Nutzer „omsi“, z. B. per systemd-Timer):
#
#   /opt/omsi-mod-hub/backup.sh
#
# - PostgreSQL über pg_dump (Custom-Format, konsistent im laufenden Betrieb)
# - Uploads als tar.gz
# - behält BACKUP_KEEP_DAYS Tage
# - kopiert sie, wenn BACKUP_REMOTE gesetzt ist, per rsync außerhalb des
#   Servers (Hetzner Storage Box, Einrichtung in docs/DEPLOYMENT.md)
# - meldet sich, wenn BACKUP_HEARTBEAT_URL gesetzt ist, bei einem
#   Monitoring-Dienst (z. B. Better Stack): nach Erfolg die URL, bei einem
#   Fehler sofort <URL>/fail. Bleibt die Meldung aus, warnt der Dienst.
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
# Heartbeat: Die URL enthält ein Geheimnis und erscheint deshalb in keiner Meldung.
# Ein nicht erreichbarer Dienst lässt das Backup nicht scheitern.
heartbeat() {
  [[ -n "${BACKUP_HEARTBEAT_URL:-}" ]] || return 0
  curl -fsS --max-time 30 --retry 3 -o /dev/null "${BACKUP_HEARTBEAT_URL}$1" \
    || echo "Heartbeat an den Monitoring-Dienst konnte nicht gesendet werden." >&2
}
# Jeder Abbruch (Fehler oder exit 1 unten) meldet sofort einen Fehlschlag.
trap 'status=$?; if (( status != 0 )); then heartbeat /fail; fi' EXIT

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

# Höchstens BACKUP_KEEP_DAYS Tage aufbewahren: Beim täglichen Lauf alles löschen,
# was älter als (BACKUP_KEEP_DAYS - 1) Tage ist; bis zum nächsten Lauf wird keine
# Datei älter als die Frist. (-mtime +N hätte erst ab N+1 vollen Tagen gelöscht.)
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'omsi-*.dump' -o -name 'uploads-*.tar.gz' \) \
  -mmin +$(((BACKUP_KEEP_DAYS - 1) * 24 * 60)) -delete

echo "Backup $stamp erstellt in $BACKUP_DIR"

# Kopie außerhalb des Servers (z. B. Hetzner Storage Box), nur wenn
# BACKUP_REMOTE gesetzt ist, etwa "u12345@u12345.your-storagebox.de:omsi-mod-hub/".
# Spiegelt den lokalen Stand nach dem Aufräumen (--delete), damit die
# Aufbewahrungsfrist auch dort gilt; gegen Löschen vom Server aus schützen die
# Snapshots der Storage Box. BatchMode: ohne Terminal nie auf Eingaben warten,
# unbekannte Host-Schlüssel abweisen (known_hosts vorab befüllen, siehe docs/DEPLOYMENT.md).
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  if ! command -v rsync >/dev/null; then
    echo "rsync ist nicht installiert; Kopie nach $BACKUP_REMOTE übersprungen." >&2
    exit 1
  fi
  ssh_cmd="ssh -p ${BACKUP_REMOTE_PORT:-23} -o BatchMode=yes -o ConnectTimeout=30"
  if [[ -n "${BACKUP_SSH_KEY:-}" ]]; then ssh_cmd+=" -i ${BACKUP_SSH_KEY}"; fi
  # Lokales Backup bleibt bei einem Fehler erhalten; der Exit-Code macht den
  # Fehler in `systemctl status omsi-mod-hub-backup` sichtbar.
  if ! rsync -az --delete \
    --include='omsi-*.dump' --include='uploads-*.tar.gz' --exclude='*' \
    -e "$ssh_cmd" "$BACKUP_DIR/" "$BACKUP_REMOTE"; then
    echo "Kopie nach $BACKUP_REMOTE fehlgeschlagen; das lokale Backup $stamp ist vorhanden." >&2
    exit 1
  fi
  echo "Backup $stamp nach $BACKUP_REMOTE kopiert"
fi

# Erst nach dem vollständigen Lauf (inkl. Kopie) Erfolg melden.
heartbeat ""
