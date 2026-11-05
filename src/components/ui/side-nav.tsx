"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type SideNavItem = { href: string; label: string; count?: number };

type SideNavProps = { items: SideNavItem[]; label: string; root: string };

function NavList({ items, label, isActive }: { items: SideNavItem[]; label: string; isActive: (href: string) => boolean }) {
  return (
    <nav aria-label={label}>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {item.label}
                {item.count ? (
                  <span className="rounded-full bg-accent-soft px-2 text-xs leading-5 text-accent">{item.count}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Seitennavigation von Dashboard und Adminbereich, hebt die aktuelle Seite
 * hervor. `root` (Übersicht) gilt nur exakt, alle anderen Einträge auch für
 * Unterseiten (z. B. /dashboard/settings/security). Liest den Pfad, muss also
 * hinter <Suspense> stehen (Cache Components) – Fallback: SideNavFallback.
 */
export function SideNav({ items, label, root }: SideNavProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === root ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return <NavList items={items} label={label} isActive={isActive} />;
}

/** Dieselben Links ohne Markierung, solange der Pfad noch nicht bekannt ist. */
export function SideNavFallback({ items, label }: Omit<SideNavProps, "root">) {
  return <NavList items={items} label={label} isActive={() => false} />;
}
