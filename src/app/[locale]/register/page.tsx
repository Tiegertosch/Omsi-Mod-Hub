import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("registerTitle"), robots: { index: false, follow: false } };
}

async function RegisterContent() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (user) redirect(`/${locale}/dashboard`);
  return <RegisterForm />;
}

export default async function RegisterPage() {
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("registerTitle")} description={t("registerDescription")}>
      <Suspense fallback={<FormSkeleton fields={4} />}>
        <RegisterContent />
      </Suspense>
    </AuthShell>
  );
}
