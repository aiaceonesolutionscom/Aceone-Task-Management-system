import { requireUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission, getAllowedDepartmentIds } from "@/lib/scopes";
import { getStorageMetrics } from "@/lib/storage";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { FilesDirectoryTable, StoredTaskGroup } from "@/components/files/files-directory-table";
import { FileText, ShieldCheck, Database, Archive } from "lucide-react";
import { redirect } from "next/navigation";

export default async function FilesStoragePage() {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) redirect("/login");

  const metrics = await getStorageMetrics();

  const isEmployee = user.role.code === "employee";
  const isSuperAdmin = Boolean(
    effectiveUser.role.isSystem ||
    effectiveUser.role.code === "super_admin" ||
    effectiveUser.role.code === "admin"
  );
  const canDelete = hasEffectivePermission(effectiveUser, "file.delete") || isSuperAdmin;
  const allowedDeptIds = isSuperAdmin ? null : getAllowedDepartmentIds(effectiveUser);

  // Build task query where clause based on user role and department scopes
  const taskWhere: any = {
    taskCode: { not: { contains: "-GENERAL" } },
    OR: [
      { attachments: { some: { deletedAt: null } } },
      { versions: { some: { attachments: { some: { deletedAt: null } } } } },
    ],
  };

  if (isEmployee) {
    taskWhere.assignees = {
      some: { userId: user.id },
    };
  } else if (allowedDeptIds !== null) {
    taskWhere.departmentId = { in: allowedDeptIds.length > 0 ? allowedDeptIds : [-1] };
  }

  // Fetch tasks with attachments & deliverable version attachments
  const tasksWithFiles = await db.task.findMany({
    where: taskWhere,
    include: {
      department: { select: { id: true, name: true } },
      assignor: { select: { id: true, name: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true, designation: true } },
        },
      },
      attachments: {
        where: {
          deletedAt: null,
          isReference: true,
          versionId: null,
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          isReference: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      versions: {
        where: {
          attachments: { some: { deletedAt: null } },
        },
        orderBy: { versionNumber: "desc" },
        include: {
          submitter: { select: { id: true, name: true } },
          attachments: {
            where: { deletedAt: null },
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              fileSize: true,
              isReference: true,
              createdAt: true,
              uploadedBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Load available categories
  const allActiveCategories = await db.department.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const availableCategories = allowedDeptIds !== null
    ? allActiveCategories.filter((c) => allowedDeptIds.includes(c.id))
    : allActiveCategories;

  // Format data for FilesDirectoryTable
  const formattedTasks: StoredTaskGroup[] = tasksWithFiles.map((t) => {
    const totalRefSize = t.attachments.reduce((acc, f) => acc + f.fileSize, 0);
    const totalVerSize = t.versions.reduce(
      (acc, v) => acc + v.attachments.reduce((sub, f) => sub + f.fileSize, 0),
      0
    );
    const totalFiles =
      t.attachments.length +
      t.versions.reduce((acc, v) => acc + v.attachments.length, 0);

    return {
      id: t.id,
      taskCode: t.taskCode,
      title: t.title,
      status: t.status,
      department: { id: t.department.id, name: t.department.name },
      assignor: t.assignor ? { id: t.assignor.id, name: t.assignor.name } : null,
      assignees: t.assignees.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        designation: a.user.designation,
      })),
      createdAt: t.createdAt.toISOString(),
      referenceFiles: t.attachments.map((att) => ({
        id: att.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
        isReference: att.isReference,
        createdAt: att.createdAt.toISOString(),
        uploadedBy: att.uploadedBy ? { id: att.uploadedBy.id, name: att.uploadedBy.name } : null,
      })),
      versions: t.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        submitterName: v.submitter.name,
        submittedAt: v.submittedAt.toISOString(),
        status: v.status,
        comment: v.comment,
        attachments: v.attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          mimeType: att.mimeType,
          fileSize: att.fileSize,
          isReference: att.isReference,
          createdAt: att.createdAt.toISOString(),
          uploadedBy: att.uploadedBy ? { id: att.uploadedBy.id, name: att.uploadedBy.name } : null,
        })),
      })),
      totalFiles,
      totalBytes: totalRefSize + totalVerSize,
    };
  });

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            Files & Binary Storage
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Internal task deliverables, reference materials, and submissions stored directly in PostgreSQL (BYTEA).
          </p>
        </div>

        {/* Storage Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Binary Storage</span>
              <Database className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{metrics.totalMegabytes} MB</p>
            <p className="text-[11px] text-neutral-400">
              {metrics.totalBytes.toLocaleString()} bytes consumed in database
            </p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Stored Files Count</span>
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{metrics.totalFiles}</p>
            <p className="text-[11px] text-neutral-400">Original deliverables and references</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-1">
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

        {/* Stored Files Task-Grouped Accordions */}
        <FilesDirectoryTable
          tasks={formattedTasks}
          categories={availableCategories}
          currentUserId={user.id}
          canDelete={canDelete}
          isSuperAdmin={isSuperAdmin}
        />
      </div>
    </AppShell>
  );
}
