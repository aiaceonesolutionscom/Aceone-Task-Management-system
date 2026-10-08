import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEffectiveUser, canViewCategory } from "@/lib/scopes";
import { getAttachmentWithData } from "@/lib/storage";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await params;
  const id = parseInt(fileId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
  }

  const attachment = await getAttachmentWithData(id);
  if (!attachment) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Authorization check: Verify user has task access or category scope
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isPrivileged = Boolean(
    effectiveUser.role.isSystem ||
    effectiveUser.role.code === "super_admin" ||
    effectiveUser.role.code === "admin"
  );

  // If this attachment belongs to a task, strictly enforce task & category access boundaries
  if (attachment.taskId && !isPrivileged) {
    const task = await db.task.findUnique({
      where: { id: attachment.taskId },
      include: { assignees: true, reviewers: true },
    });

    if (task) {
      const isAssignee = task.assignees.some((a) => a.userId === user.id);
      const isReviewer = task.reviewers.some((r) => r.userId === user.id);
      const isAssignor = task.assignedBy === user.id || task.createdBy === user.id;
      const isUploader = attachment.uploadedById === user.id;
      const hasDeptAccess = canViewCategory(effectiveUser, task.departmentId);

      if (!isAssignee && !isReviewer && !isAssignor && !isUploader && !hasDeptAccess) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to view or download this file." },
          { status: 403 }
        );
      }
    }
  }

  const isDownload = request.nextUrl.searchParams.get("download") === "1";
  const disposition = isDownload
    ? `attachment; filename="${encodeURIComponent(attachment.fileName)}"`
    : `inline; filename="${encodeURIComponent(attachment.fileName)}"`;

  // Compute strong ETag for client-side caching & bandwidth optimization
  const etag = attachment.checksum
    ? `"${attachment.checksum}"`
    : `"${attachment.id}-${attachment.fileSize}-${attachment.createdAt.getTime()}"`;

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        "ETag": etag,
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=3600",
      },
    });
  }

  // Return streamed response directly from PostgreSQL BYTEA buffer
  return new NextResponse(attachment.fileData, {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Length": attachment.fileSize.toString(),
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
      "ETag": etag,
      "Cache-Control": "private, max-age=86400, stale-while-revalidate=3600",
    },
  });
}
