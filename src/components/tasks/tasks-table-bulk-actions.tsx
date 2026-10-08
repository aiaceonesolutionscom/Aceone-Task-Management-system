"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  bulkUpdateTaskPriorityAction,
  deleteTaskAction,
  bulkDeleteTasksAction,
} from "@/server/actions/tasks";
import { toast } from "sonner";
import { formatTime12, formatDueTime } from "@/lib/date-utils";
import {
  Check,
  CheckCheck,
  ChevronRight,
  Square,
  CheckSquare,
  Loader2,
  Calendar,
  X,
  AlertCircle,
  AlertTriangle,
  Trash2,
} from "lucide-react";

interface TasksTableWithBulkActionsProps {
  tasks: Array<{
    id: number;
    taskCode: string | null;
    title: string;
    description: string | null;
    startDate: Date | string | null;
    deadline: Date | string | null;
    dueTime: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status: string;
    deliveredAt: Date | string | null;
    firstViewedAt: Date | string | null;
    department: { id: number; name: string };
    assignor: { id: number; name: string; designation: string | null } | null;
    assignees: Array<{ user: { id: number; name: string; designation: string | null } }>;
    versions: Array<{ versionNumber: number }>;
    approvals?: Array<{ approver?: { id: number; name: string; designation: string | null } | null }>;
  }>;
  canManageTasks: boolean;
  canDeleteTasks?: boolean;
  canEditTasks?: boolean;
  isEmployee: boolean;
}

