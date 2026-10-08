import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission } from "@/lib/scopes";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { DailyReportsViewManager } from "@/components/reports/daily-reports-view-manager";

export default async function DailyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  const params = await searchParams;

  const isEmployee =
    effectiveUser?.role.code === "employee" ||
    (!effectiveUser?.role.isSystem &&
      effectiveUser?.role.code !== "admin" &&
      effectiveUser?.role.code !== "manager");

  const isManager = effectiveUser?.role.code === "manager";
  const isSuperAdmin = Boolean(
    effectiveUser?.role.isSystem ||
      effectiveUser?.role.code === "super_admin" ||
      effectiveUser?.role.code === "admin"
  );

  // Load categories configured for daily reports or all categories
  const categories = await db.department.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: {
      customFields: {
        where: { entityType: "DAILY_REPORT" },
        orderBy: { order: "asc" },
      },
    },
  });

  // Scoped reports query
  const reportWhere: any = {};
  if (isEmployee) {
    reportWhere.userId = user.id;
  } else if (isManager && user.primaryDepartmentId && !isSuperAdmin) {
    reportWhere.departmentId = user.primaryDepartmentId;
  }

  // Load reports list (up to 150 recent reports for instant live filtering)
  const rawReports = await db.dailyReport.findMany({
    where: reportWhere,
    take: 150,
    include: {
      user: { select: { id: true, name: true, designation: true } },
      department: { select: { id: true, name: true, code: true } },
      reviewer: { select: { id: true, name: true } },
      fieldValues: {
        include: {
          customField: {
            select: { id: true, fieldName: true, fieldType: true },
          },
        },
      },
    },
    orderBy: { reportDate: "desc" },
  });

  // Load team members / reporters for filter dropdown
  const userWhere: any = { status: "ACTIVE" };
  if (isEmployee) {
    userWhere.id = user.id;
  } else if (isManager && user.primaryDepartmentId && !isSuperAdmin) {
    userWhere.OR = [
      { primaryDepartmentId: user.primaryDepartmentId },
      { memberships: { some: { departmentId: user.primaryDepartmentId } } },
    ];
  }

  const reporterUsers = await db.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      designation: true,
      primaryDepartment: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const canSubmit = effectiveUser ? hasEffectivePermission(effectiveUser, "report.create") : false;
  const canReview = effectiveUser ? hasEffectivePermission(effectiveUser, "report.review") : false;
  const canApprove = effectiveUser ? hasEffectivePermission(effectiveUser, "report.approve") : false;

  // Determine initial tab: if user cannot submit, fallback to view tab
  const requestedTab = params.tab === "submit" || params.tab === "view" ? params.tab : null;
  const initialTab: "submit" | "view" =
    requestedTab || (canSubmit && isEmployee ? "submit" : "view");

  // Format dates to ISO strings for hydration safety
  const formattedReports = rawReports.map((r) => ({
    ...r,
    reportDate: r.reportDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  }));

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            {isEmployee
              ? "My Daily Activity Reports & Logs"
              : isManager
              ? `${user.primaryDepartment?.name || "Department"} Daily Reports & Team Oversight`
              : "Daily Activity Reports, Sales Tracking & Team Directory"}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isEmployee
              ? `Log your daily progress, calls, deliverables, and review past submissions for ${user.primaryDepartment?.name || "your department"}.`
              : "Review, filter by member, check today's and yesterday's reports, and manage department activity."}
          </p>
        </div>

        {/* Unified Tabbed Report View Manager */}
        <DailyReportsViewManager
          reports={formattedReports}
          categories={categories}
          users={reporterUsers}
          currentUserId={user.id}
          userPrimaryDepartmentId={user.primaryDepartmentId}
          isEmployee={isEmployee}
          isManager={isManager}
          canSubmit={canSubmit}
          canReview={canReview}
          canApprove={canApprove}
          initialTab={initialTab}
        />
      </div>
    </AppShell>
  );
}
