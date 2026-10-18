import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { canDeleteOwnAccount } from "@/lib/account";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import { LATEST_TERMS, needsTermsConsent } from "@/lib/legal";
import { getDeletionSummary } from "@/server/data/account";
import { getCurrentUser } from "@/server/session";

import { TermsConsentDialog } from "./terms-consent-dialog";

const ERROR_CODES = ["validation", "rate_limit", "current_password_wrong", "unauthorized", "admin_account", "generic"] as const;

/**
 * Zeigt angemeldeten Nutzern das Popup, solange sie der neuesten Fassung der
 * Nutzungsbedingungen nicht zugestimmt haben (auch Konten ohne gespeicherte
 * Zustimmung). Steht im Layout hinter <Suspense>, liest die Session also
 * erst zur Laufzeit.
 */
export async function TermsGate() {
  const user = await getCurrentUser();
  if (!user || !needsTermsConsent(user.termsVersion)) return null;

  const [t, auth, format, locale, summary] = await Promise.all([
    getTranslations("TermsConsent"),
    getTranslations("Auth"),
    getFormatter(),
    getLocale(),
    getDeletionSummary(user.id),
  ]);
  const date = format.dateTime(new Date(`${LATEST_TERMS.effectiveFrom}T12:00:00Z`), { dateStyle: "long" });

  return (
    <TermsConsentDialog
      changes={LATEST_TERMS.changes[locale === "en" ? "en" : "de"]}
      canDelete={canDeleteOwnAccount(user.role)}
      termsHref={`/legal/terms?fassung=${LATEST_TERMS.version}`}
      labels={{
        title: user.termsVersion ? t("titleChanged") : t("titleFirst"),
        intro: user.termsVersion ? t("introChanged", { date }) : t("introFirst", { date }),
        changesTitle: t("changesTitle"),
        readFull: t("readFull"),
        opensInNewTab: t("opensInNewTab"),
        accept: t("accept"),
        decline: t("decline"),
        declineTitle: t("declineTitle"),
        declineIntro: t("declineIntro"),
        declineItems: [
          t("deleteAccount", { username: user.username }),
          t("deleteCreator"),
          t("deleteProjects", { count: summary.projects, published: summary.published }),
          t("deleteSessions"),
        ],
        declineKeep: t("declineKeep"),
        adminNote: t("adminNote"),
        password: t("password"),
        declineSubmit: t("declineSubmit"),
        back: t("back"),
        submitting: auth("submitting"),
        errors: {
          ...Object.fromEntries(ERROR_CODES.map((code) => [code, auth(`errors.${code}`)])),
          "field.required": auth("fieldErrors.required"),
          "field.password": auth("fieldErrors.password", { min: PASSWORD_MIN, max: PASSWORD_MAX }),
        },
      }}
    />
  );
}
