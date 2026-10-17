import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { ConfirmEmailForm } from "@/components/auth/confirm-email-form";
import { FormAlert } from "@/components/ui/form";
import { Link } from "@/i18n/navigation";
import { VERIFICATION_CODE_LENGTH } from "@/lib/auth-rules";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { readPendingEmail } from "@/server/pending-verification";

type Props = PageProps<"/[locale]/confirm-email">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("confirmTitle"), robots: { index: false, follow: false } };
}

/** Ziel nach Registrierung und nach der Anmeldung eines unbestätigten Kontos. */
async function ConfirmContent({ searchParams }: Pick<Props, "searchParams">) {
  const [{ next, unverified }, email, t] = await Promise.all([searchParams, readPendingEmail(), getTranslations("Auth")]);
  const length = VERIFICATION_CODE_LENGTH;

  return (
    <div className="space-y-5">
      {unverified === "1" ? <FormAlert tone="success">{t("unverifiedNotice")}</FormAlert> : null}
      <p className="text-sm text-muted">{email ? t("codeSentTo", { email, length }) : t("codeSentGeneric", { length })}</p>
      <ConfirmEmailForm email={email} next={safeRedirectPath(typeof next === "string" ? next : "", "")} />
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
    <AuthShell title={t("confirmTitle")}>
      <Suspense fallback={<FormSkeleton />}>
        <ConfirmContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
