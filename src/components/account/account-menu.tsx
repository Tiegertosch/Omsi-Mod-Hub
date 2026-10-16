"use client";

import { ChevronDown, LayoutDashboard, LogOut, Settings, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

export type AccountMenuLabels = {
  menu: string;
  signedInAs: string;
  dashboard: string;
  settings: string;
  admin: string;
  logout: string;
};

const itemClass =
  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-3 hover:text-fg";

export function AccountMenu({
  name,
  username,
  isAdmin,
  labels,
}: {
  name: string;
  username: string;
  isAdmin: boolean;
  labels: AccountMenuLabels;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-2 rounded-lg px-1.5 text-sm text-fg transition-colors hover:bg-surface-3 sm:px-2"
      >
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-md bg-accent-soft font-display text-sm font-semibold text-accent"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-32 truncate lg:inline">{name}</span>
        <span className="sr-only">{labels.menu}</span>
        <ChevronDown aria-hidden className={cn("hidden size-4 text-subtle transition-transform sm:block", open && "rotate-180")} />
      </button>

      <div
        id={panelId}
        hidden={!open}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className="absolute right-0 z-50 mt-2 w-60 rounded-[var(--radius-card)] border border-border bg-surface p-1.5 shadow-card"
      >
        <div className="border-b border-border px-3 pt-1.5 pb-2.5">
          <p className="text-xs text-subtle">{labels.signedInAs}</p>
          <p className="truncate text-sm font-medium text-fg">{name}</p>
          <p className="truncate text-xs text-subtle">@{username}</p>
        </div>
        <ul className="py-1.5">
          <li>
            <Link href="/dashboard" className={itemClass}>
              <LayoutDashboard aria-hidden className="size-4" />
              {labels.dashboard}
            </Link>
          </li>
          <li>
            <Link href="/dashboard/settings" className={itemClass}>
              <Settings aria-hidden className="size-4" />
              {labels.settings}
            </Link>
          </li>
          {isAdmin ? (
            <li>
              <Link href="/admin" className={itemClass}>
                <ShieldCheck aria-hidden className="size-4" />
                {labels.admin}
              </Link>
            </li>
          ) : null}
        </ul>
        <form action={logoutAction} className="border-t border-border pt-1.5">
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className={itemClass}>
            <LogOut aria-hidden className="size-4" />
            {labels.logout}
          </button>
        </form>
      </div>
    </div>
  );
}
