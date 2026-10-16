"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/state";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("Errors");
  // Keine internen Fehlerdetails anzeigen – nur eine verständliche Meldung.
  return (
    <Container className="py-24">
      <EmptyState
        icon={TriangleAlert}
        tone="danger"
        title={t("genericTitle")}
        action={<Button onClick={() => retry()}>{t("retry")}</Button>}
      >
        {t("genericText")}
      </EmptyState>
    </Container>
  );
}
