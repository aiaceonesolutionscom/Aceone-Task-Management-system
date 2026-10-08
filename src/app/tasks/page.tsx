import { requireUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission, getAllowedDepartmentIds } from "@/lib/scopes";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { Pagination } from "@/components/ui/pagination";
import { TasksFilterBar } from "@/components/tasks/tasks-filter-bar";
import { TasksTableWithBulkActions } from "@/components/tasks/tasks-table-bulk-actions";
import { TasksCalendarView } from "@/components/tasks/tasks-calendar-view";
import Link from "next/link";
import {
  Plus,
  CheckSquare,
  LayoutList,
  CalendarDays,
  Sparkles,
  Calendar,
  Zap,
} from "lucide-react";

export default async function TasksListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    priority?: string;
    filter?: string;
    page?: string;
    datePreset?: string;
    from?: string;
    to?: string;
    view?: string;
    schedule?: string;
  }>;
}) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  const params = await searchParams;

  const searchQuery = params.q || "";
  const categoryFilter = params.category ? parseInt(params.category, 10) : undefined;

  // Default status to "ACTIVE" when no status parameter is provided, so all active/in-progress tasks for today appear
  const rawStatus = params.status;
  const selectedStatusKey = rawStatus === undefined ? "ACTIVE" : (rawStatus === "" ? "ALL" : rawStatus);
  const statusFilter = selectedStatusKey === "ALL" ? undefined : selectedStatusKey;

  const priorityFilter = params.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined;
  const datePreset = params.datePreset || "";
  const fromDate = params.from || "";
  const toDate = params.to || "";
  const rawPage = parseInt(params.page || "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const PAGE_SIZE = 10;
  const isEmployee = user.role.code === "employee";
  const isMyTasks = isEmployee || params.filter === "my";
  const canCreateTask = effectiveUser ? hasEffectivePermission(effectiveUser, "task.create") : false;
  const canDeleteTasks = effectiveUser ? hasEffectivePermission(effectiveUser, "task.delete") : false;
  const canEditTasks = effectiveUser ? hasEffectivePermission(effectiveUser, "task.edit") : false;

  const viewMode = params.view === "calendar" ? "calendar" : "table";
  const scheduleFilter = params.schedule || "active";

  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Department / Category Access Scoping
  const allowedDepartmentIds = effectiveUser ? getAllowedDepartmentIds(effectiveUser) : null;
  const isCategoryRestricted = allowedDepartmentIds !== null;

  // Build where clause (exclude system chat team channels)
  const where: any = {
    taskCode: { not: { contains: "-GENERAL" } },
  };

  if (searchQuery) {
    where.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { taskCode: { contains: searchQuery, mode: "insensitive" } },
      { description: { contains: searchQuery, mode: "insensitive" } },
      { assignees: { some: { user: { name: { contains: searchQuery, mode: "insensitive" } } } } },
      { assignees: { some: { user: { username: { contains: searchQuery, mode: "insensitive" } } } } },
      { assignor: { name: { contains: searchQuery, mode: "insensitive" } } },
    ];
  }

  if (statusFilter === "ACTIVE") {
    // Active tasks include ASSIGNED, VIEWED, IN_PROGRESS, CHANGES_REQUESTED, UNDER_REVIEW (exclude completed/approved)
    where.status = { not: "APPROVED" };
  } else if (statusFilter) {
    where.status = statusFilter;
  }

  if (priorityFilter) {
    where.priority = priorityFilter;
  }

  // Date & Date Range Filter
  if (fromDate || toDate) {
    where.createdAt = {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)) } : {}),
    };
  } else if (datePreset) {
    if (datePreset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      where.createdAt = { gte: start };
    } else if (datePreset === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      where.createdAt = { gte: start, lt: end };
    } else if (datePreset === "7days") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: sevenDaysAgo };
    } else if (datePreset === "30days") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: thirtyDaysAgo };
    }
  }

  // Scoping based on role and assignment
  if (isEmployee || isMyTasks) {
    where.assignees = {
      some: { userId: user.id },
    };
    if (categoryFilter && !isEmployee) {
      where.departmentId = categoryFilter;
    }
  } else if (isCategoryRestricted) {
    // Non-admin (e.g. Manager) is strictly scoped to their assigned category/departments
    if (categoryFilter && allowedDepartmentIds.includes(categoryFilter)) {
      where.departmentId = categoryFilter;
    } else {
      where.departmentId = { in: allowedDepartmentIds.length > 0 ? allowedDepartmentIds : [-1] };
    }
  } else {
    // Super Admin / Admin
    if (categoryFilter) {
      where.departmentId = categoryFilter;
    }
  }

  // Employee Scheduled Tasks Filter & Counts
  let upcomingCount = 0;
  let activeCount = 0;

  if (isEmployee) {
    const [uCount, aCount] = await Promise.all([
      db.task.count({
        where: {
          taskCode: { not: { contains: "-GENERAL" } },
          assignees: { some: { userId: user.id } },
          startDate: { gt: endOfToday },
        },
      }),
      db.task.count({
        where: {
          taskCode: { not: { contains: "-GENERAL" } },
          assignees: { some: { userId: user.id } },
          status: { not: "APPROVED" },
          OR: [
            { startDate: null },
            { startDate: { lte: endOfToday } },
          ],
        },
      }),
    ]);
    upcomingCount = uCount;
    activeCount = aCount;

    if (scheduleFilter === "upcoming") {
      where.startDate = { gt: endOfToday };
    } else if (scheduleFilter === "active") {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { startDate: null },
            { startDate: { lte: endOfToday } },
          ],
        },
      ];
    }
  }

  // Load active categories and total count
  const [totalCount, allActiveCategories] = await Promise.all([
    db.task.count({ where }),
    db.department.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const availableCategories = isCategoryRestricted
    ? allActiveCategories.filter((c) => allowedDepartmentIds.includes(c.id))
    : allActiveCategories;

  // Load tasks based on View Mode
  const tasks = viewMode === "calendar"
    ? await db.task.findMany({
        where,
        take: 150,
        include: {
          department: true,
          assignor: { select: { id: true, name: true, designation: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, designation: true } },
            },
          },
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
        orderBy: { startDate: "asc" },
      })
    : await db.task.findMany({
        where,
        skip: Math.max(0, (page - 1) * PAGE_SIZE),
        take: PAGE_SIZE,
        include: {
          department: true,
          assignor: { select: { id: true, name: true, designation: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, designation: true } },
            },
          },
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
          approvals: {
            orderBy: { approvedAt: "desc" },
            take: 1,
            include: {
              approver: { select: { id: true, name: true, designation: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

  const subtitle = isEmployee
    ? `${totalCount} task(s) in this view · Tasks scheduled for future dates unlock on their assigned date`
    : isMyTasks
    ? `${totalCount} task(s) assigned to you`
    : isCategoryRestricted
    ? `${totalCount} task(s) found for department: ${availableCategories.map((c) => c.name).join(", ") || "None assigned"}`
    : `${totalCount} total tasks found · Source of truth for AceOne company operations`;

  // Build serializable URL template for pagination
  const paginationUrlTemplate = (() => {
    const sp = new URLSearchParams({
      ...(searchQuery ? { q: searchQuery } : {}),
      ...(categoryFilter && !isEmployee ? { category: categoryFilter.toString() } : {}),
      ...(selectedStatusKey ? { status: selectedStatusKey } : {}),
      ...(priorityFilter ? { priority: priorityFilter } : {}),
      ...(datePreset ? { datePreset } : {}),
      ...(fromDate ? { from: fromDate } : {}),
      ...(toDate ? { to: toDate } : {}),
      ...(isMyTasks && !isEmployee ? { filter: "my" } : {}),
      ...(viewMode ? { view: viewMode } : {}),
      ...(isEmployee && scheduleFilter ? { schedule: scheduleFilter } : {}),
    });
    const qs = sp.toString();
    return qs ? `/tasks?${qs}&page={page}` : `/tasks?page={page}`;
  })();

  // Current query params for toggling views & filters
  const baseParams = {
    ...(searchQuery ? { q: searchQuery } : {}),
    ...(categoryFilter && !isEmployee ? { category: categoryFilter.toString() } : {}),
    ...(selectedStatusKey ? { status: selectedStatusKey } : {}),
    ...(priorityFilter ? { priority: priorityFilter } : {}),
    ...(datePreset ? { datePreset } : {}),
    ...(fromDate ? { from: fromDate } : {}),
    ...(toDate ? { to: toDate } : {}),
    ...(isMyTasks && !isEmployee ? { filter: "my" } : {}),
    ...(isEmployee && scheduleFilter ? { schedule: scheduleFilter } : {}),
  };

  return (
    <AppShell user={user}>
      <div className="space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              {isEmployee ? "My Assigned Tasks" : (isMyTasks ? "My Assigned Tasks" : "Task Workspace Directory")}
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Mode Toggle: List vs Calendar */}
            <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg border border-neutral-200">
              <Link
                href={`/tasks?${new URLSearchParams({ ...baseParams, view: "table" }).toString()}`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  viewMode === "table"
                    ? "bg-white text-neutral-900 shadow-2xs"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>List</span>
              </Link>
              <Link
                href={`/tasks?${new URLSearchParams({ ...baseParams, view: "calendar" }).toString()}`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  viewMode === "calendar"
                    ? "bg-white text-neutral-900 shadow-2xs"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
                <span>Calendar</span>
              </Link>
            </div>

            {/* Create Task Actions */}
            {canCreateTask && (
              <div className="flex items-center gap-2">
                <Link
                  href="/tasks/new?tab=monthly"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold hover:bg-indigo-100 transition-colors shadow-2xs shrink-0"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Schedule Monthly</span>
                </Link>

                <Link
                  href="/tasks/new"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Task</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Employee Unlocked vs Upcoming Scheduled Tabs */}
        {isEmployee && (
          <div className="flex items-center gap-2 p-1 bg-neutral-100 rounded-lg w-fit border border-neutral-200 text-xs font-semibold">
            <Link
              href={`/tasks?${new URLSearchParams({ ...baseParams, schedule: "active" }).toString()}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                scheduleFilter === "active"
                  ? "bg-white text-neutral-900 shadow-2xs font-bold"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Active Tasks ({activeCount})</span>
            </Link>

            <Link
              href={`/tasks?${new URLSearchParams({ ...baseParams, schedule: "upcoming" }).toString()}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                scheduleFilter === "upcoming"
                  ? "bg-white text-neutral-900 shadow-2xs font-bold"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Upcoming Scheduled ({upcomingCount})</span>
            </Link>

            <Link
              href={`/tasks?${new URLSearchParams({ ...baseParams, schedule: "all" }).toString()}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                scheduleFilter === "all"
                  ? "bg-white text-neutral-900 shadow-2xs font-bold"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <span>All Tasks ({activeCount + upcomingCount})</span>
            </Link>
          </div>
        )}

        {/* Quick Status Filter Tabs with Active Tasks as Default */}
        <div className="flex items-center gap-2 text-xs overflow-x-auto no-scrollbar pb-1">
          {[
            { label: "Active Tasks", value: "ACTIVE" },
            { label: "Assigned", value: "ASSIGNED" },
            { label: "Viewed", value: "VIEWED" },
            { label: "In Progress", value: "IN_PROGRESS" },
            { label: "Needs Revision", value: "CHANGES_REQUESTED" },
            { label: "Under Review", value: "UNDER_REVIEW" },
            { label: "Approved / Completed", value: "APPROVED" },
            { label: "All Statuses", value: "ALL" },
          ].map((tab) => {
            const active = selectedStatusKey === tab.value;
            const href = `/tasks?${new URLSearchParams({
              ...baseParams,
              status: tab.value,
            }).toString()}`;

            return (
              <Link
                key={tab.label}
                href={href}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap border shrink-0 ${
                  active
                    ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                    : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Filters Bar with Live Auto-Search & Instant Filtering */}
        <TasksFilterBar
          availableCategories={availableCategories}
          isEmployee={isEmployee}
          isCategoryRestricted={isCategoryRestricted}
          initialSearch={searchQuery}
          initialCategory={categoryFilter?.toString() || ""}
          initialStatus={selectedStatusKey}
          initialDatePreset={datePreset || ""}
          initialFrom={fromDate || ""}
          initialTo={toDate || ""}
        />

        {/* Calendar View vs Table View */}
        {viewMode === "calendar" ? (
          <TasksCalendarView
            tasks={tasks as any}
            canCreateTask={canCreateTask}
            isEmployee={isEmployee}
          />
        ) : (
          /* Tasks Table View with Bulk Selection & Priority Updating */
          <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
            {tasks.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <CheckSquare className="w-10 h-10 text-neutral-300 mx-auto" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">No tasks found</h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                    {searchQuery || categoryFilter || statusFilter
                      ? "Try adjusting your search query or filters to find what you're looking for."
                      : isEmployee && scheduleFilter === "upcoming"
                      ? "You don't have any future scheduled tasks waiting to unlock."
                      : isEmployee
                      ? "You do not have any active tasks right now."
                      : "Create your first task or schedule a monthly batch to start organizing assignments."}
                  </p>
                </div>
                {canCreateTask && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Link
                      href="/tasks/new?tab=monthly"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold hover:bg-indigo-100 transition-colors shadow-2xs"
                    >
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Schedule Monthly</span>
                    </Link>
                    <Link
                      href="/tasks/new"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Create Task
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <TasksTableWithBulkActions
                tasks={tasks as any}
                canManageTasks={canCreateTask}
                canDeleteTasks={canDeleteTasks}
                canEditTasks={canEditTasks}
                isEmployee={isEmployee}
              />
            )}

            {/* Table Pagination Footer */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={PAGE_SIZE}
              urlTemplate={paginationUrlTemplate}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
