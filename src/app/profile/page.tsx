import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { User, Mail, Phone, Shield, FolderTree, Hash, Calendar, CheckCircle2 } from "lucide-react";

export default async function ProfilePage() {
  const user = await requireUser();

  const profile: any = await db.user.findUnique({
    where: { id: user.id },
    include: {
      role: true,
      primaryDepartment: true,
      assignmentScopes: { include: { department: true } },
      approvalScopes: { include: { department: true } },
      _count: { select: { taskAssignments: true, taskVersions: true, comments: true } },
    },
  });

  if (!profile) return null;
  delete profile.passwordHash;

  return (
    <AppShell user={user}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">User Profile & Account</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Your personal credentials, organizational assignments, and permission scopes.
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-2xs space-y-6">
          <div className="flex items-start gap-4 pb-4 border-b border-neutral-100">
            <div className="w-16 h-16 rounded-full bg-neutral-900 text-white font-bold text-2xl flex items-center justify-center shrink-0">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-neutral-900">{profile.name}</h2>
              <p className="text-xs text-neutral-500 font-medium">
                {profile.designation || profile.role.name}
                {profile.primaryDepartment ? ` · ${profile.primaryDepartment.name}` : ""}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-neutral-100 rounded text-neutral-700">
                  {profile.employeeId || "NO-ID"}
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {profile.status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1 p-3 bg-neutral-50 rounded border border-neutral-100">
              <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email Address
              </span>
              <p className="font-semibold text-neutral-800">{profile.email}</p>
            </div>

            <div className="space-y-1 p-3 bg-neutral-50 rounded border border-neutral-100">
              <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1">
                <Hash className="w-3 h-3" /> Username / Login ID
              </span>
              <p className="font-semibold text-neutral-800 font-mono">{profile.username || "—"}</p>
            </div>

            <div className="space-y-1 p-3 bg-neutral-50 rounded border border-neutral-100">
              <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1">
                <Shield className="w-3 h-3" /> Role & Authority
              </span>
              <p className="font-semibold text-neutral-800">
                {profile.role.name} {profile.role.isSystem ? "(Super Admin / Full Access)" : ""}
              </p>
            </div>

            <div className="space-y-1 p-3 bg-neutral-50 rounded border border-neutral-100">
              <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1">
                <FolderTree className="w-3 h-3" /> Primary Department
              </span>
              <p className="font-semibold text-neutral-800">
                {profile.primaryDepartment?.name || "Global / Executive"}
              </p>
            </div>
          </div>

          {/* Scopes Summary */}
          <div className="space-y-2 pt-2 border-t border-neutral-100">
            <h3 className="text-xs font-bold text-neutral-900">Configured Operational Scopes</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white border border-neutral-200 rounded">
                <span className="text-[10px] font-bold text-blue-600 uppercase block mb-1">
                  Assignment Scope
                </span>
                <p className="text-neutral-700">
                  {profile.role.isSystem
                    ? "Full Access (All Categories)"
                    : profile.assignmentScopes.length > 0
                    ? profile.assignmentScopes.map((s: any) => s.department.name).join(", ")
                    : "Primary Department Only"}
                </p>
              </div>

              <div className="p-3 bg-white border border-neutral-200 rounded">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">
                  Approval Scope
                </span>
                <p className="text-neutral-700">
                  {profile.role.isSystem
                    ? "Full Access (All Categories)"
                    : profile.approvalScopes.length > 0
                    ? profile.approvalScopes.map((s: any) => s.department.name).join(", ")
                    : "Primary Department Only"}
                </p>
              </div>
            </div>
          </div>

          {/* Work Activity Stats */}
          <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
            <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
              <span className="text-lg font-bold text-neutral-900 block">{profile._count.taskAssignments}</span>
              <span className="text-[10px] text-neutral-500 font-medium">Assigned Tasks</span>
            </div>
            <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
              <span className="text-lg font-bold text-neutral-900 block">{profile._count.taskVersions}</span>
              <span className="text-[10px] text-neutral-500 font-medium">Work Submissions</span>
            </div>
            <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
              <span className="text-lg font-bold text-neutral-900 block">{profile._count.comments}</span>
              <span className="text-[10px] text-neutral-500 font-medium">Discussion Comments</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
