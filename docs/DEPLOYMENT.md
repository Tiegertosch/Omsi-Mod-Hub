# Deployment: geschlossene Beta auf einem eigenen Server

Diese Anleitung bringt OMSI Mod Hub auf einen eigenen Linux-Server (VPS). Die Beta ist **geschlossen**: Die ganze Seite liegt hinter einem gemeinsamen Benutzernamen und Passwort (HTTP Basic Auth) und wird nicht von Suchmaschinen indexiert.

Ausgangspunkt: ein frisch angelegter Server mit **Ubuntu 24.04 LTS**. Alle Befehle sind zum Kopieren gedacht; Platzhalter in `GROSSBUCHSTABEN` ersetzen. Zeitbedarf beim ersten Mal: etwa 1–2 Stunden.

## Überblick

```
Internet ─► Caddy :443  (HTTPS über Let's Encrypt, Basic Auth, noindex)
              └─► Next.js 127.0.0.1:3000   (systemd-Dienst „omsi-mod-hub“, Nutzer „omsi“)
                    ├─ PostgreSQL 18 localhost:5432        Datenbank „omsi_mod_hub“
                    ├─ /var/lib/omsi-mod-hub/uploads/       hochgeladene Bilder
                    └─ /var/lib/omsi-mod-hub/backups/       tägliche Backups
/opt/omsi-mod-hub/releases/<zeit>/   ein Ordner pro Deployment (Code + Build)
/opt/omsi-mod-hub/current            Symlink auf die aktive Version
/etc/omsi-mod-hub/env                Konfiguration und Secrets (nicht im Repo)
```

**Warum kein Docker?** `next build` rendert die öffentlichen Seiten mit den echten Daten vor und braucht deshalb Zugriff auf die Produktionsdatenbank. Beim Bauen direkt auf dem Server ist das einfach gegeben. Außerdem wird das native Bildmodul (`sharp`) passend für den Server installiert.

## Was du vorher brauchst

| Was | Hinweis |
|---|---|
| VPS | z. B. Hetzner Cloud **CX22** oder das aktuelle vergleichbare Modell (mind. 2 vCPU, 4 GB RAM, 40 GB SSD), Standort Deutschland, Ubuntu 24.04. Beim Anlegen deinen **SSH-Schlüssel** hinterlegen und **Backups** aktivieren. |
| AV-Vertrag | In der Hetzner-Konsole den Vertrag zur Auftragsverarbeitung abschließen (der Server verarbeitet personenbezogene Daten der Tester). |
| Subdomain | z. B. `beta.DEINE-DOMAIN.de`. Zugriff auf die DNS-Einstellungen der Domain. |
| E-Mail-Postfach | Ein Postfach für den Versand, z. B. `no-reply@DEINE-DOMAIN.de`, mit SMTP-Server, Port (465 oder 587), Benutzername und Passwort. |
| GitHub | Admin-Zugriff auf das Repo, um einen Deploy Key einzutragen. |

## 1. Server vorbereiten

Als `root` anmelden (IP aus der Hetzner-Konsole):

```bash
ssh root@SERVER-IP
apt update && apt -y full-upgrade
```

**Eigenen Admin-Nutzer anlegen** (statt dauerhaft als root zu arbeiten) und den SSH-Schlüssel übernehmen:

```bash
adduser --gecos "" ADMIN-NAME          # Passwort für sudo vergeben
usermod -aG sudo ADMIN-NAME
rsync --archive --chown=ADMIN-NAME:ADMIN-NAME ~/.ssh /home/ADMIN-NAME
```

In einem **zweiten Terminal** testen, bevor du weitermachst: `ssh ADMIN-NAME@SERVER-IP` und `sudo -v`. Erst wenn das klappt, Passwort-Login und Root-Login abschalten:

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sudo systemctl restart ssh
```

Ab hier alles als `ADMIN-NAME`.

**Firewall, automatische Sicherheitsupdates, Swap:**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443
sudo ufw --force enable

sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

# 2 GB Swap als Reserve für den Build
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 2. Software installieren

```bash
# Werkzeuge (Build-Tools nur als Fallback für native Module)
sudo apt install -y git curl build-essential python3 \
  debian-keyring debian-archive-keyring apt-transport-https gnupg

