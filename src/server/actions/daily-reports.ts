"use server";

import { requireUser } from "@/lib/auth";
import { getEffectiveUser } from "@/lib/scopes";
import { deleteDailyReport, submitDailyReport, reviewDailyReport, SubmitDailyReportInput } from "@/lib/daily-reports";
import { revalidatePath } from "next/cache";

export async function deleteDailyReportAction(reportId: number) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) {
    throw new Error("Unauthorized");
  }

  const result = await deleteDailyReport(effectiveUser, reportId);
  revalidatePath("/daily-reports");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return result;
}

export async function submitDailyReportAction(input: SubmitDailyReportInput) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) {
    throw new Error("Unauthorized");
  }

  const report = await submitDailyReport(effectiveUser, input);
  revalidatePath("/daily-reports");
  revalidatePath("/dashboard");
  return { success: true, reportId: report.id };
}

export async function reviewDailyReportAction(input: {
  reportId: number;
  status: "APPROVED" | "CHANGES_REQUESTED";
  reviewNotes?: string;
}) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) {
    throw new Error("Unauthorized");
  }

  const report = await reviewDailyReport(effectiveUser, input);
  revalidatePath("/daily-reports");
  revalidatePath("/dashboard");
  return { success: true, reportId: report.id };
}
