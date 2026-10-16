import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { FormAlert } from "@/components/ui/form";
import { Link } from "@/i18n/navigation";

type Props = PageProps<"/[locale]/reset-password">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("resetTitle"), robots: { index: false, follow: false } };
}

async function ResetContent({ searchParams }: Pick<Props, "searchParams">) {
  const [{ token, error }, t] = await Promise.all([searchParams, getTranslations("Auth")]);
  // Better Auth leitet bei ungültigem Token mit ?error=INVALID_TOKEN hierher.
  if (typeof token !== "string" || token.length === 0 || token.length > 512 || error) {
    return (
      <div className="space-y-6">
        <FormAlert tone="error">{t("resetMissingToken")}</FormAlert>
        <Link href="/forgot-password" className="inline-block text-sm font-medium text-accent hover:text-accent-hover">
          {t("forgotTitle")}
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("resetTitle")}>
      <Suspense fallback={<FormSkeleton />}>
        <ResetContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
