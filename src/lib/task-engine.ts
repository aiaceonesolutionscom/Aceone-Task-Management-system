import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";
import { canAssignInCategory, canApproveInCategory, type EffectiveUser } from "@/lib/scopes";
import { saveAttachment } from "@/lib/storage";

/**
 * Generates the next sequential Task Code in format "AS1-1024".
 */
export async function getNextTaskCode(): Promise<string> {
  const latestTask = await db.task.findFirst({
    orderBy: { id: "desc" },
    select: { id: true, taskCode: true },
  });

  const nextSeq = (latestTask?.id ?? 0) + 1001;
  return `AS1-${nextSeq}`;
}

export function formatDescriptiveFileName({
  taskCode,
  taskTitle,
  userName,
  isReference,
  versionNumber,
  originalFileName,
}: {
  taskCode?: string | null;
  taskTitle: string;
  userName: string;
  isReference: boolean;
  versionNumber?: number;
  originalFileName: string;
}): string {
  const ext = originalFileName.includes(".")
    ? originalFileName.split(".").pop()?.toLowerCase() || "bin"
    : "bin";

  const cleanTitle = (taskTitle || "Task")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("_") || "Task";

  const cleanUser = (userName || "User")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("_") || "User";

  const code = taskCode || "TASK";
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  if (isReference) {
    return `${code}_${cleanTitle}_REF_${cleanUser}_${dateStr}.${ext}`;
  } else {
    const vStr = versionNumber ? `_V${versionNumber}` : "";
    return `${code}_${cleanTitle}${vStr}_${cleanUser}_${dateStr}.${ext}`;
  }
}

export type CreateTaskInput = {
  title: string;
  description?: string;
  instructions?: string;
  departmentId: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startDate?: Date | null;
  deadline?: Date | null;
  dueTime?: string | null;
  approvalRequired?: boolean;
  approvalMode?: "ANY_ONE" | "ALL_REQUIRED";
  assigneeUserIds: number[];
  reviewerUserIds?: number[];
  referenceLinks?: Array<{ displayName: string; url: string }>;
  customFieldValues?: Record<string, string>;
  files?: Array<{ fileName: string; mimeType: string; buffer: Buffer }>;
};

/**
 * Creates a task with multi-assignment, references, custom fields, and audit log.
 */
export async function createTask(user: EffectiveUser, input: CreateTaskInput) {
  if (!canAssignInCategory(user, input.departmentId)) {
    throw new Error("You do not have permission to assign or create tasks in this category.");
  }

  const taskCode = await getNextTaskCode();

  const task = await db.$transaction(async (tx) => {
    // 1. Create task
    const createdTask = await tx.task.create({
      data: {
        taskCode,
        title: input.title,
        description: input.description,
        instructions: input.instructions,
        departmentId: input.departmentId,
        priority: input.priority || "MEDIUM",
        status: "ASSIGNED",
        startDate: input.startDate ?? null,
        deadline: input.deadline ?? null,
        dueTime: input.dueTime ?? null,
        approvalRequired: input.approvalRequired !== false,
        approvalMode: input.approvalMode || "ANY_ONE",
        referenceLinks: input.referenceLinks ? (input.referenceLinks as object) : undefined,
        createdBy: user.id,
        assignedBy: user.id,
        sentAt: new Date(),
      },
    });

    // 2. Create assignments
    for (const assigneeId of input.assigneeUserIds) {
      await tx.taskAssignee.create({
        data: {
          taskId: createdTask.id,
          userId: assigneeId,
          assignedBy: user.id,
          status: "ASSIGNED",
        },
      });
    }

    // 3. Create reviewers if specified
    if (input.reviewerUserIds && input.reviewerUserIds.length > 0) {
      for (const reviewerId of input.reviewerUserIds) {
        await tx.taskReviewer.create({
          data: {
            taskId: createdTask.id,
            userId: reviewerId,
            assignedBy: user.id,
          },
        });
      }
    }

    // 4. Save custom field values
    if (input.customFieldValues) {
      for (const [fieldKey, value] of Object.entries(input.customFieldValues)) {
        const field = await tx.customField.findFirst({
          where: {
            fieldKey,
            OR: [{ departmentId: input.departmentId }, { departmentId: null }],
          },
        });
        if (field) {
          await tx.customFieldValue.create({
            data: {
              customFieldId: field.id,
              taskId: createdTask.id,
              value: String(value),
            },
          });
        }
      }
    }

    return createdTask;
  });

  // Save reference attachments with descriptive filenames
  if (input.files && input.files.length > 0) {
    for (const file of input.files) {
      const formattedFileName = formatDescriptiveFileName({
        taskCode: task.taskCode,
        taskTitle: task.title,
        userName: user.name,
        isReference: true,
        originalFileName: file.fileName,
      });

      await saveAttachment({
        fileName: formattedFileName,
        mimeType: file.mimeType,
        fileBuffer: file.buffer,
        fileSize: file.buffer.length,
        uploadedById: user.id,
        taskId: task.id,
        isReference: true,
      });
    }
  }

  // Audit log
  await recordAudit({
    actorId: user.id,
    action: "task.create",
    entityType: "TASK",
    entityId: task.id,
    metadata: {
      taskCode,
      title: task.title,
      departmentId: task.departmentId,
      assigneesCount: input.assigneeUserIds.length,
    },
  });

  // Notify assignees (ONLY if task is scheduled for today or earlier; future scheduled tasks unlock and notify at midnight on their day)
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const isFutureScheduled = Boolean(input.startDate && input.startDate > endOfToday);

  if (!isFutureScheduled) {
    for (const assigneeId of input.assigneeUserIds) {
      await sendNotification({
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        title: "New Task Assigned",
        message: `${user.name} assigned you task ${taskCode}: "${task.title}"`,
        taskId: task.id,
      });
    }
  }

  return task;
}

