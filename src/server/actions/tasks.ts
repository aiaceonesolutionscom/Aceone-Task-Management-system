"use server";

import { requireUser } from "@/lib/auth";
import { getEffectiveUser, canAssignInCategory, canViewCategory, hasEffectivePermission } from "@/lib/scopes";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  createTask,
  startTask,
  submitTaskVersion,
  requestChanges,
  approveTask,
  addTaskComment,
} from "@/lib/task-engine";
import { revalidatePath } from "next/cache";

export async function startTaskAction(taskId: number) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) throw new Error("User not found");

  await startTask(effectiveUser, taskId);

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createTaskAction(formData: FormData) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "task.create")) {
    throw new Error("Forbidden: You do not have permission to create tasks.");
  }

  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || "";
  const instructions = (formData.get("instructions") as string) || "";
  const departmentId = parseInt(formData.get("departmentId") as string, 10);
  const priority = (formData.get("priority") as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM";
  const deadlineStr = formData.get("deadline") as string;
  const dueTime = (formData.get("dueTime") as string) || "";
  const approvalRequired = formData.get("approvalRequired") === "true";
  const approvalMode = (formData.get("approvalMode") as "ANY_ONE" | "ALL_REQUIRED") || "ANY_ONE";

  // Assignee user IDs
  const assigneeUserIds = formData
    .getAll("assignees")
    .map((v) => parseInt(v as string, 10))
    .filter((id) => !isNaN(id));

  // Reviewer user IDs
  const reviewerUserIds = formData
    .getAll("reviewers")
    .map((v) => parseInt(v as string, 10))
    .filter((id) => !isNaN(id));

  // Custom field values (prefixed with "cf_")
  const customFieldValues: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("cf_") && typeof value === "string") {
      customFieldValues[key.replace("cf_", "")] = value;
    }
  }

  // Handle uploaded files
  const files: Array<{ fileName: string; mimeType: string; buffer: Buffer }> = [];
  const fileEntries = formData.getAll("files") as File[];
  for (const f of fileEntries) {
    if (f && f.size > 0 && f.name) {
      const arrayBuffer = await f.arrayBuffer();
      files.push({
        fileName: f.name,
        mimeType: f.type || "application/octet-stream",
        buffer: Buffer.from(arrayBuffer),
      });
    }
  }

  // Handle reference links
  const linksJson = formData.get("referenceLinks") as string;
  let referenceLinks: Array<{ displayName: string; url: string }> | undefined;
  if (linksJson) {
    try {
      referenceLinks = JSON.parse(linksJson);
    } catch {}
  }

  const deadline = deadlineStr ? new Date(deadlineStr) : undefined;

  const task = await createTask(effectiveUser, {
    title,
    description,
    instructions,
    departmentId,
    priority,
    deadline,
    dueTime,
    approvalRequired,
    approvalMode,
    assigneeUserIds,
    reviewerUserIds,
    customFieldValues,
    referenceLinks,
    files,
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true, taskId: task.id, taskCode: task.taskCode };
}

