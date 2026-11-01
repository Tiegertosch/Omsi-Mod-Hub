import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { AppealForm } from "@/components/appeal/appeal-form";
import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/ui/form";
import { getClientMessages } from "@/i18n/client-messages";
import { canAppeal } from "@/lib/appeals";
import { getDecisionByAppealToken } from "@/server/data/appeals";

type Props = PageProps<"/[locale]/appeal">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Appeal");
  return { title: t("title"), robots: { index: false, follow: false } };
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-subtle uppercase">{label}</dt>
      <dd className="mt-1 text-sm whitespace-pre-line text-fg">{children}</dd>
    </div>
  );
}

async function AppealContent({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await rootLocale();
  const [{ token }, t, format] = await Promise.all([searchParams, getTranslations("Appeal"), getFormatter()]);
  const decision = await getDecisionByAppealToken(token, locale);
  if (!decision) return <FormAlert tone="error">{t("invalidLink")}</FormAlert>;

  const date = (value: Date) => format.dateTime(value, { dateStyle: "long" });
  const open = canAppeal(decision, new Date());

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 rounded-lg border border-border bg-surface-2 p-4 sm:grid-cols-2">
        <Detail label={t("project")}>{decision.projectTitle}</Detail>
        <Detail label={t("decision")}>
          {t(`kind.${decision.kind}`)} · {date(decision.createdAt)}
        </Detail>
        <div className="sm:col-span-2">
          <Detail label={t("reason")}>{decision.reason}</Detail>
        </div>
        {decision.appealStatus === "NONE" ? <Detail label={t("deadline")}>{date(decision.appealUntil)}</Detail> : null}
      </dl>

      {decision.appealStatus === "NONE" ? (
        open ? (
          <NextIntlClientProvider messages={await getClientMessages(["Appeal"])}>
            <AppealForm token={decision.token} />
          </NextIntlClientProvider>
        ) : (
          <FormAlert tone="error">{t("expired", { date: date(decision.appealUntil) })}</FormAlert>
        )
      ) : (
        <div className="space-y-4">
          {decision.appealStatus === "OPEN" ? (
            <FormAlert tone="success">{t("open", { date: date(decision.appealedAt ?? decision.createdAt) })}</FormAlert>
          ) : (
            <FormAlert tone={decision.appealStatus === "GRANTED" ? "success" : "error"}>
              {t(decision.appealStatus === "GRANTED" ? "granted" : "denied", {
                date: date(decision.resolvedAt ?? decision.createdAt),
              })}
            </FormAlert>
          )}
          <dl className="space-y-4">
            {decision.appealMessage ? <Detail label={t("yourMessage")}>{decision.appealMessage}</Detail> : null}
            {decision.resolutionNote ? <Detail label={t("resolutionNote")}>{decision.resolutionNote}</Detail> : null}
          </dl>
        </div>
      )}
    </div>
  );
}

export default async function AppealPage({ searchParams }: Props) {
  const t = await getTranslations("Appeal");
  return (
    <AuthShell title={t("title")} description={t("description")} wide>
      <Suspense fallback={<FormSkeleton fields={3} />}>
        <AppealContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
