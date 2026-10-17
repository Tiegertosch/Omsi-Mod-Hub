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
 * - "denied":    kein unbestätigtes Konto mit diesem Namen oder falsches
 *                Passwort; der Aufrufer meldet „Benutzername vergeben“.
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
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { email: input.newEmail } }),
      // Offener Code der alten Adresse (Bezeichner des emailOTP-Plugins).
      db.verification.deleteMany({ where: { identifier: `email-verification-otp-${user.email}` } }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "unchanged";
    throw error;
  }
  return "changed";
}
