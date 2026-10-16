import { MapPinOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("Errors");
  return (
    <Container className="py-24">
      <EmptyState
        icon={MapPinOff}
        title={t("notFoundTitle")}
        action={
          <Link href="/" className={buttonStyles()}>
            {t("backHome")}
          </Link>
        }
      >
        {t("notFoundText")}
      </EmptyState>
    </Container>
  );
}
