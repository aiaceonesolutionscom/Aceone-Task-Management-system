"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Search, Clock, ArrowRight, X } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

export type OverdueTaskItem = {
  id: number;
  taskCode: string | null;
  title: string;
  department: {
    id?: number;
    name: string;
  };
  assignees: Array<{
    user: {
      id: number;
      name: string;
    };
  }>;
  deadline: string | Date | null;
  priority?: string;
  status?: string;
};

export interface OverdueTasksTableProps {
  tasks: OverdueTaskItem[];
  totalOverdueCount: number;
}

export function OverdueTasksTable({ tasks, totalOverdueCount }: OverdueTasksTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter tasks based on search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase().trim();
    return tasks.filter((t) => {
      const codeMatch = t.taskCode?.toLowerCase().includes(q) || false;
      const idMatch = `#${t.id}`.includes(q);
      const titleMatch = t.title.toLowerCase().includes(q);
      const categoryMatch = t.department.name.toLowerCase().includes(q);
      const assigneeMatch = t.assignees.some((a) => a.user.name.toLowerCase().includes(q));
      return codeMatch || idMatch || titleMatch || categoryMatch || assigneeMatch;
    });
  }, [tasks, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedTasks = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, safeCurrentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const getDaysOverdue = (deadline: string | Date | null) => {
    if (!deadline) return null;
    const d = new Date(deadline).getTime();
    const now = Date.now();
    const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const startItem = filteredTasks.length > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(safeCurrentPage * pageSize, filteredTasks.length);

  return (
    <div className="bg-white border border-red-200 rounded-lg shadow-2xs overflow-hidden">
      {/* Table Header with Title & Live Search */}
      <div className="px-5 py-3.5 bg-red-50/60 border-b border-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-red-100 text-red-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-red-950 uppercase tracking-wide">
              Attention Needed: Overdue Tasks ({totalOverdueCount})
            </h2>
            <p className="text-[11px] text-red-700/80">
              Tasks past deadline that require immediate escalation or completion
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto">
          {/* Quick Filter */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search overdue tasks..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-neutral-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Rows per page */}
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(parseInt(e.target.value, 10))}
            className="px-2 py-1.5 text-xs font-medium bg-white border border-neutral-300 rounded-md text-neutral-700 focus:ring-2 focus:ring-red-500 focus:outline-hidden"
            title="Rows per page"
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={15}>15 / page</option>
            <option value={20}>20 / page</option>
          </select>
        </div>
      </div>

      {/* Overdue Table */}
      <div className="w-full overflow-x-auto no-scrollbar">
        <table className="w-full text-left text-xs min-w-[620px] md:min-w-full">
          <thead className="bg-[#fcf9f9] text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-100">
            <tr>
              <th className="py-2.5 px-4">Task ID</th>
              <th className="py-2.5 px-3">Title</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Assignee</th>
              <th className="py-2.5 px-3">Deadline</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {paginatedTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-neutral-500">
                  {searchQuery ? "No overdue tasks matching your search." : "No overdue tasks found."}
                </td>
              </tr>
            ) : (
              paginatedTasks.map((t) => {
                const daysOverdue = getDaysOverdue(t.deadline);
                return (
                  <tr key={t.id} className="hover:bg-red-50/20 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-blue-600">
                      <Link href={`/tasks/${t.id}`} className="hover:underline">
                        {t.taskCode || `#${t.id}`}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-neutral-900 max-w-[240px] truncate" title={t.title}>
                      {t.title}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600">
                      <span className="inline-block px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[11px]">
                        {t.department.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-700">
                      {t.assignees.length > 0 ? (
                        <span className="font-medium">
                          {t.assignees.map((a) => a.user.name).join(", ")}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-red-600">
                          {t.deadline
                            ? new Date(t.deadline).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </span>
                        {daysOverdue !== null && daysOverdue > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                            +{daysOverdue}d
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Workspace <ArrowRight className="w-3 h-3" />
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
      <div className="px-5 py-3 border-t border-neutral-100 bg-[#fafbfc] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-neutral-500">
          Showing <strong className="text-neutral-800">{startItem}</strong> to{" "}
          <strong className="text-neutral-800">{endItem}</strong> of{" "}
          <strong className="text-neutral-800">{filteredTasks.length}</strong> overdue task{filteredTasks.length !== 1 ? "s" : ""}
          {searchQuery && ` (filtered from ${totalOverdueCount})`}
        </div>

        {totalPages > 1 && (
          <div>
            <Pagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={filteredTasks.length}
              pageSize={pageSize}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
