import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { LinkSourceType, LinkStatus } from "@/generated/prisma/enums";
import { externalHost } from "@/lib/external-url";
import { cn } from "@/lib/utils";

export type ExternalLinkItem = {
  id: string;
  url: string;
  label: string | null;
  sourceType: LinkSourceType;
  status: LinkStatus;
};

/**
 * Externe Downloads. Links führen über /go/[id], damit Aufrufe gezählt werden
 * können; das Ziel wird immer sichtbar angegeben.
 */
export function ExternalLinkList({ links, preview = false }: { links: ExternalLinkItem[]; preview?: boolean }) {
  const t = useTranslations("ExternalLink");

  const visible = links
    .map((link) => ({ ...link, host: externalHost(link.url) }))
    .filter((link) => link.host !== null && link.status !== "BLOCKED");

  if (visible.length === 0) return null;

  return (
    <ul className="space-y-3">
      {visible.map((link, index) => (
        <li key={link.id}>
          {preview ? (
            // Vorschau: /go leitet nur bei veröffentlichten Projekten weiter.
            <span className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-border-strong px-4 py-3 font-semibold text-muted">
              {link.label ? t("openNamed", { label: link.label }) : t("open")}
              <ExternalLinkIcon aria-hidden className="size-4 shrink-0" />
            </span>
          ) : (
            <a
              href={`/go/${link.id}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={cn(
                "group flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left font-semibold transition-colors",
                index === 0
                  ? "bg-accent text-accent-fg hover:bg-accent-hover"
                  : "border border-border-strong bg-surface-3 text-fg hover:border-accent hover:text-accent",
              )}
            >
              <span>
                {link.label ? t("openNamed", { label: link.label }) : t("open")}
                <span className="sr-only"> {t("opensInNewTab")}</span>
              </span>
              <ExternalLinkIcon aria-hidden className="size-4 shrink-0" />
            </a>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>{t("externalTarget", { host: link.host ?? "" })}</span>
            <Badge>{t(`sourceType.${link.sourceType}`)}</Badge>
            {link.status === "BROKEN" ? (
              <Badge tone="danger">{t("broken")}</Badge>
            ) : link.status === "OK" ? (
              <Badge tone="success">{t("ok")}</Badge>
            ) : (
              <Badge>{t("unverified")}</Badge>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
