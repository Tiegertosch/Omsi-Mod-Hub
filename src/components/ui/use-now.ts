"use client";

import { useSyncExternalStore } from "react";

function subscribeEverySecond(onTick: () => void) {
  const timer = window.setInterval(onTick, 1000);
  return () => window.clearInterval(timer);
}
const subscribeNever = () => () => {};
// Auf volle Sekunden gerundet, damit sich der Wert zwischen zwei Ticks nicht ändert.
const readNow = () => Math.floor(Date.now() / 1000) * 1000;
const readServerNow = () => null;

/**
 * Aktuelle Zeit (Unix-ms), jede Sekunde neu – nur solange `active`. Vor der
 * Hydration `null`; dann den Zeitpunkt des Server-Renderings verwenden, damit
 * Server- und Client-HTML übereinstimmen.
 */
export function useNow(active: boolean): number | null {
  return useSyncExternalStore(active ? subscribeEverySecond : subscribeNever, readNow, readServerNow);
}
