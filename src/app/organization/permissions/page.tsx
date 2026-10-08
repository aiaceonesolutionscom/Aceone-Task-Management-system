import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { PERMISSIONS } from "@/lib/permissions";
import { KeyRound, CheckCircle2, ArrowLeft } from "lucide-react";

export default async function PermissionsRegistryPage() {
  const user = await requireUser();

  // Group permissions by module
  const groups: Record<string, typeof PERMISSIONS[number][]> = {};
  for (const p of PERMISSIONS) {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p);
  }

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
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Permissions Registry</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            System capability definitions and granular access control tokens.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(groups).map(([groupName, items]) => (
            <div key={groupName} className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-neutral-900">{groupName} Module</h2>
                <span className="text-[10px] text-neutral-400 font-mono">({items.length} permissions)</span>
              </div>

              <div className="divide-y divide-neutral-100">
                {items.map((perm) => (
                  <div key={perm.key} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-neutral-900">{perm.label}</p>
                      <span className="font-mono text-[10px] text-neutral-400">{perm.key}</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