# PostgreSQL 18 aus dem offiziellen PostgreSQL-Repository (gleiche Version wie lokal)
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-18
sudo systemctl enable --now postgresql

# Node.js 24 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable            # stellt „pnpm“ in der Version aus package.json bereit
node --version                  # v24.x

# Caddy (offizielles Paket)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

## 3. Dienstnutzer und Verzeichnisse

```bash
sudo adduser --system --group --home /home/omsi --shell /bin/bash omsi

sudo mkdir -p /opt/omsi-mod-hub/releases /var/lib/omsi-mod-hub/{uploads,backups} /etc/omsi-mod-hub
sudo chown -R omsi:omsi /opt/omsi-mod-hub /var/lib/omsi-mod-hub
sudo chmod 750 /var/lib/omsi-mod-hub
sudo chown omsi:omsi /etc/omsi-mod-hub && sudo chmod 700 /etc/omsi-mod-hub

# „omsi“ darf nur den eigenen Dienst neu starten (für deploy.sh)
echo 'omsi ALL=(root) NOPASSWD: /usr/bin/systemctl restart omsi-mod-hub' | sudo tee /etc/sudoers.d/omsi-mod-hub
sudo chmod 440 /etc/sudoers.d/omsi-mod-hub && sudo visudo -c
```

**Datenbank anlegen.** PostgreSQL lauscht standardmäßig nur auf `localhost` und ist von außen nicht erreichbar (Port 5432 ist in der Firewall auch nicht freigegeben).

```bash
DB_PASS="$(openssl rand -hex 24)"
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE omsi_mod_hub LOGIN PASSWORD '$DB_PASS';" \
  -c "CREATE DATABASE omsi_mod_hub OWNER omsi_mod_hub;"
echo "DATABASE_URL=\"postgresql://omsi_mod_hub:$DB_PASS@localhost:5432/omsi_mod_hub\""
```

Die letzte Zeile gibt die fertige `DATABASE_URL` aus – kopieren, sie kommt in Schritt 5 in die Konfiguration. Das Passwort wird sonst nirgends gespeichert.

## 4. Zugriff auf das private Repo (Deploy Key)

```bash
sudo -iu omsi
mkdir -p ~/.ssh && chmod 700 ~/.ssh   # der Systemnutzer hat noch keinen .ssh-Ordner
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "omsi-mod-hub-server"
cat > ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
cat ~/.ssh/github_deploy.pub
```

Der letzte Befehl gibt den öffentlichen Schlüssel im Terminal aus: eine Zeile, die mit `ssh-ed25519` beginnt und mit `omsi-mod-hub-server` endet. Die ganze Zeile kopieren (nur die `.pub`-Datei; der private Schlüssel `github_deploy` bleibt auf dem Server) und auf GitHub eintragen: Repo → **Settings → Deploy keys → Add deploy key**, Titel z. B. „Beta-Server“, **„Allow write access“ nicht anhaken**. Dann testen (Fingerprint mit `yes` bestätigen):

```bash
ssh -T git@github.com          # „Hi Tiegertosch/Omsi-Mod-Hub! You've successfully authenticated…“
```

Code einmalig holen, um die Konfigurationsdateien zu kopieren:

```bash
git clone --depth 1 git@github.com:Tiegertosch/Omsi-Mod-Hub.git /tmp/omsi-setup
cp /tmp/omsi-setup/deploy/deploy.sh /tmp/omsi-setup/deploy/backup.sh /opt/omsi-mod-hub/
chmod 750 /opt/omsi-mod-hub/*.sh
cp /tmp/omsi-setup/deploy/env.production.example /etc/omsi-mod-hub/env
chmod 600 /etc/omsi-mod-hub/env
exit                            # zurück zu ADMIN-NAME
```

## 5. Konfiguration