export async function submitVersionAction(formData: FormData) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "task.submit")) {
    throw new Error("Forbidden: You do not have permission to submit task work.");
  }

  const taskId = parseInt(formData.get("taskId") as string, 10);
  const comment = (formData.get("comment") as string) || "";

  // Files
  const files: Array<{ fileName: string; mimeType: string; buffer: Buffer }> = [];
  const fileEntries = formData.getAll("files") as File[];
  for (const f of fileEntries) {
    if (f && f.size > 0 && f.name) {
      const arrayBuffer = await f.arrayBuffer();
      files.push({
        fileName: f.name,
        mimeType: f.type || "application/octet-stream",
        buffer: Buffer.from(arrayBuffer),
      });
    }
  }

  // Links
  const linksJson = formData.get("links") as string;
  let links: Array<{ displayName: string; url: string }> | undefined;
  if (linksJson) {
    try {
      links = JSON.parse(linksJson);
    } catch {}
  }

  await submitTaskVersion(effectiveUser, {
    taskId,
    comment,
    links,
    files,
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function requestChangesAction(formData: FormData) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "task.review")) {
    throw new Error("Forbidden: You do not have permission to request changes.");
  }

  const taskId = parseInt(formData.get("taskId") as string, 10);
  const versionId = parseInt(formData.get("versionId") as string, 10);
  const notes = formData.get("notes") as string;

  if (!notes || notes.trim().length === 0) {
    throw new Error("Reason/notes are required when requesting changes.");
  }

  await requestChanges(effectiveUser, {
    taskId,
    versionId,
    notes,
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function approveTaskAction(formData: FormData) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "task.approve")) {
    throw new Error("Forbidden: You do not have permission to approve tasks.");
  }

  const taskId = parseInt(formData.get("taskId") as string, 10);
  const versionIdStr = formData.get("versionId") as string;
  const comment = (formData.get("comment") as string) || undefined;

  await approveTask(effectiveUser, {
    taskId,
    versionId: versionIdStr ? parseInt(versionIdStr, 10) : undefined,
    comment,
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function addCommentAction(formData: FormData) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "task.comment")) {
    throw new Error("Forbidden: You do not have permission to comment on tasks.");
  }

  const taskId = parseInt(formData.get("taskId") as string, 10);
  const versionIdStr = formData.get("versionId") as string;
  const parentIdStr = formData.get("parentId") as string;
  const body = formData.get("body") as string;

  if (!body || body.trim().length === 0) {
    throw new Error("Comment cannot be empty");
  }

  await addTaskComment(effectiveUser, {
    taskId,
    versionId: versionIdStr ? parseInt(versionIdStr, 10) : undefined,
    parentId: parentIdStr ? parseInt(parentIdStr, 10) : undefined,
    body,
  });

  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function deleteTaskAction(taskId: number) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "task.delete")) {
    throw new Error("Forbidden: You do not have permission to delete tasks.");
  }

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { id: true, taskCode: true, title: true, departmentId: true },
  });

  if (!task) throw new Error("Task not found");

  if (!canViewCategory(effectiveUser, task.departmentId)) {
    throw new Error("Forbidden: You cannot delete tasks outside your permitted category.");
  }

  await db.$transaction(async (tx) => {
    // Delete associated attachments, views, notifications, activities
    await tx.imageAnnotation.deleteMany({ where: { attachment: { taskId } } });
    await tx.attachment.deleteMany({ where: { taskId } });
    await tx.submissionLink.deleteMany({ where: { submission: { taskId } } });
    await tx.approvalRecord.deleteMany({ where: { taskId } });
    await tx.taskVersion.deleteMany({ where: { taskId } });
    await tx.taskComment.deleteMany({ where: { taskId } });
    await tx.taskAssignee.deleteMany({ where: { taskId } });
    await tx.taskReviewer.deleteMany({ where: { taskId } });
    await tx.taskView.deleteMany({ where: { taskId } });
    await tx.taskActivityLog.deleteMany({ where: { taskId } });
    await tx.notification.deleteMany({ where: { taskId } });
    await tx.customFieldValue.deleteMany({ where: { taskId } });
    await tx.task.delete({ where: { id: taskId } });
  });

  await recordAudit({
    actorId: user.id,
    action: "task.delete",
    entityType: "TASK",
    entityId: taskId,
    metadata: { taskCode: task.taskCode, title: task.title },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { success: true, message: `Task ${task.taskCode || `#${taskId}`} deleted successfully.` };
}

export type UpdateTaskInput = {
  taskId: number;
  title: string;
  description?: string;
  instructions?: string;
  departmentId: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  deadline?: string | null;
  dueTime?: string | null;
  assigneeUserIds?: number[];
  reviewerUserIds?: number[];
  approvalRequired?: boolean;
};

export async function updateTaskAction(input: UpdateTaskInput) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "task.edit")) {
    throw new Error("Forbidden: You do not have permission to edit tasks.");
  }

  const existingTask = await db.task.findUnique({
    where: { id: input.taskId },
    include: { assignees: true, reviewers: true },
  });

  if (!existingTask) throw new Error("Task not found");

  if (!canViewCategory(effectiveUser, existingTask.departmentId)) {
    throw new Error("Forbidden: You cannot edit tasks outside your permitted category.");
  }

  const deadline = input.deadline ? new Date(input.deadline) : null;

  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: input.taskId },
      data: {
        title: input.title.trim(),
        description: input.description ?? "",
        instructions: input.instructions ?? "",
        departmentId: input.departmentId,
        priority: input.priority,
        deadline,
        dueTime: input.dueTime ?? null,
        approvalRequired: input.approvalRequired !== false,
      },
    });

    if (Array.isArray(input.assigneeUserIds)) {
      await tx.taskAssignee.deleteMany({ where: { taskId: input.taskId } });
      for (const aId of input.assigneeUserIds) {
        await tx.taskAssignee.create({
          data: {
            taskId: input.taskId,
            userId: aId,
            assignedBy: user.id,
            status: "ASSIGNED",
          },
        });
      }
    }

    if (Array.isArray(input.reviewerUserIds)) {
      await tx.taskReviewer.deleteMany({ where: { taskId: input.taskId } });
      for (const rId of input.reviewerUserIds) {
        await tx.taskReviewer.create({
          data: {
            taskId: input.taskId,
            userId: rId,
            assignedBy: user.id,
          },
        });
      }
    }

    await tx.taskActivityLog.create({
      data: {
        taskId: input.taskId,
        userId: user.id,
        action: "TASK_EDITED",
        metadata: {
          message: `${user.name} updated the task details`,
          title: input.title,
          priority: input.priority,
        },
      },
    });
  });

  await recordAudit({
    actorId: user.id,
    action: "task.edit",
    entityType: "TASK",
    entityId: input.taskId,
    metadata: {
      taskCode: existingTask.taskCode,
      title: input.title,
      departmentId: input.departmentId,
    },
  });

  revalidatePath(`/tasks/${input.taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");

  return { success: true, message: `Task ${existingTask.taskCode || `#${input.taskId}`} updated successfully.` };
}

export async function bulkDeleteTasksAction(taskIds: number[]) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "task.delete")) {
    throw new Error("Forbidden: You do not have permission to delete tasks.");
  }

  if (!taskIds || taskIds.length === 0) {
    throw new Error("No tasks selected.");
  }

  const tasks = await db.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, taskCode: true, departmentId: true, title: true },
  });

  const validIds: number[] = [];
  for (const t of tasks) {
    if (canViewCategory(effectiveUser, t.departmentId)) {
      validIds.push(t.id);
    }
  }

  if (validIds.length === 0) {
    throw new Error("You do not have permission to delete any of the selected tasks.");
  }

  for (const id of validIds) {
    await db.$transaction(async (tx) => {
      await tx.imageAnnotation.deleteMany({ where: { attachment: { taskId: id } } });
      await tx.attachment.deleteMany({ where: { taskId: id } });
      await tx.submissionLink.deleteMany({ where: { submission: { taskId: id } } });
      await tx.approvalRecord.deleteMany({ where: { taskId: id } });
      await tx.taskVersion.deleteMany({ where: { taskId: id } });
      await tx.taskComment.deleteMany({ where: { taskId: id } });
      await tx.taskAssignee.deleteMany({ where: { taskId: id } });
      await tx.taskReviewer.deleteMany({ where: { taskId: id } });
      await tx.taskView.deleteMany({ where: { taskId: id } });
      await tx.taskActivityLog.deleteMany({ where: { taskId: id } });
      await tx.notification.deleteMany({ where: { taskId: id } });
      await tx.customFieldValue.deleteMany({ where: { taskId: id } });
      await tx.task.delete({ where: { id } });
    });
  }

  await recordAudit({
    actorId: user.id,
    action: "task.bulk_delete",
    entityType: "TASK",
    metadata: { deletedCount: validIds.length, taskIds: validIds },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");

  return { success: true, count: validIds.length, message: `Successfully deleted ${validIds.length} task(s).` };
}

export async function createBatchDistributedTasksAction(data: {
  departmentId: number;
  taskTitles?: string[];
  tasks?: Array<{
    title: string;
    assigneeId?: number | null;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    deadline?: string;
    referenceLinks?: Array<{ displayName: string; url: string }>;
    files?: Array<{ fileName: string; mimeType: string; base64: string }>;
  }>;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  deadline?: string;
  approvalRequired?: boolean;
}) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "task.create")) {
    throw new Error("Forbidden: You do not have permission to create tasks.");
  }

  if (!canAssignInCategory(effectiveUser, data.departmentId)) {
    throw new Error("You do not have permission to assign tasks in this category.");
  }

  // Find active members belonging to this category
  let categoryMembers = await db.user.findMany({
    where: {
      status: "ACTIVE",
      primaryDepartmentId: data.departmentId,
      role: { code: { in: ["employee", "manager"] } },
    },
    select: { id: true, name: true },
  });

  // If none directly assigned, check other active team members
  if (categoryMembers.length === 0) {
    categoryMembers = await db.user.findMany({
      where: {
        status: "ACTIVE",
        role: { code: { in: ["employee", "manager"] } },
      },
      select: { id: true, name: true },
      take: 5,
    });
  }

  if (categoryMembers.length === 0) {
    throw new Error("No active team members available to receive tasks in this category.");
  }

  const memberMap = new Map(categoryMembers.map((m) => [m.id, m.name]));

  // Build items list from either data.tasks or data.taskTitles
  let itemsToCreate: Array<{
    title: string;
    assigneeId?: number | null;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    deadline?: string;
    referenceLinks?: Array<{ displayName: string; url: string }>;
    files?: Array<{ fileName: string; mimeType: string; base64: string }>;
  }> = [];

  if (Array.isArray(data.tasks) && data.tasks.length > 0) {
    itemsToCreate = data.tasks
      .map((t) => ({ ...t, title: t.title.trim() }))
      .filter((t) => t.title.length > 0);
  } else if (Array.isArray(data.taskTitles)) {
    itemsToCreate = data.taskTitles
      .map((t) => ({ title: t.trim() }))
      .filter((t) => t.title.length > 0);
  }

  if (itemsToCreate.length === 0) {
    throw new Error("Please provide at least one task title.");
  }

  const createdTasks: Array<{ taskCode: string; title: string; assigneeName: string }> = [];

  // Distribute tasks: if assigneeId is specified use it, else round-robin
  for (let i = 0; i < itemsToCreate.length; i++) {
    const item = itemsToCreate[i];
    let assigneeId = item.assigneeId;

    if (!assigneeId || !memberMap.has(assigneeId)) {
      const fallbackAssignee = categoryMembers[i % categoryMembers.length];
      assigneeId = fallbackAssignee.id;
    }

    const assigneeName = memberMap.get(assigneeId) || "Assigned Member";

    // Prepare reference files for this task
    let taskFiles: Array<{ fileName: string; mimeType: string; buffer: Buffer }> = [];
    if (Array.isArray(item.files) && item.files.length > 0) {
      taskFiles = item.files
        .filter((f) => f && f.base64 && f.fileName)
        .map((f) => ({
          fileName: f.fileName,
          mimeType: f.mimeType || "application/octet-stream",
          buffer: Buffer.from(f.base64, "base64"),
        }));
    }

    const task = await createTask(effectiveUser, {
      title: item.title,
      departmentId: data.departmentId,
      priority: item.priority || data.priority || "MEDIUM",
      deadline: item.deadline
        ? new Date(item.deadline)
        : data.deadline
        ? new Date(data.deadline)
        : undefined,
      approvalRequired: data.approvalRequired ?? true,
      approvalMode: "ANY_ONE",
      assigneeUserIds: [assigneeId],
      reviewerUserIds:
        effectiveUser.role.code === "manager" ||
        effectiveUser.role.code === "admin" ||
        effectiveUser.role.isSystem
          ? [effectiveUser.id]
          : [],
      referenceLinks: item.referenceLinks && item.referenceLinks.length > 0 ? item.referenceLinks : undefined,
      files: taskFiles.length > 0 ? taskFiles : undefined,
    });

    createdTasks.push({
      taskCode: task.taskCode || `#${task.id}`,
      title: task.title,
      assigneeName,
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");

  return {
    success: true,
    totalCreated: createdTasks.length,
    membersCount: categoryMembers.length,
    tasks: createdTasks,
  };
}

