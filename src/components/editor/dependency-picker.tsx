"use client";

import { Plus, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { PROJECT_LIMITS } from "@/lib/project-rules";
import { searchDependencyCandidatesAction, type DependencyCandidate } from "@/server/actions/projects";

export type DependencyItem = { id: string; title: string; creatorName: string; unpublished?: boolean };

const MIN_QUERY = 2;

/**
 * Benötigte Projekte im Hub auswählen. Die Auswahl geht als versteckte Felder
 * `dependencies` mit dem Projektformular; gesucht wird über eine Server Action
 * (nur veröffentlichte Projekte). Braucht JavaScript wie die übrigen
 * Zeilen-Editoren (Voraussetzungen, Mitwirkende).
 */
export function DependencyPicker({ projectId, initial }: { projectId?: string; initial: DependencyItem[] }) {
  const t = useTranslations("Editor");
  const locale = useLocale();
  const uid = useId();
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ query: string; items: DependencyCandidate[] } | null>(null);

  const trimmed = query.trim();
  const active = trimmed.length >= MIN_QUERY;
  const current = active && result?.query === trimmed ? result.items : null;
  const full = selected.length >= PROJECT_LIMITS.dependencies;

  useEffect(() => {
    if (trimmed.length < MIN_QUERY) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchDependencyCandidatesAction({ projectId, query: trimmed, locale })
        .then((items) => {
          if (!cancelled) setResult({ query: trimmed, items });
        })
        .catch(() => {
          if (!cancelled) setResult({ query: trimmed, items: [] });
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, projectId, locale]);

  const add = (item: DependencyCandidate) => {
    setSelected((rows) => (rows.some((row) => row.id === item.id) || rows.length >= PROJECT_LIMITS.dependencies ? rows : [...rows, item]));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-subtle">{t("dependenciesHint", { max: PROJECT_LIMITS.dependencies })}</p>

      {selected.length > 0 ? (
        <ul aria-label={t("dependenciesSelected")} className="divide-y divide-border rounded-lg border border-border bg-surface-2">
          {selected.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <input type="hidden" name="dependencies" value={item.id} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{item.title}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                  {t("dependencyBy", { name: item.creatorName })}
                  {item.unpublished ? <Badge tone="warning">{t("dependencyUnpublished")}</Badge> : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected((rows) => rows.filter((row) => row.id !== item.id))}
                className={buttonStyles({ variant: "ghost", size: "icon" })}
              >
                <X aria-hidden className="size-4" />
                <span className="sr-only">{t("dependencyRemove", { title: item.title })}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {full ? (
        <p className="text-sm text-muted">{t("dependenciesFull", { max: PROJECT_LIMITS.dependencies })}</p>
      ) : (
        <div className="space-y-2">
          <label htmlFor={`${uid}-search`} className="block text-sm font-medium text-fg">
            {t("dependencySearch")}
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <input
              id={`${uid}-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // Enter soll hier nicht das ganze Projektformular abschicken.
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder={t("dependencySearchPlaceholder")}
              maxLength={100}
              autoComplete="off"
              aria-describedby={`${uid}-status`}
              className="h-10 w-full rounded-lg border border-border bg-surface-2 pr-3 pl-9 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </div>
          <p id={`${uid}-status`} aria-live="polite" className="text-xs text-subtle">
            {!active ? t("dependencySearchHint", { min: MIN_QUERY }) : current === null ? t("dependencySearching") : current.length === 0 ? t("dependencyNoResults") : t("dependencyResults", { count: current.length })}
          </p>
          {current && current.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {current.map((item) => {
                const chosen = selected.some((row) => row.id === item.id);
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-fg">{item.title}</p>
                      <p className="text-xs text-subtle">{t("dependencyBy", { name: item.creatorName })}</p>
                    </div>
                    <button
                      type="button"
                      disabled={chosen}
                      onClick={() => add(item)}
                      aria-label={`${chosen ? t("dependencyAdded") : t("dependencyAdd")}: ${item.title}`}
                      className={buttonStyles({ variant: "outline", size: "sm" })}
                    >
                      <Plus aria-hidden className="size-4" />
                      {chosen ? t("dependencyAdded") : t("dependencyAdd")}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
