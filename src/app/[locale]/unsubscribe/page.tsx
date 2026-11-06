import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { UnsubscribeForm } from "@/components/account/unsubscribe-form";
import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/ui/form";
import { FAVORITE_LIMIT } from "@/lib/favorites";

type Props = PageProps<"/[locale]/unsubscribe">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Favorites");
  return { title: t("unsubscribeTitle"), robots: { index: false, follow: false } };
}

/**
 * Ziel des Abmeldelinks aus den Update-Mails. Der Aufruf allein ändert nichts
 * (Link-Scanner der Mailanbieter); erst der Knopf meldet ab. Die Signatur
 * prüft die Action, damit die Seite für gültige und ungültige Links gleich
 * schnell lädt.
 */
async function UnsubscribeContent({ searchParams }: Pick<Props, "searchParams">) {
  const [{ u, s }, t] = await Promise.all([searchParams, getTranslations("Favorites")]);
  if (typeof u !== "string" || typeof s !== "string" || !u || !s) {
    return <FormAlert tone="error">{t("unsubscribeInvalid")}</FormAlert>;
  }
  return (
    <UnsubscribeForm
      userId={u}
      signature={s}
      labels={{
        text: t("unsubscribeText"),
        button: t("unsubscribeButton"),
        pending: t("settingsSaving"),
        done: t("unsubscribeDone"),
        undo: t("unsubscribeUndo"),
        errors: {
          unauthorized: t("errors.unauthorized"),
          rate_limit: t("errors.rate_limit"),
          not_found: t("errors.not_found"),
          limit: t("errors.limit", { max: FAVORITE_LIMIT }),
          invalid_link: t("unsubscribeInvalid"),
          generic: t("errors.generic"),
        },
      }}
    />
  );
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const t = await getTranslations("Favorites");
  return (
    <AuthShell title={t("unsubscribeTitle")}>
      <Suspense fallback={<FormSkeleton fields={1} />}>
        <UnsubscribeContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
