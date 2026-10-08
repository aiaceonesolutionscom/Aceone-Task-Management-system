import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { UserCreateModal } from "@/components/organization/user-create-modal";
import { UserTableManager } from "@/components/organization/user-table-manager";
import { getFullPasswordVault } from "@/lib/password-vault";
import { ArrowLeft } from "lucide-react";

export default async function UsersPage() {
  const user = await requireUser();

  const [users, categories, roles] = await Promise.all([
    db.user.findMany({
      include: {
        role: true,
        primaryDepartment: true,
        assignmentScopes: { include: { department: true } },
        approvalScopes: { include: { department: true } },
        permissionOverrides: true,
        _count: { select: { taskAssignments: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.department.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    db.role.findMany({ orderBy: { id: "asc" } }),
  ]);

  users.forEach((u) => {
    delete (u as any).passwordHash;
  });

  const canViewPasswords = Boolean(
    user.role.isSystem ||
    user.role.code === "super_admin" ||
    user.role.code === "admin" ||
    user.effectivePermissions?.includes("*") ||
    user.effectivePermissions?.includes("user.view_passwords")
  );

  const vault = canViewPasswords ? await getFullPasswordVault() : {};

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Users & Team Management
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Manage employees, roles, departments, task assignment scopes, and full account actions.
            </p>
          </div>

          <UserCreateModal categories={categories} roles={roles} />
        </div>

        {/* Interactive Users Table with full CRUD, auto search, and pagination */}
        <UserTableManager
          users={users}
          roles={roles}
          categories={categories}
          currentUserId={user.id}
          isSuperAdmin={canViewPasswords}
          vault={vault}
        />
      </div>
    </AppShell>
  );
}
