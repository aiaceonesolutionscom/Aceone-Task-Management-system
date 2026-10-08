import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission, getAllowedDepartmentIds } from "@/lib/scopes";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
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
    hasEffectivePermission(effectiveUser, "report.crm.view") ||
    hasEffectivePermission(effectiveUser, "report.view");

  if (!canExport) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to export task reports." },
      { status: 403 }
    );
  }

  const allowedDeptIds = isPrivileged ? null : getAllowedDepartmentIds(effectiveUser);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const priority = searchParams.get("priority")?.trim() || "";
  const departmentIdParam = searchParams.get("departmentId")?.trim() || "";
  const assigneeIdParam = searchParams.get("assigneeId")?.trim() || "";
  const overdueOnly = searchParams.get("overdue") === "true";

  const where: any = {
    taskCode: { not: { contains: "-GENERAL" } },
    ...(allowedDeptIds !== null
      ? { departmentId: { in: allowedDeptIds.length > 0 ? allowedDeptIds : [-1] } }
      : {}),
  };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { taskCode: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (departmentIdParam) {
    const dId = parseInt(departmentIdParam, 10);
    if (!isNaN(dId)) {
      if (allowedDeptIds !== null && !allowedDeptIds.includes(dId)) {
        return NextResponse.json({ error: "Forbidden category access" }, { status: 403 });
      }
      where.departmentId = dId;
    }
  }
  if (assigneeIdParam) {
    const aId = parseInt(assigneeIdParam, 10);
    if (!isNaN(aId)) {
      where.assignees = { some: { userId: aId } };
    }
  }
  if (overdueOnly) {
    where.deadline = { lt: new Date() };
    where.status = { notIn: ["APPROVED", "COMPLETED", "ARCHIVED", "CANCELLED"] };
  }

  const tasks = await db.task.findMany({
    where,
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