/**
 * Records an assignee viewing the task, marking delivery/viewed state.
 */
export async function markTaskViewed(taskId: number, userId: number) {
  const now = new Date();

  await db.taskView.upsert({
    where: { taskId_userId: { taskId, userId } },
    update: { lastViewedAt: now },
    create: { taskId, userId, firstViewedAt: now, lastViewedAt: now },
  });

  // Update assignee status if still in ASSIGNED
  await db.taskAssignee.updateMany({
    where: { taskId, userId, status: "ASSIGNED" },
    data: { status: "VIEWED", viewedAt: now },
  });

  // If task status was ASSIGNED, advance to VIEWED
  await db.task.updateMany({
    where: { id: taskId, status: "ASSIGNED" },
    data: { status: "VIEWED", firstViewedAt: now },
  });
}

/**
 * Transitions a task to IN_PROGRESS when an assignee starts or resumes working on it.
 */
export async function startTask(user: EffectiveUser, taskId: number) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { assignees: true },
  });

  if (!task) throw new Error("Task not found");

  const isAssignee = task.assignees.some((a) => a.userId === user.id);
  const isPrivileged = Boolean(
    user.role.isSystem ||
    user.role.code === "super_admin" ||
    user.role.code === "admin"
  );
  if (!isAssignee && !isPrivileged) {
    throw new Error("Forbidden: You are not assigned to this task.");
  }

  // Update task status and assignee status to IN_PROGRESS
  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { status: "IN_PROGRESS" },
    });

    await tx.taskAssignee.updateMany({
      where: { taskId, userId: user.id },
      data: { status: "IN_PROGRESS" },
    });
  });

  // Audit log
  await recordAudit({
    actorId: user.id,
    action: "task.started",
    entityType: "TASK",
    entityId: taskId,
    metadata: {
      taskCode: task.taskCode,
      title: task.title,
      startedBy: user.name,
    },
  });

  // Activity log
  await db.taskActivityLog.create({
    data: {
      taskId,
      userId: user.id,
      action: "TASK_STARTED",
      metadata: {
        message: `${user.name} started working on this task`,
      },
    },
  });

  // Notify creator / manager if different from assignee
  if (task.createdBy !== user.id) {
    await sendNotification({
      userId: task.createdBy,
      type: "SYSTEM",
      title: "Task In Progress",
      message: `${user.name} started working on task ${task.taskCode || `#${task.id}`}: "${task.title}"`,
      taskId: task.id,
    });
  }

  return { success: true };
}

