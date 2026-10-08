import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";
import { hasEffectivePermission, type EffectiveUser } from "@/lib/scopes";

export type SubmitDailyReportInput = {
  departmentId: number;
  reportDate: Date;
  notes?: string;
  fieldValues?: Record<string, string>;
};

/**
 * Submits a daily activity report for any category configured with daily reports.
 */
export async function submitDailyReport(user: EffectiveUser, input: SubmitDailyReportInput) {
  if (!hasEffectivePermission(user, "report.create")) {
    throw new Error("Forbidden: You do not have permission to submit daily reports.");
  }
  const report = await db.$transaction(async (tx) => {
    const r = await tx.dailyReport.create({
      data: {
        userId: user.id,
        departmentId: input.departmentId,
        reportDate: input.reportDate,
        status: "SUBMITTED",
        notes: input.notes,
      },
    });

    if (input.fieldValues) {
      for (const [fieldKey, value] of Object.entries(input.fieldValues)) {
        const field = await tx.customField.findFirst({
          where: {
            fieldKey,
            entityType: "DAILY_REPORT",
            OR: [{ departmentId: input.departmentId }, { departmentId: null }],
          },
        });
        if (field) {
          await tx.customFieldValue.create({
            data: {
              customFieldId: field.id,
              dailyReportId: r.id,
              value: String(value),
            },
          });
        }
      }
    }

    return r;
  });

  await recordAudit({
    actorId: user.id,
    action: "daily_report.submit",
    entityType: "REPORT",
    entityId: report.id,
    metadata: {
      departmentId: input.departmentId,
      reportDate: input.reportDate,
    },
  });

  // Notify department head or CEO
  const superAdmins = await db.user.findMany({
    where: { role: { isSystem: true } },
    select: { id: true },
  });

  for (const admin of superAdmins) {
    if (admin.id !== user.id) {
      await sendNotification({
        userId: admin.id,
        type: "DAILY_REPORT_SUBMITTED",
        title: "Daily Report Submitted",
        message: `${user.name} submitted daily report for ${input.reportDate.toLocaleDateString()}`,
        entityType: "REPORT",
        entityId: report.id,
      });
    }
  }

  return report;
}

/**
 * Reviews a daily activity report (Approve or Request Changes).
 */
export async function reviewDailyReport(
  user: EffectiveUser,
  input: {
    reportId: number;
    status: "APPROVED" | "CHANGES_REQUESTED";
    reviewNotes?: string;
  }
) {
  const isApprove = input.status === "APPROVED";
  const requiredPerm = isApprove ? "report.approve" : "report.review";
  if (!hasEffectivePermission(user, requiredPerm)) {
    throw new Error(`Forbidden: You do not have permission to ${isApprove ? "approve" : "review"} daily reports.`);
  }

  const report = await db.dailyReport.update({
    where: { id: input.reportId },
    data: {
      status: input.status,
      reviewerId: user.id,
      reviewNotes: input.reviewNotes,
      reviewedAt: new Date(),
    },
  });

  await recordAudit({
    actorId: user.id,
    action: `daily_report.${input.status.toLowerCase()}`,
    entityType: "REPORT",
    entityId: report.id,
    metadata: { reviewNotes: input.reviewNotes },
  });

  await sendNotification({
    userId: report.userId,
    type: input.status === "APPROVED" ? "TASK_APPROVED" : "CHANGES_REQUESTED",
    title: input.status === "APPROVED" ? "Daily Report Approved" : "Changes Requested on Daily Report",
    message: `${user.name} ${input.status === "APPROVED" ? "approved" : "requested changes on"} your daily report: "${input.reviewNotes || ""}"`,
    entityType: "REPORT",
    entityId: report.id,
  });

  return report;
}
