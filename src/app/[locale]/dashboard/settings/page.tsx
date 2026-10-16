import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { PasswordForm, ProfileForm } from "@/components/account/settings-forms";
import { FormSkeleton } from "@/components/auth/auth-shell";
import { CreatorProfileForm } from "@/components/creator/creator-profile-form";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("settingsTitle"), robots: { index: false, follow: false } };
}

async function SettingsContent() {
  const locale = await rootLocale();
  const user = await requireUser(locale, `/${locale}/dashboard/settings`);
  const [t, creatorT, creatorProfile] = await Promise.all([
    getTranslations("Account"),
    getTranslations("Creator"),
    db.creatorProfile.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {creatorProfile ? (
        <section aria-labelledby="creator" className="rounded-[var(--radius-card)] border border-border bg-surface p-6 xl:col-span-2">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 id="creator" className="text-lg font-semibold text-fg">
                {creatorT("profileTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted">{creatorT("profileText")}</p>
            </div>
            <Link href={`/creators/${user.username}`} className="text-sm font-medium text-accent hover:text-accent-hover">
              {creatorT("viewPublicProfile")}
            </Link>
          </div>
          <div className="max-w-2xl">
            <CreatorProfileForm
              mode="edit"
              initial={{
                displayName: creatorProfile.displayName,
                bio: creatorProfile.bio ?? "",
                websiteUrl: creatorProfile.websiteUrl ?? "",
              }}
            />
          </div>
        </section>
      ) : null}
      <section aria-labelledby="profile" className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <h2 id="profile" className="mb-5 text-lg font-semibold text-fg">
          {t("profileSection")}
        </h2>
        <ProfileForm name={user.name} username={user.username} preferredLocale={user.preferredLocale} />
      </section>
      <section aria-labelledby="password" className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <h2 id="password" className="mb-5 text-lg font-semibold text-fg">
          {t("passwordSection")}
        </h2>
        <PasswordForm />
      </section>
    </div>
  );
}

export default async function SettingsPage() {
  const t = await getTranslations("Account");
  return (
    <>
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-fg">{t("settingsTitle")}</h1>
      <Suspense fallback={<FormSkeleton fields={4} />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}
