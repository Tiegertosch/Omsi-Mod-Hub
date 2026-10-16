import "server-only";

import type { Messages } from "next-intl";
import { getMessages } from "next-intl/server";

/** Namespaces, die auf allen Seiten von Client-Komponenten benötigt werden. */
const BASE_NAMESPACES = ["Report", "Errors", "Auth", "Account"] as const satisfies readonly (keyof Messages)[];

/**
 * Wählt die Übersetzungen aus, die an den Browser gehen. Bereiche wie das
 * Dashboard ergänzen eigene Namespaces über einen verschachtelten Provider.
 */
export async function getClientMessages(extra: readonly (keyof Messages)[] = []) {
  const messages = await getMessages();
  return Object.fromEntries([...BASE_NAMESPACES, ...extra].map((key) => [key, messages[key]]));
}
