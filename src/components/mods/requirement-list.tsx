import { Download, ExternalLink as ExternalLinkIcon, ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import type { RequirementPricing } from "@/generated/prisma/enums";
import { externalHost } from "@/lib/external-url";

export type RequirementItem = { id: string; name: string; url: string | null; pricing: RequirementPricing };

/**
 * Voraussetzungen und benötigte Add-ons. Freeware bekommt „Download“, Payware
 * „Zum Shop“; ohne Link nur Name und Bezugsart. Links führen direkt zum
 * Anbieter (beim Speichern wie Downloadlinks geprüft), das Ziel steht dabei.
 */
export async function RequirementList({ requirements }: { requirements: RequirementItem[] }) {
  const [t, link] = await Promise.all([getTranslations("Project"), getTranslations("ExternalLink")]);

  return (
    <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
      {requirements.map((requirement) => {
        const host = requirement.url ? externalHost(requirement.url) : null;
        const free = requirement.pricing === "FREEWARE";
        const Icon = free ? Download : ShoppingCart;
        return (
          <li key={requirement.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4">
            <div className="min-w-0">
              <p className="font-medium break-words text-fg">{requirement.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <Badge tone={free ? "success" : "warning"}>{t(`pricing.${requirement.pricing}`)}</Badge>
                {host ? <span>{link("externalTarget", { host })}</span> : null}
              </div>
            </div>
            {requirement.url && host ? (
              <a
                href={requirement.url}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className={buttonStyles({ variant: free ? "secondary" : "outline", size: "sm" })}
              >
                <Icon aria-hidden className="size-4" />
                {free ? t("requirementDownload") : t("requirementBuy")}
                <span className="sr-only">
                  : {requirement.name} {link("opensInNewTab")}
                </span>
                <ExternalLinkIcon aria-hidden className="size-3.5 opacity-70" />
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
