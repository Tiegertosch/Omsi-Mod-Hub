import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { CreatorSummary } from "@/server/data/creators";

export function CreatorAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-surface-3 to-border-strong font-display font-semibold text-accent ${className ?? "size-12 text-lg"}`}
    >
      {initials}
    </span>
  );
}

export function CreatorCard({ creator }: { creator: CreatorSummary }) {
  const t = useTranslations("Creators");
  const common = useTranslations("Common");

  return (
    <article className="relative flex h-full gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <CreatorAvatar name={creator.displayName} />
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 font-semibold text-fg">
          <Link
            href={`/creators/${creator.username}`}
            className="truncate after:absolute after:inset-0 after:content-[''] hover:text-accent"
          >
            {creator.displayName}
          </Link>
          {creator.verified ? (
            <BadgeCheck aria-label={common("verified")} className="size-4 shrink-0 text-info" />
          ) : null}
        </h3>
        <p className="text-xs text-subtle">@{creator.username}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge>{t("projects", { count: creator.projectCount })}</Badge>
          {creator.isSample ? <Badge tone="warning">{common("sample")}</Badge> : null}
        </div>
      </div>
    </article>
  );
}
