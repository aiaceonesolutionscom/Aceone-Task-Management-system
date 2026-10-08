import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission } from "@/lib/scopes";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { TaskCreateTabs } from "@/components/tasks/task-create-tabs";
import { redirect } from "next/navigation";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const requestedTab = sp.tab === "monthly" ? "monthly" : sp.tab === "batch" ? "batch" : "single";

  // Only users with task.create permission can access
  const canCreate = hasEffectivePermission(effectiveUser, "task.create");

  if (!canCreate) {
    redirect("/tasks");
  }

  const isSuperAdmin = Boolean(
    user.role.isSystem || user.role.code === "super_admin" || user.role.code === "admin"
  );

  const allowedDeptIds = isSuperAdmin
    ? null
    : Array.from(
        new Set([
          ...(effectiveUser.primaryDepartmentId ? [effectiveUser.primaryDepartmentId] : []),
          ...(effectiveUser.assignmentScopeIds || []),
          ...(effectiveUser.categoryScopeIds || []),
        ])
      );

  // Load active categories (scoped to manager's departments if non-admin)
  const categories = await db.department.findMany({
    where: {
      status: "ACTIVE",
      ...(allowedDeptIds !== null ? { id: { in: allowedDeptIds.length > 0 ? allowedDeptIds : [-1] } } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      customFields: {
        where: { entityType: "TASK" },
        orderBy: { order: "asc" },
      },
    },
  });

  // Load team members
  const teamMembers = await db.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      designation: true,
      primaryDepartmentId: true,
      primaryDepartment: { select: { id: true, name: true, code: true } },
      memberships: {
        select: {
          departmentId: true,
          department: { select: { id: true, name: true, code: true } },
        },
      },
      role: { select: { code: true, name: true } },
    },
  });

  // Global task custom fields
  const globalCustomFields = await db.customField.findMany({
    where: { departmentId: null, entityType: "TASK" },
    orderBy: { order: "asc" },
  });

  return (
    <AppShell user={user}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Tasks</span>
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">Task Creation & Assignment</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Create individual tasks, bulk-distribute tasks, or schedule an entire month&apos;s assignments across calendar dates.
            </p>
          </div>
        </div>

        <TaskCreateTabs
          categories={categories}
          teamMembers={teamMembers}
          globalCustomFields={globalCustomFields}
          creatorName={user.name}
          creatorRole={user.role.name}
          initialTab={requestedTab}
        />
      </div>
    </AppShell>
  );
}
