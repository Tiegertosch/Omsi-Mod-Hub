import "server-only";

import { db } from "@/lib/db";
import {
  allowedMailPriority,
  decideRetry,
  MAIL_LOCK_MINUTES,
  MAIL_PRIORITY,
  mailErrorCode,
  mailExpiresAt,
} from "@/lib/mail-queue";

import { deliverMail, mailChannel, mailHourlyLimit, mailSendIntervalMs, type MailMessage } from "./mail-transport";

/**
 * Mail-Warteschlange in der Datenbank (Tabelle MailOutbox).
 *
 * Actions legen Mails nur an und kehren sofort zurück. Ein Versandlauf im
 * Serverprozess verschickt sie nacheinander: Codes und Kontomails vor
 * Benachrichtigungen, bei SMTP mit Pause (MAIL_SEND_INTERVAL_MS). Fehlversuche
 * werden mit wachsendem Abstand wiederholt (src/lib/mail-queue.ts), bis die
 * Mail abläuft. Nach dem Versand wird der Eintrag gelöscht, weil er Codes und
 * Links im Klartext enthält.
 *
 * Gestartet wird der Lauf nach jedem Anlegen und jede Minute aus
 * src/instrumentation.ts (Wiederholungen, Einträge von vor einem Neustart).
 * Der Zustand liegt auf globalThis, weil Next den Code für Instrumentation,
 * Actions und Route Handler getrennt bündeln kann.
 */

export type QueueOptions = {
  /** Gültigkeit in Minuten (Codes, Links); danach wird nicht mehr versendet */
  validMinutes?: number;
  /** Benachrichtigung: nachrangig hinter Codes und Kontomails */
  bulk?: boolean;
};

type WorkerState = { running: boolean; again: boolean; timer?: ReturnType<typeof setInterval> };

const STATE_KEY = Symbol.for("omsi-mod-hub.mail-outbox");
const globalState = globalThis as unknown as Record<symbol, WorkerState | undefined>;
const state: WorkerState = (globalState[STATE_KEY] ??= { running: false, again: false });

function row(message: MailMessage, options: QueueOptions, now: Date) {
  return {
    channel: mailChannel(),
    priority: options.bulk ? MAIL_PRIORITY.bulk : MAIL_PRIORITY.account,
    recipient: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html ?? null,
    headers: message.headers ? JSON.stringify(message.headers) : null,
    nextAttemptAt: now,
    expiresAt: mailExpiresAt(now, options.validMinutes),
  };
}

/** Legt Mails an und stößt den Versand an. Wirft bei Datenbankfehlern. */
export async function enqueueMails(messages: readonly MailMessage[], options: QueueOptions = {}): Promise<void> {
  if (messages.length === 0) return;
  const now = new Date();
  await db.mailOutbox.createMany({ data: messages.map((message) => row(message, options, now)) });
  kickMailOutbox();
}

/** Startet einen Versandlauf, falls keiner läuft; sonst läuft der aktuelle danach noch einmal. */
export function kickMailOutbox(): void {
  if (state.running) {
    state.again = true;
    return;
  }
  state.running = true;
  state.again = false;
  processOutbox()
    .catch((error: unknown) => {
      console.error("[mail] Versandlauf fehlgeschlagen:", error instanceof Error ? error.message : "unbekannter Fehler");
    })
    .finally(() => {
      state.running = false;
      if (state.again) kickMailOutbox();
    });
}

/** Regelmäßiger Versandlauf (aus src/instrumentation.ts). Mehrfaches Aufrufen startet nur einen Zeitgeber. */
export function startMailOutbox(intervalMs = 60_000): void {
  if (state.timer) return;
  state.timer = setInterval(kickMailOutbox, intervalMs);
  state.timer.unref?.();
  kickMailOutbox();
}

const EMPTY_CONTENT = { recipient: null, subject: null, text: null, html: null, headers: null };