/**
 * Submits a new version of work for a task (V1, V2, V3...).
 */
export async function submitTaskVersion(
  user: EffectiveUser,
  input: {
    taskId: number;
    comment?: string;
    links?: Array<{ displayName: string; url: string }>;
    files?: Array<{ fileName: string; mimeType: string; buffer: Buffer }>;
  }
) {
  // Find task
  const task = await db.task.findUnique({
    where: { id: input.taskId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      reviewers: true,
      assignees: true,
    },
  });

  if (!task) throw new Error("Task not found");

  const isAssignee = task.assignees.some((a) => a.userId === user.id);
  const isPrivileged = Boolean(
    user.role.isSystem ||
    user.role.code === "super_admin" ||
    user.role.code === "admin"
  );
  if (!isAssignee && !isPrivileged) {
    throw new Error("Forbidden: You are not assigned to this task.");
  }

  // Determine next version number (V1, V2, V3...)
  const currentMax = task.versions[0]?.versionNumber ?? 0;
  const versionNumber = currentMax + 1;

  const version = await db.$transaction(async (tx) => {
    // 1. Create TaskVersion
    const v = await tx.taskVersion.create({
      data: {
        taskId: task.id,
        versionNumber,
        submittedById: user.id,
        comment: input.comment,
        status: "SUBMITTED",
      },
    });

    // 2. Add external links if any
    if (input.links && input.links.length > 0) {
      for (const link of input.links) {
        await tx.submissionLink.create({
          data: {
            submissionId: v.id,
            displayName: link.displayName,
            url: link.url,
          },
        });
      }
    }

    // 3. Update task status to UNDER_REVIEW
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: "UNDER_REVIEW",
      },
    });

    // 4. Update user's assignee status
    await tx.taskAssignee.updateMany({
      where: { taskId: task.id, userId: user.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    return v;
  });

  // Save submission files in PostgreSQL BYTEA with descriptive filenames
  if (input.files && input.files.length > 0) {
    for (const file of input.files) {
      const formattedFileName = formatDescriptiveFileName({
        taskCode: task.taskCode,
        taskTitle: task.title,
        userName: user.name,
        isReference: false,
        versionNumber: version.versionNumber,
        originalFileName: file.fileName,
      });

      await saveAttachment({
        fileName: formattedFileName,
        mimeType: file.mimeType,
        fileBuffer: file.buffer,
        fileSize: file.buffer.length,
        uploadedById: user.id,
        taskId: task.id,
        versionId: version.id,
        isReference: false,
      });
    }
  }

  // Audit log
  await recordAudit({
    actorId: user.id,
    action: "task.version_submitted",
    entityType: "TASK",
    entityId: task.id,
    metadata: {
      taskCode: task.taskCode,
      versionNumber,
      filesCount: input.files?.length ?? 0,
    },
  });

  // Notify reviewers and creator
  const recipientIds = new Set<number>();
  if (task.createdBy !== user.id) recipientIds.add(task.createdBy);
  for (const r of task.reviewers) {
    if (r.userId !== user.id) recipientIds.add(r.userId);
  }

  for (const rId of recipientIds) {
    await sendNotification({
      userId: rId,
      type: "NEW_VERSION_SUBMITTED",
      title: `Version ${versionNumber} Submitted`,
      message: `${user.name} submitted Version ${versionNumber} for ${task.taskCode}: "${task.title}"`,
      taskId: task.id,
    });
  }

  return version;
}

/**
 * Reviewer requests changes on a submission version.
 */
