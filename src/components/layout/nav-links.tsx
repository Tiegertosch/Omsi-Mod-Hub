import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: "/mods" | "/creators" | "/search"; label: string };

export function isActiveHref(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Darstellung der Hauptnavigation (ohne Hooks, auch als Suspense-Fallback nutzbar). */
export function NavLinkList({
  items,
  activeHref,
  orientation = "horizontal",
}: {
  items: NavItem[];
  activeHref: string | null;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <ul className={cn("flex", orientation === "horizontal" ? "items-center gap-1" : "flex-col gap-1")}>
      {items.map((item) => {
        const active = activeHref === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                orientation === "vertical" && "text-base",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
