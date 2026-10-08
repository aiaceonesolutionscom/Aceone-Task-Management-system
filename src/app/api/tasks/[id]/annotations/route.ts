import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const taskId = parseInt(id, 10);
  if (isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  const { getEffectiveUser, canViewCategory } = await import("@/lib/scopes");
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { assignees: true, reviewers: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isPrivileged = Boolean(
    effectiveUser.role.isSystem ||
    effectiveUser.role.code === "super_admin" ||
    effectiveUser.role.code === "admin"
  );
  const isAssignee = task.assignees.some((a) => a.userId === user.id);
  const isReviewer = task.reviewers.some((r) => r.userId === user.id);
  const isAssignor = task.assignedBy === user.id || task.createdBy === user.id;
  const hasDeptAccess = canViewCategory(effectiveUser, task.departmentId);

  if (!isPrivileged && !isAssignee && !isReviewer && !isAssignor && !hasDeptAccess) {
    return NextResponse.json({ error: "Forbidden: You do not have access to this task." }, { status: 403 });
  }

  const attachmentIdParam = req.nextUrl.searchParams.get("attachmentId");
  if (!attachmentIdParam) {
    return NextResponse.json({ error: "attachmentId required" }, { status: 400 });
  }

  const attachmentId = parseInt(attachmentIdParam, 10);
  if (isNaN(attachmentId)) {
    return NextResponse.json({ error: "Invalid attachmentId" }, { status: 400 });
  }

  const annotations = await db.imageAnnotation.findMany({
    where: { attachmentId },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          name: true,
          designation: true,
        },
      },
    },
  });

  return NextResponse.json(annotations);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const taskId = parseInt(id, 10);
  if (isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  try {
    const { getEffectiveUser, canApproveInCategory } = await import("@/lib/scopes");
    const effectiveUser = await getEffectiveUser(user.id);
    if (!effectiveUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { assignees: true, reviewers: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const isDesignatedReviewer = task.reviewers.some((r) => r.userId === user.id);
    const hasCategoryScope = canApproveInCategory(effectiveUser, task.departmentId);
    const isAuthorizedReviewer =
      effectiveUser.role.isSystem ||
      effectiveUser.role.code === "super_admin" ||
      effectiveUser.role.code === "admin" ||
      effectiveUser.role.code === "manager" ||
      hasCategoryScope ||
      isDesignatedReviewer;

    if (!isAuthorizedReviewer) {
      return NextResponse.json(
        { error: "Employees cannot annotate deliverables. Only authorized reviewers and approvers can annotate." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { attachmentId, versionId, tool, x, y, width, height, comment, color, requestChanges } = body;

    if (!attachmentId || tool === undefined || x === undefined || y === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const created = await db.imageAnnotation.create({
      data: {
        attachmentId: Number(attachmentId),
        versionId: versionId ? Number(versionId) : null,
        userId: user.id,
        tool: String(tool),
        x: Number(x),
        y: Number(y),
        width: width !== undefined && width !== null ? Number(width) : null,
        height: height !== undefined && height !== null ? Number(height) : null,
        comment: comment ? String(comment) : null,
        color: color ? String(color) : "#ef4444",
      },
      include: {
        user: {
          select: {
            name: true,
            designation: true,
          },
        },
      },
    });

    // Log activity
    await db.taskActivityLog.create({
      data: {
        taskId,
        userId: user.id,
        action: "annotation.added",
        metadata: {
          details: comment
            ? `Added visual review pin/markup: "${comment.substring(0, 80)}${comment.length > 80 ? '...' : ''}"`
            : "Added visual review markup on image deliverable",
        },
      },
    });

    // If requestChanges is requested or requested via Save & Request Changes
    let autoRequestedChanges = false;
    if (requestChanges && task.status !== "CHANGES_REQUESTED") {
      await db.task.update({
        where: { id: taskId },
        data: { status: "CHANGES_REQUESTED" },
      });

      autoRequestedChanges = true;

      // Update latest task version if exists
      const latestVersion = await db.taskVersion.findFirst({
        where: { taskId },
        orderBy: { versionNumber: "desc" },
      });

      if (latestVersion && latestVersion.status !== "CHANGES_REQUESTED") {
        await db.taskVersion.update({
          where: { id: latestVersion.id },
          data: {
            status: "CHANGES_REQUESTED",
            reviewerId: user.id,
            reviewedAt: new Date(),
            reviewNotes: comment
              ? `Visual Annotation Markup: "${comment}"`
              : "Visual markup and annotations added to deliverable. Revisions requested.",
          },
        });
      }

      // Log task status transition activity
      await db.taskActivityLog.create({
        data: {
          taskId,
          userId: user.id,
          action: "task.changes_requested",
          metadata: {
            details: `Task status updated to CHANGES_REQUESTED via visual review annotation: "${comment || 'Visual markup added'}"`,
            previousStatus: task.status,
            newStatus: "CHANGES_REQUESTED",
          },
        },
      });
    }

    // Notify task assignees
    const recipientIds = task.assignees
      .map((a) => a.userId)
      .filter((uid) => uid !== user.id);

    for (const recipientId of recipientIds) {
      await sendNotification({
        userId: recipientId,
        taskId,
        type: autoRequestedChanges ? "CHANGES_REQUESTED" : "NEW_COMMENT",
        title: autoRequestedChanges
          ? `Changes Requested: Visual Markup by ${user.name}`
          : `Visual Feedback: ${user.name} marked an image`,
        message: comment
          ? `Annotation: "${comment}". ${autoRequestedChanges ? "Task status updated to Changes Requested." : ""}`
          : `Reviewer ${user.name} pinned feedback on your deliverable.`,
        entityType: "TASK",
        entityId: String(taskId),
      });
    }

    return NextResponse.json({ ...created, autoRequestedChanges }, { status: 201 });
  } catch (err: any) {
    console.error("Failed to create annotation:", err);
    return NextResponse.json({ error: err.message || "Failed to save annotation" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idParam = req.nextUrl.searchParams.get("annotationId");
  if (!idParam) {
    return NextResponse.json({ error: "annotationId required" }, { status: 400 });
  }

  const annotationId = parseInt(idParam, 10);
  if (isNaN(annotationId)) {
    return NextResponse.json({ error: "Invalid annotationId" }, { status: 400 });
  }

  await db.imageAnnotation.deleteMany({
    where: {
      id: annotationId,
      // User can delete own annotation or admin/super_admin can delete
      ...(user.role.isSystem || user.role.code === "admin" || user.role.code === "manager"
        ? {}
        : { userId: user.id }),
    },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const taskId = parseInt(id, 10);
  if (isNaN(taskId)) return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });

  const { getEffectiveUser, canApproveInCategory } = await import("@/lib/scopes");
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { assignees: true, reviewers: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const isDesignatedReviewer = task.reviewers.some((r) => r.userId === user.id);
  const hasCategoryScope = canApproveInCategory(effectiveUser, task.departmentId);
  const isAuthorized =
    effectiveUser.role.isSystem ||
    effectiveUser.role.code === "super_admin" ||
    effectiveUser.role.code === "admin" ||
    effectiveUser.role.code === "manager" ||
    hasCategoryScope ||
    isDesignatedReviewer;

  if (!isAuthorized) {
    return NextResponse.json({ error: "Only reviewers/approvers can request changes." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const notes =
    body.notes ||
    "Visual annotations and review markup placed on deliverable. Please inspect pinned feedback and submit revised work.";

  await db.task.update({
    where: { id: taskId },
    data: { status: "CHANGES_REQUESTED" },
  });

  const latestVersion = await db.taskVersion.findFirst({
    where: { taskId },
    orderBy: { versionNumber: "desc" },
  });

  if (latestVersion) {
    await db.taskVersion.update({
      where: { id: latestVersion.id },
      data: {
        status: "CHANGES_REQUESTED",
        reviewerId: user.id,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });
  }

  await db.taskActivityLog.create({
    data: {
      taskId,
      userId: user.id,
      action: "task.changes_requested",
      metadata: {
        details: notes,
        newStatus: "CHANGES_REQUESTED",
      },
    },
  });

  for (const assignee of task.assignees) {
    if (assignee.userId !== user.id) {
      await sendNotification({
        userId: assignee.userId,
        taskId,
        type: "CHANGES_REQUESTED",
        title: `Changes Requested by ${user.name}`,
        message: notes,
        entityType: "TASK",
        entityId: String(taskId),
      });
    }
  }

  return NextResponse.json({ success: true, newStatus: "CHANGES_REQUESTED" });
}
