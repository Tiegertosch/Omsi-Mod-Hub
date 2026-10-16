import { Search } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { AdminPageHeader, FilterTabs, ListSkeleton } from "@/components/admin/admin-page";
import { BanForm, UnbanForm } from "@/components/admin/ban-forms";
import { Pagination } from "@/components/mods/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { canBanUser, isBanActive } from "@/lib/moderation";
import { hasRole } from "@/lib/roles";
import { MAX_QUERY_LENGTH } from "@/lib/search-text";
import { getUsers, USER_FILTERS, type UserFilter } from "@/server/data/admin";
import { requireAdmin } from "@/server/session";

type Props = PageProps<"/[locale]/admin/users">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("users.title"), robots: { index: false, follow: false } };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

async function UsersContent({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await rootLocale();
  const admin = await requireAdmin(locale, `/${locale}/admin/users`);
  const params = await searchParams;
  const q = first(params.q).slice(0, MAX_QUERY_LENGTH);
  const filter: UserFilter = USER_FILTERS.find((f) => f === first(params.filter)) ?? "all";
  const page = Math.max(1, Math.min(1000, Number.parseInt(first(params.page), 10) || 1));

  const [{ users, total, pageCount }, t, account, common, format] = await Promise.all([
    getUsers({ q, filter, page }),
    getTranslations("Admin"),
    getTranslations("Account"),
    getTranslations("Common"),
    getFormatter(),
  ]);
  const query = { ...(q ? { q } : {}), ...(filter !== "all" ? { filter } : {}) };

  return (
    <>
      <form action={`/${locale}/admin/users`} method="get" role="search" className="mb-4 flex gap-2">
        {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
        <label htmlFor="user-search" className="sr-only">
          {t("users.search")}
        </label>
        <input
          id="user-search"
          type="search"
          name="q"
          defaultValue={q}
          maxLength={MAX_QUERY_LENGTH}
          placeholder={t("users.searchPlaceholder")}
          className={inputClass}
        />
        <button type="submit" className={buttonStyles({ variant: "secondary", className: "h-11" })}>
          <Search aria-hidden className="size-4" />
          <span className="sr-only sm:not-sr-only">{t("users.search")}</span>
        </button>
      </form>

      <FilterTabs
        label={t("users.filterLabel")}
        active={filter}
        hrefFor={(f) => ({ pathname: "/admin/users", query: { ...(q ? { q } : {}), ...(f !== "all" ? { filter: f } : {}) } })}
        items={USER_FILTERS.map((f) => ({ value: f, label: t(`users.filters.${f}`) }))}
      />

      <p className="mb-4 text-sm text-muted" aria-live="polite">
        {t("users.count", { count: total })}
      </p>

      {users.length === 0 ? (
        <EmptyState title={t("users.empty")} />
      ) : (
        <ul className="space-y-3">
          {users.map((user) => {
            const banActive = isBanActive(user);
            const roles = user.role.split(",").map((r) => r.trim());
            return (
              <li
                key={user.id}
                className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-fg">{user.name}</h2>
                    <span className="text-sm text-subtle">@{user.username}</span>
                    {roles.map((role) => (
                      <Badge key={role} tone="accent">
                        {role === "user" || role === "creator" || role === "admin" ? account(`roles.${role}`) : role}
                      </Badge>
                    ))}
                    {!user.emailVerified ? <Badge>{t("unverified")}</Badge> : null}
                    {user.banned ? <Badge tone="danger">{banActive ? t("banned") : t("banExpired")}</Badge> : null}
                    {user.isSample ? <Badge tone="warning">{common("sample")}</Badge> : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{user.email}</p>
                  <p className="mt-1 text-xs text-subtle">
                    {t("users.registered", { date: format.dateTime(user.createdAt, { dateStyle: "medium" }) })}
                    {hasRole(user.role, "creator") ? ` · ${t("users.published", { count: user._count.projects })}` : null}
                  </p>
                  {user.banned ? (
                    <p className="mt-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-muted">
                      <span className="font-medium text-fg">{t("users.banReason")}:</span> {user.banReason ?? "–"}
                      <br />
                      {user.banExpires
                        ? t("users.banUntil", {
                            date: format.dateTime(user.banExpires, { dateStyle: "medium", timeStyle: "short" }),
                          })
                        : t("users.banPermanent")}
                    </p>
                  ) : null}
                  {user.creatorProfile && user._count.projects > 0 && !user.banned ? (
                    <Link href={`/creators/${user.username}`} className="mt-2 inline-block text-sm text-accent hover:underline">
                      {t("users.publicProfile")}
                    </Link>
                  ) : null}
                </div>
                <div>
                  {user.banned ? (
                    <UnbanForm userId={user.id} />
                  ) : canBanUser(admin, user) ? (
                    <BanForm userId={user.id} username={user.username} />
                  ) : (
                    <p className="text-xs text-subtle">
                      {user.id === admin.id ? t("users.cannotBanSelf") : t("users.cannotBanAdmin")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination pathname="/admin/users" query={query} page={page} pageCount={pageCount} />
    </>
  );
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const t = await getTranslations("Admin");
  return (
    <>
      <AdminPageHeader title={t("users.title")} description={t("users.description")} />
      <Suspense fallback={<ListSkeleton rows={5} height="h-24" />}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
