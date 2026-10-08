"use client";

import React, { useState } from "react";
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
    assignees?: Array<{ userId?: number; user: { id: number; name: string } }>;
    reviewers?: Array<{ userId?: number; user: { id: number; name: string } }>;
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

  // Initial values
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(task.description || "");
  const [instructions, setInstructions] = useState(task.instructions || "");
  const [departmentId, setDepartmentId] = useState<number>(task.departmentId);
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">(task.priority || "MEDIUM");

  const initialDeadlineStr = task.deadline
    ? new Date(task.deadline).toISOString().split("T")[0]
    : "";
  const [deadline, setDeadline] = useState(initialDeadlineStr);
  const [dueTime, setDueTime] = useState(task.dueTime || "18:00");
  const [approvalRequired, setApprovalRequired] = useState(task.approvalRequired !== false);

  const initialAssigneeIds = (task.assignees || []).map((a) => a.userId || a.user.id);
  const [assigneeUserIds, setAssigneeUserIds] = useState<number[]>(initialAssigneeIds);

  const initialReviewerIds = (task.reviewers || []).map((r) => r.userId || r.user.id);
  const [reviewerUserIds, setReviewerUserIds] = useState<number[]>(initialReviewerIds);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a task title.");
      return;
    }

    setLoading(true);
    try {
      const res = await updateTaskAction({
        taskId: task.id,
        title: title.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        departmentId,
        priority,
        deadline: deadline || null,
        dueTime: dueTime || null,
        approvalRequired,
        assigneeUserIds,
        reviewerUserIds,
      });

      if (res.success) {
        toast.success(res.message || "Task updated successfully!");
        onClose();
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update task.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                Edit Task {task.taskCode ? `(${task.taskCode})` : `#${task.id}`}
              </h2>
              <p className="text-[11px] text-neutral-500">
                Update task title, department, priority, schedule, and team members.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
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
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
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
                    {cat.name}
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
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
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
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-800">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of what needs to be done..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* Instructions / Deliverables */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-800">Instructions & Guidelines</label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Important notes, file requirements, format rules..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* Assignees */}
          <div className="space-y-1.5 pt-1">
            <label className="font-semibold text-neutral-800 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-neutral-500" /> Assigned Members ({assigneeUserIds.length})
              </span>
            </label>
            <div className="max-h-36 overflow-y-auto border border-neutral-200 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-neutral-50/40">
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
            <div className="max-h-28 overflow-y-auto border border-neutral-200 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-neutral-50/40">
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

          {/* Approval toggle */}
          <div className="pt-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer text-neutral-700">
              <input
                type="checkbox"
                checked={approvalRequired}
                onChange={(e) => setApprovalRequired(e.target.checked)}
                className="rounded text-blue-600 focus:ring-0"
              />
              <span className="font-medium">Require manager/reviewer approval before completion</span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
          >
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
