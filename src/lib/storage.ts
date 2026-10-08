import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export type UploadFileInput = {
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  fileSize: number;
  uploadedById: number;
  taskId?: number | null;
  versionId?: number | null;
  commentId?: number | null;
  isReference?: boolean;
};

/**
 * Stores uploaded file directly in PostgreSQL using BYTEA binary data type.
 * Computes sha256 checksum for data integrity verification.
 */
export async function saveAttachment(input: UploadFileInput) {
  const checksum = createHash("sha256").update(input.fileBuffer).digest("hex");

  const attachment = await db.attachment.create({
    data: {
      fileName: input.fileName,
      mimeType: input.mimeType || "application/octet-stream",
      fileSize: input.fileSize || input.fileBuffer.length,
      fileData: new Uint8Array(input.fileBuffer),
      checksum,
      isReference: Boolean(input.isReference),
      taskId: input.taskId ?? null,
      versionId: input.versionId ?? null,
      commentId: input.commentId ?? null,
      uploadedById: input.uploadedById,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      checksum: true,
      isReference: true,
      isArchived: true,
      taskId: true,
      versionId: true,
      uploadedById: true,
      createdAt: true,
    },
  });

  return attachment;
}

/**
 * Retrieves attachment metadata and binary content for streaming.
 */
export async function getAttachmentWithData(attachmentId: number) {
  return db.attachment.findUnique({
    where: { id: attachmentId, deletedAt: null },
  });
}

/**
 * Aggregates database file storage metrics.
 */
export async function getStorageMetrics() {
  const totalFiles = await db.attachment.count({ where: { deletedAt: null } });
  const archivedFiles = await db.attachment.count({ where: { isArchived: true, deletedAt: null } });

  // Sum file sizes
  const sizeAggregate = await db.attachment.aggregate({
    _sum: { fileSize: true },
    where: { deletedAt: null },
  });

  const totalBytes = sizeAggregate._sum.fileSize ?? 0;

  // Largest 10 files
  const largestFiles = await db.attachment.findMany({
    where: { deletedAt: null },
    orderBy: { fileSize: "desc" },
    take: 10,
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      isReference: true,
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      task: {
        select: { id: true, taskCode: true, title: true },
      },
    },
  });

  return {
    totalFiles,
    archivedFiles,
    totalBytes,
    totalMegabytes: (totalBytes / (1024 * 1024)).toFixed(2),
    largestFiles,
  };
}
