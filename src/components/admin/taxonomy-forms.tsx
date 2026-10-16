"use client";

import { FormAlert, SelectField, TextField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { routing } from "@/i18n/routing";
import { ADMIN_LIMITS, CATEGORY_ICON_NAMES } from "@/lib/admin-forms";
import { SLUG_MAX } from "@/lib/slug";
import type { AdminState } from "@/server/admin-action";
import { deleteCategoryAction, deleteTagAction, saveCategoryAction, saveTagAction } from "@/server/actions/taxonomy";

import { useAdminForm } from "./use-admin-form";

type Translations = Record<string, { name: string; description?: string | null }>;

function byLocale(rows: readonly { locale: string; name: string; description?: string | null }[]): Translations {
  return Object.fromEntries(rows.map((row) => [row.locale, row]));
}

function FormFeedback({ state, error, success }: { state: AdminState; error?: string; success: string }) {
  if (error) return <FormAlert tone="error">{error}</FormAlert>;
  if (state.status === "success") return <FormAlert tone="success">{success}</FormAlert>;
  return null;
}

function SlugField({ id, label, hint, error }: { id: string; label: string; hint: string; error?: string }) {
  return (
    <TextField
      id={id}
      name="slug"
      label={label}
      hint={hint}
      maxLength={SLUG_MAX}
      autoCapitalize="none"
      autoComplete="off"
      spellCheck={false}
      error={error}
    />
  );
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

export type AdminCategory = {
  id: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
  translations: { locale: string; name: string; description: string | null }[];
};

/** Anlegen (ohne `category`) oder Bearbeiten einer Kategorie. */
export function CategoryForm({ category }: { category?: AdminCategory }) {
  const isNew = !category;
  const { t, state, formRef, formAction, onSubmit, pending, fieldError, formError } = useAdminForm(saveCategoryAction, {
    resetOnSuccess: isNew,
  });
  const prefix = category ? `category-${category.id}` : "category-new";
  const texts = byLocale(category?.translations ?? []);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="space-y-4" noValidate>
      {category ? <input type="hidden" name="categoryId" value={category.id} /> : null}
      <FormFeedback state={state} error={formError} success={t("saved")} />
      <div className="grid gap-4 sm:grid-cols-3">
        {isNew ? (
          <SlugField
            id={`${prefix}-slug`}
            label={t("taxonomy.slug")}
            hint={t("taxonomy.categorySlugHint")}
            error={fieldError("slug")}
          />
        ) : null}
        <SelectField
          id={`${prefix}-icon`}
          name="icon"
          label={t("taxonomy.icon")}
          defaultValue={category?.icon ?? ""}
          error={fieldError("icon")}
        >
          <option value="">{t("taxonomy.iconNone")}</option>
          {CATEGORY_ICON_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
        <TextField
          id={`${prefix}-sort`}
          name="sortOrder"
          type="number"
          inputMode="numeric"
          min={0}
          max={ADMIN_LIMITS.sortOrder}
          label={t("taxonomy.sortOrder")}
          defaultValue={category?.sortOrder ?? 0}
          error={fieldError("sortOrder")}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {routing.locales.map((locale) => (
          <fieldset key={locale} className="min-w-0 space-y-3 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-semibold tracking-wide text-subtle uppercase">
              {t(`taxonomy.locale.${locale}`)}
            </legend>
            <TextField
              id={`${prefix}-${locale}-name`}
              name={`translations.${locale}.name`}
              label={t("taxonomy.nameIn", { language: t(`taxonomy.locale.${locale}`) })}
              maxLength={ADMIN_LIMITS.categoryName}
              defaultValue={texts[locale]?.name ?? ""}
              error={fieldError(`translations.${locale}.name`)}
            />
            <TextField
              id={`${prefix}-${locale}-description`}
              name={`translations.${locale}.description`}
              label={t("taxonomy.descriptionIn", { language: t(`taxonomy.locale.${locale}`) })}
              maxLength={ADMIN_LIMITS.categoryDescription}
              defaultValue={texts[locale]?.description ?? ""}
              error={fieldError(`translations.${locale}.description`)}
            />
          </fieldset>
        ))}
      </div>
      <PendingButton pending={pending} pendingLabel={t("saving")} size="sm">
        {isNew ? t("taxonomy.createCategory") : t("save")}
      </PendingButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export type AdminTag = { id: string; slug: string; translations: { locale: string; name: string }[] };

export function TagForm({ tag }: { tag?: AdminTag }) {
  const isNew = !tag;
  const { t, state, formRef, formAction, onSubmit, pending, fieldError, formError } = useAdminForm(saveTagAction, {
    resetOnSuccess: isNew,
  });
  const prefix = tag ? `tag-${tag.id}` : "tag-new";
  const texts = byLocale(tag?.translations ?? []);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="space-y-4" noValidate>
      {tag ? <input type="hidden" name="tagId" value={tag.id} /> : null}
      <FormFeedback state={state} error={formError} success={t("saved")} />
      <div className="grid gap-4 sm:grid-cols-3">
        {isNew ? (
          <SlugField
            id={`${prefix}-slug`}
            label={t("taxonomy.slug")}
            hint={t("taxonomy.tagSlugHint")}
            error={fieldError("slug")}
          />
        ) : null}
        {routing.locales.map((locale) => (
          <TextField
            key={locale}
            id={`${prefix}-${locale}-name`}
            name={`translations.${locale}.name`}
            label={t("taxonomy.nameIn", { language: t(`taxonomy.locale.${locale}`) })}
            maxLength={ADMIN_LIMITS.tagName}
            defaultValue={texts[locale]?.name ?? ""}
            error={fieldError(`translations.${locale}.name`)}
          />
        ))}
      </div>
      <PendingButton pending={pending} pendingLabel={t("saving")} size="sm">
        {isNew ? t("taxonomy.createTag") : t("save")}
      </PendingButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Löschen
// ---------------------------------------------------------------------------

/** Löschen mit Bestätigung: Der Button erscheint erst im aufgeklappten Bereich. */
export function DeleteEntityForm({ kind, id, warning }: { kind: "category" | "tag"; id: string; warning: string }) {
  const { t, formAction, onSubmit, pending, formError } = useAdminForm(
    kind === "category" ? deleteCategoryAction : deleteTagAction,
  );
  return (
    <details className="rounded-lg border border-danger/30">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-danger">{t("taxonomy.delete")}</summary>
      <form action={formAction} onSubmit={onSubmit} className="space-y-3 border-t border-danger/30 p-3">
        <input type="hidden" name={kind === "category" ? "categoryId" : "tagId"} value={id} />
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        <p className="text-sm text-muted">{warning}</p>
        <PendingButton pending={pending} pendingLabel={t("saving")} variant="danger" size="sm">
          {t("taxonomy.deleteConfirm")}
        </PendingButton>
      </form>
    </details>
  );
}
