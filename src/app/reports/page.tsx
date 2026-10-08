import { requireUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission, getAllowedDepartmentIds } from "@/lib/scopes";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import {
  Download,
  BarChart3,
  TrendingUp,
  Users,
  FolderTree,
  ShieldAlert,
  AlertTriangle,
  Database,
  Lock,
} from "lucide-react";
import { ReportsCRMViewer, CRMTaskItem } from "@/components/reports/reports-crm-viewer";

export default async function ReportsAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    departmentId?: string;
    assigneeId?: string;
    overdue?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  const params = await searchParams;

  const isPrivileged = Boolean(
    user.role.code === "super_admin" ||
    user.role.isSystem ||
    user.role.code === "admin"
  );

  const canViewCategoryReports = effectiveUser
    ? isPrivileged || hasEffectivePermission(effectiveUser, "report.category.view")
    : false;

  const canViewReportsCRM = effectiveUser
    ? isPrivileged || hasEffectivePermission(effectiveUser, "report.crm.view")
    : false;

  const canExport = effectiveUser
    ? isPrivileged ||
      hasEffectivePermission(effectiveUser, "report.export") ||
      hasEffectivePermission(effectiveUser, "report.crm.view") ||
      hasEffectivePermission(effectiveUser, "report.view")
    : false;

  const allowedDepartmentIds = isPrivileged
    ? null
    : effectiveUser
    ? getAllowedDepartmentIds(effectiveUser)
    : [];

  const baseTaskWhere: any = {
    taskCode: { not: { contains: "-GENERAL" } },
    ...(allowedDepartmentIds !== null
      ? { departmentId: { in: allowedDepartmentIds.length > 0 ? allowedDepartmentIds : [-1] } }
      : {}),
  };

  // Build Filter Where Clause for CRM
  const crmWhere: any = { ...baseTaskWhere };

  if (params.q?.trim()) {
    crmWhere.OR = [
      { title: { contains: params.q.trim(), mode: "insensitive" } },
      { taskCode: { contains: params.q.trim(), mode: "insensitive" } },
      { description: { contains: params.q.trim(), mode: "insensitive" } },
    ];
  }

  if (params.status) {
    crmWhere.status = params.status;
  }

  if (params.priority) {
    crmWhere.priority = params.priority;
  }

  if (params.departmentId) {
    const dId = parseInt(params.departmentId, 10);
    if (!isNaN(dId)) {
      if (allowedDepartmentIds === null || allowedDepartmentIds.includes(dId)) {
        crmWhere.departmentId = dId;
      }
    }
  }

  if (params.assigneeId) {
    const aId = parseInt(params.assigneeId, 10);
    if (!isNaN(aId)) {
      crmWhere.assignees = { some: { userId: aId } };
    }
  }

  if (params.overdue === "true") {
    crmWhere.deadline = { lt: new Date() };
    crmWhere.status = { notIn: ["APPROVED", "COMPLETED", "ARCHIVED", "CANCELLED"] };
  }

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  // Load metrics and CRM records from database concurrently
  const [
    totalTasks,
    completedTasks,
    underReviewTasks,
    changesRequestedTasks,
    overdueTasks,
    categoryStats,
    assigneeStats,
    overdueList,
    departmentsList,
    usersList,
    crmTasksCount,
    crmTasksRaw,
  ] = await Promise.all([
    db.task.count({ where: baseTaskWhere }),
    db.task.count({ where: { ...baseTaskWhere, status: { in: ["APPROVED", "COMPLETED"] } } }),
    db.task.count({ where: { ...baseTaskWhere, status: "UNDER_REVIEW" } }),
    db.task.count({ where: { ...baseTaskWhere, status: "CHANGES_REQUESTED" } }),
    db.task.count({
      where: {
        ...baseTaskWhere,
        deadline: { lt: new Date() },
        status: { notIn: ["APPROVED", "COMPLETED", "ARCHIVED", "CANCELLED"] },
      },
    }),
    db.department.findMany({
      where: {
        status: "ACTIVE",
        ...(allowedDepartmentIds !== null ? { id: { in: allowedDepartmentIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        _count: {
          select: {
            tasks: { where: { taskCode: { not: { contains: "-GENERAL" } } } },
            members: true,
          },
        },
      },
    }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        designation: true,
        taskAssignments: {
          select: { status: true },
        },
      },
      take: 15,
    }),
    db.task.findMany({
      where: {
        ...baseTaskWhere,
        deadline: { lt: new Date() },
        status: { notIn: ["APPROVED", "COMPLETED", "ARCHIVED", "CANCELLED"] },
      },
      include: {
        department: true,
        assignees: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { deadline: "asc" },
      take: 10,
    }),
    db.department.findMany({
      where: {
        status: "ACTIVE",
        ...(allowedDepartmentIds !== null ? { id: { in: allowedDepartmentIds } } : {}),
      },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, designation: true },
      orderBy: { name: "asc" },
    }),
    canViewReportsCRM ? db.task.count({ where: crmWhere }) : Promise.resolve(0),
    canViewReportsCRM
      ? db.task.findMany({
          where: crmWhere,
          include: {
            department: { select: { id: true, name: true, code: true } },
            assignor: { select: { id: true, name: true } },
            assignees: {
              include: { user: { select: { id: true, name: true, designation: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        })
      : Promise.resolve([]),
  ]);

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Format CRM tasks for client component
  const crmTasks: CRMTaskItem[] = crmTasksRaw.map((t) => ({
    id: t.id,
    taskCode: t.taskCode,
    title: t.title,
    status: t.status,
    priority: t.priority,
    deadline: t.deadline ? t.deadline.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    department: t.department,
    assignor: t.assignor,
    assignees: t.assignees.map((a) => ({
      user: {
        id: a.user.id,
        name: a.user.name,
        designation: a.user.designation,
      },
    })),
  }));

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Operations &amp; Performance Analytics
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Live metrics across categories, assignments, CRM pipeline, and delivery stages.
            </p>
          </div>

          {canExport && (
            <a
              href="/api/reports/export"
              download="aceone-tasks-report.csv"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-white border border-neutral-300 text-neutral-700 text-xs font-semibold hover:bg-neutral-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV Report</span>
            </a>
          )}
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase">Completion Rate</span>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{completionRate}%</p>
            <div className="w-full bg-neutral-100 rounded-full h-1.5 mt-2">
              <div
                className="bg-emerald-600 h-1.5 rounded-full"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase">Completed Deliverables</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{completedTasks}</p>
            <p className="text-[11px] text-neutral-400 mt-1">Approved across teams</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase">Active In-Review</span>
            <p className="text-2xl font-bold text-amber-600 mt-1">{underReviewTasks}</p>
            <p className="text-[11px] text-neutral-400 mt-1">Pending review decision</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase">Overdue Items</span>
            <p className="text-2xl font-bold text-red-600 mt-1">{overdueTasks}</p>
            <p className="text-[11px] text-neutral-400 mt-1">Exceeded deadline</p>
          </div>
        </div>

        {/* Actionable Overdue Tasks List */}
        {overdueList.length > 0 && (
          <div className="bg-white border border-red-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="px-5 py-3 bg-red-50/60 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h2 className="text-xs font-bold text-red-950 uppercase tracking-wide">
                  Attention Needed: Overdue Tasks ({overdueTasks})
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-red-700 bg-red-100/60 px-2 py-0.5 rounded">
                Exceeded Deadline
              </span>
            </div>

            <div className="w-full overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs min-w-[550px] md:min-w-full">
                <thead className="bg-[#fcf9f9] text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-100">
                  <tr>
                    <th className="py-2.5 px-4">Task ID</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Assignee</th>
                    <th className="py-2.5 px-3">Deadline</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {overdueList.map((t) => (
                    <tr key={t.id} className="hover:bg-red-50/20">
                      <td className="py-2.5 px-4 font-mono font-bold text-blue-600">
                        <Link href={`/tasks/${t.id}`} className="hover:underline">
                          {t.taskCode || `#${t.id}`}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900 max-w-[200px] truncate">
                        {t.title}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600">{t.department.name}</td>
                      <td className="py-2.5 px-3 text-neutral-700">
                        {t.assignees.length > 0
                          ? t.assignees.map((a) => a.user.name).join(", ")
                          : "Unassigned"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-red-600">
                        {t.deadline
                          ? new Date(t.deadline).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Link
                          href={`/tasks/${t.id}`}
                          className="inline-flex items-center text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Workspace →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CRM SECTION — Enterprise Deep Filter Records Explorer with Pagination */}
        {canViewReportsCRM ? (
          <ReportsCRMViewer
            initialTasks={crmTasks}
            totalTasks={crmTasksCount}
            currentPage={page}
            pageSize={pageSize}
            departments={departmentsList}
            users={usersList}
            canExport={canExport}
            filterValues={{
              q: params.q,
              status: params.status,
              priority: params.priority,
              departmentId: params.departmentId,
              assigneeId: params.assigneeId,
              overdue: params.overdue === "true",
            }}
          />
        ) : (
          <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-2xs text-center">
            <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto mb-2">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900">CRM &amp; Deep Explorer Restricted</h3>
            <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
              You currently do not have the <code>report.crm.view</code> permission to browse the granular CRM system data records. Please contact your Super Admin to grant you access.
            </p>
          </div>
        )}

        {/* Category Breakdown Table — Controlled by report.category.view permission */}
        {canViewCategoryReports && (
          <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-neutral-900">Department &amp; Category Activity</h2>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Category Access Permitted
              </span>
            </div>

            <div className="w-full overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs min-w-[550px] md:min-w-full">
                <thead className="bg-[#f9fafb] text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
                  <tr>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Total Tasks</th>
                    <th className="py-2.5 px-3">Team Size</th>
                    <th className="py-2.5 px-4 text-right">Work Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {categoryStats.map((c) => {
                    const share =
                      totalTasks > 0 ? Math.round((c._count.tasks / totalTasks) * 100) : 0;
                    return (
                      <tr key={c.id} className="hover:bg-neutral-50/60">
                        <td className="py-3 px-4 font-semibold text-neutral-900">{c.name}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-neutral-500">
                          {c.code || "—"}
                        </td>
                        <td className="py-3 px-3 font-semibold text-neutral-800">{c._count.tasks}</td>
                        <td className="py-3 px-3 text-neutral-600">{c._count.members} members</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono text-neutral-500 text-[11px]">{share}%</span>
                            <div className="w-20 bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-neutral-900 h-1.5" style={{ width: `${share}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Team Member Workload Breakdown */}
        <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-neutral-900">Team Member Activity</h2>
            </div>
          </div>

          <div className="w-full overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs min-w-[550px] md:min-w-full">
              <thead className="bg-[#f9fafb] text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
                <tr>
                  <th className="py-2.5 px-4">Member</th>
                  <th className="py-2.5 px-3">Designation</th>
                  <th className="py-2.5 px-3">Total Assigned</th>
                  <th className="py-2.5 px-3">Completed</th>
                  <th className="py-2.5 px-3">In Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {assigneeStats.map((u) => {
                  const assigned = u.taskAssignments.length;
                  const completed = u.taskAssignments.filter((a) => a.status === "COMPLETED").length;
                  const inProgress = u.taskAssignments.filter((a) =>
                    ["ASSIGNED", "VIEWED", "IN_PROGRESS", "SUBMITTED"].includes(a.status)
                  ).length;

                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/60">
                      <td className="py-3 px-4 font-semibold text-neutral-900">{u.name}</td>
                      <td className="py-3 px-3 text-neutral-500">{u.designation || "Team Member"}</td>
                      <td className="py-3 px-3 font-semibold text-neutral-800">{assigned}</td>
                      <td className="py-3 px-3 text-emerald-600 font-semibold">{completed}</td>
                      <td className="py-3 px-3 text-blue-600 font-semibold">{inProgress}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
