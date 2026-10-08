"use server";

import { requireUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission, canViewCategory } from "@/lib/scopes";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { saveAttachment } from "@/lib/storage";
import { revalidatePath } from "next/cache";

export async function deleteFileAction(fileId: number) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) {
    throw new Error("Unauthorized");
  }

  const attachment = await db.attachment.findUnique({
    where: { id: fileId },
    include: {
      task: { select: { id: true, taskCode: true, departmentId: true } },
    },
  });

  if (!attachment) {
    throw new Error("File not found");
  }

  const isUploader = attachment.uploadedById === user.id;
  const isSuperAdmin = Boolean(
    effectiveUser.role.isSystem ||
    effectiveUser.role.code === "super_admin" ||
    effectiveUser.role.code === "admin"
  );
  const canDeleteFiles = hasEffectivePermission(effectiveUser, "file.delete");

  if (!isSuperAdmin && !canDeleteFiles && !isUploader) {
    throw new Error("Forbidden: You do not have permission to delete this file.");
  }

  // If attached to a task, check department scope
  if (attachment.task && !isSuperAdmin) {
    if (!canViewCategory(effectiveUser, attachment.task.departmentId)) {
      throw new Error("Forbidden: You cannot delete files outside your category scope.");
    }
  }

  await db.$transaction(async (tx) => {
    // Clean up annotations linked to this attachment
    await tx.imageAnnotation.deleteMany({
      where: { attachmentId: fileId },
    });

    // Mark as deleted (soft delete)
    await tx.attachment.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });
  });

  await recordAudit({
    actorId: user.id,
    action: "file.delete",
    entityType: "ATTACHMENT",
    entityId: fileId,
    metadata: {
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      taskId: attachment.taskId,
    },
  });

  revalidatePath("/files");
  if (attachment.taskId) {
    revalidatePath(`/tasks/${attachment.taskId}`);
  }

  return { success: true, message: `File "${attachment.fileName}" has been deleted.` };
}

export async function updateFileAction(fileId: number, fileName: string) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) {
    throw new Error("Unauthorized");
  }

  const cleanName = fileName.trim();
  if (!cleanName) {
    throw new Error("File name cannot be empty.");
  }

  const attachment = await db.attachment.findUnique({
    where: { id: fileId },
    include: {
      task: { select: { id: true, departmentId: true } },
    },
  });

  if (!attachment) {
    throw new Error("File not found");
  }

  const isUploader = attachment.uploadedById === user.id;
  const isSuperAdmin = Boolean(
    effectiveUser.role.isSystem ||
    effectiveUser.role.code === "super_admin" ||
    effectiveUser.role.code === "admin"
  );
  const canEditFiles =
    hasEffectivePermission(effectiveUser, "file.edit") ||
    hasEffectivePermission(effectiveUser, "file.upload");

  if (!isSuperAdmin && !canEditFiles && !isUploader) {
    throw new Error("Forbidden: You do not have permission to edit this file.");
  }

  if (attachment.task && !isSuperAdmin) {
    if (!canViewCategory(effectiveUser, attachment.task.departmentId)) {
      throw new Error("Forbidden: You cannot edit files outside your category scope.");
    }
  }

  const updated = await db.attachment.update({
    where: { id: fileId },
    data: { fileName: cleanName },
  });

  await recordAudit({
    actorId: user.id,
    action: "file.update",
    entityType: "ATTACHMENT",
    entityId: fileId,
    metadata: {
      oldName: attachment.fileName,
      newName: cleanName,
    },
  });

  revalidatePath("/files");
  if (attachment.taskId) {
    revalidatePath(`/tasks/${attachment.taskId}`);
  }

  return { success: true, fileName: updated.fileName };
}

export async function uploadStandaloneFileAction(formData: FormData) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "file.upload")) {
    throw new Error("Forbidden: You do not have permission to upload files.");
  }

  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    throw new Error("Please select a valid file to upload.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const origName = file.name || "file.bin";
  const cleanFileName = origName.replace(/[\\/:*?"<>|]/g, "-").trim() || "file.bin";

  const saved = await saveAttachment({
    fileName: cleanFileName,
    mimeType: file.type || "application/octet-stream",
    fileBuffer: buffer,
    fileSize: file.size,
    uploadedById: user.id,
    isReference: true,
  });

  await recordAudit({
    actorId: user.id,
    action: "file.upload",
    entityType: "ATTACHMENT",
    entityId: saved.id,
    metadata: {
      fileName: saved.fileName,
      fileSize: saved.fileSize,
    },
  });

  revalidatePath("/files");
  return { success: true, fileId: saved.id, fileName: saved.fileName };
}
