import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("loginTitle"), robots: { index: false, follow: false } };
}

async function LoginContent({ searchParams }: Pick<PageProps<"/[locale]/login">, "searchParams">) {
  const [{ next }, user, locale] = await Promise.all([searchParams, getCurrentUser(), getLocale()]);
  const nextPath = typeof next === "string" ? next : "";
  // Bereits angemeldet: direkt weiter.
  if (user) redirect(safeRedirectPath(nextPath, `/${locale}/dashboard`));
  return <LoginForm next={safeRedirectPath(nextPath, "")} />;
}

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("loginTitle")} description={t("loginDescription")}>
      <Suspense fallback={<FormSkeleton />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
