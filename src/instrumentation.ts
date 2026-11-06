/**
 * Läuft einmal beim Start des Next-Servers. Startet den regelmäßigen Lauf der
 * Mail-Warteschlange (src/server/mail-outbox.ts): Wiederholungen nach
 * Fehlversuchen und Mails, die vor einem Neustart angelegt wurden.
 *
 * Nicht beim Build: Dort starten ebenfalls Server-Instanzen zum Vorrendern.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startMailOutbox } = await import("./server/mail-outbox");
  startMailOutbox();
}
