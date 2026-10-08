import { requireUser } from "@/lib/auth";
import { getEffectiveUser, canApproveInCategory, canViewCategory, hasEffectivePermission } from "@/lib/scopes";
import { db } from "@/lib/db";
import { markTaskViewed } from "@/lib/task-engine";
import {
  getCommentReads,
  getCommentDeliveries,
  markCommentsAsDelivered,
  markCommentsAsRead,
} from "@/lib/chat-reads";
import { AppShell } from "@/components/layout/app-shell";
import { TaskWorkspaceView } from "@/components/tasks/task-workspace-view";
import { notFound, redirect } from "next/navigation";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) redirect("/login");

  const { id } = await params;
  const taskId = parseInt(id, 10);
  if (isNaN(taskId)) notFound();

  // Load complete task source of truth
  const [task, categories, teamMembers] = await Promise.all([
    db.task.findUnique({
      where: { id: taskId },
      include: {
        department: true,
        creator: { select: { id: true, name: true, email: true, designation: true } },
        assignor: { select: { id: true, name: true, email: true, designation: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, designation: true } },
          },
        },
        reviewers: {
          include: {
            user: { select: { id: true, name: true, email: true, designation: true } },
          },
        },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            submitter: { select: { id: true, name: true, designation: true } },
            reviewer: { select: { id: true, name: true, designation: true } },
            attachments: { where: { deletedAt: null } },
            links: true,
          },
        },
        attachments: {
          where: { isReference: true, versionId: null, deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, designation: true } },
          },
        },
        fieldValues: {
          include: { customField: true },
        },
        approvals: {
          orderBy: { approvedAt: "desc" },
          include: {
            approver: { select: { id: true, name: true, designation: true } },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          include: {
            actor: { select: { id: true, name: true, designation: true } },
          },
        },
      },
    }),
    db.department.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, email: true, designation: true, primaryDepartmentId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!task) notFound();

  // Mark task as viewed by current user (delivers seen tracking)
  await markTaskViewed(task.id, user.id);

  // Mark all incoming unread comments as delivered and read for the viewer
  const commentIds = task.comments.map((c) => c.id);
  const incomingUnreadIds = task.comments
    .filter((c) => c.userId !== user.id)
    .map((c) => c.id);

  if (incomingUnreadIds.length > 0) {
    await Promise.all([
      markCommentsAsDelivered(incomingUnreadIds, user.id),
      markCommentsAsRead(incomingUnreadIds, user.id),
    ]);
  }

  const [readsMap, deliveriesMap] = await Promise.all([
    getCommentReads(commentIds),
    getCommentDeliveries(commentIds),
  ]);

  const enrichedTask = {
    ...task,
    comments: task.comments.map((c) => ({
      ...c,
      reads: readsMap[c.id] || [],
      deliveries: deliveriesMap[c.id] || [],
    })),
  };

  const isAssignee = task.assignees.some((a) => a.userId === user.id);
  const isCreator = task.createdBy === user.id;
  const isDesignatedReviewer = task.reviewers.some((r) => r.userId === user.id);
  const hasCategoryApprovalScope = canApproveInCategory(effectiveUser, task.departmentId);
  const hasReviewOrApprovalScope =
    effectiveUser.role.isSystem ||
    effectiveUser.role.code === "super_admin" ||
    effectiveUser.role.code === "admin" ||
    hasCategoryApprovalScope ||
    isDesignatedReviewer;

  const canApprove =
    hasEffectivePermission(effectiveUser, "task.approve") && hasReviewOrApprovalScope;

  const canReview =
    hasEffectivePermission(effectiveUser, "task.review") && hasReviewOrApprovalScope;

  const canSubmit =
    hasEffectivePermission(effectiveUser, "task.submit") &&
    (isAssignee || isCreator || effectiveUser.role.isSystem);

  const canComment = hasEffectivePermission(effectiveUser, "task.comment");

  const canDelete =
    hasEffectivePermission(effectiveUser, "task.delete") &&
    canViewCategory(effectiveUser, task.departmentId);

  const canEdit =
    hasEffectivePermission(effectiveUser, "task.edit") &&
    canViewCategory(effectiveUser, task.departmentId);

  return (
    <AppShell user={user}>
      <div className="max-w-full xl:max-w-6xl mx-auto w-full">
        <TaskWorkspaceView
          task={enrichedTask}
          currentUserId={user.id}
          canReview={canReview}
          canApprove={canApprove}
          canSubmit={canSubmit}
          canComment={canComment}
          canEdit={canEdit}
          canDelete={canDelete}
          categories={categories}
          teamMembers={teamMembers}
        />
      </div>
    </AppShell>
  );
}
