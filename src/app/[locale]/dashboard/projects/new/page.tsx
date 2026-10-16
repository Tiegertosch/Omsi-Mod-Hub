import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { FormSkeleton } from "@/components/auth/auth-shell";
import { ProjectForm } from "@/components/editor/project-form";
import { Link } from "@/i18n/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { requireCreator } from "@/server/creator";
import { getEditorOptions } from "@/server/data/creator-projects";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Editor");
  return { title: t("newTitle"), robots: { index: false, follow: false } };
}

const emptyTranslation = { title: "", summary: "", description: "", installation: "", requirements: "" };

async function NewProjectContent() {
  const locale = await rootLocale();
  await requireCreator(locale, `/${locale}/dashboard/projects/new`);
  const options = await getEditorOptions(locale);
  const defaultLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;

  return (
    <ProjectForm
      options={options}
      values={{
        categoryId: "",
        defaultLocale,
        slug: "",
        slugLocked: false,
        license: "",
        sourceUrl: "",
        gameCompatibility: "",
        translations: Object.fromEntries(routing.locales.map((l) => [l, emptyTranslation])) as Record<
          (typeof routing.locales)[number],
          typeof emptyTranslation
        >,
        tags: [],
        contributors: [],
      }}
    />
  );
}

export default async function NewProjectPage() {
  const t = await getTranslations("Editor");
  return (
    <>
      <Link href="/dashboard/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft aria-hidden className="size-4" />
        {t("backToList")}
      </Link>
      <h1 className="text-3xl font-bold tracking-tight text-fg">{t("newTitle")}</h1>
      <p className="mt-2 mb-8 max-w-2xl text-sm text-muted">{t("newIntro")}</p>
      <Suspense fallback={<FormSkeleton fields={5} />}>
        <NewProjectContent />
      </Suspense>
    </>
  );
}
