import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { AdminCard, AdminPageHeader, ListSkeleton } from "@/components/admin/admin-page";
import { CategoryForm, DeleteEntityForm } from "@/components/admin/taxonomy-forms";
import { categoryIcon } from "@/components/mods/category-icon";
import { Badge } from "@/components/ui/badge";
import { pickTranslation } from "@/lib/translation";
import { getAdminCategories } from "@/server/data/admin";
import { requireAdmin } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("taxonomy.categoriesTitle"), robots: { index: false, follow: false } };
}

async function CategoriesContent() {
  const locale = await rootLocale();
  await requireAdmin(locale, `/${locale}/admin/categories`);
  const [categories, t] = await Promise.all([getAdminCategories(), getTranslations("Admin")]);

  return (
    <>
      <AdminCard className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-fg">{t("taxonomy.newCategory")}</h2>
        <CategoryForm />
      </AdminCard>

      <ul className="space-y-3">
        {categories.map((category) => {
          const Icon = categoryIcon(category.icon);
          const name = pickTranslation(category.translations, locale, "en")?.translation.name ?? category.slug;
          const inUse = category._count.projects > 0 || category._count.children > 0;
          return (
            <li key={category.id} className="rounded-[var(--radius-card)] border border-border bg-surface">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
                  <Icon aria-hidden className="size-5 text-accent" />
                  <span className="font-medium text-fg">{name}</span>
                  <span className="text-sm text-subtle">/mods/{category.slug}</span>
                  <Badge>{t("taxonomy.projectCount", { count: category._count.projects })}</Badge>
                  {category.parentId ? <Badge tone="info">{t("taxonomy.subcategory")}</Badge> : null}
                  <span className="ml-auto text-xs text-subtle">
                    {t("taxonomy.sortOrder")}: {category.sortOrder}
                  </span>
                </summary>
                <div className="space-y-4 border-t border-border p-4">
                  <CategoryForm category={category} />
                  {inUse ? (
                    <p className="text-sm text-subtle">{t("taxonomy.categoryInUse")}</p>
                  ) : (
                    <DeleteEntityForm kind="category" id={category.id} warning={t("taxonomy.deleteCategoryWarning")} />
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default async function AdminCategoriesPage() {
  const t = await getTranslations("Admin");
  return (
    <>
      <AdminPageHeader title={t("taxonomy.categoriesTitle")} description={t("taxonomy.categoriesDescription")} />
      <Suspense fallback={<ListSkeleton rows={4} height="h-14" />}>
        <CategoriesContent />
      </Suspense>
    </>
  );
}
