#!/usr/bin/env bash
# Deployment von OMSI Mod Hub auf dem Server (als Nutzer „omsi“ ausführen):
#
#   /opt/omsi-mod-hub/deploy.sh
#   INITIAL_SEED=1 /opt/omsi-mod-hub/deploy.sh   # nur beim ersten Mal
#
# Ablauf: neuer Release-Ordner aus GitHub → Abhängigkeiten → Migrationen →
# Build (mit Produktionsdatenbank) → Symlink „current“ umstellen → Dienst neu
# starten → Health-Check. Schlägt ein Schritt vor dem Umstellen fehl, läuft die
# bisherige Version unverändert weiter. Schlägt der Health-Check fehl, wird
# automatisch auf die vorherige Version zurückgestellt.
#
# Hinweis: Datenbank-Migrationen werden bei einem Rollback nicht zurückgedreht.
# Migrationen deshalb nur additiv gestalten (neue Spalten/Tabellen).

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/omsi-mod-hub}"
REPO="${REPO:-git@github.com:Tiegertosch/Omsi-Mod-Hub.git}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-/etc/omsi-mod-hub/env}"
SERVICE="${SERVICE:-omsi-mod-hub}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
# Nur für Tests: Dienst nicht neu starten und keinen Health-Check ausführen
SKIP_RESTART="${SKIP_RESTART:-0}"

log() { printf '\n==> %s\n' "$*"; }

# pnpm kommt über corepack; keine interaktive Rückfrage beim ersten Herunterladen
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

[[ -r "$ENV_FILE" ]] || { echo "Env-Datei $ENV_FILE fehlt oder ist nicht lesbar." >&2; exit 1; }

RELEASES="$APP_DIR/releases"
CURRENT="$APP_DIR/current"
RELEASE="$RELEASES/$(date -u +%Y%m%d%H%M%S)"
PREVIOUS="$(readlink "$CURRENT" 2>/dev/null || true)"
SWITCHED=0

# Vor dem Aufräum-Trap prüfen, damit ein vorhandener Release nie gelöscht wird.
[[ -e "$RELEASE" ]] && { echo "$RELEASE existiert bereits – bitte eine Sekunde warten und erneut starten." >&2; exit 1; }

cleanup_failed() {
  local status=$?
  if [[ $status -ne 0 && $SWITCHED -eq 0 && -d "$RELEASE" ]]; then
    echo "Deployment abgebrochen – die laufende Version bleibt aktiv. Entferne $RELEASE" >&2
    rm -rf "$RELEASE"
  fi
}
trap cleanup_failed EXIT

mkdir -p "$RELEASES"

log "Code holen ($BRANCH)"
git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$RELEASE"
ln -s "$ENV_FILE" "$RELEASE/.env"
cd "$RELEASE"
echo "Commit: $(git rev-parse --short HEAD) – $(git log -1 --format=%s)"

log "Abhängigkeiten installieren"
pnpm install --frozen-lockfile

log "Datenbank-Migrationen anwenden"
pnpm db:deploy

# Nur beim allerersten Deployment: Kategorien und Tags anlegen (ohne Beispieldaten).
# Vor dem Build, damit die vorgerenderten Seiten die Kategorien schon enthalten.
# Später nicht mehr verwenden – der Seed überschreibt Namen und Icons, die im
# Adminbereich geändert wurden.
if [[ "${INITIAL_SEED:-0}" == "1" ]]; then
  log "Stammdaten anlegen (Kategorien und Tags)"
  SEED_SAMPLES=false pnpm db:seed
fi

log "Build (rendert öffentliche Seiten mit den aktuellen Daten vor)"
pnpm build

log "Version umstellen"
ln -sfn "$RELEASE" "$CURRENT.tmp"
mv -Tf "$CURRENT.tmp" "$CURRENT"
SWITCHED=1

if [[ "$SKIP_RESTART" != "1" ]]; then
  log "Dienst neu starten"
  sudo systemctl restart "$SERVICE"

  log "Health-Check"
  healthy=0
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then healthy=1; break; fi
    sleep 2
  done
  if [[ $healthy -ne 1 ]]; then
    echo "Health-Check fehlgeschlagen." >&2
    if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
      echo "Stelle zurück auf $PREVIOUS" >&2
      ln -sfn "$PREVIOUS" "$CURRENT.tmp"
      mv -Tf "$CURRENT.tmp" "$CURRENT"
      sudo systemctl restart "$SERVICE"
    fi
    echo "Logs: journalctl -u $SERVICE -n 100" >&2
    exit 1
  fi
fi

log "Alte Releases aufräumen (behalte $KEEP_RELEASES)"
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r | tail -n +"$((KEEP_RELEASES + 1))" |
  while read -r old; do
    [[ "$RELEASES/$old" == "$(readlink "$CURRENT")" ]] && continue
    rm -rf "${RELEASES:?}/$old"
  done

log "Fertig: $(basename "$RELEASE") ist aktiv."
