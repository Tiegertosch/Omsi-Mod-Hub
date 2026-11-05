"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type SettingsNavItem = { href: string; label: string };

/** Reiter der Einstellungen (Profil, Sicherheit, Konto) – echte Links, ohne JavaScript nutzbar. */
export function SettingsNav({ items, label }: { items: SettingsNavItem[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="mb-8 border-b border-border">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "border-accent text-fg" : "border-transparent text-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
