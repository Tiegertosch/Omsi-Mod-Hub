"use client";

import { FormAlert, SelectField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { changeProjectCategoryAction } from "@/server/actions/admin-projects";

import { useAdminForm } from "./use-admin-form";

/** Projekt einer anderen Kategorie zuordnen (aufklappbar, um die Liste ruhig zu halten). */
export function ProjectCategoryForm({
  projectId,
  categoryId,
  categories,
}: {
  projectId: string;
  categoryId: string;
  categories: { id: string; name: string }[];
}) {
  const { t, formAction, onSubmit, pending, formError, fieldError, state } = useAdminForm(changeProjectCategoryAction);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm text-muted hover:text-fg">{t("category.change")}</summary>
      <form action={formAction} onSubmit={onSubmit} className="mt-3 space-y-3" noValidate>
        <input type="hidden" name="projectId" value={projectId} />
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        {state.status === "success" ? <FormAlert tone="success">{t("category.changed")}</FormAlert> : null}
        <SelectField
          id={`project-category-${projectId}`}
          name="categoryId"
          label={t("category.label")}
          defaultValue={categoryId}
          error={fieldError("categoryId")}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <PendingButton pending={pending} pendingLabel={t("saving")} variant="secondary" size="sm">
          {t("category.submit")}
        </PendingButton>
      </form>
    </details>
  );
}
