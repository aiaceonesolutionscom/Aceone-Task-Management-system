import { requireUser } from "@/lib/auth";
import { getEffectiveUser } from "@/lib/scopes";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { formatDateTime12 } from "@/lib/date-utils";
import { History, Search, Filter } from "lucide-react";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string }>;
}) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  const isSystemAdmin = user.role.code === "super_admin" || user.role.code === "system_admin";
  const allowedDeptIds = isSystemAdmin
    ? null
    : Array.from(
        new Set([
          ...(effectiveUser?.primaryDepartmentId ? [effectiveUser.primaryDepartmentId] : []),
          ...(effectiveUser?.categoryScopeIds || []),
        ])
      );

  const params = await searchParams;

  const where: any = {};
  if (params.action) where.action = { contains: params.action, mode: "insensitive" };
  if (params.entity) where.entityType = params.entity;

  // Scope to manager's departments if not system admin
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

    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { entityType: "TASK", entityId: { in: scopedTaskIds } },
          { actorId: { in: scopedUserIds } },
        ],
      },
    ];
  }

  const logs = await db.auditLog.findMany({
    where,
    include: {
      actor: { select: { id: true, name: true, email: true, designation: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">System Audit Logs</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Immutable company audit trail tracking all actions, workflow state transitions, and compliance.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
          <form method="GET" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              name="action"
              defaultValue={params.action || ""}
              placeholder="Filter by action (e.g. task.create, user.create)..."
              className="px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded focus:bg-white focus:outline-none"
            />
            <select
              name="entity"
              defaultValue={params.entity || ""}
              className="px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded text-neutral-700"
            >
              <option value="">All Entities</option>
              <option value="ERROR">Errors & Crashes</option>
              <option value="TASK">Task</option>
              <option value="USER">User</option>
              <option value="CATEGORY">Category</option>
              <option value="REPORT">Report</option>
              <option value="FILE">File</option>
            </select>
            <button
              type="submit"
              className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-semibold"
            >
              Filter Logs
            </button>
          </form>
        </div>

        {/* Logs Table */}
        <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9fafb] text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-3">Details / Context</th>
                  <th className="py-2.5 px-4 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {logs.map((log) => {
                  const isError = log.entityType === "ERROR" || log.action.includes("error");
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-neutral-50/60 font-mono text-[11px] ${
                        isError ? "bg-red-50/30" : ""
                      }`}
                    >
                      <td className="py-2.5 px-4 text-neutral-500 whitespace-nowrap">
                        {formatDateTime12(log.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-neutral-900">
                        {log.actor?.name || (isError ? "System/Client" : "System")}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            isError
                              ? "bg-red-100 text-red-700 font-bold"
                              : "bg-neutral-100 text-neutral-800"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-neutral-600">
                        {log.entityType} {log.entityId ? `#${log.entityId}` : ""}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate font-sans text-neutral-500">
                        {log.metadata ? JSON.stringify(log.metadata) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right text-neutral-400">
                        {log.ipAddress || "127.0.0.1"}
                      </td>
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
