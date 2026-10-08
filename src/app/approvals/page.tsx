import { requireUser } from "@/lib/auth";
import { getEffectiveUser } from "@/lib/scopes";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { formatDateTime12 } from "@/lib/date-utils";
import Link from "next/link";
import {
  ClipboardCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export default async function ApprovalsPage() {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);

  const isSystemAdmin = Boolean(
    effectiveUser?.role.isSystem ||
    effectiveUser?.role.code === "admin" ||
    effectiveUser?.role.code === "super_admin"
  );

  const allowedApprovalDepts = isSystemAdmin
    ? null
    : Array.from(
        new Set([
          ...(effectiveUser?.primaryDepartmentId ? [effectiveUser.primaryDepartmentId] : []),
          ...(effectiveUser?.approvalScopeIds || []),
        ])
      );

  const categoryFilter =
    allowedApprovalDepts !== null
      ? { in: allowedApprovalDepts.length > 0 ? allowedApprovalDepts : [-1] }
      : undefined;

  const [pendingApprovals, changesRequested, recentApprovals] = await Promise.all([
    db.task.findMany({
      where: {
        status: "UNDER_REVIEW",
        ...(categoryFilter ? { departmentId: categoryFilter } : {}),
      },
      include: {
        department: true,
        assignees: { include: { user: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { submitter: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.task.findMany({
      where: {
        status: "CHANGES_REQUESTED",
        ...(categoryFilter ? { departmentId: categoryFilter } : {}),
      },
      include: {
        department: true,
        assignees: { include: { user: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { submitter: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.approvalRecord.findMany({
      take: 10,
      orderBy: { approvedAt: "desc" },
      include: {
        approver: true,
        task: { include: { department: true } },
        submission: true,
      },
    }),
  ]);

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Approvals & Review Center</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Review submissions, evaluate revisions, and execute workflow decisions.
          </p>
        </div>

        {/* 1. Pending Approvals Queue */}
        <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-neutral-900">Awaiting Decision ({pendingApprovals.length})</h2>
            </div>
            <span className="text-[11px] text-neutral-400">High priority review queue</span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              No submissions currently awaiting approval in your scope.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {pendingApprovals.map((task) => {
                const ver = task.versions[0];
                return (
                  <div
                    key={task.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/70 transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-neutral-900">
                          {task.taskCode || `#${task.id}`}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-neutral-100 rounded text-neutral-700">
                          {task.department.name}
                        </span>
                        {ver && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                            Version {ver.versionNumber}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-neutral-900 truncate">{task.title}</h3>
                      <p className="text-[11px] text-neutral-500">
                        Submitted by: {ver?.submitter?.name || "Assignee"} ·{" "}
                        {ver ? formatDateTime12(ver.submittedAt) : ""}
                      </p>
                    </div>

                    <Link
                      href={`/tasks/${task.id}`}
                      className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-semibold shrink-0 flex items-center gap-1 self-start sm:self-auto"
                    >
                      Review Workspace <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Changes Requested Queue */}
        <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h2 className="text-sm font-bold text-neutral-900">Changes Requested ({changesRequested.length})</h2>
            </div>
            <span className="text-[11px] text-neutral-400">Revisions assigned back to employees</span>
          </div>

          {changesRequested.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              No tasks currently in changes requested status.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {changesRequested.map((task) => (
                <div
                  key={task.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-neutral-50/70"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-neutral-900">
                        {task.taskCode || `#${task.id}`}
                      </span>
                      <span className="text-[10px] text-neutral-500">{task.department.name}</span>
                    </div>
                    <h3 className="text-xs font-semibold text-neutral-900 truncate">{task.title}</h3>
                    <p className="text-[11px] text-neutral-400">
                      Assignees working on revisions: {task.assignees.map((a) => a.user.name).join(", ")}
                    </p>
                  </div>

                  <Link
                    href={`/tasks/${task.id}`}
                    className="text-xs font-semibold text-blue-600 hover:underline shrink-0"
                  >
                    View Task
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Recent Approval Log */}
        <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-neutral-900">Recent Approval Decisions</h2>
            </div>
          </div>

          {recentApprovals.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">No approval history yet.</div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentApprovals.map((rec) => (
                <div key={rec.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-neutral-900">{rec.approver.name}</span>{" "}
                    <span className="text-neutral-500">
                      {rec.status === "APPROVED" ? "approved" : "requested changes on"}
                    </span>{" "}
                    <Link href={`/tasks/${rec.taskId}`} className="font-bold text-blue-600 hover:underline">
                      {rec.task.taskCode || `#${rec.taskId}`} - {rec.task.title}
                    </Link>
                    {rec.comment && (
                      <p className="text-[11px] text-neutral-600 italic mt-0.5">"{rec.comment}"</p>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                    {new Date(rec.approvedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