export function TasksTableWithBulkActions({
  tasks,
  canManageTasks,
  canDeleteTasks = false,
  canEditTasks = false,
  isEmployee,
}: TasksTableWithBulkActionsProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingPriority, setLoadingPriority] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<any | null>(null);
  const [deletingSingle, setDeletingSingle] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);

  const canDelete = canDeleteTasks || canManageTasks;

  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    }
  };

  const toggleSelectRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkPriorityChange = async (priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT") => {
    if (selectedIds.size === 0) return;

    setLoadingPriority(priority);
    try {
      const taskIds = Array.from(selectedIds);
      const res = await bulkUpdateTaskPriorityAction(taskIds, priority);
      if (res.success) {
        toast.success(`Successfully updated ${res.count} tasks to ${priority} priority!`);
        setSelectedIds(new Set());
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update priorities.");
    } finally {
      setLoadingPriority(null);
    }
  };

  const handleSingleDelete = async () => {
    if (!taskToDelete) return;
    setDeletingSingle(true);
    try {
      const res = await deleteTaskAction(taskToDelete.id);
      if (res.success) {
        toast.success(res.message || "Task deleted successfully.");
        setTaskToDelete(null);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(taskToDelete.id);
          return next;
        });
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete task.");
    } finally {
      setDeletingSingle(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeletingBulk(true);
    try {
      const taskIds = Array.from(selectedIds);
      const res = await bulkDeleteTasksAction(taskIds);
      if (res.success) {
        toast.success(res.message || `Deleted ${res.count} tasks successfully.`);
        setSelectedIds(new Set());
        setBulkDeleteConfirmOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete tasks.");
    } finally {
      setDeletingBulk(false);
    }
  };

  const now = new Date();

  return (
    <div className="relative">
      {/* Floating Sticky Bulk Actions Bar */}
      {selectedIds.size > 0 && (canManageTasks || canDelete) && (
        <div className="sticky top-2 z-30 mb-3 mx-2 bg-neutral-900 text-white p-3 rounded-xl shadow-lg border border-neutral-800 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-white text-neutral-900 px-2 py-0.5 rounded-full font-mono">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold">
              {selectedIds.size === 1 ? "task selected" : "tasks selected"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mr-1">
              Set Priority:
            </span>
            {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={Boolean(loadingPriority)}
                onClick={() => handleBulkPriorityChange(p)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  p === "URGENT"
                    ? "bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white border border-red-500/40"
                    : p === "HIGH"
                    ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-white border border-amber-500/40"
                    : p === "MEDIUM"
                    ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500 hover:text-white border border-blue-500/40"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white border border-neutral-700"
                }`}
              >
                {loadingPriority === p ? (
                  <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                ) : null}
                {p}
              </button>
            ))}

            {canDelete && (
              <button
                type="button"
                onClick={() => setBulkDeleteConfirmOpen(true)}
                className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-500 transition-colors cursor-pointer flex items-center gap-1 ml-1 shadow-2xs"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="p-1 text-neutral-400 hover:text-white ml-2 rounded hover:bg-neutral-800"
              title="Deselect All"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto no-scrollbar">
        <table className="w-full text-left text-xs border-collapse table-auto min-w-[650px] md:min-w-full">
          <thead>
            <tr className="border-b border-neutral-200 bg-[#f9fafb] text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {canManageTasks && (
                <th className="py-3 px-3 w-8">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-neutral-400 hover:text-neutral-700 cursor-pointer flex items-center"
                    aria-label="Select all"
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
              )}
              <th className="py-3 px-3">Task ID</th>
              <th className="py-3 px-3">Title & Details</th>
              <th className="py-3 px-3 hidden md:table-cell">Category</th>
              <th className="py-3 px-2 hidden sm:table-cell">Priority</th>
              <th className="py-3 px-2">Assignees</th>
              <th className="py-3 px-2 hidden sm:table-cell">Timeline / Due</th>
              <th className="py-3 px-2">Status</th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {tasks.map((task) => {
              const isSelected = selectedIds.has(task.id);
              const isOverdue =
                task.deadline &&
                new Date(task.deadline).getTime() < Date.now() &&
                !["APPROVED", "COMPLETED"].includes(task.status);

              const latestVersion = task.versions?.[0];

              // Check if future scheduled task
              const isFutureScheduled =
                task.startDate && new Date(task.startDate).getTime() > now.getTime();

              return (
                <tr
                  key={task.id}
                  className={`transition-colors group ${
                    isSelected ? "bg-blue-50/50" : "hover:bg-neutral-50/70"
                  }`}
                >
                  {/* Checkbox column */}
                  {canManageTasks && (
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => toggleSelectRow(task.id)}
                        className="text-neutral-400 hover:text-neutral-700 cursor-pointer flex items-center"
                        aria-label={`Select task ${task.taskCode || task.id}`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  )}

                  {/* Task Code + Delivery Badge */}
                  <td className="py-3 px-3 font-mono font-bold text-neutral-900 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Link href={`/tasks/${task.id}`} className="hover:underline text-blue-600">
                        {task.taskCode || `#${task.id}`}
                      </Link>
                      {task.firstViewedAt ? (
                        <span title={`Seen at ${formatTime12(task.firstViewedAt)}`} className="text-blue-600">
                          <CheckCheck className="w-3.5 h-3.5" />
                        </span>
                      ) : task.deliveredAt ? (
                        <span title="Delivered to device" className="text-neutral-400">
                          <CheckCheck className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span title="Sent" className="text-neutral-300">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Title */}
                  <td className="py-3 px-3 max-w-[200px] md:max-w-xs">
                    <Link href={`/tasks/${task.id}`} className="block">
                      <p className="font-semibold text-neutral-900 truncate hover:text-blue-600">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="md:hidden px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 font-medium text-[10px]">
                          {task.department.name}
                        </span>
                        <span className="text-[11px] text-neutral-400 truncate">
                          Assigned by: {task.assignor?.name || "Admin"}
                          {latestVersion ? ` · V${latestVersion.versionNumber}` : ""}
                        </span>
                        {isFutureScheduled && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                            <Calendar className="w-3 h-3" />
                            <span>Unlocks {new Date(task.startDate!).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                          </span>
                        )}
                      </div>
                    </Link>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-3 whitespace-nowrap hidden md:table-cell">
                    <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium text-[11px]">
                      {task.department.name}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="py-3 px-2 whitespace-nowrap hidden sm:table-cell">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        task.priority === "URGENT"
                          ? "bg-red-100 text-red-800"
                          : task.priority === "HIGH"
                          ? "bg-amber-100 text-amber-800"
                          : task.priority === "MEDIUM"
                          ? "bg-blue-50 text-blue-800"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {task.priority}
                    </span>
                  </td>

                  {/* Assignees */}
                  <td className="py-3 px-2 max-w-[120px] truncate">
                    {task.assignees.length > 0 ? (
                      <span
                        className="text-neutral-700 font-medium text-[11px]"
                        title={task.assignees.map((a) => a.user.name).join(", ")}
                      >
                        {task.assignees.map((a) => a.user.name).join(", ")}
                      </span>
                    ) : (
                      <span className="text-neutral-400 italic text-[11px]">None</span>
                    )}
                  </td>

                  {/* Deadline / Scheduled date */}
                  <td className="py-3 px-2 whitespace-nowrap hidden sm:table-cell">
                    {task.deadline ? (
                      <div>
                        <p className={`font-semibold ${isOverdue ? "text-red-600" : "text-neutral-700"}`}>
                          {new Date(task.deadline).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                          {task.dueTime ? ` ${formatDueTime(task.dueTime)}` : ""}
                        </p>
                        {isOverdue && (
                          <span className="text-[10px] font-bold text-red-500 uppercase">
                            Overdue
                          </span>
                        )}
                      </div>
                    ) : task.startDate ? (
                      <span className="text-neutral-600 text-[11px]">
                        Start: {new Date(task.startDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-2 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] inline-block ${
                        task.status === "APPROVED" || task.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : task.status === "CHANGES_REQUESTED"
                          ? "bg-rose-100 text-rose-800"
                          : task.status === "UNDER_REVIEW" || task.status === "SUBMITTED"
                          ? "bg-amber-100 text-amber-800"
                          : task.status === "IN_PROGRESS"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                    {(task.status === "APPROVED" || task.status === "COMPLETED") &&
                      task.approvals?.[0]?.approver && (
                        <span
                          className="block text-[10px] text-emerald-700 font-semibold mt-0.5"
                          title={`Approved by ${task.approvals[0].approver.name}`}
                        >
                          by {task.approvals[0].approver.name}
                        </span>
                      )}
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-neutral-900 group-hover:translate-x-0.5 transition-transform"
                      >
                        Workspace <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setTaskToDelete(task)}
                          className="p-1 text-neutral-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal: Single Task Delete */}
      {taskToDelete !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" /> Confirm Task Deletion
              </h3>
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-neutral-600">
              <p>
                Are you sure you want to permanently delete task{" "}
                <strong className="text-neutral-900">{taskToDelete.taskCode || `#${taskToDelete.id}`} - "{taskToDelete.title}"</strong>?
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Permanent Action
                </p>
                <p>
                  This will delete all submitted versions, annotations, uploaded deliverables, comments, and activity logs associated with this task.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                disabled={deletingSingle}
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSingleDelete}
                disabled={deletingSingle}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
              >
                {deletingSingle && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deletingSingle ? "Deleting..." : "Permanently Delete Task"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Bulk Tasks Delete */}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" /> Confirm Bulk Task Deletion
              </h3>
              <button
                type="button"
                onClick={() => setBulkDeleteConfirmOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-neutral-600">
              <p>
                Are you sure you want to permanently delete{" "}
                <strong className="text-neutral-900">{selectedIds.size} selected tasks</strong>?
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Permanent Bulk Action
                </p>
                <p>
                  This action cannot be undone. All selected tasks, their files, comments, annotations, and histories will be permanently removed.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirmOpen(false)}
                disabled={deletingBulk}
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={deletingBulk}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
              >
                {deletingBulk && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deletingBulk ? "Deleting..." : `Delete ${selectedIds.size} Tasks`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
