"use client";

import { usePathname } from "@/i18n/navigation";

import { isActiveHref, NavLinkList, type NavItem } from "./nav-links";

export function ActiveNavLinks({
  items,
  orientation,
}: {
  items: NavItem[];
  orientation?: "horizontal" | "vertical";
}) {
  const pathname = usePathname();
  const active = items.find((item) => isActiveHref(pathname, item.href))?.href ?? null;
  return <NavLinkList items={items} activeHref={active} orientation={orientation} />;
}
