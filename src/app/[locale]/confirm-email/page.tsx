import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { ConfirmEmailForm } from "@/components/auth/confirm-email-form";
import { RegisterSteps } from "@/components/auth/register-steps";
import { FormAlert } from "@/components/ui/form";
import { Link } from "@/i18n/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { readPendingRegistration } from "@/server/pending-verification";
import { resendCooldownForPage } from "@/server/resend-cooldown";

type Props = PageProps<"/[locale]/confirm-email">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("confirmTitle"), robots: { index: false, follow: false } };
}

/** Schritt 2: Ziel nach Registrierung und nach der Anmeldung eines unbestätigten Kontos. */
async function ConfirmContent({ searchParams }: Pick<Props, "searchParams">) {
  await connection();
  const [{ next, unverified }, pending, t] = await Promise.all([
    searchParams,
    readPendingRegistration(),
    getTranslations("Auth"),
  ]);
  // Läuft die Sperre für „Code erneut senden“ noch (z. B. nach Neuladen), zeigt das Formular den Countdown.
  const cooldown = await resendCooldownForPage(pending?.email || null);

  return (
    <div className="space-y-6">
      {unverified === "1" ? <FormAlert tone="success">{t("unverifiedNotice")}</FormAlert> : null}
      <ConfirmEmailForm
        email={pending?.email || null}
        next={safeRedirectPath(typeof next === "string" ? next : "", "")}
        resendRetryAt={cooldown.retryAt}
        renderedAt={cooldown.now}
      />
      <p className="border-t border-border pt-5 text-xs text-subtle">
        {t.rich("codeExistingAccount", {
          login: (chunks) => (
            <Link href="/login" className="text-accent hover:text-accent-hover">
              {chunks}
            </Link>
          ),
          reset: (chunks) => (
            <Link href="/forgot-password" className="text-accent hover:text-accent-hover">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}

export default async function ConfirmEmailPage({ searchParams }: Props) {
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("confirmTitle")} header={<RegisterSteps current={2} />}>
      <Suspense fallback={<FormSkeleton />}>
        <ConfirmContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
