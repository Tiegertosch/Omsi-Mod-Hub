import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * „E-Mail-Adresse bearbeiten“ im zweiten Registrierungsschritt: Das Konto
 * existiert schon, ist aber unbestätigt. Wer Benutzername und Passwort kennt,
 * darf die Adresse ändern – ohne Passwort könnte jeder, der die Adresse eines
 * unbestätigten Kontos kennt, es auf seine eigene umleiten und übernehmen.
 *
 * - "denied":    kein unbestätigtes Konto mit diesem Namen, falsches Passwort
 *                oder das Konto wurde inzwischen bestätigt; der Aufrufer
 *                meldet „Benutzername vergeben“.
 * - "changed":   Adresse geändert, alter Code verworfen.
 * - "unchanged": Die neue Adresse gehört einem anderen Konto. Nach außen wie
 *                "changed" behandeln (kein Ausspähen von Adressen); es geht
 *                dann einfach kein Code an das eigene Konto.
 */
export async function changeUnverifiedEmail(input: {
  username: string;
  password: string;
  newEmail: string;
}): Promise<"denied" | "changed" | "unchanged"> {
  const user = await db.user.findUnique({
    where: { username: input.username },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      accounts: { where: { providerId: "credential" }, select: { password: true } },
    },
  });
  const hash = user?.accounts[0]?.password;
  if (!user || user.emailVerified || !hash) return "denied";

  const { password } = await auth.$context;
  if (!(await password.verify({ hash, password: input.password }))) return "denied";
  if (user.email === input.newEmail) return "changed";

  try {
    const changed = await db.$transaction(async (tx) => {
      // Bedingt auf den gelesenen Stand: Bestätigt jemand die alte Adresse,
      // während das Passwort geprüft wird, darf die neue Adresse den Status
      // „bestätigt“ nicht erben.
      const result = await tx.user.updateMany({
        where: { id: user.id, email: user.email, emailVerified: false },
        data: { email: input.newEmail, emailVerified: false },
      });
      if (result.count === 0) return false;
      // Offener Code der alten Adresse (Bezeichner des emailOTP-Plugins).
      await tx.verification.deleteMany({ where: { identifier: `email-verification-otp-${user.email}` } });
      return true;
    });
    if (!changed) return "denied";
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "unchanged";
    throw error;
  }
  return "changed";
}
