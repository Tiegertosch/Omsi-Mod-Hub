import type { BadgeTone } from "@/components/ui/badge";
import type { ProjectStatus } from "@/generated/prisma/enums";

/** Farbe des Status-Badges – geteilt von Server- und Client-Komponenten. */
export const STATUS_TONES: Record<ProjectStatus, BadgeTone> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "info",
  PUBLISHED: "success",
  REJECTED: "danger",
  HIDDEN: "warning",
  ARCHIVED: "neutral",
};
