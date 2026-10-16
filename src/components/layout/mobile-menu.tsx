"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MobileMenu({
  openLabel,
  closeLabel,
  children,
}: {
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-fg"
      >
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        <span className="sr-only">{open ? closeLabel : openLabel}</span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        // Schließt das Menü, sobald ein Link darin angeklickt wird.
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={cn("absolute inset-x-0 top-full border-b border-border bg-surface px-4 pt-4 pb-6 shadow-card")}
      >
        {children}
      </div>
    </div>
  );
}
