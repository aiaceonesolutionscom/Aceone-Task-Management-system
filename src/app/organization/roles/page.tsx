import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { RoleCreateModal } from "@/components/organization/role-create-modal";
import { RoleEditModal } from "@/components/organization/role-edit-modal";
import { Shield, KeyRound, Check, ArrowLeft, Users } from "lucide-react";

export default async function RolesPage() {
  const user = await requireUser();

  let [roles, permissions] = await Promise.all([
    db.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { id: "asc" },
    }),
    db.permission.findMany({
      orderBy: [{ group: "asc" }, { label: "asc" }],
    }),
  ]);

  if (!permissions.some((p) => p.key === "user.view_passwords")) {
    await db.permission.upsert({
      where: { key: "user.view_passwords" },
      update: { label: "View & recover user passwords (Credentials Vault)", group: "Users" },
      create: { key: "user.view_passwords", label: "View & recover user passwords (Credentials Vault)", group: "Users" },
    });
    permissions = await db.permission.findMany({
      orderBy: [{ group: "asc" }, { label: "asc" }],
    });
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Header Bar */}
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
              Role & Permission Builder
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Create and manage configurable role capabilities. Roles dynamically determine access when assigned to team members.
            </p>
          </div>

          <RoleCreateModal permissions={permissions} />
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role) => {
            const rolePerms = role.permissions.map((p) => p.permission);

            return (
              <div
                key={role.id}
                className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-neutral-900">{role.name}</h2>
                          {role.isSystem && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-900 uppercase">
                              System
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-neutral-400 uppercase">
                          {role.code}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-2.5 py-0.5 rounded flex items-center gap-1">
                        <Users className="w-3 h-3 text-neutral-400" />
                        {role._count.users} {role._count.users === 1 ? "User" : "Users"}
                      </span>
                    </div>
                  </div>

                  {role.description && (
                    <p className="text-xs text-neutral-600 leading-relaxed">{role.description}</p>
                  )}

                  {/* Granted Permissions List */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide block">
                      Granted Permissions{" "}
                      {role.isSystem
                        ? "(All Permissions Implicitly Granted)"
                        : `(${role.permissions.length})`}
                    </span>

                    <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1 border border-neutral-100 rounded-md bg-neutral-50/50">
                      {role.isSystem ? (
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded">
                          Full Enterprise System Access (*)
                        </span>
                      ) : role.permissions.length === 0 ? (
                        <span className="text-neutral-400 italic text-[11px] p-1">
                          No specific permissions assigned yet.
                        </span>
                      ) : (
                        rolePerms.map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-neutral-200 text-neutral-700 text-[10px] font-medium rounded shadow-2xs"
                          >
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{p.label}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Card Footer Actions */}
                {!role.isSystem && (
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-end">
                    <RoleEditModal role={role} permissions={permissions} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
