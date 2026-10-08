"use client";

import React, { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { updateTaskAction } from "@/server/actions/tasks";
import { toast } from "sonner";
import {
  X,
  Loader2,
  Calendar,
  Clock,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Trash2,
  Plus,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  FileText,
  RotateCcw,
  Paperclip,
} from "lucide-react";

export interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: {
    id: number;
    taskCode: string | null;
    title: string;
    description: string | null;
    instructions?: string | null;
    departmentId: number;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    deadline: Date | string | null;
    dueTime: string | null;
    approvalRequired?: boolean;
    approvalMode?: "ANY_ONE" | "ALL_REQUIRED" | string | null;
    referenceLinks?: any;
    attachments?: Array<{
      id: number;
      fileName: string;
      mimeType: string;
      fileSize: number;
      isReference?: boolean;
      createdAt?: Date | string;
    }>;
    assignees?: Array<{ userId?: number; user: { id: number; name: string; designation?: string | null } }>;
    reviewers?: Array<{ userId?: number; user: { id: number; name: string; designation?: string | null } }>;
  };
  categories: Array<{ id: number; name: string; code?: string | null }>;
  teamMembers: Array<{
    id: number;
    name: string;
    email?: string;
    designation?: string | null;
    primaryDepartmentId?: number | null;
    role?: { code: string; name: string };
  }>;
}

