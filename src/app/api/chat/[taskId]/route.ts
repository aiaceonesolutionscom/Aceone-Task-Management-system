import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getEffectiveUser, canViewCategory } from "@/lib/scopes";
import { db } from "@/lib/db";
import { addTaskComment } from "@/lib/task-engine";
import {
  getCommentReads,
  markCommentsAsRead,
  getCommentDeliveries,
  markCommentsAsDelivered,
} from "@/lib/chat-reads";

async function verifyTaskAccess(user: any, effectiveUser: any, taskId: number) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      assignees: true,
      reviewers: true,
    },
  });

  if (!task) {
    return { error: "Task not found", status: 404, task: null };
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
    return { error: "Forbidden: You do not have access to this conversation.", status: 403, task: null };
  }

  return { error: null, status: 200, task };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const user = await requireUser();
    const effectiveUser = await getEffectiveUser(user.id);
    if (!effectiveUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId: taskIdStr } = await context.params;
    const taskId = parseInt(taskIdStr, 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    // Verify user has task / category authorization
    const access = await verifyTaskAccess(user, effectiveUser, taskId);
    if (access.error) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // 1. Fetch comments with user details
    const comments = await db.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            role: { select: { name: true, code: true } },
          },
        },
      },
    });

    const commentIds = comments.map((c) => c.id);

    // 2. Auto-mark incoming comments for current user as delivered & read
    const incomingUnreadIds = comments
      .filter((c) => c.userId !== user.id)
      .map((c) => c.id);

    if (incomingUnreadIds.length > 0) {
      await markCommentsAsDelivered(incomingUnreadIds, user.id);
      await markCommentsAsRead(incomingUnreadIds, user.id);
    }

    // 3. Fetch all read receipts and delivery receipts for these comments
    const [readsMap, deliveriesMap] = await Promise.all([
      getCommentReads(commentIds),
      getCommentDeliveries(commentIds),
    ]);

    const enrichedComments = comments.map((c) => ({
      ...c,
      reads: readsMap[c.id] || [],
      deliveries: deliveriesMap[c.id] || [],
    }));

    return NextResponse.json({ success: true, comments: enrichedComments });
  } catch (err: any) {
    console.error("Error in GET /api/chat/[taskId]:", err);
    return NextResponse.json(
      { error: "Unable to load messages at this time." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const user = await requireUser();
    const effectiveUser = await getEffectiveUser(user.id);
    if (!effectiveUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId: taskIdStr } = await context.params;
    const taskId = parseInt(taskIdStr, 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    // Verify user has task / category authorization
    const access = await verifyTaskAccess(user, effectiveUser, taskId);
    if (access.error) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const bodyData = await request.json();
    const rawBody = (bodyData.body || "").trim();

    if (!rawBody) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }

    if (rawBody.length > 5000) {
      return NextResponse.json(
        { error: "Message exceeds maximum allowed length of 5000 characters." },
        { status: 400 }
      );
    }

    const newComment = await addTaskComment(effectiveUser, {
      taskId,
      body: rawBody,
    });

    // Sender automatically marks their own comment as read & delivered
    await markCommentsAsDelivered([newComment.id], user.id);
    await markCommentsAsRead([newComment.id], user.id);

    // Fetch reads, deliveries and user info for the created comment
    const [readsMap, deliveriesMap] = await Promise.all([
      getCommentReads([newComment.id]),
      getCommentDeliveries([newComment.id]),
    ]);

    const fullComment = {
      ...newComment,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        designation: user.designation,
        role: { name: user.role.name, code: user.role.code },
      },
      reads: readsMap[newComment.id] || [],
      deliveries: deliveriesMap[newComment.id] || [],
    };

    return NextResponse.json({ success: true, comment: fullComment });
  } catch (err: any) {
    console.error("Error in POST /api/chat/[taskId]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send message." },
      { status: 500 }
    );
  }
}
