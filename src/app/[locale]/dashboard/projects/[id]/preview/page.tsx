import { Eye } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { FormSkeleton } from "@/components/auth/auth-shell";
import { STATUS_TONES } from "@/components/editor/status-tones";
import { ProjectDetailView } from "@/components/mods/project-detail";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { canManageProjects } from "@/server/creator";
import { getProjectForPreview } from "@/server/data/creator-projects";
import { requireUser } from "@/server/session";

type Props = PageProps<"/[locale]/dashboard/projects/[id]/preview">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Projects");
  return { title: t("preview"), robots: { index: false, follow: false } };
}

/** Vorschau für Besitzer und Admins – zeigt auch Entwürfe und eingereichte Projekte. */
async function PreviewContent({ params }: Pick<Props, "params">) {
  const [{ id }, locale] = await Promise.all([params, rootLocale()]);
  const user = await requireUser(locale, `/${locale}/dashboard/projects/${id}/preview`);
  // Creator sehen eigene Projekte, Admins alle (Prüfung in getProjectForPreview).
  if (!canManageProjects(user)) notFound();
  const project = await getProjectForPreview(user, id);
  if (!project) notFound();

  const [t, statusT] = await Promise.all([getTranslations("Projects"), getTranslations("ProjectStatus")]);
  const isOwner = project.creator.id === user.id;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-info/40 bg-info/5 px-4 py-3 text-sm">
        <Eye aria-hidden className="size-4 text-info" />
        <span className="font-semibold text-fg">{t("preview")}</span>
        <Badge tone={STATUS_TONES[project.status]}>{statusT(project.status)}</Badge>
        {isOwner ? (
          <Link href={`/dashboard/projects/${project.id}/edit`} className="ml-auto font-medium text-accent hover:text-accent-hover">
            {t("edit")}
          </Link>
        ) : null}
      </div>
      <ProjectDetailView project={project} locale={locale} moreFromCreator={[]} preview />
    </div>
  );
}

export default function PreviewPage({ params }: Props) {
  return (
    <Suspense fallback={<FormSkeleton fields={4} />}>
      <PreviewContent params={params} />
    </Suspense>
  );
}
