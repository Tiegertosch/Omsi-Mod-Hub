import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { ProfileForm } from "@/components/account/settings-forms";
import { SettingsSection } from "@/components/account/settings-section";
import { FormSkeleton } from "@/components/auth/auth-shell";
import { CreatorProfileForm } from "@/components/creator/creator-profile-form";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/session";

type Props = PageProps<"/[locale]/dashboard/settings">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: `${t("settingsNav.profile")} – ${t("settingsTitle")}`, robots: { index: false, follow: false } };
}

/** Einstellungen → Profil: Anzeigename, Sprache und Creator-Profil. */
async function ProfileContent({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await rootLocale();
  const [params, user, t, creatorT] = await Promise.all([
    searchParams,
    requireUser(locale, `/${locale}/dashboard/settings`),
    getTranslations("Account"),
    getTranslations("Creator"),
  ]);

  // Links aus früheren Mails (vor der Aufteilung in Unterseiten) zeigen hierher.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") query.set(key, value);
  if (params.emailChange) redirect(`/${locale}/dashboard/settings/account?${query}`);
  if (params.twoFactor) redirect(`/${locale}/dashboard/settings/security?${query}`);

  const creatorProfile = await db.creatorProfile.findUnique({ where: { userId: user.id } });

  return (
    <div className="space-y-6">
      <SettingsSection id="profile" title={t("profileSection")}>
        <ProfileForm name={user.name} username={user.username} preferredLocale={user.preferredLocale} />
      </SettingsSection>

      {creatorProfile ? (
        <SettingsSection
          id="creator"
          title={creatorT("profileTitle")}
          description={creatorT("profileText")}
          action={
            <Link href={`/creators/${user.username}`} className="text-sm font-medium text-accent hover:text-accent-hover">
              {creatorT("viewPublicProfile")}
            </Link>
          }
        >
          <CreatorProfileForm
            mode="edit"
            initial={{
              displayName: creatorProfile.displayName,
              bio: creatorProfile.bio ?? "",
              websiteUrl: creatorProfile.websiteUrl ?? "",
            }}
          />
        </SettingsSection>
      ) : null}
    </div>
  );
}

export default function ProfileSettingsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<FormSkeleton fields={4} />}>
      <ProfileContent searchParams={searchParams} />
    </Suspense>
  );
}
