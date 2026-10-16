import { CircleCheck, CircleX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { FormSkeleton } from "@/components/auth/auth-shell";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type Props = PageProps<"/[locale]/verify-email">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("verifyTitle"), robots: { index: false, follow: false } };
}

/** Ziel des Bestätigungslinks; Better Auth hängt bei Fehlern ?error=… an. */
async function VerifyResult({ searchParams }: Pick<Props, "searchParams">) {
  const [{ error }, t] = await Promise.all([searchParams, getTranslations("Auth")]);
  const failed = typeof error === "string" && error.length > 0;
  const Icon = failed ? CircleX : CircleCheck;

  return (
    <div className="text-center">
      <Icon aria-hidden className={`mx-auto mb-4 size-12 ${failed ? "text-danger" : "text-success"}`} />
      <h1 className="text-2xl font-bold tracking-tight text-fg">{failed ? t("verifyErrorTitle") : t("verifyTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{failed ? t("verifyErrorText") : t("verifyText")}</p>
      <Link href={failed ? "/login" : "/dashboard"} className={buttonStyles({ className: "mt-7" })}>
        {failed ? t("loginLink") : t("toDashboard")}
      </Link>
    </div>
  );
}

export default function VerifyEmailPage({ searchParams }: Props) {
  return (
    <div className="flex justify-center px-4 py-20">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-card">
        <Suspense fallback={<FormSkeleton fields={1} />}>
          <VerifyResult searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
