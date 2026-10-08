"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  Download,
  RotateCcw,
  User,
  FolderTree,
  Calendar,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Database,
  BarChart2,
} from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

export interface CRMTaskItem {
  id: number;
  taskCode: string | null;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  createdAt: string;
  department: { id: number; name: string; code: string | null };
  assignor: { id: number; name: string } | null;
  assignees: Array<{ user: { id: number; name: string; designation?: string | null } }>;
}

export interface ReportsCRMViewerProps {
  initialTasks: CRMTaskItem[];
  totalTasks: number;
  currentPage: number;
  pageSize: number;
  departments: Array<{ id: number; name: string; code: string | null }>;
  users: Array<{ id: number; name: string; designation?: string | null }>;
  canExport: boolean;
  filterValues: {
    q?: string;
    status?: string;
    priority?: string;
    departmentId?: string;
    assigneeId?: string;
    overdue?: boolean;
  };
}

export function ReportsCRMViewer({
  initialTasks,
  totalTasks,
  currentPage,
  pageSize,
  departments,
  users,
  canExport,
  filterValues,
}: ReportsCRMViewerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(filterValues.q || "");
  const [status, setStatus] = useState(filterValues.status || "");
  const [priority, setPriority] = useState(filterValues.priority || "");
  const [departmentId, setDepartmentId] = useState(filterValues.departmentId || "");
  const [assigneeId, setAssigneeId] = useState(filterValues.assigneeId || "");
  const [overdue, setOverdue] = useState(Boolean(filterValues.overdue));

  const totalPages = Math.ceil(totalTasks / pageSize) || 1;

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (departmentId) params.set("departmentId", departmentId);
    if (assigneeId) params.set("assigneeId", assigneeId);
    if (overdue) params.set("overdue", "true");
    params.set("page", "1"); // Reset to page 1 on filter change

    router.push(`/reports?${params.toString()}`);
  };

  const handleReset = () => {
    setQ("");
    setStatus("");
    setPriority("");
    setDepartmentId("");
    setAssigneeId("");
    setOverdue(false);
    router.push("/reports");
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/reports?${params.toString()}`);
  };

  // Build export URL retaining active filters
  const buildExportUrl = () => {
    const params = new URLSearchParams();
    if (filterValues.q) params.set("q", filterValues.q);
    if (filterValues.status) params.set("status", filterValues.status);
    if (filterValues.priority) params.set("priority", filterValues.priority);
    if (filterValues.departmentId) params.set("departmentId", filterValues.departmentId);
    if (filterValues.assigneeId) params.set("assigneeId", filterValues.assigneeId);
    if (filterValues.overdue) params.set("overdue", "true");
    const qs = params.toString();
    return `/api/reports/export${qs ? `?${qs}` : ""}`;
  };

  const getStatusBadge = (taskStatus: string) => {
    switch (taskStatus) {
      case "APPROVED":
      case "COMPLETED":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Approved</span>;
      case "UNDER_REVIEW":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Under Review</span>;
      case "CHANGES_REQUESTED":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">Changes Req.</span>;
      case "IN_PROGRESS":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">In Progress</span>;
      case "CANCELLED":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700">{taskStatus}</span>;
    }
  };

  const getPriorityBadge = (taskPriority: string) => {
    switch (taskPriority) {
      case "URGENT":
        return <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Urgent</span>;
      case "HIGH":
        return <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">High</span>;
      case "MEDIUM":
        return <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">Medium</span>;
      default:
        return <span className="text-[10px] font-medium text-neutral-600 bg-neutral-50 px-1.5 py-0.5 rounded">Low</span>;
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-2xs overflow-hidden space-y-0">
      {/* CRM Header Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <span>Enterprise CRM &amp; Reports Explorer</span>
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                  {totalTasks} Records
                </span>
              </h2>
              <p className="text-[11px] text-neutral-500">
                Deep structured query engine across tasks, staff assignments, categories, and delivery stages.
              </p>
            </div>
          </div>
        </div>

        {canExport && (
          <a
            href={buildExportUrl()}
            download="aceone-filtered-crm-report.csv"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition-colors self-start md:self-auto cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Filtered CRM ({totalTasks})</span>
          </a>
        )}
      </div>

      {/* CRM Multi-Filter Console */}
      <div className="p-4 bg-neutral-50/70 border-b border-neutral-200">
        <form onSubmit={handleApplyFilter} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, ID, or keywords..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 shadow-2xs"
              />
            </div>

            {/* Category / Department */}
            <div>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-900 shadow-2xs"
              >
                <option value="">All Categories</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.code ? `(${d.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-900 shadow-2xs"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="CHANGES_REQUESTED">Changes Requested</option>
                <option value="APPROVED">Approved</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-900 shadow-2xs"
              >
                <option value="">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Assigned Staff */}
            <div>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-900 shadow-2xs"
              >
                <option value="">All Assignees</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-200/60">
            {/* Quick Overdue Toggle */}
            <label className="flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overdue}
                onChange={(e) => setOverdue(e.target.checked)}
                className="rounded border-neutral-300 text-red-600 focus:ring-red-500 h-3.5 w-3.5"
              />
              <span className="font-semibold text-red-700 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Show Overdue Tasks Only
              </span>
            </label>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition shadow-2xs"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-2xs"
              >
                <Filter className="w-3 h-3" />
                Apply Filters
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* CRM Structured Data Table */}
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left text-xs border-collapse min-w-[750px] md:min-w-full">
          <thead className="bg-[#f9fafb] text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
            <tr>
              <th className="py-2.5 px-4">Task ID</th>
              <th className="py-2.5 px-3">Title &amp; Workflow</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Assigned Team</th>
              <th className="py-2.5 px-3">Priority</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Deadline</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {initialTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-neutral-400">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Database className="w-6 h-6 text-neutral-300" />
                    <p className="text-xs font-semibold text-neutral-600">No CRM records found</p>
                    <p className="text-[11px] text-neutral-400">
                      Try adjusting the search filters above to explore data.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              initialTasks.map((task) => {
                const isOverdue =
                  task.deadline &&
                  new Date(task.deadline) < new Date() &&
                  !["APPROVED", "COMPLETED", "ARCHIVED", "CANCELLED"].includes(task.status);

                return (
                  <tr key={task.id} className="hover:bg-neutral-50/70 transition-colors">
                    {/* Task ID */}
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                      <Link href={`/tasks/${task.id}`} className="hover:underline flex items-center gap-1">
                        <span>{task.taskCode || `#${task.id}`}</span>
                      </Link>
                    </td>

                    {/* Title & Created Date */}
                    <td className="py-3 px-3 max-w-xs">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="font-semibold text-neutral-900 hover:text-blue-600 line-clamp-1"
                      >
                        {task.title}
                      </Link>
                      <span className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        Created {new Date(task.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-neutral-700">
                        <FolderTree className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="font-semibold">{task.department.name}</span>
                      </div>
                    </td>

                    {/* Assignees */}
                    <td className="py-3 px-3">
                      {task.assignees.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {task.assignees.map((a) => (
                            <span
                              key={a.user.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 text-[10px] font-semibold text-neutral-800"
                            >
                              <User className="w-3 h-3 text-neutral-400" />
                              {a.user.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic text-[11px]">Unassigned</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-3 whitespace-nowrap">{getPriorityBadge(task.priority)}</td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">{getStatusBadge(task.status)}</td>

                    {/* Deadline */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {task.deadline ? (
                        <span
                          className={`text-xs font-semibold ${
                            isOverdue ? "text-red-600 flex items-center gap-1" : "text-neutral-600"
                          }`}
                        >
                          {isOverdue && <AlertCircle className="w-3 h-3" />}
                          {new Date(task.deadline).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      ) : (
                        <span className="text-neutral-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 rounded transition shadow-2xs"
                      >
                        <span>Workspace</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalTasks > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalTasks}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
