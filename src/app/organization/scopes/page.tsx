import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { UserScopeEditorModal } from "@/components/organization/user-scope-editor-modal";
import { Compass, Shield, Users, Check, ArrowLeft, Eye, Send, ClipboardCheck } from "lucide-react";

export default async function ScopesPage() {
  const user = await requireUser();

  const [users, categories] = await Promise.all([
    db.user.findMany({
      where: { status: "ACTIVE" },
      include: {
        role: true,
        primaryDepartment: true,
        categoryScopes: { include: { department: true } },
        assignmentScopes: { include: { department: true } },
        approvalScopes: { include: { department: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.department.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  users.forEach((u) => {
    delete (u as any).passwordHash;
  });

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
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Organizational Scope Builder</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Grant and manage category access boundaries: task visibility in directory, assignment permissions, and approval authority.
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">User Scopes Matrix & Access Control</h2>
              <p className="text-[11px] text-neutral-500">
                Managers only see tasks from their primary category and granted category scopes.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
              {users.length} active team members
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9fafb] text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
                <tr>
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Primary Category</th>
                  <th className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 text-blue-700">
                      <Eye className="w-3 h-3" />
                      Task Visibility
                    </span>
                  </th>
                  <th className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 text-purple-700">
                      <Send className="w-3 h-3" />
                      Assignment Scope
                    </span>
                  </th>
                  <th className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <ClipboardCheck className="w-3 h-3" />
                      Approval Scope
                    </span>
                  </th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-neutral-900">
                      {u.name}
                      <span className="text-[10px] text-neutral-400 font-normal block font-mono">
                        {u.employeeId || u.email}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-neutral-100 text-neutral-800">
                        {u.role.name}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-neutral-700 font-medium">
                      {u.primaryDepartment?.name || "Global / Unassigned"}
                    </td>

                    {/* Task Visibility Scope */}
                    <td className="py-3 px-3">
                      {u.role.isSystem ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold text-[10px]">
                          All Categories (Super Admin)
                        </span>
                      ) : u.categoryScopes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.primaryDepartment && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded font-semibold text-[10px]">
                              {u.primaryDepartment.name} (Primary)
                            </span>
                          )}
                          {u.categoryScopes.map((s) => (
                            <span
                              key={s.id}
                              className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded font-semibold text-[10px]"
                            >
                              +{s.department.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-600 font-medium text-[11px]">
                          {u.primaryDepartment?.name || "None"}
                        </span>
                      )}
                    </td>

                    {/* Assignment Scope */}
                    <td className="py-3 px-3">
                      {u.role.isSystem ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold text-[10px]">
                          All Categories
                        </span>
                      ) : u.assignmentScopes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.assignmentScopes.map((s) => (
                            <span
                              key={s.id}
                              className="px-1.5 py-0.5 bg-purple-50 text-purple-800 rounded font-semibold text-[10px]"
                            >
                              {s.department.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic text-[11px]">
                          Primary Only ({u.primaryDepartment?.name || "None"})
                        </span>
                      )}
                    </td>

                    {/* Approval Scope */}
                    <td className="py-3 px-3">
                      {u.role.isSystem ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold text-[10px]">
                          All Categories
                        </span>
                      ) : u.approvalScopes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.approvalScopes.map((s) => (
                            <span
                              key={s.id}
                              className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded font-semibold text-[10px]"
                            >
                              {s.department.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic text-[11px]">
                          Primary Only ({u.primaryDepartment?.name || "None"})
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <UserScopeEditorModal user={u} categories={categories} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
