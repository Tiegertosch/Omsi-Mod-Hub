"use server";

import { z } from "zod";

import { ReportReason } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { clientKey, consumeRateLimit } from "@/server/rate-limit";
import { needsTermsConsent } from "@/lib/legal";
import { getCurrentUser } from "@/server/session";

export type ReportFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; code: "validation" | "rate_limit" | "not_found" | "terms_required" | "generic" };

const reportSchema = z.object({
  projectId: z.string().min(1).max(64),
  reason: z.enum(ReportReason),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((value) => (value.length > 0 ? value : null)),
  // Honeypot: von Menschen unsichtbar, von Bots oft ausgefüllt
  website: z.string().max(0),
});

const REPORTS_PER_WINDOW = 5;
const REPORT_WINDOW_MS = 10 * 60 * 1000;

export async function reportProject(_prev: ReportFormState, formData: FormData): Promise<ReportFormState> {
  const parsed = reportSchema.safeParse({
    projectId: formData.get("projectId") ?? "",
    reason: formData.get("reason") ?? "",
    description: formData.get("description") ?? "",
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    // Ausgefüllter Honeypot: Erfolg vortäuschen, nichts speichern.
    if (parsed.error.issues.some((issue) => issue.path[0] === "website")) return { status: "success" };
    return { status: "error", code: "validation" };
  }

  try {
    if (!(await consumeRateLimit(await clientKey("report"), REPORTS_PER_WINDOW, REPORT_WINDOW_MS))) {
      return { status: "error", code: "rate_limit" };
    }

    const project = await db.project.findFirst({
      where: { id: parsed.data.projectId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!project) return { status: "error", code: "not_found" };

    // Angemeldete Nutzer werden als Meldende gespeichert, Gäste anonym.
    // Gäste dürfen melden; ein angemeldetes Konto braucht die Zustimmung zu den Nutzungsbedingungen.
    const reporter = await getCurrentUser();
    if (reporter && needsTermsConsent(reporter.termsVersion)) return { status: "error", code: "terms_required" };
    await db.report.create({
      data: {
        projectId: project.id,
        reporterId: reporter?.id ?? null,
        reason: parsed.data.reason,
        description: parsed.data.description,
      },
    });
    return { status: "success" };
  } catch (error) {
    console.error("reportProject failed", error instanceof Error ? error.message : "unknown error");
    return { status: "error", code: "generic" };
  }
}
