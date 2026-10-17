import { Monitor, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense, type ReactNode } from "react";

import { DeleteAccountForm, RevokeOtherSessionsForm, RevokeSessionForm } from "@/components/account/account-security";
import { EmailForm, PasswordForm, ProfileForm } from "@/components/account/settings-forms";
import { FormSkeleton } from "@/components/auth/auth-shell";
import { CreatorProfileForm } from "@/components/creator/creator-profile-form";
import { Badge } from "@/components/ui/badge";
import { FormAlert } from "@/components/ui/form";
import { Link } from "@/i18n/navigation";
import { canDeleteOwnAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { getDeletionSummary, getOwnSessions } from "@/server/data/account";
import { requireUser } from "@/server/session";

type Props = PageProps<"/[locale]/dashboard/settings">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("settingsTitle"), robots: { index: false, follow: false } };
}

function Section({
  id,
  title,
  description,
  className,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn("rounded-[var(--radius-card)] border border-border bg-surface p-6", className)}>
      <h2 id={id} className={cn("text-lg font-semibold text-fg", description ? "mb-1" : "mb-5")}>
        {title}
      </h2>
      {description ? <p className="mb-5 text-sm text-muted">{description}</p> : null}
      {children}
    </section>
  );
}

const MOBILE_SYSTEMS = new Set(["iOS", "Android"]);

async function SettingsContent({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await rootLocale();
  const user = await requireUser(locale, `/${locale}/dashboard/settings`);
  const [{ emailChange, error }, t, creatorT, format, creatorProfile, sessions, deletion] = await Promise.all([
    searchParams,
    getTranslations("Account"),
    getTranslations("Creator"),
    getFormatter(),
    db.creatorProfile.findUnique({ where: { userId: user.id } }),
    getOwnSessions(user),
    getDeletionSummary(user.id),
  ]);
  // Ziel der Bestätigungslinks; Better Auth hängt bei Fehlern ?error=… an.
  const emailChangeNotice = emailChange === "1" ? (typeof error === "string" && error ? "error" : "confirmed") : null;
  const canDelete = canDeleteOwnAccount(user.role);

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

      <Section id="profile" title={t("profileSection")}>
        <ProfileForm name={user.name} username={user.username} preferredLocale={user.preferredLocale} />
      </Section>

      <Section id="email" title={t("emailSection")}>
        {emailChangeNotice ? (
          <div className="mb-5">
            <FormAlert tone={emailChangeNotice === "error" ? "error" : "success"}>
              {emailChangeNotice === "error" ? t("emailChangeFailed") : t("emailChangeConfirmed")}
            </FormAlert>
          </div>
        ) : null}
        <EmailForm email={user.email} />
      </Section>

      <Section id="password" title={t("passwordSection")}>
        <PasswordForm />
      </Section>

      <Section id="sessions" title={t("sessionsSection")} description={t("sessionsText")}>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {sessions.map((session) => {
            const { browser, os } = session.device;
            const label =
              browser && os ? t("deviceOn", { browser, os }) : (browser ?? os ?? t("unknownDevice"));
            const Icon = os && MOBILE_SYSTEMS.has(os) ? Smartphone : Monitor;
            return (
              <li key={session.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 gap-3">
                  <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-subtle" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                      {label}
                      {session.current ? <Badge tone="accent">{t("thisDevice")}</Badge> : null}
                    </p>
                    <p className="mt-1 text-xs text-subtle">
                      {t("signedInAt", { date: format.dateTime(session.createdAt, { dateStyle: "medium" }) })}
                      {" · "}
                      {t("lastActive", { date: format.dateTime(session.lastActiveAt, { dateStyle: "medium" }) })}
                      {session.ipAddress ? (
                        <>
                          {" · "}
                          {t("ipAddress", { ip: session.ipAddress })}
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
                {session.current ? null : <RevokeSessionForm sessionId={session.id} label={label} />}
              </li>
            );
          })}
        </ul>
        {sessions.length > 1 ? (
          <div className="mt-5">
            <RevokeOtherSessionsForm />
          </div>
        ) : null}
      </Section>

      <Section id="delete" title={t("deleteSection")} description={t("deleteText")} className="border-danger/40 xl:col-span-2">
        <div className="max-w-2xl space-y-4">
          <p className="text-sm text-muted">{t("deleteWhat")}</p>
          <p className="text-sm text-fg">
            {t("deleteProjectCount", { count: deletion.projects, published: deletion.published })}
          </p>
          {canDelete ? (
            <DeleteAccountForm username={user.username} />
          ) : (
            <p className="rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-sm text-muted">
              {t("deleteAdminBlocked")}
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: Props) {
  const t = await getTranslations("Account");
  return (
    <>
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-fg">{t("settingsTitle")}</h1>
      <Suspense fallback={<FormSkeleton fields={4} />}>
        <SettingsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
