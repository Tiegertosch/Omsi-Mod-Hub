/**
 * Lokales CLI-Skript zum Setzen einer Rolle, z. B. für das erste Admin-Konto:
 *
 *   pnpm user:set-role <email> admin
 *
 * Es gibt bewusst keinen Web-Endpunkt und keinen Seed dafür. Wer dieses Skript
 * ausführen kann, hat ohnehin Zugriff auf Server und Datenbank.
 * Die Änderung wird im Audit-Log protokolliert.
 */
import "dotenv/config";

import { createPrismaClient } from "../src/lib/prisma-factory";
import { isAppRole } from "../src/lib/roles";

const [email, role] = process.argv.slice(2);

async function main() {
  if (!email || !isAppRole(role)) {
    console.error("Aufruf: pnpm user:set-role <email> <user|creator|admin>");
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
    if (!user.emailVerified) {
      console.error("Die E-Mail-Adresse dieses Kontos ist noch nicht bestätigt.");
      process.exitCode = 1;
      return;
    }

    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { role } }),
      db.auditLog.create({
        data: {
          actorId: null,
          action: "user.role.set",
          entityType: "User",
          entityId: user.id,
          metadata: JSON.stringify({ from: user.role, to: role, via: "cli" }),
        },
      }),
    ]);
    console.log(`Rolle von @${user.username} geändert: ${user.role} → ${role}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
