import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission, getAllowedDepartmentIds } from "@/lib/scopes";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isPrivileged = Boolean(
    effectiveUser.role.isSystem ||
    effectiveUser.role.code === "super_admin" ||
    effectiveUser.role.code === "admin"
  );

  const canExport =
    isPrivileged ||
    hasEffectivePermission(effectiveUser, "report.export") ||
    hasEffectivePermission(effectiveUser, "report.view");

  if (!canExport) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to export task reports." },
      { status: 403 }
    );
  }

  const allowedDeptIds = isPrivileged ? null : getAllowedDepartmentIds(effectiveUser);

  const tasks = await db.task.findMany({
    where: allowedDeptIds !== null ? { departmentId: { in: allowedDeptIds } } : {},
    include: {
      department: true,
      assignor: true,
      assignees: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Task ID",
    "Title",
    "Category",
    "Priority",
    "Status",
    "Assigned By",
    "Assigned To",
    "Deadline",
    "Created At",
  ];

  const rows = tasks.map((t) => [
    `"${t.taskCode || t.id}"`,
    `"${t.title.replace(/"/g, '""')}"`,
    `"${t.department.name}"`,
    `"${t.priority}"`,
    `"${t.status}"`,
    `"${t.assignor?.name || "CEO"}"`,
    `"${t.assignees.map((a) => a.user.name).join(", ")}"`,
    `"${t.deadline ? new Date(t.deadline).toLocaleDateString() : ""}"`,
    `"${new Date(t.createdAt).toLocaleDateString()}"`,
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="aceone-tasks-export.csv"',
    },
  });
}
