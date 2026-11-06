import { Bookmark } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { FAVORITE_LIMIT } from "@/lib/favorites";
import { cn } from "@/lib/utils";
import { getFavoriteState } from "@/server/data/favorites";
import { getCurrentUser } from "@/server/session";

import { FavoriteToggle, type FavoriteToggleLabels } from "./favorite-toggle";

/** Texte für FavoriteToggle (auch auf der Merkliste im Dashboard). */
export async function getFavoriteToggleLabels(): Promise<FavoriteToggleLabels> {
  const t = await getTranslations("Favorites");
  return {
    add: t("add"),
    saved: t("saved"),
    addLabel: t("addLabel"),
    removeLabel: t("removeLabel"),
    errors: {
      unauthorized: t("errors.unauthorized"),
      rate_limit: t("errors.rate_limit"),
      not_found: t("errors.not_found"),
      limit: t("errors.limit", { max: FAVORITE_LIMIT }),
      invalid_link: t("errors.invalid_link"),
      generic: t("errors.generic"),
    },
  };
}

/**
 * Merken auf der Projektseite. Liest die Session und steht deshalb hinter
 * <Suspense> (die Projektseite selbst bleibt zwischengespeichert). Gäste
 * sehen einen Link zur Anmeldung, der danach hierher zurückführt.
 */
export async function FavoriteButton({ projectId, slug, locale }: { projectId: string; slug: string; locale: string }) {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("Favorites")]);

  if (!user) {
    const next = `/${locale}/mods/${slug}`;
    return (
      <div className="space-y-2">
        <Link
          href={{ pathname: "/login", query: { next } }}
          className={cn(buttonStyles({ variant: "outline", size: "md" }), "w-full")}
        >
          <Bookmark aria-hidden className="size-4" />
          {t("loginToSave")}
        </Link>
        <p className="text-xs text-subtle">{t("hintGuest")}</p>
      </div>
    );
  }

  const [{ saved, notify }, labels] = await Promise.all([getFavoriteState(user.id, projectId), getFavoriteToggleLabels()]);
  const hint = saved ? (notify ? t("hintNotify") : t("hintNotifyOff")) : notify ? t("hintAdd") : t("hintAddNotifyOff");

  return (
    <div className="space-y-2">
      <FavoriteToggle projectId={projectId} saved={saved} labels={labels} />
      <p className="text-xs text-subtle">
        {hint}{" "}
        <Link href="/dashboard/settings/account#notifications" className="text-accent hover:text-accent-hover">
          {t("settingsLink")}
        </Link>
      </p>
    </div>
  );
}

export function FavoriteButtonSkeleton() {
  return <div aria-hidden className="h-10 w-full animate-pulse rounded-lg bg-surface-2" />;
}
