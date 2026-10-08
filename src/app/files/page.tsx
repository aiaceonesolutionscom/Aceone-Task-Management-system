import { requireUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission } from "@/lib/scopes";
import { getStorageMetrics } from "@/lib/storage";
import { AppShell } from "@/components/layout/app-shell";
import { FilesDirectoryTable } from "@/components/files/files-directory-table";
import { HardDrive, FileText, Download, ShieldCheck, Database, Archive } from "lucide-react";

export default async function FilesStoragePage() {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  const metrics = await getStorageMetrics();

  const isSuperAdmin = Boolean(
    effectiveUser?.role.isSystem ||
    effectiveUser?.role.code === "super_admin" ||
    effectiveUser?.role.code === "admin"
  );
  const canUpload = hasEffectivePermission(effectiveUser, "file.upload") || isSuperAdmin;
  const canEdit =
    hasEffectivePermission(effectiveUser, "file.edit") ||
    hasEffectivePermission(effectiveUser, "file.upload") ||
    isSuperAdmin;
  const canDelete = hasEffectivePermission(effectiveUser, "file.delete") || isSuperAdmin;

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            Files & PostgreSQL Binary Storage
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Internal company deliverables and reference materials stored directly in PostgreSQL (BYTEA).
          </p>
        </div>

        {/* Storage Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Binary Storage</span>
              <Database className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{metrics.totalMegabytes} MB</p>
            <p className="text-[11px] text-neutral-400">
              {metrics.totalBytes.toLocaleString()} bytes consumed in database
            </p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Stored Files Count</span>
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{metrics.totalFiles}</p>
            <p className="text-[11px] text-neutral-400">Original deliverables and references</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Archived Files</span>
              <Archive className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{metrics.archivedFiles}</p>
            <p className="text-[11px] text-neutral-400">Preserved historical versions</p>
          </div>
        </div>

        {/* Security & Architecture Note */}
        <div className="bg-[#fbfcfd] border border-neutral-200 rounded-lg p-4 text-xs text-neutral-600 space-y-1">
          <p className="font-bold text-neutral-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> PostgreSQL Binary Storage Architecture
          </p>
          <p className="leading-relaxed">
            All company assets are stored as raw binary data (<code className="font-mono text-neutral-800">BYTEA</code>) inside PostgreSQL rather than unprotected filesystem directories. Every access request enforces authenticated session checks, role permission validation, and task category scopes to prevent unauthorized access.
          </p>
        </div>

        {/* Stored Files Interactive Table */}
        <FilesDirectoryTable
          files={metrics.largestFiles as any}
          currentUserId={user.id}
          canUpload={canUpload}
          canEdit={canEdit}
          canDelete={canDelete}
          isSuperAdmin={isSuperAdmin}
        />
      </div>
    </AppShell>
  );
}