export async function requestChanges(
  user: EffectiveUser,
  input: {
    taskId: number;
    versionId: number;
    notes: string;
  }
) {
  const task = await db.task.findUnique({
    where: { id: input.taskId },
    include: { assignees: true },
  });

  if (!task) throw new Error("Task not found");
  if (!canApproveInCategory(user, task.departmentId)) {
    throw new Error("You do not have approval scope for this category.");
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
    // 1. Update version
    await tx.taskVersion.update({
      where: { id: input.versionId },
      data: {
        status: "CHANGES_REQUESTED",
        reviewerId: user.id,
        reviewNotes: input.notes,
        reviewedAt: now,
      },
    });

    // 2. Update task status
    await tx.task.update({
      where: { id: task.id },
      data: { status: "CHANGES_REQUESTED" },
    });

    // 3. Record approval record (safe against duplicate constraint)
    const existingRecord = await tx.approvalRecord.findFirst({
      where: {
        taskId: task.id,
        submissionId: input.versionId,
      },
    });

    if (existingRecord) {
      await tx.approvalRecord.update({
        where: { id: existingRecord.id },
        data: {
          approvedBy: user.id,
          status: "CHANGES_REQUESTED",
          comment: input.notes,
          approvedAt: now,
        },
      });
    } else {
      await tx.approvalRecord.create({
        data: {
          taskId: task.id,
          submissionId: input.versionId,
          approvedBy: user.id,
          status: "CHANGES_REQUESTED",
          comment: input.notes,
          approvedAt: now,
        },
      });
    }
  });

  // Audit log
  await recordAudit({
    actorId: user.id,
    action: "task.changes_requested",
    entityType: "TASK",
    entityId: task.id,
    metadata: {
      taskCode: task.taskCode,
      notes: input.notes,
    },
  });

  // Notify assignees
  for (const assignee of task.assignees) {
    await sendNotification({
      userId: assignee.userId,
      type: "CHANGES_REQUESTED",
      title: "Changes Requested",
      message: `${user.name} requested changes on ${task.taskCode}: "${input.notes}"`,
      taskId: task.id,
    });
  }
}

/**
 * Reviewer approves a task submission.
 * Handles ANY_ONE vs ALL_REQUIRED approval modes.
 */
export async function approveTask(
  user: EffectiveUser,
  input: {
    taskId: number;
    versionId?: number;
    comment?: string;
  }
) {
  const task = await db.task.findUnique({
    where: { id: input.taskId },
    include: {
      assignees: true,
      reviewers: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      approvals: true,
    },
  });

  if (!task) throw new Error("Task not found");
  if (!canApproveInCategory(user, task.departmentId)) {
    throw new Error("You do not have approval scope for this category.");
  }

  const candidateVersionId = input.versionId ?? task.versions[0]?.id;
  const now = new Date();

  await db.$transaction(async (tx) => {
    let validSubmissionId: number | null = null;
    if (candidateVersionId) {
      const ver = await tx.taskVersion.findUnique({
        where: { id: candidateVersionId },
        select: { id: true, taskId: true },
      });
      if (ver && ver.taskId === task.id) {
        validSubmissionId = ver.id;
        await tx.taskVersion.update({
          where: { id: ver.id },
          data: {
            status: "APPROVED",
            reviewerId: user.id,
            reviewedAt: now,
            reviewNotes: input.comment || "Approved",
          },
        });
      }
    }

    // 1. Record approval (safe against duplicate constraint)
    const existingApproval = validSubmissionId
      ? await tx.approvalRecord.findFirst({
          where: { taskId: task.id, submissionId: validSubmissionId },
        })
      : null;

    if (existingApproval) {
      await tx.approvalRecord.update({
        where: { id: existingApproval.id },
        data: {
          approvedBy: user.id,
          status: "APPROVED",
          comment: input.comment,
          approvedAt: now,
        },
      });
    } else {
      await tx.approvalRecord.create({
        data: {
          taskId: task.id,
          submissionId: validSubmissionId,
          approvedBy: user.id,
          status: "APPROVED",
          comment: input.comment,
          approvedAt: now,
        },
      });
    }

    let markComplete = false;

    if (task.approvalMode === "ANY_ONE" || task.reviewers.length <= 1) {
      markComplete = true;
    } else {
      // Check if all reviewers have approved
      const approvedReviewerIds = new Set(
        task.approvals.filter((a) => a.status === "APPROVED").map((a) => a.approvedBy)
      );
      approvedReviewerIds.add(user.id);

      const allApproved = task.reviewers.every((r) => approvedReviewerIds.has(r.userId));
      if (allApproved) markComplete = true;
    }

    if (markComplete) {
      await tx.task.update({
        where: { id: task.id },
        data: { status: "APPROVED" },
      });

      if (validSubmissionId) {
        await tx.taskVersion.update({
          where: { id: validSubmissionId },
          data: {
            status: "APPROVED",
            reviewerId: user.id,
            reviewedAt: now,
          },
        });
      }

      await tx.taskAssignee.updateMany({
        where: { taskId: task.id },
        data: { status: "COMPLETED", completedAt: now },
      });
    }
  });

  // Audit log
  await recordAudit({
    actorId: user.id,
    action: "task.approved",
    entityType: "TASK",
    entityId: task.id,
    metadata: {
      taskCode: task.taskCode,
      comment: input.comment,
    },
  });

  // Notify assignees
  for (const a of task.assignees) {
    await sendNotification({
      userId: a.userId,
      type: "TASK_APPROVED",
      title: "Task Approved",
      message: `${user.name} approved task ${task.taskCode}!`,
      taskId: task.id,
    });
  }

  // Also notify other reviewers/managers so they know who approved it
  for (const r of task.reviewers) {
    if (r.userId !== user.id) {
      await sendNotification({
        userId: r.userId,
        type: "TASK_APPROVED",
        title: "Task Approved by Management",
        message: `${user.name} approved task ${task.taskCode}!`,
        taskId: task.id,
      });
    }
  }

  // Notify assignor if different from approver
  if (task.assignedBy && task.assignedBy !== user.id) {
    await sendNotification({
      userId: task.assignedBy,
      type: "TASK_APPROVED",
      title: "Task Approved",
      message: `${user.name} approved task ${task.taskCode}!`,
      taskId: task.id,
    });
  }
}

