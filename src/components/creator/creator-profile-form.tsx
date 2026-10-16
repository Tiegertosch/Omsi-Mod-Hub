"use client";

import { useLocale, useTranslations } from "next-intl";

import { useEditorForm } from "@/components/editor/use-editor-form";
import { FormAlert, TextAreaField, TextField } from "@/components/ui/form";
import { PendingButton } from "@/components/ui/pending-button";
import { MAX_EXTERNAL_URL_LENGTH } from "@/lib/external-url";
import { becomeCreatorAction, updateCreatorProfileAction } from "@/server/actions/creator-profile";

export function CreatorProfileForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial: { displayName: string; bio: string; websiteUrl: string };
}) {
  const locale = useLocale();
  const t = useTranslations("Creator");
  const { t: editorT, state, pending, onSubmit, formAction, fieldError, formError } = useEditorForm(
    mode === "create" ? becomeCreatorAction : updateCreatorProfileAction,
  );

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{t("profileSaved")}</FormAlert> : null}
      <TextField
        id="creator-display-name"
        name="displayName"
        label={t("displayName")}
        defaultValue={initial.displayName}
        maxLength={50}
        required
        hint={t("displayNameHint")}
        error={fieldError("displayName")}
      />
      <TextAreaField
        id="creator-bio"
        name="bio"
        label={t("bio")}
        defaultValue={initial.bio}
        rows={4}
        maxLength={1000}
        hint={t("bioHint")}
        error={fieldError("bio")}
      />
      <TextField
        id="creator-website"
        name="websiteUrl"
        type="url"
        label={t("websiteUrl")}
        defaultValue={initial.websiteUrl}
        maxLength={MAX_EXTERNAL_URL_LENGTH}
        hint={t("websiteUrlHint")}
        error={fieldError("websiteUrl")}
      />
      <PendingButton pending={pending} pendingLabel={editorT("saving")} variant={mode === "create" ? "primary" : "secondary"}>
        {mode === "create" ? t("becomeSubmit") : t("saveProfile")}
      </PendingButton>
    </form>
  );
}
