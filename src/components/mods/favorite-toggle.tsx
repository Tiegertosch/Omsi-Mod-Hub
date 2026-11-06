"use client";

import { Bookmark, BookmarkCheck, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormAlert } from "@/components/ui/form";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleFavoriteAction, type FavoriteErrorCode, type FavoriteState } from "@/server/actions/favorites";

export type FavoriteToggleLabels = {
  add: string;
  saved: string;
  addLabel: string;
  removeLabel: string;
  errors: Record<FavoriteErrorCode, string>;
};

const initialState: FavoriteState = { status: "idle" };

function ToggleButton({ saved, labels, title }: { saved: boolean; labels: FavoriteToggleLabels; title?: string }) {
  const { pending } = useFormStatus();
  const Icon = pending ? LoaderCircle : saved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="submit"
      disabled={pending}
      // Der Name enthält den sichtbaren Text („Merken“ bzw. „Gemerkt“) und sagt, was der Klick tut.
      aria-label={`${saved ? labels.removeLabel : labels.addLabel}${title ? `: ${title}` : ""}`}
      className={cn(buttonStyles({ variant: saved ? "secondary" : "outline", size: "md" }), "w-full")}
    >
      <Icon aria-hidden className={cn("size-4", pending && "animate-spin", saved && !pending && "text-accent")} />
      {saved ? labels.saved : labels.add}
    </button>
  );
}

/**
 * Merken-Knopf. Ein normales Formular (funktioniert ohne JavaScript); der
 * Zustand kommt vom Server, nach dem Absenden aktualisiert refresh() die Seite.
 * Texte kommen als Props, damit die Projektseite keinen weiteren
 * Übersetzungs-Namespace an den Browser schicken muss.
 */
export function FavoriteToggle({
  projectId,
  saved,
  labels,
  title,
}: {
  projectId: string;
  saved: boolean;
  labels: FavoriteToggleLabels;
  /** Projekttitel für den Namen des Knopfs, wenn mehrere auf einer Seite stehen (Merkliste) */
  title?: string;
}) {
  const [state, formAction] = useActionState(toggleFavoriteAction, initialState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="intent" value={saved ? "remove" : "add"} />
      <ToggleButton saved={saved} labels={labels} title={title} />
      {state.status === "error" ? <FormAlert tone="error">{labels.errors[state.code]}</FormAlert> : null}
    </form>
  );
}
