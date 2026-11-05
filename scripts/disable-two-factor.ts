/**
 * Notfall: Zwei-Faktor-Anmeldung eines Kontos abschalten, wenn App und
 * Backup-Codes verloren sind.
 *
 *   pnpm user:disable-2fa <email>
 *
 * Nur nach geprüfter Identität ausführen (z. B. Anfrage von der hinterlegten
 * Adresse und Rückfrage). Meldet alle Geräte ab und protokolliert die Änderung.
 * Admins verlieren damit ihre Admin-Rechte, bis sie 2FA neu einrichten.
 */
import "dotenv/config";

import { createPrismaClient } from "../src/lib/prisma-factory";

const [email] = process.argv.slice(2);

async function main() {
  if (!email) {
    console.error("Aufruf: pnpm user:disable-2fa <email>");
    process.exitCode = 1;
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ist nicht gesetzt.");
  const db = createPrismaClient(url);

  try {
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      console.error(`Kein Konto mit der E-Mail-Adresse ${email} gefunden.`);
      process.exitCode = 1;
      return;
    }

    await db.$transaction([
      db.twoFactor.deleteMany({ where: { userId: user.id } }),
      db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false } }),
      db.session.deleteMany({ where: { userId: user.id } }),
      db.auditLog.create({
        data: {
          actorId: null,
          action: "user.two_factor_disable",
          entityType: "User",
          entityId: user.id,
          metadata: JSON.stringify({ via: "cli" }),
        },
      }),
    ]);
    console.log(`Zwei-Faktor-Anmeldung von @${user.username} abgeschaltet, alle Geräte abgemeldet.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