/**
 * Contextual task comment with @mention parsing.
 */
export async function addTaskComment(
  user: EffectiveUser,
  input: {
    taskId: number;
    versionId?: number | null;
    parentId?: number | null;
    body: string;
  }
) {
  const comment = await db.taskComment.create({
    data: {
      taskId: input.taskId,
      versionId: input.versionId ?? null,
      parentId: input.parentId ?? null,
      userId: user.id,
      body: input.body,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, designation: true },
      },
    },
  });

  // Parse @mentions (e.g. @saboor or @muneeb)
  const notifiedUserIds = new Set<number>([user.id]);
  const mentionMatches = input.body.match(/@([a-zA-Z0-9_.-]+)/g);
  if (mentionMatches) {
    for (const match of mentionMatches) {
      const username = match.substring(1).toLowerCase();
      const mentionedUser = await db.user.findFirst({
        where: {
          OR: [
            { username: { equals: username, mode: "insensitive" } },
            { name: { contains: username, mode: "insensitive" } },
          ],
        },
      });

      if (mentionedUser && !notifiedUserIds.has(mentionedUser.id)) {
        notifiedUserIds.add(mentionedUser.id);
        await sendNotification({
          userId: mentionedUser.id,
          type: "MENTION",
          title: "You were mentioned",
          message: `${user.name} mentioned you in a comment: "${input.body.slice(0, 80)}"`,
          taskId: input.taskId,
        });
      }
    }
  }

  // Notify other task assignees, reviewers, and assignor in real-time
  const task = await db.task.findUnique({
    where: { id: input.taskId },
    include: {
      assignees: true,
      reviewers: true,
    },
  });

  if (task) {
    const participantIds = new Set<number>();
    task.assignees.forEach((a) => participantIds.add(a.userId));
    task.reviewers.forEach((r) => participantIds.add(r.userId));
    if (task.assignedBy) participantIds.add(task.assignedBy);
    if (task.createdBy) participantIds.add(task.createdBy);

    for (const pid of participantIds) {
      if (!notifiedUserIds.has(pid)) {
        notifiedUserIds.add(pid);
        await sendNotification({
          userId: pid,
          type: "NEW_COMMENT",
          title: `New Comment on ${task.taskCode || `Task #${task.id}`}`,
          message: `${user.name}: "${input.body.slice(0, 80)}"`,
          taskId: input.taskId,
        });
      }
    }
  }

  // Audit log
  await recordAudit({
    actorId: user.id,
    action: "task.comment",
    entityType: "TASK",
    entityId: input.taskId,
    metadata: { commentId: comment.id },
  });

  return comment;
}
