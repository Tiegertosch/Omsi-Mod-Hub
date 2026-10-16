import { UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { buttonStyles } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/server/session";

import { AccountMenu } from "./account-menu";

/** Konto-Bereich im Header. Liest die Session und muss hinter <Suspense> stehen. */
export async function AccountArea() {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("Account")]);

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link href="/login" className={buttonStyles({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>
          {t("login")}
        </Link>
        <Link href="/register" className={buttonStyles({ size: "sm", className: "hidden sm:inline-flex" })}>
          {t("register")}
        </Link>
        <Link
          href="/login"
          className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg sm:hidden"
        >
          <UserRound aria-hidden className="size-5" />
          <span className="sr-only">{t("login")}</span>
        </Link>
      </div>
    );
  }

  return (
    <AccountMenu
      name={user.name}
      username={user.username}
      isAdmin={isAdmin(user.role)}
      labels={{
        menu: t("menuLabel"),
        signedInAs: t("signedInAs"),
        dashboard: t("dashboard"),
        settings: t("settings"),
        admin: t("admin"),
        logout: t("logout"),
      }}
    />
  );
}

export function AccountAreaFallback() {
  return <Skeleton className="h-9 w-9 rounded-lg sm:w-28" />;
}
