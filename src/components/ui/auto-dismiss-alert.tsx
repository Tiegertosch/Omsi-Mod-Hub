"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { FormAlert } from "./form";

export const AUTO_DISMISS_MS = 5_000;

/**
 * Hinweis, der sich nach `durationMs` selbst ausblendet. Ein kleiner Ring oben
 * rechts zeigt die verbleibende Zeit (ohne Zahl). Zeigt die Maus darauf oder
 * liegt der Fokus darin, hält der Countdown an, damit niemand beim Lesen den
 * Text verliert.
 *
 * `resetKey` ist das Ergebnis der Action (bei jedem Absenden ein neues
 * Objekt): Ein neues Ergebnis zeigt den Hinweis wieder und startet neu.
 *
 * Ausgeblendet wird per Timer, nicht am Animationsende – bei „Bewegung
 * reduzieren“ verkürzt globals.css alle Animationen auf fast null, der Ring
 * entfällt dann, die Anzeigedauer bleibt.
 */
export function AutoDismissAlert({
  tone,
  resetKey,
  durationMs = AUTO_DISMISS_MS,
  children,
}: {
  tone: "error" | "success";
  resetKey: unknown;
  durationMs?: number;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setVisible(true);
    setCycle((value) => value + 1);
  }

  const paused = hovered || focused;
  const remaining = useRef(durationMs);
  const remainingCycle = useRef(cycle);

  useEffect(() => {
    if (remainingCycle.current !== cycle) {
      remainingCycle.current = cycle;
      remaining.current = durationMs;
    }
    if (!visible || paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => setVisible(false), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [visible, paused, cycle, durationMs]);

  if (!visible) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <FormAlert tone={tone} className="pr-10">
        {children}
      </FormAlert>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className={cn(
          "absolute top-3 right-3 size-4 -rotate-90 motion-reduce:hidden",
          tone === "error" ? "text-danger" : "text-success",
        )}
      >
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth="2.5" />
        <circle
          key={cycle}
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          style={{
            animation: `countdown-ring ${durationMs}ms linear forwards`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      </svg>
    </div>
  );
}