export type MonthlyScheduleTaskItem = {
  title: string;
  description?: string;
  instructions?: string;
  scheduledDate: string; // "YYYY-MM-DD"
  dueTime?: string; // e.g. "18:00"
  assigneeId?: number | null; // specific assignee or null for auto round-robin
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  referenceLinks?: Array<{ displayName: string; url: string }>;
  files?: Array<{ fileName: string; mimeType: string; base64: string }>;
};

export type CreateMonthlyScheduledTasksInput = {
  departmentId: number;
  month: string; // e.g. "2026-10"
  distributionMode: "divide_equally" | "specific_person" | "per_task";
  globalAssigneeId?: number | null;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueTime?: string;
  approvalRequired?: boolean;
  tasks: MonthlyScheduleTaskItem[];
};

export async function createMonthlyScheduledTasksAction(data: CreateMonthlyScheduledTasksInput) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "task.create")) {
    throw new Error("Forbidden: You do not have permission to create tasks.");
  }

  if (!canAssignInCategory(effectiveUser, data.departmentId)) {
    throw new Error("You do not have permission to assign tasks in this category.");
  }

  if (!Array.isArray(data.tasks) || data.tasks.length === 0) {
    throw new Error("Please add at least one task for the month.");
  }

  // Find active members belonging to this category
  let categoryMembers = await db.user.findMany({
    where: {
      status: "ACTIVE",
      primaryDepartmentId: data.departmentId,
      role: { code: { in: ["employee", "manager"] } },
    },
    select: { id: true, name: true },
  });

  if (categoryMembers.length === 0) {
    categoryMembers = await db.user.findMany({
      where: {
        status: "ACTIVE",
        role: { code: { in: ["employee", "manager"] } },
      },
      select: { id: true, name: true },
      take: 5,
    });
  }

  if (categoryMembers.length === 0) {
    throw new Error("No active team members available to receive tasks in this category.");
  }

  const memberMap = new Map(categoryMembers.map((m) => [m.id, m.name]));

  const createdTasks: Array<{ taskCode: string; title: string; scheduledDate: string; assigneeName: string }> = [];

  for (let i = 0; i < data.tasks.length; i++) {
    const item = data.tasks[i];
    const taskTitle = item.title?.trim();
    if (!taskTitle) continue;

    // Determine assignee
    let assigneeId = item.assigneeId;
    if (data.distributionMode === "specific_person" && data.globalAssigneeId) {
      assigneeId = data.globalAssigneeId;
    } else if (!assigneeId || !memberMap.has(assigneeId)) {
      // Auto divide equally (round-robin)
      const fallbackAssignee = categoryMembers[i % categoryMembers.length];
      assigneeId = fallbackAssignee.id;
    }

    const assigneeName = memberMap.get(assigneeId) || (data.globalAssigneeId ? "Assigned Member" : "Auto-Assigned");

    // Parse scheduled date
    const [yStr, mStr, dStr] = (item.scheduledDate || "").split("-");
    const year = parseInt(yStr, 10);
    const monthIndex = parseInt(mStr, 10) - 1;
    const day = parseInt(dStr, 10);

    const isValidDate = !isNaN(year) && !isNaN(monthIndex) && !isNaN(day);
    const startDate = isValidDate ? new Date(year, monthIndex, day, 0, 0, 0, 0) : new Date();

    const timeStr = item.dueTime || data.dueTime || "18:00";
    const [hStr, minStr] = timeStr.split(":");
    const deadlineHour = parseInt(hStr, 10) || 18;
    const deadlineMin = parseInt(minStr, 10) || 0;
    const deadline = isValidDate
      ? new Date(year, monthIndex, day, deadlineHour, deadlineMin, 0, 0)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Prepare files if any
    let taskFiles: Array<{ fileName: string; mimeType: string; buffer: Buffer }> = [];
    if (Array.isArray(item.files) && item.files.length > 0) {
      taskFiles = item.files
        .filter((f) => f && f.base64 && f.fileName)
        .map((f) => ({
          fileName: f.fileName,
          mimeType: f.mimeType || "application/octet-stream",
          buffer: Buffer.from(f.base64, "base64"),
        }));
    }

    const taskPriority = item.priority || data.priority || "MEDIUM";

    const task = await createTask(effectiveUser, {
      title: taskTitle,
      description: item.description || undefined,
      instructions: item.instructions || undefined,
      departmentId: data.departmentId,
      priority: taskPriority,
      startDate,
      deadline,
      dueTime: timeStr,
      approvalRequired: data.approvalRequired ?? true,
      approvalMode: "ANY_ONE",
      assigneeUserIds: [assigneeId],
      reviewerUserIds:
        effectiveUser.role.code === "manager" ||
        effectiveUser.role.code === "admin" ||
        effectiveUser.role.isSystem
          ? [effectiveUser.id]
          : [],
      referenceLinks: item.referenceLinks && item.referenceLinks.length > 0 ? item.referenceLinks : undefined,
      files: taskFiles.length > 0 ? taskFiles : undefined,
    });

    createdTasks.push({
      taskCode: task.taskCode || `#${task.id}`,
      title: task.title,
      scheduledDate: item.scheduledDate,
      assigneeName,
    });
  }

  await recordAudit({
    actorId: user.id,
    action: "task.monthly_campaign_create",
    entityType: "TASK",
    metadata: {
      departmentId: data.departmentId,
      month: data.month,
      totalScheduled: createdTasks.length,
      distributionMode: data.distributionMode,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");

  return {
    success: true,
    totalCreated: createdTasks.length,
    tasks: createdTasks,
  };
}

export async function bulkUpdateTaskPriorityAction(
  taskIds: number[],
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "task.create")) {
    throw new Error("Forbidden: You do not have permission to modify task priorities.");
  }

  if (!taskIds || taskIds.length === 0) {
    throw new Error("No tasks selected.");
  }

  const tasks = await db.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, departmentId: true, taskCode: true, priority: true },
  });

  const isSuperAdmin = Boolean(
    user.role.isSystem || user.role.code === "super_admin" || user.role.code === "admin"
  );

  const allowedDeptIds = isSuperAdmin
    ? null
    : Array.from(
        new Set([
          ...(effectiveUser.primaryDepartmentId ? [effectiveUser.primaryDepartmentId] : []),
          ...(effectiveUser.assignmentScopeIds || []),
          ...(effectiveUser.categoryScopeIds || []),
        ])
      );

  const validTaskIds: number[] = [];
  for (const t of tasks) {
    if (allowedDeptIds === null || allowedDeptIds.includes(t.departmentId)) {
      validTaskIds.push(t.id);
    }
  }

  if (validTaskIds.length === 0) {
    throw new Error("You do not have permission to modify the selected tasks.");
  }

  await db.task.updateMany({
    where: { id: { in: validTaskIds } },
    data: { priority },
  });

  await recordAudit({
    actorId: user.id,
    action: "task.bulk_priority_update",
    entityType: "TASK",
    metadata: { updatedCount: validTaskIds.length, newPriority: priority, taskIds: validTaskIds },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");

  return { success: true, count: validTaskIds.length, priority };
}