```bash
sudo -u omsi nano /etc/omsi-mod-hub/env
```

- `DATABASE_URL`: die Zeile aus Schritt 3 („Datenbank anlegen“)
- `NEXT_PUBLIC_SITE_URL` und `BETTER_AUTH_URL`: `https://beta.DEINE-DOMAIN.de`
- `BETTER_AUTH_SECRET`: **neu** erzeugen (nicht das lokale wiederverwenden):
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
- `CAP_SECRET`: genauso, ein eigenes zweites Secret für das CAPTCHA. Fehlt es, schlagen Registrierung, Anmeldung, „Passwort vergessen“ und Meldungen fehl.
- `SMTP_URL`: Port 465 → `smtps://BENUTZER:PASSWORT@SMTP-SERVER:465`, Port 587 → `smtp://…:587`. Sonderzeichen in Benutzer und Passwort URL-kodieren (`@` → `%40`, `:` → `%3A`, `#` → `%23`, `%` → `%25`). Ist der Benutzer die E-Mail-Adresse, wird daraus z. B. `no-reply%40DEINE-DOMAIN.de`.
- `MAIL_FROM`: Absender mit derselben Adresse wie das Postfach.

**SMTP testen** (mit dem Testcode aus Schritt 4):

```bash
sudo -iu omsi
cd /tmp/omsi-setup && ln -s /etc/omsi-mod-hub/env .env
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --frozen-lockfile
pnpm mail:test DEINE-EIGENE@ADRESSE.de
exit
```

Die Ausgabe nennt bei Fehlern die wahrscheinliche Ursache (Anmeldung, TLS/Port, Absender). Landet die Testmail im Spam, beim Mail-Anbieter SPF und DKIM für die Domain prüfen.

## 6. DNS, Caddy und Dienste

**DNS:** Bei deinem Domain-Anbieter einen **A-Eintrag** `beta` → `SERVER-IP` anlegen (und, falls der Server IPv6 hat, einen **AAAA-Eintrag**). Prüfen, bis die IP erscheint:

```bash
getent hosts beta.DEINE-DOMAIN.de
```

**Caddy** (erst wenn der DNS-Eintrag wirkt, sonst schlägt das Zertifikat fehl):

```bash
caddy hash-password             # Beta-Passwort zweimal eingeben, Hash kopieren
sudo cp /tmp/omsi-setup/deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile  # E-Mail, Domain, Benutzername und Hash eintragen
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
# Die Prüfung läuft als root und legt dabei die Log-Datei an – danach dem
# Caddy-Nutzer übergeben, sonst startet der Dienst mit „permission denied“.
sudo mkdir -p /var/log/caddy && sudo chown -R caddy:caddy /var/log/caddy
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager   # „active (running)“
```

Bei einer späteren Änderung am Caddyfile genügt `sudo systemctl reload caddy`, sofern Caddy läuft.

**systemd-Dienste:**

```bash
sudo cp /tmp/omsi-setup/deploy/omsi-mod-hub.service \
        /tmp/omsi-setup/deploy/omsi-mod-hub-backup.service \
        /tmp/omsi-setup/deploy/omsi-mod-hub-backup.timer \
        /tmp/omsi-setup/deploy/omsi-mod-hub-cleanup.service \
        /tmp/omsi-setup/deploy/omsi-mod-hub-cleanup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable omsi-mod-hub
sudo systemctl enable --now omsi-mod-hub-backup.timer omsi-mod-hub-cleanup.timer
```

## 7. Erstes Deployment

```bash
sudo -iu omsi
INITIAL_SEED=1 /opt/omsi-mod-hub/deploy.sh
exit
```

`INITIAL_SEED=1` legt **nur beim ersten Mal** die Kategorien und Tags an (ohne Beispieldaten). Später nicht mehr verwenden, sonst werden im Adminbereich geänderte Namen und Icons überschrieben.

Prüfen:

```bash
curl -I https://beta.DEINE-DOMAIN.de                   # 401 (Passwort nötig)
curl -I -u BETA_BENUTZER https://beta.DEINE-DOMAIN.de  # 307 bzw. 200 nach Passworteingabe
curl https://beta.DEINE-DOMAIN.de/api/health           # {"status":"ok"}
```

Aufräumen: `sudo rm -rf /tmp/omsi-setup`

## 8. Erstes Admin-Konto

1. Im Browser `https://beta.DEINE-DOMAIN.de` öffnen (Beta-Zugangsdaten eingeben), registrieren und die E-Mail bestätigen.
2. Auf dem Server die Rolle setzen:

```bash
sudo -iu omsi
cd /opt/omsi-mod-hub/current && pnpm user:set-role DEINE@ADRESSE.de admin
exit
```

Danach ist unter *Konto → Administration* der Adminbereich erreichbar.

## Betrieb

**Update auf den neuesten Stand von `main`:**

```bash
sudo -iu omsi /opt/omsi-mod-hub/deploy.sh
```

Das Skript baut in einem neuen Ordner, die laufende Version bleibt bis zum Umschalten aktiv. Schlägt der Health-Check nach dem Neustart fehl, stellt es automatisch auf die vorherige Version zurück. Ändert sich `deploy/deploy.sh` oder `deploy/backup.sh` im Repo, die Kopie unter `/opt/omsi-mod-hub/` von Hand aktualisieren: `cp /opt/omsi-mod-hub/current/deploy/*.sh /opt/omsi-mod-hub/`.

**Manuelles Zurückstellen** auf eine ältere Version (Migrationen werden dabei nicht zurückgedreht):

```bash
sudo -iu omsi
ls /opt/omsi-mod-hub/releases
ln -sfn /opt/omsi-mod-hub/releases/ZEITSTEMPEL /opt/omsi-mod-hub/current
sudo systemctl restart omsi-mod-hub
```

**Logs:**

```bash
journalctl -u omsi-mod-hub -f            # App
sudo tail -f /var/log/caddy/omsi-mod-hub.log
systemctl list-timers 'omsi-mod-hub-*'
journalctl -u omsi-mod-hub-cleanup        # Ergebnis der Datenbereinigung
```

**Löschfristen:** Der Timer `omsi-mod-hub-cleanup` löscht täglich um 04:15 Uhr alte Rate-Limit-Einträge (enthalten IP-Adressen, nach 24 Stunden), abgelaufene Sitzungen, Codes und Links Konten, die nach 7 Tagen noch nicht bestätigt sind, abgeschlossene Meldungen 6 Monate nach dem Abschluss und Protokolleinträge nach 12 Monaten (`src/lib/retention.ts`). Caddy bewahrt Zugriffslogs höchstens 14 Tage auf (`roll_keep_for` im Caddyfile). Manuell: `sudo systemctl start omsi-mod-hub-cleanup`.

**Löschfristen auf einer bestehenden Beta nachrüsten** (einmalig, nach dem Deploy dieser Version):

