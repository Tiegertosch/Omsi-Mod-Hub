"use client";

import { Plus, X } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useEffectEvent, useId, useState, type ReactNode } from "react";

import { buttonStyles } from "@/components/ui/button";
import { FormAlert, SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { routing, type AppLocale } from "@/i18n/routing";
import { PROJECT_FORM_TABS, tabsWithErrors } from "@/lib/editor-tabs";
import { MAX_EXTERNAL_URL_LENGTH } from "@/lib/external-url";
import { PROJECT_LIMITS } from "@/lib/project-rules";
import { SLUG_MAX } from "@/lib/slug";
import { cn } from "@/lib/utils";
import type { RequirementPricing } from "@/generated/prisma/enums";
import { saveProjectAction } from "@/server/actions/projects";

import { EditorTabPanel, useEditorTabs } from "./editor-tabs";
import { useEditorForm, type EditorState } from "./use-editor-form";

export type ProjectFormValues = {
  projectId?: string;
  categoryId: string;
  defaultLocale: AppLocale;
  slug: string;
  slugLocked: boolean;
  license: string;
  sourceUrl: string;
  gameCompatibility: string;
  translations: Record<
    AppLocale,
    { title: string; summary: string; description: string; installation: string }
  >;
  tags: string[];
  contributors: { name: string; role: string }[];
  requirements: { name: string; url: string; pricing: RequirementPricing }[];
};

export type ProjectFormOptions = {
  categories: { id: string; name: string }[];
  tags: { slug: string; name: string }[];
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-[var(--radius-card)] border border-border bg-surface p-5 sm:p-6">
      <h2 id={id} className="mb-5 text-lg font-semibold text-fg">
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function ProjectForm({ values, options }: { values: ProjectFormValues; options: ProjectFormOptions }) {
  const locale = useLocale();
  const uid = useId();
  const { t, state, pending, onSubmit, formAction, fieldError, formError, hasErrorWithPrefix } =
    useEditorForm(saveProjectAction);
  const isNew = !values.projectId;

  const [activeLocale, setActiveLocale] = useState<AppLocale>(values.defaultLocale);
  const [contributors, setContributors] = useState(() =>
    values.contributors.map((c, index) => ({ key: `${uid}-c${index}`, ...c })),
  );
  const [requirements, setRequirements] = useState(() =>
    values.requirements.map((r, index) => ({ key: `${uid}-r${index}`, ...r })),
  );
  const [nextKey, setNextKey] = useState(0);
  const tabs = useEditorTabs();
  const formTabActive = PROJECT_FORM_TABS.some((tab) => tab === tabs.active);

  // Nach dem Speichern Fehler sichtbar machen: Ist die gewählte Sprache
  // fehlerfrei, die andere aber nicht, wird zu ihr gewechselt.
  const [checkedState, setCheckedState] = useState(state);
  if (checkedState !== state) {
    setCheckedState(state);
    const invalidLocales = routing.locales.filter((l) => hasErrorWithPrefix(`translations.${l}.`));
    if (invalidLocales.length > 0 && !invalidLocales.includes(activeLocale)) setActiveLocale(invalidLocales[0]);
  }
  // Ebenso bei den Tabs: markieren und den ersten mit Fehlern öffnen.
  const revealErrors = useEffectEvent((result: EditorState) => {
    const invalid = tabsWithErrors(result.status === "error" ? Object.keys(result.fieldErrors ?? {}) : []);
    tabs.setInvalid(invalid);
    if (invalid.length > 0 && !invalid.includes(tabs.active)) tabs.select(invalid[0]);
  });
  useEffect(() => revealErrors(state), [state]);

  const required = <span className="ml-1 text-xs font-normal text-subtle">({t("required")})</span>;

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-6" hidden={!formTabActive} noValidate>
      <input type="hidden" name="locale" value={locale} />
      {values.projectId ? <input type="hidden" name="projectId" value={values.projectId} /> : null}

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{t("saved")}</FormAlert> : null}

      <EditorTabPanel tab="general" className="space-y-6">
        <Section id="section-general" title={t("sections.general")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              id="project-category"
              name="categoryId"
              label={<>{t("category")}{required}</>}
              defaultValue={values.categoryId}
              error={fieldError("categoryId")}
            >
              <option value="">{t("chooseCategory")}</option>
              {options.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="project-default-locale"
              name="defaultLocale"
              label={t("defaultLocale")}
              defaultValue={values.defaultLocale}
              hint={t("defaultLocaleHint")}
              error={fieldError("defaultLocale")}
            >
              {routing.locales.map((l) => (
                <option key={l} value={l}>
                  {t(`language.${l}`)}
                </option>
              ))}
            </SelectField>
          </div>

          {values.slugLocked ? (
            <p className="text-sm text-muted">{t("slugLocked", { slug: values.slug })}</p>
          ) : (
            <TextField
              id="project-slug"
              name="slug"
              label={t("slug")}
              defaultValue={values.slug}
              maxLength={SLUG_MAX}
              spellCheck={false}
              hint={t("slugHint")}
              error={fieldError("slug")}
            />
          )}

          <TextField
            id="project-license"
            name="license"
            label={<>{t("license")}{required}</>}
            defaultValue={values.license}
            maxLength={PROJECT_LIMITS.license}
            hint={t("licenseHint")}
            error={fieldError("license")}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="project-source"
              name="sourceUrl"
              type="url"
              label={t("sourceUrl")}
              defaultValue={values.sourceUrl}
              maxLength={MAX_EXTERNAL_URL_LENGTH}
              hint={t("sourceUrlHint")}
              error={fieldError("sourceUrl")}
            />
            <TextField
              id="project-compat"
              name="gameCompatibility"
              label={t("gameCompatibility")}
              defaultValue={values.gameCompatibility}
              maxLength={PROJECT_LIMITS.gameCompatibility}
              hint={t("gameCompatibilityHint")}
              error={fieldError("gameCompatibility")}
            />
          </div>
        </Section>

        <Section id="section-tags" title={t("sections.tags")}>
          <fieldset>
            <legend className="mb-3 text-sm text-subtle">{t("tagsHint", { max: PROJECT_LIMITS.tags })}</legend>
            <div className="flex flex-wrap gap-2">
              {options.tags.map((tag) => (
                <label
                  key={tag.slug}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-muted has-[:checked]:border-accent has-[:checked]:text-accent"
                >
                  <input
                    type="checkbox"
                    name="tags"
                    value={tag.slug}
                    defaultChecked={values.tags.includes(tag.slug)}
                    className="size-3.5 accent-[var(--color-accent)]"
                  />
                  {tag.name}
                </label>
              ))}
            </div>
            {fieldError("tags") ? <p className="mt-2 text-xs text-danger">{fieldError("tags")}</p> : null}
          </fieldset>
        </Section>
      </EditorTabPanel>

      <EditorTabPanel tab="texts">
        <Section id="section-texts" title={t("sections.texts")}>
          <div role="tablist" aria-label={t("sections.texts")} className="flex gap-1 rounded-lg border border-border bg-surface-2 p-1">
            {routing.locales.map((l) => {
              const invalid = hasErrorWithPrefix(`translations.${l}.`);
              return (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  id={`tab-${l}`}
                  aria-selected={activeLocale === l}
                  aria-controls={`panel-${l}`}
                  onClick={() => setActiveLocale(l)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    activeLocale === l ? "bg-surface-3 text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {t(`language.${l}`)}
                  {invalid ? <span aria-hidden className="size-2 rounded-full bg-danger" /> : null}
                </button>
              );
            })}
          </div>

          {routing.locales.map((l) => {
            const v = values.translations[l];
            const f = (field: string) => fieldError(`translations.${l}.${field}`);
            return (
              <div
                key={l}
                role="tabpanel"
                id={`panel-${l}`}
                aria-labelledby={`tab-${l}`}
                hidden={activeLocale !== l}
                className="space-y-5"
                lang={l}
              >
                <TextField id={`t-${l}-title`} name={`translations.${l}.title`} label={t("title")} defaultValue={v.title} maxLength={PROJECT_LIMITS.title} error={f("title")} />
                <TextField
                  id={`t-${l}-summary`}
                  name={`translations.${l}.summary`}
                  label={t("summary")}
                  defaultValue={v.summary}
                  maxLength={PROJECT_LIMITS.summary}
                  hint={t("summaryHint")}
                  error={f("summary")}
                />
                <TextAreaField
                  id={`t-${l}-description`}
                  name={`translations.${l}.description`}
                  label={t("description")}
                  defaultValue={v.description}
                  rows={10}
                  maxLength={PROJECT_LIMITS.description}
                  hint={t("textHint")}
                  error={f("description")}
                />
                <TextAreaField
                  id={`t-${l}-installation`}
                  name={`translations.${l}.installation`}
                  label={<>{t("installation")} <span className="text-xs font-normal text-subtle">({t("optional")})</span></>}
                  defaultValue={v.installation}
                  rows={6}
                  maxLength={PROJECT_LIMITS.installation}
                  error={f("installation")}
                />
              </div>
            );
          })}
        </Section>
      </EditorTabPanel>

      <EditorTabPanel tab="extras" className="space-y-6">
        <Section id="section-requirements" title={t("sections.requirements")}>
          <p className="text-sm text-subtle">{t("requirementsHint")}</p>
          {requirements.length > 0 ? (
            <ul className="space-y-4">
              {requirements.map((row, index) => (
                <li
                  key={row.key}
                  className="grid items-start gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_9rem_auto]"
                >
                  <TextField
                    id={`${row.key}-name`}
                    name={`requirements.${index}.name`}
                    label={t("requirementName")}
                    defaultValue={row.name}
                    maxLength={PROJECT_LIMITS.requirementName}
                    error={fieldError(`requirements.${index}.name`)}
                  />
                  <TextField
                    id={`${row.key}-url`}
                    name={`requirements.${index}.url`}
                    type="url"
                    inputMode="url"
                    label={<>{t("requirementUrl")} <span className="text-xs font-normal text-subtle">({t("optional")})</span></>}
                    placeholder="https://"
                    defaultValue={row.url}
                    maxLength={MAX_EXTERNAL_URL_LENGTH}
                    error={fieldError(`requirements.${index}.url`)}
                  />
                  <SelectField
                    id={`${row.key}-pricing`}
                    name={`requirements.${index}.pricing`}
                    label={t("requirementPricing")}
                    defaultValue={row.pricing}
                  >
                    <option value="FREEWARE">{t("pricing.FREEWARE")}</option>
                    <option value="PAYWARE">{t("pricing.PAYWARE")}</option>
                  </SelectField>
                  <button
                    type="button"
                    onClick={() => setRequirements((rows) => rows.filter((r) => r.key !== row.key))}
                    className={buttonStyles({ variant: "ghost", size: "icon", className: "sm:mt-7" })}
                  >
                    <X aria-hidden className="size-4" />
                    <span className="sr-only">{t("remove")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {requirements.length < PROJECT_LIMITS.requirements ? (
            <button
              type="button"
              onClick={() => {
                setRequirements((rows) => [...rows, { key: `${uid}-nr${nextKey}`, name: "", url: "", pricing: "FREEWARE" }]);
                setNextKey((k) => k + 1);
              }}
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              <Plus aria-hidden className="size-4" />
              {t("addRequirement")}
            </button>
          ) : null}
        </Section>

        <Section id="section-contributors" title={t("sections.contributors")}>
          <ul className="space-y-3">
            {contributors.map((row, index) => (
              <li key={row.key} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <TextField
                  id={`${row.key}-name`}
                  name={`contributors.${index}.name`}
                  label={t("contributorName")}
                  defaultValue={row.name}
                  maxLength={PROJECT_LIMITS.contributorName}
                  error={fieldError(`contributors.${index}.name`)}
                />
                <TextField
                  id={`${row.key}-role`}
                  name={`contributors.${index}.role`}
                  label={t("contributorRole")}
                  defaultValue={row.role}
                  maxLength={PROJECT_LIMITS.contributorRole}
                />
                <button
                  type="button"
                  onClick={() => setContributors((rows) => rows.filter((r) => r.key !== row.key))}
                  className={buttonStyles({ variant: "ghost", size: "icon", className: "sm:mt-7" })}
                >
                  <X aria-hidden className="size-4" />
                  <span className="sr-only">{t("remove")}</span>
                </button>
              </li>
            ))}
          </ul>
          {contributors.length < PROJECT_LIMITS.contributors ? (
            <button
              type="button"
              onClick={() => {
                setContributors((rows) => [...rows, { key: `${uid}-nc${nextKey}`, name: "", role: "" }]);
                setNextKey((k) => k + 1);
              }}
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              <Plus aria-hidden className="size-4" />
              {t("addContributor")}
            </button>
          ) : null}
        </Section>
      </EditorTabPanel>

      <div className="flex items-center gap-4">
        <PendingButton pending={pending} pendingLabel={t("saving")} size="lg">
          {isNew ? t("create") : t("save")}
        </PendingButton>
        {/* Wiederholung am Button; die Ansage für Screenreader erfolgt oben (role=alert). */}
        {formError ? (
          <p aria-hidden className="text-sm text-danger">
            {formError}
          </p>
        ) : state.status === "success" ? (
          <p aria-hidden className="text-sm text-success">
            {t("saved")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
