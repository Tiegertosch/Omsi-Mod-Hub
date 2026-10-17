import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { RegisterSteps } from "@/components/auth/register-steps";
import { readPendingRegistration } from "@/server/pending-verification";
import { getCurrentUser } from "@/server/session";

type Props = PageProps<"/[locale]/register">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("registerTitle"), robots: { index: false, follow: false } };
}

/** Schritt 1. Mit `?edit=1` („E-Mail-Adresse bearbeiten“) sind Name und Adresse vorausgefüllt. */
async function RegisterContent({ searchParams }: Pick<Props, "searchParams">) {
  const [{ edit }, user, locale] = await Promise.all([searchParams, getCurrentUser(), getLocale()]);
  if (user) redirect(`/${locale}/dashboard`);
  const pending = edit === "1" ? await readPendingRegistration() : null;
  return <RegisterForm initial={pending ?? undefined} />;
}

export default async function RegisterPage({ searchParams }: Props) {
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("registerTitle")} description={t("registerDescription")} header={<RegisterSteps current={1} />}>
      <Suspense fallback={<FormSkeleton fields={4} />}>
        <RegisterContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
