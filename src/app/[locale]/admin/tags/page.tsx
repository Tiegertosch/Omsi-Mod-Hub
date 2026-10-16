import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { AdminCard, AdminPageHeader, ListSkeleton } from "@/components/admin/admin-page";
import { DeleteEntityForm, TagForm } from "@/components/admin/taxonomy-forms";
import { Badge } from "@/components/ui/badge";
import { pickTranslation } from "@/lib/translation";
import { getAdminTags } from "@/server/data/admin";
import { requireAdmin } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("taxonomy.tagsTitle"), robots: { index: false, follow: false } };
}

async function TagsContent() {
  const locale = await rootLocale();
  await requireAdmin(locale, `/${locale}/admin/tags`);
  const [tags, t] = await Promise.all([getAdminTags(), getTranslations("Admin")]);

  return (
    <>
      <AdminCard className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-fg">{t("taxonomy.newTag")}</h2>
        <TagForm />
      </AdminCard>

      <ul className="space-y-3">
        {tags.map((tag) => {
          const name = pickTranslation(tag.translations, locale, "en")?.translation.name ?? tag.slug;
          return (
            <li key={tag.id} className="rounded-[var(--radius-card)] border border-border bg-surface">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
                  <span className="font-medium text-fg">{name}</span>
                  <span className="text-sm text-subtle">{tag.slug}</span>
                  <Badge>{t("taxonomy.projectCount", { count: tag._count.projects })}</Badge>
                </summary>
                <div className="space-y-4 border-t border-border p-4">
                  <TagForm tag={tag} />
                  <DeleteEntityForm
                    kind="tag"
                    id={tag.id}
                    warning={t("taxonomy.deleteTagWarning", { count: tag._count.projects })}
                  />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default async function AdminTagsPage() {
  const t = await getTranslations("Admin");
  return (
    <>
      <AdminPageHeader title={t("taxonomy.tagsTitle")} description={t("taxonomy.tagsDescription")} />
      <Suspense fallback={<ListSkeleton rows={6} height="h-12" />}>
        <TagsContent />
      </Suspense>
    </>
  );
}