export function TaskEditModal({
  isOpen,
  onClose,
  task,
  categories,
  teamMembers,
}: TaskEditModalProps) {
  const router = useRouter();
  const fileInputId = useId();

  // Basic Information
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(task.description || "");
  const [instructions, setInstructions] = useState(task.instructions || "");
  const [departmentId, setDepartmentId] = useState<number>(task.departmentId);
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">(task.priority || "MEDIUM");

  // Deadlines
  const initialDeadlineStr = task.deadline
    ? new Date(task.deadline).toISOString().split("T")[0]
    : "";
  const [deadline, setDeadline] = useState(initialDeadlineStr);
  const [dueTime, setDueTime] = useState(task.dueTime || "18:00");

  // Approvals
  const [approvalRequired, setApprovalRequired] = useState(task.approvalRequired !== false);
  const [approvalMode, setApprovalMode] = useState<"ANY_ONE" | "ALL_REQUIRED">(
    task.approvalMode === "ALL_REQUIRED" ? "ALL_REQUIRED" : "ANY_ONE"
  );

  // Assignees & Reviewers
  const initialAssigneeIds = (task.assignees || []).map((a) => a.userId || a.user.id);
  const [assigneeUserIds, setAssigneeUserIds] = useState<number[]>(initialAssigneeIds);

  const initialReviewerIds = (task.reviewers || []).map((r) => r.userId || r.user.id);
  const [reviewerUserIds, setReviewerUserIds] = useState<number[]>(initialReviewerIds);

  // Reference Links
  const parseLinks = (): Array<{ displayName: string; url: string }> => {
    if (!task.referenceLinks) return [];
    if (Array.isArray(task.referenceLinks)) return task.referenceLinks as Array<{ displayName: string; url: string }>;
    try {
      const parsed = typeof task.referenceLinks === "string" ? JSON.parse(task.referenceLinks) : task.referenceLinks;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const [referenceLinks, setReferenceLinks] = useState<Array<{ displayName: string; url: string }>>(parseLinks);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  // Existing Reference Attachments
  const initialAttachments = (task.attachments || []).filter((att) => att.isReference !== false);
  const [existingAttachments, setExistingAttachments] = useState(initialAttachments);
  const [removedAttachments, setRemovedAttachments] = useState<typeof initialAttachments>([]);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([]);

  // New Files to Upload
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const toggleAssignee = (id: number) => {
    setAssigneeUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleReviewer = (id: number) => {
    setReviewerUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;
    setReferenceLinks((prev) => [
      ...prev,
      {
        displayName: newLinkTitle.trim() || newLinkUrl.trim(),
        url: newLinkUrl.trim(),
      },
    ]);
    setNewLinkTitle("");
    setNewLinkUrl("");
  };

  const handleRemoveLink = (index: number) => {
    setReferenceLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingAttachment = (att: (typeof existingAttachments)[0]) => {
    setExistingAttachments((prev) => prev.filter((a) => a.id !== att.id));
    setRemovedAttachments((prev) => [...prev, att]);
    setDeletedAttachmentIds((prev) => [...prev, att.id]);
  };

  const handleRestoreAttachment = (att: (typeof existingAttachments)[0]) => {
    setRemovedAttachments((prev) => prev.filter((a) => a.id !== att.id));
    setExistingAttachments((prev) => [...prev, att]);
    setDeletedAttachmentIds((prev) => prev.filter((id) => id !== att.id));
  };

  const handleNewFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setNewFiles((prev) => [...prev, ...selected]);
    }
  };

  const handleRemoveNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImageFile = (mimeType?: string, fileName?: string) => {
    if (mimeType?.startsWith("image/")) return true;
    const ext = fileName?.split(".").pop()?.toLowerCase();
    return ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a task title.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Saving task changes...", {
      description: "Updating details, attachments, and permissions...",
    });

    try {
      const formData = new FormData();
      formData.set("taskId", task.id.toString());
      formData.set("title", title.trim());
      formData.set("description", description.trim());
      formData.set("instructions", instructions.trim());
      formData.set("departmentId", departmentId.toString());
      formData.set("priority", priority);
      formData.set("deadline", deadline || "");
      formData.set("dueTime", dueTime || "");
      formData.set("approvalRequired", approvalRequired ? "true" : "false");
      formData.set("approvalMode", approvalMode);

      assigneeUserIds.forEach((id) => formData.append("assignees", id.toString()));
      reviewerUserIds.forEach((id) => formData.append("reviewers", id.toString()));

      if (referenceLinks.length > 0) {
        formData.set("referenceLinks", JSON.stringify(referenceLinks));
      } else {
        formData.set("referenceLinks", "[]");
      }

      if (deletedAttachmentIds.length > 0) {
        formData.set("deletedAttachmentIds", JSON.stringify(deletedAttachmentIds));
      }

      newFiles.forEach((file) => {
        formData.append("files", file);
      });

      const res = await updateTaskAction(formData);

      if (res.success) {
        toast.success(res.message || "Task updated successfully!", { id: toastId });
        onClose();
        router.refresh();
      } else {
        toast.error((res as any)?.error || "Failed to update task", { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update task.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                Edit Task <span className="text-blue-600">{task.taskCode || `#${task.id}`}</span>
              </h2>
              <p className="text-[11px] text-neutral-500">
                Update task information, reference pictures, external links, schedule, and team members.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Section 1: Title & Category */}
          <div className="space-y-3 p-4 bg-neutral-50/50 rounded-lg border border-neutral-200/80">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" /> Basic Information
            </h3>

            {/* Title */}
            <div className="space-y-1">
              <label className="font-semibold text-neutral-800">
                Task Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Design Landing Page Banner"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Department & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-800">Department / Category</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {cat.code ? `(${cat.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-800">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            {/* Schedule / Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-800 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" /> Deadline Date
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" /> Due Time
                </label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Description & Guidelines */}
          <div className="space-y-3 p-4 bg-neutral-50/50 rounded-lg border border-neutral-200/80">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-1.5">
              <FileEdit className="w-3.5 h-3.5 text-indigo-600" /> Scope & Guidelines
            </h3>

            {/* Description */}
            <div className="space-y-1">
              <label className="font-semibold text-neutral-800">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of what needs to be done..."
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
              />
            </div>

            {/* Instructions / Deliverables */}
            <div className="space-y-1">
              <label className="font-semibold text-neutral-800">Instructions & Specific Guidelines</label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Important notes, dimension requirements, deliverable formats..."
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
              />
            </div>
          </div>

          {/* Section 3: Reference Pictures & Attachments */}
          <div className="space-y-3 p-4 bg-neutral-50/50 rounded-lg border border-neutral-200/80">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-blue-600" /> Reference Pictures & Attachments
              </h3>
              <span className="text-[11px] text-neutral-500">
                {existingAttachments.length} existing • {newFiles.length} new
              </span>
            </div>

            {/* Existing Attachments Display */}
            {existingAttachments.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-neutral-600">Existing Task Pictures & Files</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {existingAttachments.map((att) => {
                    const isImg = isImageFile(att.mimeType, att.fileName);
                    return (
                      <div
                        key={att.id}
                        className="flex items-center gap-2.5 p-2 bg-white border border-neutral-200 rounded-lg shadow-2xs group hover:border-neutral-300 transition-colors"
                      >
                        {isImg ? (
                          <div className="w-10 h-10 rounded-md overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/files/${att.id}`}
                              alt={att.fileName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-blue-50 text-blue-600 border border-blue-100 shrink-0 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-neutral-900 truncate" title={att.fileName}>
                            {att.fileName}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {formatFileSize(att.fileSize)} • Reference
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveExistingAttachment(att)}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Remove attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Removed Attachments (with undo) */}
            {removedAttachments.length > 0 && (
              <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-lg space-y-1">
                <p className="text-[11px] font-semibold text-rose-800">
                  {removedAttachments.length} file{removedAttachments.length > 1 ? "s" : ""} marked for deletion:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {removedAttachments.map((att) => (
                    <span
                      key={att.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-rose-200 rounded text-[11px] text-rose-700 font-medium"
                    >
                      <span className="line-through max-w-[150px] truncate">{att.fileName}</span>
                      <button
                        type="button"
                        onClick={() => handleRestoreAttachment(att)}
                        className="text-neutral-500 hover:text-neutral-900 flex items-center gap-0.5 ml-1"
                        title="Restore"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Upload New Reference Files Dropzone / Input */}
            <div className="space-y-2 pt-1">
              <label
                htmlFor={fileInputId}
                className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-neutral-300 hover:border-blue-400 hover:bg-blue-50/30 rounded-lg cursor-pointer transition-colors text-neutral-600 hover:text-neutral-900"
              >
                <Upload className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold">
                  Add Pictures or Documents (PNG, JPG, PDF, ZIP, etc.)
                </span>
                <input
                  id={fileInputId}
                  type="file"
                  multiple
                  onChange={handleNewFilesSelect}
                  className="hidden"
                />
              </label>

              {/* Newly Selected Files List */}
              {newFiles.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-neutral-600">New Files to be Uploaded ({newFiles.length})</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {newFiles.map((file, idx) => {
                      const isImg = isImageFile(file.type, file.name);
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 p-2 bg-emerald-50/50 border border-emerald-200 rounded-lg shadow-2xs"
                        >
                          <div className="w-10 h-10 rounded-md overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200 flex items-center justify-center">
                            {isImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FileText className="w-5 h-5 text-emerald-600" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-neutral-900 truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-[10px] text-emerald-700">
                              {formatFileSize(file.size)} • New Upload
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveNewFile(idx)}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: External Reference Links */}
          <div className="space-y-3 p-4 bg-neutral-50/50 rounded-lg border border-neutral-200/80">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" /> External Reference Links
            </h3>

            {/* Input Row */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Title (e.g. Figma Design, Git Branch)"
                value={newLinkTitle}
                onChange={(e) => setNewLinkTitle(e.target.value)}
                className="sm:w-1/3 px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <input
                type="url"
                placeholder="https://..."
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddLink}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-md flex items-center justify-center gap-1 shrink-0 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Link
              </button>
            </div>

            {/* Links List */}
            {referenceLinks.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {referenceLinks.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs p-2 bg-white border border-neutral-200 rounded-md shadow-2xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-semibold text-neutral-800 truncate">{l.displayName}:</span>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-xs"
                      >
                        {l.url}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(i)}
                      className="p-1 text-neutral-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Assignees & Reviewers */}
          <div className="space-y-3 p-4 bg-neutral-50/50 rounded-lg border border-neutral-200/80">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-600" /> Team Assignment & Approvals
            </h3>

            {/* Assignees */}
            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-800 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-neutral-500" /> Assigned Members ({assigneeUserIds.length})
                </span>
              </label>
              <div className="max-h-36 overflow-y-auto border border-neutral-200 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white">
                {teamMembers.map((member) => {
                  const isSelected = assigneeUserIds.includes(member.id);
                  return (
                    <label
                      key={member.id}
                      className={`flex items-center gap-2 p-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50/80 border-blue-200 text-blue-900 font-medium"
                          : "bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAssignee(member.id)}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      <span className="truncate">{member.name}</span>
                      {member.designation && (
                        <span className="text-[10px] text-neutral-400 truncate">({member.designation})</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Reviewers */}
            <div className="space-y-1.5 pt-1">
              <label className="font-semibold text-neutral-800 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-neutral-500" /> Reviewers / Approvers ({reviewerUserIds.length})
                </span>
              </label>
              <div className="max-h-28 overflow-y-auto border border-neutral-200 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white">
                {teamMembers.map((member) => {
                  const isSelected = reviewerUserIds.includes(member.id);
                  return (
                    <label
                      key={member.id}
                      className={`flex items-center gap-2 p-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-purple-50/80 border-purple-200 text-purple-900 font-medium"
                          : "bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleReviewer(member.id)}
                        className="rounded text-purple-600 focus:ring-0"
                      />
                      <span className="truncate">{member.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Approval Workflow Configuration */}
            <div className="pt-2 space-y-2 border-t border-neutral-200">
              <label className="flex items-center gap-2 text-xs cursor-pointer text-neutral-800 font-semibold">
                <input
                  type="checkbox"
                  checked={approvalRequired}
                  onChange={(e) => setApprovalRequired(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                Require manager/reviewer approval before completion
              </label>

              {approvalRequired && (
                <div className="space-y-1 pt-1 pl-6">
                  <label className="text-[11px] font-semibold text-neutral-600">Approval Mode</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      className={`p-2 rounded-md border cursor-pointer text-xs space-y-0.5 ${
                        approvalMode === "ANY_ONE"
                          ? "border-blue-500 bg-blue-50/60 text-blue-900"
                          : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <input
                          type="radio"
                          name="approvalMode"
                          value="ANY_ONE"
                          checked={approvalMode === "ANY_ONE"}
                          onChange={() => setApprovalMode("ANY_ONE")}
                        />
                        Any One Reviewer
                      </div>
                      <p className="text-[10px] text-neutral-500 pl-5">
                        First response (approval or change request) finalizes the workflow.
                      </p>
                    </label>

                    <label
                      className={`p-2 rounded-md border cursor-pointer text-xs space-y-0.5 ${
                        approvalMode === "ALL_REQUIRED"
                          ? "border-blue-500 bg-blue-50/60 text-blue-900"
                          : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <input
                          type="radio"
                          name="approvalMode"
                          value="ALL_REQUIRED"
                          checked={approvalMode === "ALL_REQUIRED"}
                          onChange={() => setApprovalMode("ALL_REQUIRED")}
                        />
                        All Reviewers Required
                      </div>
                      <p className="text-[10px] text-neutral-500 pl-5">
                        Every assigned reviewer must approve before task completes.
                      </p>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/70 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-1.5 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save All Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
