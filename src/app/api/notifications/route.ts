import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dispatchDailyScheduledNotifications } from "@/lib/daily-task-scheduler";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Automatically check & dispatch any unlocked tasks for today (midnight start) and clean up future notifications
  await dispatchDailyScheduledNotifications(user.id);

  // Auto-record message deliveries for this user's active tasks while user is online
  try {
    await db.$executeRawUnsafe(
      `
      INSERT INTO "ChatMessageDelivery" ("commentId", "userId", "deliveredAt")
      SELECT c.id, $1::int, CURRENT_TIMESTAMP
      FROM "TaskComment" c
      JOIN "Task" t ON t.id = c."taskId"
      WHERE c."userId" != $1::int
        AND c."createdAt" >= NOW() - INTERVAL '3 days'
        AND (
          t."createdBy" = $1::int
          OR t."assignedBy" = $1::int
          OR EXISTS (SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."userId" = $1::int)
          OR EXISTS (SELECT 1 FROM "TaskReviewer" tr WHERE tr."taskId" = t.id AND tr."userId" = $1::int)
          OR EXISTS (SELECT 1 FROM "DepartmentMember" dm WHERE dm."departmentId" = t."departmentId" AND dm."userId" = $1::int)
        )
      ON CONFLICT ("commentId", "userId") DO NOTHING;
      `,
      user.id
    );
  } catch {
    // Non-fatal delivery sync
  }

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";

  const notifications = await db.notification.findMany({
    where: {
      userId: user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const unreadCount = await db.notification.count({
    where: { userId: user.id, isRead: false },
  });

  const isSuperAdmin = Boolean(
    user.role.isSystem ||
    user.role.code === "super_admin" ||
    user.role.code === "admin"
  );
  const isManager = user.role.code === "manager";
  const isEmployee = user.role.code === "employee";

  // Category scopes for managers
  const userApprovalScopes = isManager
    ? await db.userApprovalScope.findMany({ where: { userId: user.id }, select: { departmentId: true } })
    : [];
  const managerDeptIds = userApprovalScopes.map((s) => s.departmentId);
  if (user.primaryDepartmentId && !managerDeptIds.includes(user.primaryDepartmentId)) {
    managerDeptIds.push(user.primaryDepartmentId);
  }

  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const activeTaskWhere: any = {
    status: { in: ["NEW", "ASSIGNED", "VIEWED", "IN_PROGRESS", "CHANGES_REQUESTED", "UNDER_REVIEW"] },
    taskCode: { not: { contains: "-GENERAL" } },
    OR: [
      { startDate: null },
      { startDate: { lte: endOfToday } },
    ],
  };

  if (isEmployee) {
    activeTaskWhere.assignees = { some: { userId: user.id } };
  } else if (isManager && managerDeptIds.length > 0) {
    activeTaskWhere.departmentId = { in: managerDeptIds };
  }

  const activeTasksCount = await db.task.count({ where: activeTaskWhere });

  // Calculate pending approvals for managers and admins
  let pendingApprovalsCount = 0;
  if (isSuperAdmin) {
    pendingApprovalsCount = await db.task.count({
      where: {
        status: "UNDER_REVIEW",
        taskCode: { not: { contains: "-GENERAL" } },
      },
    });
  } else if (isManager && managerDeptIds.length > 0) {
    pendingApprovalsCount = await db.task.count({
      where: {
        status: "UNDER_REVIEW",
        departmentId: { in: managerDeptIds },
        taskCode: { not: { contains: "-GENERAL" } },
      },
    });
  }

  return NextResponse.json({
    notifications,
    unreadCount,
    activeTasksCount,
    pendingApprovalsCount,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Notification id required" }, { status: 400 });

    await db.notification.updateMany({
      where: { id: Number(id), userId: user.id },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update notification" }, { status: 500 });
  }
}
