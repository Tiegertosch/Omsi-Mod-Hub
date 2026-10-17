import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("deletedTitle"), robots: { index: false, follow: false } };
}

/** Ziel nach dem Löschen des Kontos. Zeigt nur einen festen Text. */
export default async function AccountDeletedPage() {
  const t = await getTranslations("Account");
  return (
    <div className="flex justify-center px-4 py-20">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
        <CircleCheck aria-hidden className="mx-auto mb-4 size-12 text-success" />
        <h1 className="text-2xl font-bold tracking-tight text-fg">{t("deletedTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("deletedText")}</p>
        <Link href="/" className={buttonStyles({ className: "mt-7" })}>
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
