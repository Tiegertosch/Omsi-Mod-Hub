import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Form from "next/form";

import { getPathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Suchformular (GET) – funktioniert auch ohne JavaScript. */
export function SearchForm({
  size = "md",
  defaultValue,
  className,
  id = "site-search",
}: {
  size?: "md" | "lg";
  defaultValue?: string;
  className?: string;
  id?: string;
}) {
  const t = useTranslations("Search");
  const locale = useLocale();

  return (
    <Form action={getPathname({ href: "/search", locale })} role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {t("label")}
      </label>
      <Search
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-subtle",
          size === "lg" ? "left-4 size-5" : "left-3 size-4",
        )}
      />
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        maxLength={100}
        placeholder={t("placeholder")}
        autoComplete="off"
        className={cn(
          "w-full rounded-lg border border-border bg-surface-2 text-fg placeholder:text-subtle",
          "transition-colors hover:border-border-strong focus:border-accent focus:outline-none",
          size === "lg" ? "h-14 pl-12 pr-32 text-base" : "h-10 pl-9 pr-3 text-sm",
        )}
      />
      {size === "lg" ? (
        <button
          type="submit"
          className="absolute top-1/2 right-2 h-10 -translate-y-1/2 rounded-md bg-accent px-5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
        >
          {t("submit")}
        </button>
      ) : (
        <button type="submit" className="sr-only">
          {t("submit")}
        </button>
      )}
    </Form>
  );
}
