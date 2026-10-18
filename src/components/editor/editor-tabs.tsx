"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { tabFromHash, type EditorTabId } from "@/lib/editor-tabs";
import { cn } from "@/lib/utils";

const TAB_LIST_ID = "editor-tabs";

type EditorTabsContext = {
  tabs: readonly EditorTabId[];
  active: EditorTabId;
  select: (tab: EditorTabId) => void;
  invalid: readonly EditorTabId[];
  setInvalid: (tabs: readonly EditorTabId[]) => void;
};

const Context = createContext<EditorTabsContext | null>(null);

// Der aktive Tab steht im Anker der Adresse: Neu laden behält ihn, Links wie #media öffnen ihn.
function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => window.location.hash;
const readServerHash = () => "";

export function EditorTabs({ tabs, children }: { tabs: readonly EditorTabId[]; children: ReactNode }) {
  const hash = useSyncExternalStore(subscribeToHash, readHash, readServerHash);
  const active = tabFromHash(hash, tabs) ?? tabs[0];
  const [invalid, setInvalid] = useState<readonly EditorTabId[]>([]);

  const select = useCallback((tab: EditorTabId) => {
    if (window.location.hash === `#${tab}`) return;
    // replaceState statt location.hash: kein Springen und kein Verlaufseintrag je Tab.
    window.history.replaceState(null, "", `#${tab}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);

  const value = useMemo(() => ({ tabs, active, select, invalid, setInvalid }), [tabs, active, select, invalid]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useEditorTabs() {
  const value = useContext(Context);
  if (!value) throw new Error("useEditorTabs außerhalb von <EditorTabs>");
  return value;
}

/** Für Komponenten, die auch ohne Tabs vorkommen (z. B. Statusbereich). */
export function useOptionalEditorTabs() {
  return useContext(Context);
}

/** Wechselt den Tab und scrollt zur Tab-Leiste (z. B. aus der Checkliste heraus). */
export function showEditorTab(tabs: EditorTabsContext, tab: EditorTabId) {
  tabs.select(tab);
  document.getElementById(TAB_LIST_ID)?.scrollIntoView({ block: "start" });
}

export function EditorTabList({ label }: { label: string }) {
  const t = useTranslations("Editor");
  const { tabs, active, select, invalid } = useEditorTabs();
  const list = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<EditorTabId, HTMLButtonElement>());

  // Auf schmalen Bildschirmen scrollt die Leiste: den aktiven Tab (z. B. aus #versions) sichtbar halten.
  useEffect(() => {
    const bar = list.current?.getBoundingClientRect();
    const button = buttons.current.get(active)?.getBoundingClientRect();
    if (!list.current || !bar || !button) return;
    if (button.left < bar.left) list.current.scrollLeft -= bar.left - button.left;
    else if (button.right > bar.right) list.current.scrollLeft += button.right - bar.right;
  }, [active]);

  // Tastatur nach WAI-ARIA: Pfeiltasten wechseln den Tab, Pos1/Ende springen an den Rand.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.indexOf(active);
    const target =
      event.key === "ArrowRight"
        ? tabs[(index + 1) % tabs.length]
        : event.key === "ArrowLeft"
          ? tabs[(index - 1 + tabs.length) % tabs.length]
          : event.key === "Home"
            ? tabs[0]
            : event.key === "End"
              ? tabs[tabs.length - 1]
              : null;
    if (!target) return;
    event.preventDefault();
    select(target);
    buttons.current.get(target)?.focus();
  };

  return (
    <div
      ref={list}
      id={TAB_LIST_ID}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex scroll-mt-24 gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]"
    >
      {tabs.map((tab) => {
        const selected = tab === active;
        return (
          <button
            key={tab}
            ref={(node) => {
              if (node) buttons.current.set(tab, node);
              else buttons.current.delete(tab);
            }}
            type="button"
            role="tab"
            id={`editor-tab-${tab}`}
            aria-selected={selected}
            aria-controls={`editor-panel-${tab}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(tab)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              selected ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t(`tabs.${tab}`)}
            {invalid.includes(tab) ? (
              <>
                <span aria-hidden className="size-2 rounded-full bg-danger" />
                <span className="sr-only">{t("tabHasErrors")}</span>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function EditorTabPanel({ tab, className, children }: { tab: EditorTabId; className?: string; children: ReactNode }) {
  const { active } = useEditorTabs();
  return (
    <div
      role="tabpanel"
      id={`editor-panel-${tab}`}
      aria-labelledby={`editor-tab-${tab}`}
      hidden={active !== tab}
      className={className}
    >
      {children}
    </div>
  );
}