```bash
sudo cp /opt/omsi-mod-hub/current/deploy/omsi-mod-hub-cleanup.service \
        /opt/omsi-mod-hub/current/deploy/omsi-mod-hub-cleanup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now omsi-mod-hub-cleanup.timer
sudo systemctl start omsi-mod-hub-cleanup && journalctl -u omsi-mod-hub-cleanup -n 5 --no-pager
# Im Caddyfile im log-Block die Zeile `roll_keep_for 336h` ergänzen (siehe deploy/Caddyfile.example):
sudo nano /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**Backups:** täglich um 03:30 Uhr nach `/var/lib/omsi-mod-hub/backups` (14 Tage). Manuell: `sudo -iu omsi /opt/omsi-mod-hub/backup.sh`. Wiederherstellen steht im Kopf von `deploy/backup.sh`.

Diese Backups liegen auf demselben Server. Für den Fall, dass er ausfällt, gelöscht oder übernommen wird, kopiert `backup.sh` sie zusätzlich auf eine **Hetzner Storage Box**, sobald `BACKUP_REMOTE` gesetzt ist. Die Kopie spiegelt den lokalen Stand (14 Tage); gegen Löschen vom Server aus schützen die Snapshots der Storage Box, an die der Server nicht herankommt.

**Storage Box einrichten** (einmalig; Angaben in der Hetzner Console beim Einrichten prüfen):

1. Storage Box bestellen (kleinste Stufe reicht), Standort möglichst ein anderes Rechenzentrum als der Server, aber in Deutschland.
2. Einstellungen: **SSH-Support an**; SMB- und WebDAV-Support aus. „Externe Erreichbarkeit“ zunächst aus lassen (nur aus dem Hetzner-Netz erreichbar); bricht der Verbindungstest in Schritt 5 mit einem Timeout ab, einschalten.
3. **Snapshots:** automatische Snapshots täglich, z. B. 05:00 Uhr (nach dem Backup um 03:30), höchstens 10 behalten.
4. Auf dem Server einen eigenen Schlüssel ohne Passphrase für den Backup-Nutzer anlegen und hochladen (die Storage Box hat keine Shell, deshalb `-s` für den Upload per SFTP):
   ```bash
   sudo -iu omsi
   ssh-keygen -t ed25519 -N "" -f ~/.ssh/storagebox_ed25519 -C "omsi-mod-hub-backup"
   ssh-copy-id -p 23 -s -i ~/.ssh/storagebox_ed25519 uXXXXX@uXXXXX.your-storagebox.de   # fragt einmal das Storage-Box-Passwort
   ```
5. Verbindung testen und dabei den Host-Schlüssel bestätigen (der nächtliche Lauf läuft ohne Terminal und weist unbekannte Host-Schlüssel ab):
   ```bash
   ssh -p 23 -i ~/.ssh/storagebox_ed25519 uXXXXX@uXXXXX.your-storagebox.de ls   # Fingerprint mit der Hetzner Console abgleichen, „yes“
   ssh -p 23 -i ~/.ssh/storagebox_ed25519 uXXXXX@uXXXXX.your-storagebox.de mkdir omsi-mod-hub
   exit
   ```
6. In `/etc/omsi-mod-hub/env` eintragen (Vorlage: `deploy/env.production.example`):
   ```bash
   BACKUP_REMOTE="uXXXXX@uXXXXX.your-storagebox.de:omsi-mod-hub/"
   BACKUP_SSH_KEY="/home/omsi/.ssh/storagebox_ed25519"
   ```
7. Das neue `backup.sh` übernehmen, einmal von Hand ausführen und den Lauf prüfen (`rsync` ist bei Ubuntu meist installiert, sonst `sudo apt install rsync`):
   ```bash
   sudo -iu omsi cp /opt/omsi-mod-hub/current/deploy/backup.sh /opt/omsi-mod-hub/
   sudo systemctl start omsi-mod-hub-backup
   systemctl status omsi-mod-hub-backup --no-pager     # „… nach uXXXXX@… kopiert“, kein Fehler
   ```

Ein fehlgeschlagener Kopierschritt lässt das lokale Backup bestehen, der Dienst endet dann aber mit Fehler (sichtbar in `systemctl --failed`).

**Wiederherstellung testen:** Einmal eine Datei von der Storage Box zurückholen und prüfen, auch aus einem Snapshot (liegen im Verzeichnis `.zfs/snapshot/` der Storage Box; Hetzner-Doku prüfen):

```bash
sudo -iu omsi
mkdir -p /tmp/restore-test && cd /tmp/restore-test
# Platzhalter im entfernten Pfad erweitert rsync nicht; deshalb filtern statt omsi-*.dump im Pfad
rsync -av -e 'ssh -p 23 -i ~/.ssh/storagebox_ed25519' --include='omsi-*.dump' --exclude='*' 'uXXXXX@uXXXXX.your-storagebox.de:omsi-mod-hub/' .
pg_restore --list "$(ls -t omsi-*.dump | head -1)" | head    # Inhaltsverzeichnis des Dumps
rm -rf /tmp/restore-test
```

Die vollständige Wiederherstellung (Dienst stoppen, `pg_restore`, Bilder entpacken) steht im Kopf von `deploy/backup.sh`.

**Monitoring:** Bei einem Dienst wie UptimeRobot `https://beta.DEINE-DOMAIN.de/api/health` alle 5 Minuten prüfen lassen; der Pfad ist von der Basic Auth ausgenommen.

