"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTaskAction,
  submitVersionAction,
  requestChangesAction,
  approveTaskAction,
  addCommentAction,
  deleteTaskAction,
} from "@/server/actions/tasks";
import { deleteFileAction } from "@/server/actions/files";
import { TaskEditModal } from "./task-edit-modal";
import { ImageAnnotationViewer } from "./image-annotation-viewer";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/audio-chime";
import { formatTime12, formatDateTime12, formatDueTime, formatShortDateTime12 } from "@/lib/date-utils";
import {
  FileText,
  Paperclip,
  GitBranch,
  MessageSquare,
  History,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Plus,
  ExternalLink,
  Download,
  Calendar,
  Clock,
  Send,
  User,
  Check,
  CheckCheck,
  ArrowLeft,
  X,
  Play,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";

export function TaskWorkspaceView({
  task,
  currentUserId,
  canReview,
  canApprove,
  canSubmit,
  canComment,
  canEdit = false,
  canDelete = false,
  categories = [],
  teamMembers = [],
}: {
  task: any;
  currentUserId: number;
  canReview?: boolean;
  canApprove: boolean;
  canSubmit: boolean;
  canComment: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  categories?: Array<{ id: number; name: string; code?: string | null }>;
  teamMembers?: Array<any>;
}) {
  const router = useRouter();
  const isReviewer = Boolean(canReview ?? canApprove);
  const [activeTab, setActiveTab] = useState<"overview" | "versions" | "reviewer" | "comments" | "activity">("overview");

  // Modals state
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteTaskConfirmOpen, setDeleteTaskConfirmOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: number; fileName: string } | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);
  const [loading, setLoading] = useState(false);

  // Selected image for annotation
  const latestVersion = task.versions[0];

  // Strictly filter task creation reference materials (exclude version submissions)
  const referenceMaterials = useMemo(() => {
    return (task.attachments || []).filter(
      (att: any) => att.isReference !== false && !att.versionId
    );
  }, [task.attachments]);

  const submissionImages = latestVersion?.attachments?.filter((a: any) =>
    a.mimeType.startsWith("image/")
  ) || [];
  const [selectedImageId, setSelectedImageId] = useState<number | null>(
    submissionImages[0]?.id || null
  );

  const selectedImage = submissionImages.find((img: any) => img.id === selectedImageId);

  // New version submission form state
  const [submissionComment, setSubmissionComment] = useState("");
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [submissionLinks, setSubmissionLinks] = useState<Array<{ displayName: string; url: string }>>([]);

  // Change request state
  const [changeNotes, setChangeNotes] = useState("");

  // Approval state
  const [approvalComment, setApprovalComment] = useState("");

  // Comment state
  const [commentBody, setCommentBody] = useState("");
  const [liveComments, setLiveComments] = useState<any[]>(task.comments || []);
  const lastCountRef = useRef<number>((task.comments || []).length);
  const initialFetchDone = useRef<boolean>(false);

  const handleAddSubmissionLink = () => {
    if (!linkUrl.trim()) return;
    setSubmissionLinks([
      ...submissionLinks,
      { displayName: linkTitle.trim() || linkUrl.trim(), url: linkUrl.trim() },
    ]);
    setLinkTitle("");
    setLinkUrl("");
  };

  const handleVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionFiles.length === 0 && submissionLinks.length === 0 && !submissionComment.trim()) {
      toast.error("Please attach files, links, or a message.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Uploading deliverable version...", {
      description: "Processing attachments and notifying reviewers...",
    });

    try {
      const formData = new FormData();
      formData.set("taskId", task.id.toString());
      formData.set("comment", submissionComment);
      if (submissionLinks.length > 0) {
        formData.set("links", JSON.stringify(submissionLinks));
      }
      submissionFiles.forEach((f) => formData.append("files", f));

      await submitVersionAction(formData);
      toast.success(`Deliverable Version ${((latestVersion?.versionNumber || 0) + 1)} submitted successfully!`, {
        id: toastId,
        description: "Task is now under review. Department reviewers have been notified.",
        duration: 4000,
      });
      setSubmitModalOpen(false);
      setSubmissionComment("");
      setSubmissionFiles([]);
      setSubmissionLinks([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit version", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeNotes.trim()) {
      toast.error("Please enter the specific changes required.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Submitting revision request...", {
      description: "Recording change notes and notifying assignees...",
    });

    try {
      const formData = new FormData();
      formData.set("taskId", task.id.toString());
      formData.set("versionId", (latestVersion?.id || 0).toString());
      formData.set("notes", changeNotes);

      await requestChangesAction(formData);
      toast.success("Changes requested! Assignees have been alerted.", {
        id: toastId,
        description: "Task status changed to CHANGES_REQUESTED.",
        duration: 4000,
      });
      setChangesModalOpen(false);
      setChangeNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to request changes", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading("Approving task...", {
      description: "Finalizing approval sign-off and updating task status...",
    });

    try {
      const formData = new FormData();
      formData.set("taskId", task.id.toString());
      if (latestVersion) formData.set("versionId", latestVersion.id.toString());
      if (approvalComment) formData.set("comment", approvalComment);

      await approveTaskAction(formData);
      toast.success("Task approved successfully!", {
        id: toastId,
        description: "Status is now APPROVED. Assignees and reviewers notified.",
        duration: 4000,
      });
      setApproveModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to approve task", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleStartWork = async () => {
    setLoading(true);
    const toastId = toast.loading("Updating status to In Progress...", {
      description: "Notifying manager and stakeholders that work has started...",
    });

    try {
      await startTaskAction(task.id);
      toast.success("Task is now In Progress!", {
        id: toastId,
        description: "Status changed to IN_PROGRESS. Stakeholders have been alerted.",
        duration: 4000,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to start task", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async () => {
    setDeletingTask(true);
    try {
      const res = await deleteTaskAction(task.id);
      if (res.success) {
        toast.success(res.message || "Task deleted successfully.");
        router.push("/tasks");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete task.");
    } finally {
      setDeletingTask(false);
      setDeleteTaskConfirmOpen(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    setDeletingFile(true);
    try {
      const res = await deleteFileAction(fileToDelete.id);
      if (res.success) {
        toast.success(res.message || "File deleted successfully.");
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete file.");
    } finally {
      setDeletingFile(false);
      setFileToDelete(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchLatestComments = async () => {
      try {
        const res = await fetch(`/api/chat/${task.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.comments) && isMounted) {
          const fresh = data.comments;
          if (initialFetchDone.current && fresh.length > lastCountRef.current) {
            const lastMsg = fresh[fresh.length - 1];
            if (lastMsg && lastMsg.userId !== currentUserId && lastMsg.user?.id !== currentUserId) {
              playNotificationSound();
              toast.info(`New comment from ${lastMsg.user?.name || "Team Member"}`, {
                description: lastMsg.body,
              });
            }
          }
          lastCountRef.current = fresh.length;
          initialFetchDone.current = true;
          setLiveComments(fresh);
        }
      } catch {
        // Quiet network blip
      }
    };

    fetchLatestComments();
    const interval = setInterval(fetchLatestComments, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [task.id, currentUserId]);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;

    const toastId = toast.loading("Posting message...");
    try {
      const formData = new FormData();
      formData.set("taskId", task.id.toString());
      formData.set("body", commentBody);

      await addCommentAction(formData);
      setCommentBody("");
      toast.success("Message posted to discussion thread!", { id: toastId, duration: 3000 });

      // Fast-sync comments
      const res = await fetch(`/api/chat/${task.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.comments)) {
          setLiveComments(data.comments);
          lastCountRef.current = data.comments.length;
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to post comment", { id: toastId });
    }
  };

  const renderReadReceipt = (c: any) => {
    const isSender = c.userId === currentUserId || c.user?.id === currentUserId;
    if (!isSender) return null;

    const commentTime = new Date(c.createdAt).getTime();

    // 1) Database read receipts from ChatMessageRead
    const readers = (c.reads || []).filter(
      (r: any) => r.userId !== currentUserId
    );
    const hasDbReadReceipt = readers.length > 0;

    // 2) Any other comment by someone else posted after this comment
    const hasSubsequentReplyFromOther = liveComments.some(
      (other: any) =>
        other.userId !== currentUserId &&
        other.user?.id !== currentUserId &&
        new Date(other.createdAt).getTime() > commentTime
    );

    // 3) Any assignee (other than sender) viewed the task after comment time
    const hasAssigneeViewedAfter = task.assignees?.some(
      (a: any) =>
        a.userId !== currentUserId &&
        a.viewedAt &&
        new Date(a.viewedAt).getTime() >= commentTime
    );

    // 4) Task moved to review / changes requested / approved
    const isSeen = hasDbReadReceipt || hasSubsequentReplyFromOther || hasAssigneeViewedAfter;

    if (isSeen) {
      return (
        <span
          title="Seen / Read by recipient (Double blue tick)"
          className="inline-flex items-center text-sky-500 font-bold ml-1.5 transition-colors"
        >
          <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      );
    }

    // 4) Database delivery receipts
    const deliveries = (c.deliveries || []).filter(
      (d: any) => d.userId !== currentUserId
    );
    const isDelivered = deliveries.length > 0;

    if (isDelivered) {
      return (
        <span
          title="Delivered to recipient (Double grey tick)"
          className="inline-flex items-center text-neutral-400 ml-1.5"
        >
          <CheckCheck className="w-3.5 h-3.5 stroke-[2]" />
        </span>
      );
    }

    return (
      <span
        title="Sent to server · Waiting for delivery (Recipient offline)"
        className="inline-flex items-center text-neutral-400 ml-1.5"
      >
        <Check className="w-3.5 h-3.5 stroke-[2.2]" />
      </span>
    );
  };

  const isOverdue =
    task.deadline &&
    new Date(task.deadline).getTime() < Date.now() &&
    !["APPROVED", "COMPLETED"].includes(task.status);

  return (
    <div className="space-y-5">
      {/* Back to Tasks Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors bg-white border border-neutral-200 px-3 py-1.5 rounded-md hover:bg-neutral-50 shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tasks</span>
        </Link>
      </div>

      {/* Workspace Header Card */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-neutral-900 text-white rounded">
                {task.taskCode || `#${task.id}`}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded">
                {task.department.name}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  task.priority === "URGENT"
                    ? "bg-red-100 text-red-800"
                    : task.priority === "HIGH"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {task.priority} Priority
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  task.status === "APPROVED" || task.status === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-800"
                    : task.status === "CHANGES_REQUESTED"
                    ? "bg-rose-100 text-rose-800"
                    : task.status === "UNDER_REVIEW"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {task.status.replace("_", " ")}
              </span>
            </div>

            <h1 className="text-lg md:text-xl font-bold text-neutral-900 tracking-tight">
              {task.title}
            </h1>

            {task.description && (
              <p className="text-xs text-neutral-600 leading-relaxed max-w-3xl">
                {task.description}
              </p>
            )}
          </div>

          {/* Action Buttons for Assignees & Approvers */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {task.status === "APPROVED" || task.status === "COMPLETED" ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs rounded-md shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>Task Approved</span>
                    {task.approvals?.[0]?.approver ? (
                      <span className="text-emerald-800 font-semibold">
                        by {task.approvals[0].approver.name}
                        {task.approvals[0].approver.designation ? ` (${task.approvals[0].approver.designation})` : ""}
                      </span>
                    ) : latestVersion?.reviewer ? (
                      <span className="text-emerald-800 font-semibold">
                        by {latestVersion.reviewer.name}
                      </span>
                    ) : null}
                  </div>
                  {task.approvals?.[0]?.approvedAt && (
                    <span className="text-[10px] text-emerald-600 font-normal block">
                      {formatShortDateTime12(task.approvals[0].approvedAt, false)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Start Work / Resume Work Button for Assignees */}
                {canSubmit && (task.status === "ASSIGNED" || task.status === "VIEWED" || task.status === "CHANGES_REQUESTED") && (
                  <button
                    onClick={handleStartWork}
                    disabled={loading}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{task.status === "CHANGES_REQUESTED" ? "Resume Work" : "Start Working"}</span>
                  </button>
                )}

                {canSubmit && task.status === "IN_PROGRESS" && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-md shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                    <span>In Progress</span>
                  </div>
                )}

                {canSubmit && (
                  <button
                    onClick={() => setSubmitModalOpen(true)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Submit Work {latestVersion ? `(V${latestVersion.versionNumber + 1})` : "(V1)"}</span>
                  </button>
                )}

                {isReviewer && (
                  <button
                    onClick={() => setChangesModalOpen(true)}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Request Changes</span>
                  </button>
                )}
                {canApprove && (
                  <button
                    onClick={() => setApproveModalOpen(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Task</span>
                  </button>
                )}
                {!isReviewer && !canApprove && !canSubmit && (
                  <div className="text-[11px] text-neutral-500 bg-neutral-100/80 px-2.5 py-1.5 rounded border border-neutral-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Reviewer / Manager approval required</span>
                  </div>
                )}
              </>
            )}

            {/* Edit and Delete Task Actions (Permitted Roles & Admin) */}
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="px-3 py-2 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-blue-600" />
                <span>Edit Task</span>
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteTaskConfirmOpen(true)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Delete Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-100 text-xs">
          <div>
            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Assigned By</span>
            <span className="font-semibold text-neutral-900 mt-0.5 block">
              {task.assignor?.name || "CEO"}
              <span className="text-neutral-500 font-normal text-[11px] block">
                {task.assignor?.designation || "Executive"}
              </span>
            </span>
          </div>

          <div>
            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Assigned To</span>
            <div className="mt-0.5 space-y-0.5">
              {task.assignees.map((a: any) => (
                <div key={a.id} className="font-semibold text-neutral-800 text-[11px] flex items-center gap-1">
                  <span>{a.user.name}</span>
                  <span className="text-[10px] font-normal text-neutral-400">({a.status})</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Deadline</span>
            <div className="mt-0.5">
              <span className={`font-semibold ${isOverdue ? "text-red-600 font-bold" : "text-neutral-800"}`}>
                {task.deadline
                  ? new Date(task.deadline).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "No deadline"}
                {task.dueTime ? ` at ${formatDueTime(task.dueTime)}` : ""}
              </span>
              {isOverdue && <span className="text-[10px] text-red-500 block font-bold">OVERDUE</span>}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Approval Mode</span>
            <span className="font-semibold text-neutral-800 mt-0.5 block">
              {task.approvalRequired ? (task.approvalMode === "ANY_ONE" ? "Any One Approver" : "All Required") : "None"}
            </span>
          </div>
        </div>
      </div>

      {/* Prominent Manager Feedback & Change Request Alert */}
      {(latestVersion?.reviewNotes || task.status === "CHANGES_REQUESTED" || task.comments.length > 0) && (
        <div
          className={`p-4 rounded-lg border shadow-2xs space-y-2.5 transition-all ${
            task.status === "CHANGES_REQUESTED"
              ? "bg-rose-50/90 border-rose-300 text-rose-950 ring-1 ring-rose-200"
              : "bg-blue-50/80 border-blue-200 text-blue-950"
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {task.status === "CHANGES_REQUESTED" ? (
                <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
              )}
              <span className="text-xs font-bold uppercase tracking-wider">
                {task.status === "CHANGES_REQUESTED"
                  ? "Action Required: Revisions Requested by Reviewer"
                  : "Latest Manager Message & Feedback"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {task.status === "CHANGES_REQUESTED" && canSubmit && (
                <button
                  onClick={() => setSubmitModalOpen(true)}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Submit Revised Version</span>
                </button>
              )}
              <button
                onClick={() =>
                  setActiveTab(task.status === "CHANGES_REQUESTED" ? "versions" : "comments")
                }
                className="font-semibold underline hover:opacity-80 text-xs cursor-pointer"
              >
                View in {task.status === "CHANGES_REQUESTED" ? "Versions Timeline" : "Discussion"} →
              </button>
            </div>
          </div>

          <div className="bg-white/80 p-3 rounded-md border border-neutral-200/80">
            <p className="text-xs leading-relaxed font-medium text-neutral-800 whitespace-pre-wrap">
              "{latestVersion?.reviewNotes || task.comments[task.comments.length - 1]?.body}"
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-medium">
            <span>
              By{" "}
              <strong className="text-neutral-700">
                {latestVersion?.reviewer?.name ||
                  task.comments[task.comments.length - 1]?.user?.name ||
                  "Reviewer"}
              </strong>
            </span>
            <span>·</span>
            <span>
              {formatDateTime12(
                latestVersion?.reviewedAt ||
                  task.comments[task.comments.length - 1]?.createdAt ||
                  Date.now()
              )}
            </span>
          </div>
        </div>
      )}

      {/* Task Approved & Finalized Banner with Approver Name */}
      {(task.status === "APPROVED" || task.status === "COMPLETED") && (
        <div className="bg-emerald-50/80 border border-emerald-300 rounded-lg p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 block">
                  Task Approved & Finalized
                </span>
                <span className="text-xs text-emerald-800">
                  Decision approved by{" "}
                  <strong className="font-bold text-emerald-950">
                    {task.approvals?.[0]?.approver?.name || latestVersion?.reviewer?.name || "Super Admin"}
                  </strong>
                  {(task.approvals?.[0]?.approver?.designation || latestVersion?.reviewer?.designation) && (
                    <span> ({task.approvals?.[0]?.approver?.designation || latestVersion?.reviewer?.designation})</span>
                  )}
                  {" · "}
                  {formatShortDateTime12(
                    task.approvals?.[0]?.approvedAt || latestVersion?.reviewedAt || task.updatedAt,
                    true
                  )}
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold">
              ✓ All Requirements Approved
            </span>
          </div>

          {(task.approvals?.[0]?.comment || latestVersion?.reviewNotes) && (
            <div className="bg-white/95 p-3 rounded-md border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">
                Approval Feedback & Sign-Off Notes:
              </span>
              <p className="text-xs leading-relaxed font-medium text-neutral-800 whitespace-pre-wrap">
                "{task.approvals?.[0]?.comment || latestVersion?.reviewNotes}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* Workspace Tabs Navigation */}
      <div className="flex border-b border-neutral-200 gap-1 overflow-x-auto no-scrollbar bg-white px-3 pt-1 rounded-t-lg">
        {[
          { key: "overview", label: "Overview & Instructions", icon: FileText },
          { key: "versions", label: `Submissions & Versions (${task.versions.length})`, icon: GitBranch },
          { key: "reviewer", label: `Image Review & Annotations (${submissionImages.length})`, icon: ShieldCheck },
          { key: "comments", label: `Discussion & Mentions (${task.comments.length})`, icon: MessageSquare },
          { key: "activity", label: `Activity History (${task.activities.length})`, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview & Instructions */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Task Instructions & Guidelines
            </h2>
            {task.instructions ? (
              <div className="p-4 bg-neutral-50 rounded-md border border-neutral-200 font-mono text-xs whitespace-pre-wrap text-neutral-800 leading-relaxed">
                {task.instructions}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">No detailed instructions provided.</p>
            )}
          </div>

          {/* Reference Files & External Links */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Reference Files & Materials (PostgreSQL Storage)
            </h2>

            {referenceMaterials.length === 0 && !task.referenceLinks ? (
              <p className="text-xs text-neutral-400 italic">No references attached to this task.</p>
            ) : (
              <div className="space-y-3">
                {/* File attachments */}
                {referenceMaterials.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {referenceMaterials.map((att: any) => {
                      const isImg = att.mimeType?.startsWith("image/");
                      return (
                        <div
                          key={att.id}
                          className="border border-neutral-200 rounded-lg overflow-hidden bg-white shadow-2xs hover:shadow-xs transition-shadow flex flex-col"
                        >
                          {isImg ? (
                            <a
                              href={`/api/files/${att.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="relative block aspect-video bg-neutral-100 overflow-hidden group"
                            >
                              <img
                                src={`/api/files/${att.id}`}
                                alt={att.fileName}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-semibold gap-1">
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Preview Image</span>
                              </div>
                            </a>
                          ) : (
                            <div className="aspect-video bg-neutral-50 flex flex-col items-center justify-center text-neutral-400 p-4 border-b border-neutral-100">
                              <Paperclip className="w-8 h-8 text-neutral-300 mb-1" />
                              <span className="text-[10px] uppercase font-bold text-neutral-500">
                                {att.fileName.split(".").pop()} File
                              </span>
                            </div>
                          )}

                          <div className="p-2.5 flex items-center justify-between gap-2 text-xs flex-1">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-neutral-900 truncate" title={att.fileName}>
                                {att.fileName}
                              </p>
                              <p className="text-[10px] text-neutral-400">
                                {(att.fileSize / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isImg && (
                                <a
                                  href={`/api/files/${att.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100"
                                  title="Open Full Image"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <a
                                href={`/api/files/${att.id}?download=1`}
                                download={att.fileName}
                                className="p-1 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100"
                                title="Download File"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              {(canDelete || canEdit || att.uploadedById === currentUserId) && (
                                <button
                                  type="button"
                                  onClick={() => setFileToDelete({ id: att.id, fileName: att.fileName })}
                                  className="p-1 text-neutral-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                                  title="Delete File"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* External links */}
                {Array.isArray(task.referenceLinks) && task.referenceLinks.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-semibold text-neutral-600 block">External URLs:</span>
                    {task.referenceLinks.map((link: any, idx: number) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 border border-neutral-200 rounded-md bg-white hover:bg-neutral-50 flex items-center justify-between text-xs text-blue-600 font-semibold"
                      >
                        <span>{link.displayName}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Custom Field Values */}
          {task.fieldValues.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Category Custom Fields
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {task.fieldValues.map((fv: any) => (
                  <div key={fv.id} className="p-2.5 bg-neutral-50 rounded border border-neutral-200">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase block">
                      {fv.customField.fieldName}
                    </span>
                    <span className="font-semibold text-neutral-800 mt-0.5 block">{fv.value || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Team Discussion & Manager Feedback in Overview */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Team Discussion & Reviewer Communication ({task.comments.length})
                </h2>
              </div>
              <button
                onClick={() => setActiveTab("comments")}
                className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Open Full Discussion →
              </button>
            </div>

            {task.comments.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-2">
                No discussion messages yet. Write a message below to communicate directly with your manager.
              </p>
            ) : (
              <div className="space-y-2.5">
                {task.comments.slice(-3).map((c: any) => (
                  <div key={c.id} className="p-3 bg-neutral-50 rounded-md border border-neutral-200 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                        <span>{c.user.name}</span>
                        {c.user.designation && (
                          <span className="text-[10px] text-neutral-500 font-normal">
                            ({c.user.designation})
                          </span>
                        )}
                        {(c.userId === currentUserId || c.user?.id === currentUserId) && (
                          <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1 rounded">
                            You
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 text-neutral-400 text-[10px]">
                        <span>
                          {formatTime12(c.createdAt)}
                        </span>
                        {renderReadReceipt(c)}
                      </div>
                    </div>
                    <p className="text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Comment Input */}
            <form onSubmit={handleSendComment} className="flex gap-2 pt-2 border-t border-neutral-100">
              <input
                type="text"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a message or reply to your manager..."
                className="flex-1 px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              <button
                type="submit"
                disabled={!commentBody.trim()}
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: Version Timeline (V1, V2, V3...) */}
      {activeTab === "versions" && (
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Submission Version History</h2>
                <p className="text-[11px] text-neutral-500">
                  Revisions are preserved under one task. Each version contains original files and review notes.
                </p>
              </div>
              {canSubmit && (
                <button
                  onClick={() => setSubmitModalOpen(true)}
                  className="px-3 py-1.5 bg-neutral-900 text-white rounded text-xs font-semibold hover:bg-neutral-800"
                >
                  New Version
                </button>
              )}
            </div>

            {/* Reference Materials & Assets at Top of Versions */}
            {referenceMaterials.length > 0 && (
              <div className="p-3.5 bg-blue-50/40 border border-blue-200 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                    <h3 className="text-xs font-bold text-neutral-900">
                      Reference Materials & Assets ({referenceMaterials.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-blue-700 font-semibold bg-blue-100 px-2 py-0.5 rounded">
                    Task Creation References
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {referenceMaterials.map((att: any) => {
                    const isImg = att.mimeType?.startsWith("image/");
                    return (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 p-2 bg-white border border-neutral-200 rounded-lg shadow-2xs hover:border-blue-300 transition-colors"
                      >
                        <div className="w-12 h-12 shrink-0 rounded bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center">
                          {isImg ? (
                            <img
                              src={`/api/files/${att.id}`}
                              alt={att.fileName}
                              className="w-12 h-12 object-cover"
                            />
                          ) : (
                            <Paperclip className="w-5 h-5 text-neutral-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-xs font-semibold text-neutral-900 truncate" title={att.fileName}>
                            {att.fileName}
                          </p>
                          <p className="text-[10px] text-neutral-400 font-mono">
                            {(att.fileSize / 1024).toFixed(1)} KB
                          </p>
                          <div className="flex items-center gap-2 pt-0.5">
                            {isImg && (
                              <a
                                href={`/api/files/${att.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
                              >
                                <ExternalLink className="w-3 h-3" /> Preview
                              </a>
                            )}
                            <a
                              href={`/api/files/${att.id}?download=1`}
                              download={att.fileName}
                              className="text-[10px] font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-0.5"
                            >
                              <Download className="w-3 h-3" /> Download
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {task.versions.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                No submissions made yet. Work submitted by assignees will appear here as Version 1.
              </div>
            ) : (
              <div className="space-y-4">
                {task.versions.map((ver: any) => (
                  <div
                    key={ver.id}
                    className="p-4 border border-neutral-200 rounded-lg bg-[#fafbfc] space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-neutral-900 text-white rounded">
                          Version {ver.versionNumber}
                        </span>
                        <span className="text-xs font-semibold text-neutral-800">
                          Submitted by {ver.submitter.name}
                        </span>
                        <span className="text-[11px] text-neutral-500 font-medium">
                          Submitted on {new Date(ver.submittedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })} at {formatTime12(ver.submittedAt)}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          ver.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : ver.status === "CHANGES_REQUESTED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {ver.status.replace("_", " ")}
                      </span>
                    </div>

                    {ver.comment && (
                      <p className="text-xs text-neutral-700 bg-white p-3 rounded-md border border-neutral-200 leading-relaxed">
                        <span className="font-semibold text-neutral-900 block mb-0.5">Submission Notes:</span>
                        "{ver.comment}"
                      </p>
                    )}

                    {/* Review Result Notes for Approved Version */}
                    {ver.status === "APPROVED" && (
                      <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                        <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            Approved by {ver.reviewer?.name || task.approvals?.[0]?.approver?.name || "Super Admin"}
                            {(ver.reviewer?.designation || task.approvals?.[0]?.approver?.designation)
                              ? ` (${ver.reviewer?.designation || task.approvals?.[0]?.approver?.designation})`
                              : ""}
                          </span>
                        </p>
                        {ver.reviewNotes && (
                          <p className="text-emerald-800 leading-relaxed font-medium">"{ver.reviewNotes}"</p>
                        )}
                      </div>
                    )}

                    {/* Review Result Notes when CHANGES_REQUESTED */}
                    {ver.status === "CHANGES_REQUESTED" && ver.reviewNotes && (
                      <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs space-y-1">
                        <p className="font-bold text-rose-800 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Reviewer Feedback ({ver.reviewer?.name || "Reviewer"}):</span>
                        </p>
                        <p className="text-rose-700 leading-relaxed">{ver.reviewNotes}</p>
                      </div>
                    )}

                    {/* Version Deliverables / Files with Image Preview */}
                    {ver.attachments.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-[11px] font-bold text-neutral-700 block">
                          Submitted Files & Deliverables ({ver.attachments.length}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {ver.attachments.map((f: any) => {
                            const isImg = f.mimeType?.startsWith("image/");
                            return (
                              <div
                                key={f.id}
                                className="border border-neutral-200 rounded-lg overflow-hidden bg-white shadow-2xs hover:shadow-xs transition-shadow flex flex-col"
                              >
                                {isImg ? (
                                  <a
                                    href={`/api/files/${f.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="relative block aspect-video bg-neutral-100 overflow-hidden group"
                                  >
                                    <img
                                      src={`/api/files/${f.id}`}
                                      alt={f.fileName}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    />
                                    <div className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-semibold gap-1">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>View Full Image</span>
                                    </div>
                                  </a>
                                ) : (
                                  <div className="aspect-video bg-neutral-50 flex flex-col items-center justify-center text-neutral-400 p-4 border-b border-neutral-100">
                                    <Paperclip className="w-8 h-8 text-neutral-300 mb-1" />
                                    <span className="text-[10px] uppercase font-bold text-neutral-500">
                                      {f.fileName.split(".").pop()} File
                                    </span>
                                  </div>
                                )}

                                <div className="p-2.5 flex items-center justify-between gap-2 text-xs flex-1">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-neutral-900 truncate" title={f.fileName}>
                                      {f.fileName}
                                    </p>
                                    <p className="text-[10px] text-neutral-400">
                                      {(f.fileSize / 1024).toFixed(1)} KB
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isImg && (
                                      <a
                                        href={`/api/files/${f.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100"
                                        title="Open Full Image"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                    <a
                                      href={`/api/files/${f.id}?download=1`}
                                      download={f.fileName}
                                      className="p-1 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100"
                                      title="Download File"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                    {(canDelete || canEdit || f.uploadedById === currentUserId) && (
                                      <button
                                        type="button"
                                        onClick={() => setFileToDelete({ id: f.id, fileName: f.fileName })}
                                        className="p-1 text-neutral-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                                        title="Delete File"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Direct Reviewer & Approver Actions on this Version */}
                    {ver.status !== "APPROVED" && (isReviewer || canApprove) && (
                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-200/70">
                        {isReviewer && (
                          <button
                            onClick={() => setChangesModalOpen(true)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold rounded shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Request Changes</span>
                          </button>
                        )}
                        {canApprove && (
                          <button
                            onClick={() => setApproveModalOpen(true)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve Version {ver.versionNumber}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Image Review & Annotation Studio */}
      {activeTab === "reviewer" && (
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Image Annotation & Review Studio</h2>
                <p className="text-[11px] text-neutral-500">
                  Mark areas on submitted images with boxes or pins. Annotations remain pixel-perfect across devices.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Image selector */}
                {submissionImages.length > 1 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-neutral-500 font-medium">Select Image:</span>
                    <select
                      value={selectedImageId || ""}
                      onChange={(e) => setSelectedImageId(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-semibold"
                    >
                      {submissionImages.map((img: any) => (
                        <option key={img.id} value={img.id}>
                          {img.fileName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isReviewer && (
                  <button
                    type="button"
                    onClick={() => setChangesModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer ring-1 ring-rose-500"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Save & Request Changes</span>
                  </button>
                )}
              </div>
            </div>

            {selectedImage ? (
              <ImageAnnotationViewer
                attachmentId={selectedImage.id}
                fileName={selectedImage.fileName}
                fileUrl={`/api/files/${selectedImage.id}`}
                taskId={task.id}
                versionId={latestVersion?.id}
                canAnnotate={isReviewer}
              />
            ) : (
              <div className="p-12 text-center text-xs text-neutral-400">
                No images submitted for review yet. When employees submit PNG or JPG images, they can be visually annotated here.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Discussion & Mentions */}
      {activeTab === "comments" && (
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-neutral-900">Task Contextual Discussion</h2>

            {/* Comments Thread */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {liveComments.length === 0 ? (
                <p className="text-xs text-neutral-400 italic py-4">No comments posted yet.</p>
              ) : (
                liveComments.map((c: any) => (
                  <div
                    key={c.id}
                    className={`p-3.5 rounded-lg border text-xs space-y-1.5 transition-colors ${
                      c.userId === currentUserId || c.user?.id === currentUserId
                        ? "bg-blue-50/20 border-blue-200/70"
                        : "bg-neutral-50 border-neutral-200"
                    }`}
                  >
                    <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                      <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                        <span>{c.user.name}</span>
                        {c.user.designation && (
                          <span className="text-[10px] text-neutral-500 font-normal">
                            ({c.user.designation})
                          </span>
                        )}
                        {(c.userId === currentUserId || c.user?.id === currentUserId) && (
                          <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1 rounded">
                            You
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                        <span>{formatTime12(c.createdAt)}</span>
                        {renderReadReceipt(c)}
                      </div>
                    </div>
                    <p className="text-neutral-800 leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))
              )}
            </div>

            {/* Post Comment Input */}
            {canComment && (
              <form onSubmit={handleSendComment} className="flex gap-2 pt-2 border-t border-neutral-100">
                <input
                  type="text"
                  placeholder="Type a comment or mention (@username)..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Activity Log Timeline */}
      {activeTab === "activity" && (
        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-neutral-900">Task Activity History & Audit Trail</h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Complete chronological audit trail showing when actions were performed and by whom.
            </p>
          </div>
          <div className="space-y-3 pt-1">
            {task.activities.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-4">No activity logged yet.</p>
            ) : (
              task.activities.map((act: any) => {
                const actDate = new Date(act.createdAt);
                return (
                  <div key={act.id} className="flex items-start gap-3 text-xs p-2.5 rounded-md hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {act.actor?.name.charAt(0) || "S"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-neutral-900">{act.actor?.name || "System"}</span>
                        {act.actor?.designation && (
                          <span className="text-[10px] text-neutral-400">({act.actor.designation})</span>
                        )}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-semibold">
                          {act.action.replace(".", " ").toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1 font-medium flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        <span>
                          {actDate.toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          at{" "}
                          {formatTime12(actDate)}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal: Submit Work */}
      {submitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-neutral-900">
                Submit Work · Version {((latestVersion?.versionNumber || 0) + 1)}
              </h3>
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              Upload deliverables and provide notes for reviewers. Files are stored securely in PostgreSQL.
            </p>

            <form onSubmit={handleVersionSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Attach Deliverables / Files</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => e.target.files && setSubmissionFiles(Array.from(e.target.files))}
                  className="block w-full text-xs text-neutral-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 hover:file:bg-neutral-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">External Deliverable Link (optional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Title (e.g. Figma, Git commit)"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    className="w-1/3 px-2.5 py-1.5 text-xs border border-neutral-300 rounded"
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs border border-neutral-300 rounded"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubmissionLink}
                    className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold rounded"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Submission Message / Summary</label>
                <textarea
                  rows={3}
                  value={submissionComment}
                  onChange={(e) => setSubmissionComment(e.target.value)}
                  placeholder="Explain what was implemented or changed..."
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50"
                >
                  {loading ? "Submitting..." : "Submit Version"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request Changes */}
      {changesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Request Changes on Submission
              </h3>
              <button
                type="button"
                onClick={() => setChangesModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              Provide specific actionable instructions on what needs to be revised. Assignees will be notified.
            </p>

            <form onSubmit={handleRequestChanges} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Feedback / Required Revisions *</label>
                <textarea
                  rows={4}
                  required
                  value={changeNotes}
                  onChange={(e) => setChangeNotes(e.target.value)}
                  placeholder="e.g. Please increase the padding around the header logo and submit dark mode version..."
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setChangesModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-50"
                >
                  {loading ? "Requesting..." : "Send Change Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Approve Task */}
      {approveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Approve Task Deliverables
              </h3>
              <button
                type="button"
                onClick={() => setApproveModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              Confirm approval for this task. Depending on approval mode, this will mark the task completed.
            </p>

            <form onSubmit={handleApprove} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Approval Comment (optional)</label>
                <textarea
                  rows={2}
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="e.g. Looks great, approved for release."
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setApproveModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? "Approving..." : "Confirm Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Task */}
      {canEdit && (
        <TaskEditModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          task={task}
          categories={categories}
          teamMembers={teamMembers}
        />
      )}

      {/* Confirmation Modal: Delete Task */}
      {deleteTaskConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" /> Confirm Task Deletion
              </h3>
              <button
                type="button"
                onClick={() => setDeleteTaskConfirmOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-neutral-600">
              <p>
                Are you sure you want to permanently delete task{" "}
                <strong className="text-neutral-900">{task.taskCode || `#${task.id}`} - "{task.title}"</strong>?
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Permanent Action
                </p>
                <p>
                  This will permanently delete this task along with all its submitted versions, annotations, uploaded deliverables, comments, and activity history. This action cannot be reversed.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeleteTaskConfirmOpen(false)}
                disabled={deletingTask}
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={deletingTask}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
              >
                {deletingTask && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deletingTask ? "Deleting..." : "Permanently Delete Task"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete File / Attachment */}
      {fileToDelete !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" /> Delete File
              </h3>
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              Are you sure you want to delete <strong className="text-neutral-900">{fileToDelete.fileName}</strong>?
              This will remove the file from storage.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={deletingFile}
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFile}
                disabled={deletingFile}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {deletingFile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deletingFile ? "Deleting..." : "Delete File"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
