import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type Query = Record<string, string | string[]>;

export function Pagination({
  pathname,
  query,
  page,
  pageCount,
}: {
  pathname: string;
  query: Query;
  page: number;
  pageCount: number;
}) {
  const t = useTranslations("Pagination");
  if (pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const next = { ...query };
    if (target > 1) next.page = String(target);
    else delete next.page;
    return { pathname, query: next };
  };

  const itemClass = "inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-medium";

  return (
    <nav aria-label={t("label")} className="mt-10 flex flex-col items-center gap-3">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" className={cn(itemClass, "gap-1 text-muted hover:bg-surface-3 hover:text-fg")}>
              <ChevronLeft aria-hidden className="size-4" />
              {t("previous")}
            </Link>
          ) : (
            <span className={cn(itemClass, "gap-1 text-subtle/60")} aria-disabled="true">
              <ChevronLeft aria-hidden className="size-4" />
              {t("previous")}
            </span>
          )}
        </li>
        {pageWindow(page, pageCount).map((p, index) =>
          p === null ? (
            <li key={`gap-${index}`} aria-hidden className="px-1 text-subtle">
              …
            </li>
          ) : (
            <li key={p}>
              {p === page ? (
                <span aria-current="page" className={cn(itemClass, "bg-accent text-accent-fg")}>
                  {p}
                </span>
              ) : (
                <Link href={hrefFor(p)} className={cn(itemClass, "text-muted hover:bg-surface-3 hover:text-fg")}>
                  {p}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {page < pageCount ? (
            <Link href={hrefFor(page + 1)} rel="next" className={cn(itemClass, "gap-1 text-muted hover:bg-surface-3 hover:text-fg")}>
              {t("next")}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <span className={cn(itemClass, "gap-1 text-subtle/60")} aria-disabled="true">
              {t("next")}
              <ChevronRight aria-hidden className="size-4" />
            </span>
          )}
        </li>
      </ul>
      <p className="text-xs text-subtle">{t("page", { page, total: pageCount })}</p>
    </nav>
  );
}
