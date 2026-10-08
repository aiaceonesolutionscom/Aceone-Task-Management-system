import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission } from "@/lib/scopes";
import { submitDailyReport, reviewDailyReport } from "@/lib/daily-reports";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!hasEffectivePermission(effectiveUser, "report.create")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to submit daily reports." }, { status: 403 });
  }

  const body = await request.json();
  const { departmentId, reportDate, notes, fieldValues } = body;

  try {
    const report = await submitDailyReport(effectiveUser, {
      departmentId: Number(departmentId),
      reportDate: new Date(reportDate),
      notes,
      fieldValues,
    });
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to submit" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { reportId, status, reviewNotes } = body;

  const isApprove = status === "APPROVED";
  const requiredPerm = isApprove ? "report.approve" : "report.review";
  if (!hasEffectivePermission(effectiveUser, requiredPerm)) {
    return NextResponse.json(
      { error: `Forbidden: You do not have permission to ${isApprove ? "approve" : "review"} daily reports.` },
      { status: 403 }
    );
  }

  try {
    const report = await reviewDailyReport(effectiveUser, {
      reportId: Number(reportId),
      status,
      reviewNotes,
    });
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to review" }, { status: 400 });
  }
}
