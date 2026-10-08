import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveUser, hasEffectivePermission } from "@/lib/scopes";
import { AppShell } from "@/components/layout/app-shell";
import { formatTime12 } from "@/lib/date-utils";
import Link from "next/link";
import {
  CheckSquare,
  Clock,
  AlertCircle,
  FileCheck,
  Plus,
  ArrowRight,
  TrendingUp,
  FolderTree,
  Users,
  AlertTriangle,
  MessageSquare,
  FileText,
  Calendar,
  CheckCircle2,
  Bell,
  ExternalLink,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  const isSystemAdmin = Boolean(
    effectiveUser?.role.isSystem ||
    effectiveUser?.role.code === "admin" ||
    effectiveUser?.role.code === "super_admin"
  );
  const isEmployee = effectiveUser?.role.code === "employee";
  const canCreateTask = effectiveUser ? hasEffectivePermission(effectiveUser, "task.create") : false;
  const canViewCategories = effectiveUser ? (hasEffectivePermission(effectiveUser, "category.view") || isSystemAdmin) : false;

  // Notification count
  const unreadNotificationsCount = await db.notification.count({
    where: { userId: user.id, isRead: false },
  });

  // ----------------------------------------------------
  // 1. EMPLOYEE DASHBOARD DATA
  // ----------------------------------------------------
  if (isEmployee) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [employeeAssignments, todayReport, employeeNotifications] = await Promise.all([
      db.taskAssignee.findMany({
        where: { userId: user.id },
        include: {
          task: {
            include: {
              department: true,
              assignor: { select: { id: true, name: true, designation: true } },
              versions: {
                orderBy: { versionNumber: "desc" },
                take: 1,
                include: { reviewer: true },
              },
              comments: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { user: true },
              },
            },
          },
        },
        orderBy: { assignedAt: "desc" },
      }),
      db.dailyReport.findFirst({
        where: {
          userId: user.id,
          createdAt: { gte: startOfToday },
        },
        include: { reviewer: true },
      }),
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const allAssignedTasks = employeeAssignments.map((a) => a.task);
    const myTasks = allAssignedTasks.filter((t) => !t.startDate || new Date(t.startDate) <= endOfToday);
    const futureScheduledTasks = allAssignedTasks.filter((t) => t.startDate && new Date(t.startDate) > endOfToday);

    const activeTasks = myTasks.filter((t) =>
      ["NEW", "ASSIGNED", "VIEWED", "IN_PROGRESS"].includes(t.status)
    );
    const changesRequested = myTasks.filter((t) => t.status === "CHANGES_REQUESTED");
    const underReview = myTasks.filter((t) => t.status === "UNDER_REVIEW");
    const completedTasks = myTasks.filter((t) =>
      ["APPROVED", "COMPLETED"].includes(t.status)
    );
    const overdueTasks = myTasks.filter(
      (t) =>
        t.deadline &&
        new Date(t.deadline).getTime() < Date.now() &&
        !["APPROVED", "COMPLETED"].includes(t.status)
    );

    return (
      <AppShell user={user} unreadCount={unreadNotificationsCount}>
        <div className="space-y-6">
          {/* Employee Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                  Welcome back, {user.name}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                  Employee Workspace
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {user.designation || "Team Member"}
                {user.primaryDepartment ? ` · ${user.primaryDepartment.name} Department` : ""} ·{" "}
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/daily-reports"
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-xs transition-colors ${
                  todayReport
                    ? "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{todayReport ? "View Today's Report" : "Submit Daily Report"}</span>
              </Link>
            </div>
          </div>

          {/* Upcoming Scheduled Tasks Notification Banner */}
          {futureScheduledTasks.length > 0 && (
            <div className="bg-gradient-to-r from-purple-50/80 via-indigo-50/60 to-blue-50/70 border border-purple-200 rounded-xl p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                    <span>{futureScheduledTasks.length} Scheduled Tasks Waiting to Unlock This Month</span>
                    <span className="text-[10px] bg-purple-200/70 text-purple-800 px-1.5 py-0.2 rounded font-bold">
                      Upcoming
                    </span>
                  </h2>
                  <p className="text-[11px] text-purple-700 mt-0.5">
                    Tasks scheduled for future dates will automatically appear on your active list when their day arrives.
                  </p>
                </div>
              </div>
              <Link
                href="/tasks?schedule=upcoming"
                className="inline-flex items-center gap-1 text-xs font-bold text-purple-800 hover:text-purple-950 bg-white border border-purple-200 px-3 py-1.5 rounded-lg shadow-2xs shrink-0"
              >
                <span>View Scheduled Tasks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Urgent Manager Feedback Banner (if any task has CHANGES_REQUESTED) */}
          {changesRequested.length > 0 && (
            <div className="bg-rose-50 border border-rose-300 rounded-lg p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-xs font-bold text-rose-950 uppercase tracking-wide">
                    Action Required: Manager Feedback & Revisions ({changesRequested.length})
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-rose-700">
                  High Priority
                </span>
              </div>

              <div className="space-y-2">
                {changesRequested.map((task) => {
                  const latestVer = task.versions[0];
                  return (
                    <div
                      key={task.id}
                      className="bg-white p-3 rounded-md border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-neutral-900 text-white rounded">
                            {task.taskCode || `#${task.id}`}
                          </span>
                          <span className="text-xs font-bold text-neutral-900">{task.title}</span>
                          <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            Revisions Requested
                          </span>
                        </div>
                        {latestVer?.reviewNotes && (
                          <p className="text-xs text-rose-800 leading-relaxed font-medium">
                            "{latestVer.reviewNotes}"
                          </p>
                        )}
                        <p className="text-[10px] text-neutral-500">
                          Reviewed by {latestVer?.reviewer?.name || "Manager"}
                        </p>
                      </div>

                      <Link
                        href={`/tasks/${task.id}`}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded shadow-xs shrink-0 inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>Fix & Resubmit</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Employee Stat Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                  Active Tasks
                </span>
                <CheckSquare className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{activeTasks.length}</p>
              <p className="text-[10px] text-neutral-400 mt-0.5">Assigned to you in progress</p>
            </div>

            <div className={`rounded-lg p-3.5 border shadow-2xs transition-all ${
              changesRequested.length > 0
                ? "bg-rose-50/70 border-rose-300"
                : "bg-white border-neutral-200"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                  Changes Req.
                </span>
                <AlertCircle className={`w-4 h-4 ${changesRequested.length > 0 ? "text-rose-600" : "text-neutral-400"}`} />
              </div>
              <p className={`text-2xl font-bold mt-1 ${changesRequested.length > 0 ? "text-rose-700" : "text-neutral-900"}`}>
                {changesRequested.length}
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5">Need your revision</p>
            </div>

            <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                  Under Review
                </span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{underReview.length}</p>
              <p className="text-[10px] text-neutral-400 mt-0.5">Awaiting manager decision</p>
            </div>

            <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                  Approved
                </span>
                <FileCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{completedTasks.length}</p>
              <p className="text-[10px] text-neutral-400 mt-0.5">Verified & completed</p>
            </div>
          </div>

          {/* Main Content Grid: My Assigned Tasks Board & Right Widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: My Assigned Tasks List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900">My Assigned Tasks ({myTasks.length})</h2>
                    <p className="text-[11px] text-neutral-500">Tasks assigned specifically to you by team leads</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/tasks?filter=my&status=APPROVED"
                      className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-1"
                    >
                      History ({completedTasks.length})
                    </Link>
                    <Link
                      href="/tasks"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      All Tasks <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                {myTasks.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <CheckSquare className="w-8 h-8 text-neutral-300 mx-auto" />
                    <p className="text-xs font-semibold text-neutral-700">No tasks assigned yet</p>
                    <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                      When your manager or team lead assigns you tasks, they will appear here with instructions and files.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {myTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        className="p-4 flex items-center justify-between hover:bg-neutral-50/80 transition-colors block group"
                      >
                        <div className="min-w-0 flex-1 pr-4 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-neutral-900 text-white rounded">
                              {task.taskCode || `#${task.id}`}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded">
                              {task.department.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                task.priority === "URGENT"
                                  ? "bg-red-100 text-red-800"
                                  : task.priority === "HIGH"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-neutral-100 text-neutral-600"
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>

                          <h3 className="text-xs font-bold text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                            {task.title}
                          </h3>

                          <p className="text-[11px] text-neutral-500">
                            Assigned by: <strong>{task.assignor?.name || "Manager"}</strong>
                            {task.deadline && (
                              <span>
                                {" "}· Due: {new Date(task.deadline).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <span
                            className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              task.status === "APPROVED" || task.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800"
                                : task.status === "CHANGES_REQUESTED"
                                ? "bg-rose-100 text-rose-800"
                                : task.status === "UNDER_REVIEW"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {task.status.replace("_", " ")}
                          </span>
                          <span className="text-[11px] text-blue-600 font-semibold block group-hover:underline">
                            Open Task →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Daily Report Widget & Notifications Feed */}
            <div className="space-y-4">
              {/* Daily Report Card */}
              <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-neutral-900">Today's Daily Report</h3>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      todayReport
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {todayReport ? todayReport.status : "Pending"}
                  </span>
                </div>

                {todayReport ? (
                  <div className="space-y-2 text-xs">
                    <p className="text-neutral-600">
                      Report submitted at{" "}
                      <strong>
                        {formatTime12(todayReport.createdAt)}
                      </strong>
                    </p>
                    {todayReport.reviewNotes && (
                      <div className="p-2 rounded bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-700">
                        <span className="font-semibold block">Reviewer Notes:</span>
                        {todayReport.reviewNotes}
                      </div>
                    )}
                    <Link
                      href="/daily-reports"
                      className="inline-block text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      View Report Details →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    <p className="text-neutral-500 leading-relaxed text-[11px]">
                      You haven't logged your daily activity yet. Keep your manager updated by submitting today's report.
                    </p>
                    <Link
                      href="/daily-reports"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Submit Today's Report</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Notifications & Reviewer Messages Feed */}
              <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="px-4 py-3.5 border-b border-neutral-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900">Notifications & Updates</h3>
                    <p className="text-[10px] text-neutral-500">Manager notes, reviews & task alerts</p>
                  </div>
                  <Link href="/notifications" className="text-[11px] font-semibold text-blue-600 hover:underline">
                    All
                  </Link>
                </div>

                {employeeNotifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-400">
                    No new notifications
                  </div>
                ) : (
                  <div className="p-3 space-y-2.5">
                    {employeeNotifications.map((notif) => (
                      <Link
                        key={notif.id}
                        href={notif.taskId ? `/tasks/${notif.taskId}` : "/notifications"}
                        className="p-2.5 rounded-md hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-colors block text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 truncate">{notif.title}</span>
                          <span className="text-[10px] text-neutral-400 shrink-0">
                            {formatTime12(notif.createdAt)}
                          </span>
                        </div>
                        {notif.message && (
                          <p className="text-[11px] text-neutral-600 line-clamp-2">
                            {notif.message}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ----------------------------------------------------
  // 2. MANAGEMENT & EXECUTIVE DASHBOARD (Manager / Admin / Super Admin)
  // ----------------------------------------------------
  const allowedDeptIds = isSystemAdmin
    ? null
    : Array.from(
        new Set([
          ...(effectiveUser?.primaryDepartmentId ? [effectiveUser.primaryDepartmentId] : []),
          ...(effectiveUser?.categoryScopeIds || []),
        ])
      );

  const deptTaskFilter: any = {
    taskCode: { not: { contains: "-GENERAL" } },
    ...(allowedDeptIds !== null
      ? { departmentId: { in: allowedDeptIds.length > 0 ? allowedDeptIds : [-1] } }
      : {}),
  };

  // Scope audit activities to manager's departments if not system admin
  let auditWhere: any = {};
  if (!isSystemAdmin && allowedDeptIds !== null) {
    const scopedTasks = await db.task.findMany({
      where: {
        OR: [
          { departmentId: { in: allowedDeptIds.length > 0 ? allowedDeptIds : [-1] } },
          { assignees: { some: { userId: user.id } } },
          { reviewers: { some: { userId: user.id } } },
          { assignedBy: user.id },
        ],
      },
      select: { id: true },
    });
    const scopedTaskIds = scopedTasks.map((t) => t.id.toString());

    const scopedUsers = await db.user.findMany({
      where: {
        OR: [
          { primaryDepartmentId: { in: allowedDeptIds.length > 0 ? allowedDeptIds : [-1] } },
          { id: user.id },
        ],
      },
      select: { id: true },
    });
    const scopedUserIds = scopedUsers.map((u) => u.id);

    auditWhere = {
      OR: [
        { entityType: "TASK", entityId: { in: scopedTaskIds } },
        { actorId: { in: scopedUserIds } },
      ],
    };
  }

  const [
    totalTasks,
    activeTasks,
    pendingApprovals,
    changesRequested,
    completedTasks,
    overdueTasks,
    myAssignedTasks,
    recentTasks,
    recentActivities,
    categoriesCount,
    usersCount,
  ] = await Promise.all([
    db.task.count({ where: deptTaskFilter }),
    db.task.count({ where: { ...deptTaskFilter, status: { in: ["NEW", "ASSIGNED", "VIEWED", "IN_PROGRESS", "UNDER_REVIEW"] } } }),
    db.task.count({ where: { ...deptTaskFilter, status: "UNDER_REVIEW" } }),
    db.task.count({ where: { ...deptTaskFilter, status: "CHANGES_REQUESTED" } }),
    db.task.count({ where: { ...deptTaskFilter, status: { in: ["APPROVED", "COMPLETED"] } } }),
    db.task.count({
      where: {
        ...deptTaskFilter,
        deadline: { lt: new Date() },
        status: { notIn: ["APPROVED", "COMPLETED", "ARCHIVED", "CANCELLED"] },
      },
    }),
    db.taskAssignee.findMany({
      where: { userId: user.id },
      include: {
        task: {
          include: { department: true, assignor: true },
        },
      },
      take: 8,
      orderBy: { assignedAt: "desc" },
    }),
    db.task.findMany({
      where: {
        ...deptTaskFilter,
        status: { in: ["NEW", "ASSIGNED", "VIEWED", "IN_PROGRESS", "UNDER_REVIEW", "CHANGES_REQUESTED"] },
      },
      include: {
        department: true,
        assignor: true,
        assignees: { include: { user: true } },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "asc" },
      ],
      take: 8,
    }),
    db.auditLog.findMany({
      where: auditWhere,
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.department.count(),
    db.user.count(),
  ]);

  const isEmptySetup = totalTasks === 0;

  return (
    <AppShell user={user} unreadCount={unreadNotificationsCount}>
      <div className="space-y-6">
        {/* Welcome Header & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Welcome, {user.name}
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              {user.designation || user.role.name}
              {user.primaryDepartment ? ` · ${user.primaryDepartment.name}` : ""} ·{" "}
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {canCreateTask && (
              <Link
                href="/tasks/new"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Task</span>
              </Link>
            )}
            <Link
              href="/daily-reports"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-neutral-300 text-neutral-700 text-xs font-semibold hover:bg-neutral-50 transition-colors shadow-xs"
            >
              <span>Daily Report</span>
            </Link>
          </div>
        </div>

        {/* Empty Onboarding Guide (Section 122 of Specification) */}
        {isEmptySetup && isSystemAdmin && (
          <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-xs space-y-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                Workspace Setup Guide
              </span>
              <div className="flex items-center gap-3 mt-1">
                <Image
                  src="/aceone-logo.webp"
                  alt="AceOne Solutions"
                  width={140}
                  height={34}
                  className="h-7 w-auto object-contain"
                />
                <h2 className="text-base font-bold text-neutral-900">
                  Welcome to Task Management System
                </h2>
              </div>
              <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
                The database is clean and ready. Follow these steps to configure your organizational
                workflow:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <Link
                href="/organization/categories"
                className="p-3.5 rounded-md border border-neutral-200 hover:border-neutral-900 bg-[#fbfcfd] hover:bg-white transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between text-neutral-500 group-hover:text-neutral-900">
                  <FolderTree className="w-4 h-4" />
                  <span className="text-[11px] font-bold">Step 1</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-900">Setup Categories</h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {categoriesCount} categories configured. Create departments and codes.
                  </p>
                </div>
              </Link>

              <Link
                href="/organization/users"
                className="p-3.5 rounded-md border border-neutral-200 hover:border-neutral-900 bg-[#fbfcfd] hover:bg-white transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between text-neutral-500 group-hover:text-neutral-900">
                  <Users className="w-4 h-4" />
                  <span className="text-[11px] font-bold">Step 2</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-900">Add Team Members</h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {usersCount} team members. Assign designations and scopes.
                  </p>
                </div>
              </Link>

              <Link
                href="/organization/scopes"
                className="p-3.5 rounded-md border border-neutral-200 hover:border-neutral-900 bg-[#fbfcfd] hover:bg-white transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between text-neutral-500 group-hover:text-neutral-900">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[11px] font-bold">Step 3</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-900">Configure Scopes</h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Define assignment and approval boundaries.
                  </p>
                </div>
              </Link>

              <Link
                href="/tasks/new"
                className="p-3.5 rounded-md border border-neutral-200 hover:border-neutral-900 bg-[#fbfcfd] hover:bg-white transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between text-neutral-500 group-hover:text-neutral-900">
                  <CheckSquare className="w-4 h-4" />
                  <span className="text-[11px] font-bold">Step 4</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-900">Create First Task</h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Assign work with instructions and references.
                  </p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                Active Tasks
              </span>
              <CheckSquare className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xl font-bold text-neutral-900 mt-1">{activeTasks}</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">Total across categories</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                Under Review
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xl font-bold text-neutral-900 mt-1">{pendingApprovals}</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">Awaiting decision</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                Changes Req.
              </span>
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-xl font-bold text-neutral-900 mt-1">{changesRequested}</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">Revisions in progress</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                Approved
              </span>
              <FileCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xl font-bold text-neutral-900 mt-1">{completedTasks}</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">Completed successfully</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                Overdue
              </span>
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-xl font-bold text-red-600 mt-1">{overdueTasks}</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">Past deadline</p>
          </div>
        </div>

        {/* Dashboard Main Grid: My Tasks & Recent Work */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: My Assigned Tasks */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">
                    Pending & Actionable Work Queue ({activeTasks})
                  </h2>
                  <p className="text-[11px] text-neutral-500">
                    Unfinished tasks requiring action or review decision
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/tasks?status=APPROVED"
                    className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-1"
                  >
                    History & Completed ({completedTasks})
                  </Link>
                  <Link
                    href="/tasks"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    All Tasks <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {recentTasks.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckSquare className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-medium text-neutral-800">
                    All caught up! No pending tasks currently require action.
                  </p>
                  <Link
                    href="/tasks?status=APPROVED"
                    className="inline-block text-xs font-semibold text-blue-600 hover:underline"
                  >
                    View Task History & Completed Items ({completedTasks}) →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {recentTasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="p-3.5 flex items-center justify-between hover:bg-neutral-50/80 transition-colors block"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-neutral-100 text-neutral-700 rounded">
                            {t.taskCode || `#${t.id}`}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {t.department.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              t.priority === "URGENT"
                                ? "bg-red-100 text-red-800"
                                : t.priority === "HIGH"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-neutral-100 text-neutral-600"
                            }`}
                          >
                            {t.priority}
                          </span>
                        </div>
                        <h3 className="text-xs font-semibold text-neutral-900 truncate">
                          {t.title}
                        </h3>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {t.assignees.length > 0
                            ? `Assigned to: ${t.assignees.map((a) => a.user.name).join(", ")}`
                            : "Unassigned"}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          t.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : t.status === "CHANGES_REQUESTED"
                            ? "bg-rose-100 text-rose-800"
                            : t.status === "UNDER_REVIEW"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {t.status.replace("_", " ")}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Recent Activity Feed & Audit */}
          <div className="space-y-4">
            <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
              <div className="px-4 py-3.5 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">Recent Activity</h2>
                  <p className="text-[11px] text-neutral-500">Audit trail & real-time updates</p>
                </div>
                <Link
                  href="/audit"
                  className="text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                >
                  Logs
                </Link>
              </div>

              {recentActivities.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400">
                  No activity recorded yet
                </div>
              ) : (
                <div className="p-4 space-y-3.5">
                  {recentActivities.map((act) => {
                    const meta = (act.metadata as any) || {};
                    const taskCode = meta.taskCode || (act.entityType === "TASK" ? `Task #${act.entityId}` : "");
                    const isTask = act.entityType === "TASK" && act.entityId;

                    let actionColor = "bg-neutral-100 text-neutral-700";
                    let actionText = act.action.replace(".", " ");

                    if (act.action === "task.approved") {
                      actionColor = "bg-emerald-100 text-emerald-800";
                      actionText = "approved task";
                    } else if (act.action === "task.changes_requested") {
                      actionColor = "bg-rose-100 text-rose-800";
                      actionText = "requested changes on";
                    } else if (act.action === "task.version_submitted") {
                      actionColor = "bg-blue-100 text-blue-800";
                      actionText = `submitted V${meta.versionNumber || "1"} for`;
                    } else if (act.action === "task.create") {
                      actionColor = "bg-neutral-100 text-neutral-900";
                      actionText = "created task";
                    } else if (act.action === "task.comment") {
                      actionColor = "bg-indigo-100 text-indigo-800";
                      actionText = "commented on";
                    }

                    return (
                      <div key={act.id} className="flex gap-2.5 items-start text-xs">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 ${actionColor}`}>
                          {act.actor?.name.charAt(0) || "S"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-neutral-900 font-medium leading-snug">
                            <span className="font-semibold">{act.actor?.name || "System"}</span>{" "}
                            <span className="text-neutral-600">{actionText}</span>{" "}
                            {taskCode && isTask ? (
                              <Link
                                href={`/tasks/${act.entityId}`}
                                className="font-mono font-bold text-blue-600 hover:underline"
                              >
                                {taskCode}
                              </Link>
                            ) : taskCode ? (
                              <span className="font-mono font-semibold">{taskCode}</span>
                            ) : null}
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">
                            {formatTime12(act.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Category Directory Summary */}
            {canViewCategories && (
              <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-neutral-900">AceOne Categories</h3>
                  <Link
                    href="/organization/categories"
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    Manage
                  </Link>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Categories are fully configurable. Add departments, custom fields, and daily reporting
                  without code changes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
