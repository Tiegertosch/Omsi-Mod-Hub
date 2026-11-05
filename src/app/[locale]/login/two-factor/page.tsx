import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { TwoFactorLoginForm } from "@/components/auth/two-factor-login-form";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/session";
import { twoFactorChallenge } from "@/server/two-factor-cookie";

type Props = PageProps<"/[locale]/login/two-factor">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("twoFactor.title"), robots: { index: false, follow: false } };
}

async function TwoFactorContent({ searchParams }: Pick<Props, "searchParams">) {
  const [{ next, method }, user, locale, challenge, t] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getLocale(),
    twoFactorChallenge(),
    getTranslations("Auth"),
  ]);
  const nextPath = safeRedirectPath(typeof next === "string" ? next : "", "");
  if (user) redirect(nextPath || `/${locale}/dashboard`);

  // Ohne Challenge-Cookie (abgelaufen oder direkt aufgerufen) zurück zum Passwort.
  if (!challenge) {
    return (
      <div className="space-y-5 text-sm text-muted">
        <p>{t("errors.two_factor_expired")}</p>
        <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"} className={buttonStyles({ className: "w-full" })}>
          {t("twoFactor.backToLogin")}
        </Link>
      </div>
    );
  }
  return <TwoFactorLoginForm next={nextPath} method={method === "backup" ? "backup" : "totp"} />;
}

export default async function TwoFactorPage({ searchParams }: Props) {
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("twoFactor.title")} description={t("twoFactor.description")}>
      <Suspense fallback={<FormSkeleton fields={1} />}>
        <TwoFactorContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