/** Reserviert den nächsten fälligen Eintrag dieses Versandwegs; `null`, wenn keiner fällig ist. */
async function claimNext(channel: string, maxPriority: number) {
  for (let tries = 0; tries < 5; tries++) {
    const now = new Date();
    const candidate = await db.mailOutbox.findFirst({
      where: {
        channel,
        failedAt: null,
        priority: { lte: maxPriority },
        nextAttemptAt: { lte: now },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      select: { id: true, lockedUntil: true },
    });
    if (!candidate) return null;
    // Bedingt auf den gelesenen Stand: Nur ein Lauf (auch in einem zweiten Prozess) gewinnt.
    const claimed = await db.mailOutbox.updateMany({
      where: { id: candidate.id, failedAt: null, lockedUntil: candidate.lockedUntil },
      data: { lockedUntil: new Date(now.getTime() + MAIL_LOCK_MINUTES * 60_000) },
    });
    if (claimed.count === 1) return db.mailOutbox.findUnique({ where: { id: candidate.id } });
  }
  return null;
}

const HOUR = 60 * 60 * 1000;

/**
 * Stundenlimit des Mailanbieters: Gezählt werden Sendeversuche (auch
 * fehlgeschlagene) der letzten Stunde in MailSendLog, gemeinsam für alle
 * Prozesse und über Neustarts hinweg. Ist das Budget für Benachrichtigungen
 * aufgebraucht, gehen nur noch Codes und Kontomails raus; ist alles
 * aufgebraucht, wartet die Warteschlange auf den nächsten Lauf (jede Minute).
 */
async function sendBudget(limit: number | null): Promise<number | null> {
  if (limit === null) return allowedMailPriority(0, null);
  const since = new Date(Date.now() - HOUR);
  const sent = await db.mailSendLog.count({ where: { sentAt: { gt: since } } });
  return allowedMailPriority(sent, limit);
}

async function processOutbox(): Promise<void> {
  const channel = mailChannel();
  const interval = mailSendIntervalMs();
  const limit = mailHourlyLimit();
  if (limit !== null) await db.mailSendLog.deleteMany({ where: { sentAt: { lte: new Date(Date.now() - HOUR) } } });

  for (;;) {
    const maxPriority = await sendBudget(limit);
    if (maxPriority === null) return;
    const entry = await claimNext(channel, maxPriority);
    if (!entry) return;
    const now = new Date();

    if (entry.expiresAt <= now || !entry.recipient || !entry.subject || entry.text === null) {
      await db.mailOutbox.update({
        where: { id: entry.id },
        data: { ...EMPTY_CONTENT, failedAt: now, lockedUntil: null, lastError: entry.lastError ?? "expired" },
      });
      continue;
    }

    if (limit !== null) await db.mailSendLog.create({ data: {} });
    try {
      await deliverMail({
        to: entry.recipient,
        subject: entry.subject,
        text: entry.text,
        html: entry.html ?? undefined,
        headers: entry.headers ? (JSON.parse(entry.headers) as Record<string, string>) : undefined,
      });
      await db.mailOutbox.delete({ where: { id: entry.id } });
    } catch (error) {
      const attempts = entry.attempts + 1;
      const code = mailErrorCode(error);
      const decision = decideRetry(attempts, new Date(), entry.expiresAt);
      if (decision.kind === "retry") {
        await db.mailOutbox.update({
          where: { id: entry.id },
          data: { attempts, lastError: code, nextAttemptAt: decision.nextAttemptAt, lockedUntil: null },
        });
        console.warn(`[mail] Versand fehlgeschlagen (${code}), Versuch ${attempts}; neuer Versuch geplant.`);
      } else {
        await db.mailOutbox.update({
          where: { id: entry.id },
          data: { ...EMPTY_CONTENT, attempts, lastError: code, failedAt: new Date(), lockedUntil: null },
        });
        console.error(`[mail] Versand endgültig fehlgeschlagen (${code}) nach ${attempts} Versuchen.`);
      }
    }

    if (interval > 0) await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
