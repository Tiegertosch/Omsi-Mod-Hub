import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("forgotTitle"), robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("forgotTitle")} description={t("forgotDescription")}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
