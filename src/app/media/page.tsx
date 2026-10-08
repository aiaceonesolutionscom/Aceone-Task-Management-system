import { requireUser } from "@/lib/auth";
import { getEffectiveUser, getAllowedDepartmentIds } from "@/lib/scopes";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { MediaGalleryView } from "@/components/media/media-gallery-view";
import { redirect } from "next/navigation";

export default async function MediaPage() {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) redirect("/login");

  const isEmployee = user.role.code === "employee";
  const isSuperAdmin = Boolean(
    effectiveUser.role.isSystem ||
    effectiveUser.role.code === "super_admin" ||
    effectiveUser.role.code === "admin"
  );

  const allowedDeptIds = isSuperAdmin ? null : getAllowedDepartmentIds(effectiveUser);

  // Build task query where clause based on user role and scopes
  const taskWhere: any = {
    taskCode: { not: { contains: "-GENERAL" } },
    OR: [
      { attachments: { some: {} } },
      { versions: { some: { attachments: { some: {} } } } },
    ],
  };

  if (isEmployee) {
    // Employees ONLY see media from tasks assigned to them
    taskWhere.assignees = {
      some: { userId: user.id },
    };
  } else if (allowedDeptIds !== null) {
    // Managers ONLY see media for tasks within their assigned department(s)
    taskWhere.departmentId = { in: allowedDeptIds.length > 0 ? allowedDeptIds : [-1] };
  }

  // Fetch tasks with media attachments and versions
  const tasks = await db.task.findMany({
    where: taskWhere,
    include: {
      department: true,
      assignor: { select: { id: true, name: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true, designation: true } },
        },
      },
      attachments: {
        where: {
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
        },
        orderBy: { createdAt: "desc" },
      },
      approvals: {
        orderBy: { approvedAt: "desc" },
        take: 1,
        include: {
          approver: { select: { id: true, name: true, designation: true } },
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          submitter: { select: { id: true, name: true } },
          attachments: {
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              fileSize: true,
              isReference: true,
              createdAt: true,
            },
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

  // Format data for component
  const formattedTasks = tasks.map((t) => ({
    id: t.id,
    taskCode: t.taskCode,
    title: t.title,
    description: t.description,
    instructions: t.instructions,
    requirements: t.requirements,
    status: t.status,
    priority: t.priority,
    department: { id: t.department.id, name: t.department.name },
    assignor: t.assignor ? { id: t.assignor.id, name: t.assignor.name } : null,
    approvedBy: t.approvals?.[0]?.approver
      ? {
          name: t.approvals[0].approver.name,
          designation: t.approvals[0].approver.designation,
          approvedAt: t.approvals[0].approvedAt.toISOString(),
        }
      : null,
    assignees: t.assignees.map((a) => ({
      id: a.user.id,
      name: a.user.name,
      designation: a.user.designation,
    })),
    createdAt: t.createdAt.toISOString(),
    deadline: t.deadline ? t.deadline.toISOString() : null,
    attachments: t.attachments.map((att) => ({
      id: att.id,
      fileName: att.fileName,
      mimeType: att.mimeType,
      fileSize: att.fileSize,
      isReference: att.isReference,
      createdAt: att.createdAt.toISOString(),
    })),
    versions: t.versions.map((v) => ({
      versionNumber: v.versionNumber,
      submitterName: v.submitter.name,
      submittedAt: v.submittedAt.toISOString(),
      status: v.status,
      comment: v.comment,
      reviewNotes: v.reviewNotes,
      attachments: v.attachments.map((att) => ({
        id: att.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
        isReference: att.isReference,
        createdAt: att.createdAt.toISOString(),
      })),
    })),
  }));

  const departmentScopeName = allowedDeptIds !== null
    ? availableCategories.map((c) => c.name).join(", ")
    : "All Categories";

  return (
    <AppShell user={user}>
      <MediaGalleryView
        tasks={formattedTasks}
        categories={availableCategories}
        currentRole={user.role.code}
        departmentScopeName={departmentScopeName}
      />
    </AppShell>
  );
}