**Beispieldaten:** Auf dem Server nie `pnpm db:seed` ohne `SEED_SAMPLES=false` ausführen – das legt fiktive Creator und Projekte an.

## Umstieg einer bestehenden SQLite-Beta auf PostgreSQL (einmalig)

Gilt nur für Server, die vor dem Umstieg auf PostgreSQL (Oktober 2026) eingerichtet wurden. Die Beta startet dabei **mit leerer Datenbank neu**: Konten, Projekte und Meldungen aus SQLite werden nicht übernommen, sondern nur archiviert.

**1. Dienst stoppen, PostgreSQL installieren, Datenbank anlegen**

```bash
sudo systemctl stop omsi-mod-hub
```

Dann aus Abschnitt 2 den Block „PostgreSQL 18“ und aus Abschnitt 3 „Datenbank anlegen“ ausführen und die ausgegebene `DATABASE_URL` notieren.

**2. Alte Daten archivieren, Konfiguration und Skripte aktualisieren**

```bash
sudo -iu omsi
mkdir -p /var/lib/omsi-mod-hub/backups/sqlite-archiv
mv /var/lib/omsi-mod-hub/db /var/lib/omsi-mod-hub/uploads /var/lib/omsi-mod-hub/backups/sqlite-archiv/
mkdir /var/lib/omsi-mod-hub/uploads
nano /etc/omsi-mod-hub/env      # DATABASE_URL durch die neue PostgreSQL-Zeile ersetzen
git clone --depth 1 git@github.com:Tiegertosch/Omsi-Mod-Hub.git /tmp/omsi-pg
cp /tmp/omsi-pg/deploy/deploy.sh /tmp/omsi-pg/deploy/backup.sh /opt/omsi-mod-hub/
exit

sudo cp /tmp/omsi-pg/deploy/omsi-mod-hub.service /tmp/omsi-pg/deploy/omsi-mod-hub-backup.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo rm -rf /tmp/omsi-pg
```

**3. Neu deployen – mit Stammdaten (Kategorien und Tags), wie beim allerersten Mal**

```bash
sudo -iu omsi
INITIAL_SEED=1 /opt/omsi-mod-hub/deploy.sh
exit
```

Danach wie in Abschnitt 8 neu registrieren und die Admin-Rolle setzen, dann ein Backup testen: `sudo -iu omsi /opt/omsi-mod-hub/backup.sh` muss eine Datei `omsi-….dump` erzeugen. Wenn alles läuft, können das Archiv `/var/lib/omsi-mod-hub/backups/sqlite-archiv` gelöscht und das Paket `sqlite3` entfernt werden (`sudo apt remove sqlite3`).

## Vor dem öffentlichen Start

- [x] Nutzungsbedingungen rechtlich geprüft, Entwurfshinweis entfernt
- [x] Datenschutzerklärung um E-Mail-Versand (checkdomain), Cookies und Löschfristen ergänzt
- [ ] Impressum geprüft und das Postfach `kontakt@omsi-modhub.de` eingerichtet
- [ ] Basic Auth und `X-Robots-Tag` im Caddyfile entfernen; `robots.txt` und Sitemap prüfen
- [x] Content-Security-Policy ergänzen
- [ ] Zustellbarkeit der E-Mails mit mehreren Anbietern (Gmail, GMX, Outlook) prüfen
- [x] Backup außerhalb des Servers eingerichtet (Hetzner Storage Box mit Snapshots) und Wiederherstellung getestet
- [ ] Bei Wachstum: Objektspeicher für Bilder, gemeinsamer Cache-Handler, ggf. verwaltete Datenbank (siehe ARCHITECTURE.md)
