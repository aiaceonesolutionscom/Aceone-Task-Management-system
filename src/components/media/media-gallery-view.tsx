"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Images,
  Search,
  Filter,
  Download,
  ExternalLink,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileImage,
  ChevronRight,
  ChevronDown,
  FolderTree,
  Calendar,
  User as UserIcon,
  X,
  Maximize2,
  Layers,
  LayoutGrid,
  FileCheck2,
} from "lucide-react";
import { formatShortDateTime12 } from "@/lib/date-utils";
import { Pagination } from "@/components/ui/pagination";

export type MediaAttachment = {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  isReference: boolean;
  createdAt: string | Date;
  versionNumber?: number | null;
  submitterName?: string | null;
  versionStatus?: string | null;
  versionComment?: string | null;
};

export type MediaTaskGroup = {
  id: number;
  taskCode: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  requirements: string | null;
  status: string;
  priority: string;
  department: { id: number; name: string };
  assignor: { id: number; name: string } | null;
  approvedBy?: { name: string; designation?: string | null; approvedAt?: string | null } | null;
  assignees: { id: number; name: string; designation?: string | null }[];
  createdAt: string | Date;
  deadline: string | Date | null;
  attachments: MediaAttachment[];
  versions: {
    versionNumber: number;
    submitterName: string;
    submittedAt: string | Date;
    status: string;
    comment: string | null;
    reviewNotes: string | null;
    attachments: MediaAttachment[];
  }[];
};

export function MediaGalleryView({
  tasks,
  categories,
  currentRole,
  departmentScopeName,
}: {
  tasks: MediaTaskGroup[];
  categories: { id: number; name: string }[];
  currentRole: string;
  departmentScopeName?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedType, setSelectedType] = useState<"ALL" | "DELIVERABLES" | "REFERENCES">("ALL");
  const [datePreset, setDatePreset] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"tasks" | "grid">("tasks");
  const [pageSize, setPageSize] = useState<number>(10);
  const [approvedPage, setApprovedPage] = useState<number>(1);
  const [referencePage, setReferencePage] = useState<number>(1);
  const [changesPage, setChangesPage] = useState<number>(1);
  const [underReviewPage, setUnderReviewPage] = useState<number>(1);
  const SECTION_PAGE_SIZE = 10;

  // Lightbox preview modal state
  const [previewAttachment, setPreviewAttachment] = useState<{
    id: number;
    fileName: string;
    fileSize: number;
    taskTitle: string;
    taskCode: string | null;
    versionInfo?: string;
  } | null>(null);

  // Accordion dropdown state for task cards (collapsible to reduce load)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set());

  const toggleTaskExpand = (taskId: number) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const expandAll = (ids: number[]) => {
    setExpandedTaskIds(new Set(ids));
  };

  const collapseAll = () => {
    setExpandedTaskIds(new Set());
  };

  const isEmployee = currentRole === "employee";

  // Filtering
  const filteredTasks = useMemo(() => {
    return tasks
      .map((task) => {
        // Filter by category (only if not employee)
        if (!isEmployee && selectedCategory && task.department.id.toString() !== selectedCategory) {
          return null;
        }

        // Filter by task status
        if (selectedStatus && task.status !== selectedStatus) {
          return null;
        }

        // Filter by date range or preset
        const taskDate = new Date(task.createdAt);
        if (fromDate) {
          const from = new Date(fromDate);
          from.setHours(0, 0, 0, 0);
          if (taskDate < from) return null;
        }
        if (toDate) {
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999);
          if (taskDate > to) return null;
        }
        if (!fromDate && !toDate && datePreset) {
          const now = new Date();
          if (datePreset === "today") {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (taskDate < start) return null;
          } else if (datePreset === "yesterday") {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (taskDate < start || taskDate >= end) return null;
          } else if (datePreset === "7days") {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (taskDate < sevenDaysAgo) return null;
          } else if (datePreset === "30days") {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (taskDate < thirtyDaysAgo) return null;
          }
        }

        // Filter search query
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          task.title.toLowerCase().includes(q) ||
          (task.taskCode && task.taskCode.toLowerCase().includes(q)) ||
          task.attachments.some((a) => a.fileName.toLowerCase().includes(q)) ||
          task.versions.some((v) => v.attachments.some((a) => a.fileName.toLowerCase().includes(q)));

        if (!matchesQuery) return null;

        // Filter by asset type
        const taskRefAttachments = selectedType === "DELIVERABLES" ? [] : task.attachments;
        const taskVersions = task.versions
          .map((v) => ({
            ...v,
            attachments: selectedType === "REFERENCES" ? [] : v.attachments,
          }))
          .filter((v) => v.attachments.length > 0 || selectedType !== "DELIVERABLES");

        const totalFilteredFiles =
          taskRefAttachments.length +
          taskVersions.reduce((acc, v) => acc + v.attachments.length, 0);

        if (totalFilteredFiles === 0 && (selectedType !== "ALL" || !matchesQuery)) {
          return null;
        }

        return {
          ...task,
          attachments: taskRefAttachments,
          versions: taskVersions,
          totalFiles: totalFilteredFiles,
        };
      })
      .filter(Boolean) as (MediaTaskGroup & { totalFiles: number })[];
  }, [tasks, selectedCategory, selectedStatus, selectedType, searchQuery, datePreset, fromDate, toDate, isEmployee]);

  // State for Assets Grid structure filter
  const [gridStructureFilter, setGridStructureFilter] = useState<"ALL" | "APPROVED" | "REFERENCE" | "CHANGES_REQUESTED" | "UNDER_REVIEW">("ALL");

  // Flat list of individual media assets for Grid View with structured categories
  const allFlatMedia = useMemo(() => {
    const list: {
      attachment: MediaAttachment;
      taskId: number;
      taskCode: string | null;
      taskTitle: string;
      departmentName: string;
      taskStatus: string;
      kind: "REFERENCE" | "DELIVERABLE";
      versionNumber?: number;
      versionStatus?: string | null;
      approved: boolean;
      structureCategory: "APPROVED" | "REFERENCE" | "CHANGES_REQUESTED" | "UNDER_REVIEW";
    }[] = [];

    filteredTasks.forEach((task) => {
      // 1. Reference materials
      task.attachments.forEach((att) => {
        list.push({
          attachment: att,
          taskId: task.id,
          taskCode: task.taskCode,
          taskTitle: task.title,
          departmentName: task.department.name,
          taskStatus: task.status,
          kind: "REFERENCE",
          approved: task.status === "APPROVED",
          structureCategory: "REFERENCE",
        });
      });

      // 2. Deliverable submissions from versions
      task.versions.forEach((ver) => {
        const isVerApproved = ver.status === "APPROVED" || task.status === "APPROVED";
        const isVerChangesRequested = ver.status === "CHANGES_REQUESTED" || task.status === "CHANGES_REQUESTED";

        let structureCategory: "APPROVED" | "REFERENCE" | "CHANGES_REQUESTED" | "UNDER_REVIEW" = "UNDER_REVIEW";
        if (isVerApproved) {
          structureCategory = "APPROVED";
        } else if (isVerChangesRequested) {
          structureCategory = "CHANGES_REQUESTED";
        }

        ver.attachments.forEach((att) => {
          list.push({
            attachment: att,
            taskId: task.id,
            taskCode: task.taskCode,
            taskTitle: task.title,
            departmentName: task.department.name,
            taskStatus: task.status,
            kind: "DELIVERABLE",
            versionNumber: ver.versionNumber,
            versionStatus: ver.status || task.status,
            approved: isVerApproved,
            structureCategory,
          });
        });
      });
    });

    return list;
  }, [filteredTasks]);

  // Grouped assets by structured category
  const structuredAssets = useMemo(() => {
    return {
      APPROVED: allFlatMedia.filter((item) => item.structureCategory === "APPROVED"),
      REFERENCE: allFlatMedia.filter((item) => item.structureCategory === "REFERENCE"),
      CHANGES_REQUESTED: allFlatMedia.filter((item) => item.structureCategory === "CHANGES_REQUESTED"),
      UNDER_REVIEW: allFlatMedia.filter((item) => item.structureCategory === "UNDER_REVIEW"),
    };
  }, [allFlatMedia]);

  const activeGridAssets = useMemo(() => {
    if (gridStructureFilter === "ALL") return allFlatMedia;
    return allFlatMedia.filter((item) => item.structureCategory === gridStructureFilter);
  }, [allFlatMedia, gridStructureFilter]);

  // Reset to page 1 when filters or view settings change
  React.useEffect(() => {
    setCurrentPage(1);
    setApprovedPage(1);
    setReferencePage(1);
    setChangesPage(1);
    setUnderReviewPage(1);
  }, [searchQuery, selectedCategory, selectedStatus, selectedType, datePreset, fromDate, toDate, viewMode, pageSize, gridStructureFilter]);

  // Pagination slice
  const totalTasks = filteredTasks.length;
  const effectivePageSize = viewMode === "tasks" ? pageSize : pageSize * 2;
  const totalItemsCount = viewMode === "tasks" ? totalTasks : activeGridAssets.length;
  const totalPages = Math.max(1, Math.ceil(totalItemsCount / effectivePageSize));

  // Auto-clamp currentPage if it exceeds totalPages
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  const paginatedGridAssets = useMemo(() => {
    const start = (currentPage - 1) * effectivePageSize;
    return activeGridAssets.slice(start, start + effectivePageSize);
  }, [activeGridAssets, currentPage, effectivePageSize]);

  const totalFilteredMediaCount = useMemo(() => {
    return filteredTasks.reduce((acc, t) => acc + (t.totalFiles || 0), 0);
  }, [filteredTasks]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImageMime = (mime: string, fileName: string) => {
    if (mime.startsWith("image/")) return true;
    const ext = fileName.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "avif"].includes(ext || "");
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Media & Asset Directory
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-800 uppercase">
              {isEmployee ? "My Submissions" : departmentScopeName || "Company Assets"}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isEmployee
              ? "All deliverable versions, reference attachments, and files uploaded for your assigned tasks."
              : `Structured task-by-task media archive and deliverable submissions for ${departmentScopeName || "assigned department(s)"}.`}
          </p>
        </div>

        {/* View Mode Toggle: Task Cards vs Dense Asset Grid */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-neutral-100 p-1 rounded-lg border border-neutral-200">
            <button
              type="button"
              onClick={() => setViewMode("tasks")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "tasks"
                  ? "bg-white text-neutral-900 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-neutral-600" />
              <span>Task View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-neutral-900 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-neutral-600" />
              <span>Asset Grid ({totalFilteredMediaCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs space-y-3 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative w-full sm:flex-1 sm:min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, ID (AS1-1001), or filename..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {/* Category Filter — Hidden for Employees */}
          {!isEmployee && categories.length > 1 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 font-medium cursor-pointer shrink-0 sm:min-w-[130px]"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 font-medium cursor-pointer shrink-0 sm:min-w-[125px]"
          >
            <option value="">All Statuses</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="CHANGES_REQUESTED">Changes Requested</option>
            <option value="APPROVED">Approved / Completed</option>
            <option value="IN_PROGRESS">In Progress</option>
          </select>

          {/* Day / Date Preset Filter */}
          <select
            value={datePreset}
            onChange={(e) => {
              setDatePreset(e.target.value);
              setFromDate("");
              setToDate("");
            }}
            className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 font-medium cursor-pointer shrink-0 sm:min-w-[110px]"
          >
            <option value="">All Dates</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>

          {/* Date Range Inputs — Sized cleanly to prevent overflowing */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-1.5 bg-neutral-50 px-2.5 py-1 rounded-md border border-neutral-200 shrink-0">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setDatePreset("");
              }}
              title="From Date"
              className="w-[122px] px-1.5 py-0.5 text-xs bg-white border border-neutral-200 rounded text-neutral-800 font-medium cursor-pointer"
            />
            <span className="text-neutral-400 text-xs font-medium">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setDatePreset("");
              }}
              title="To Date"
              className="w-[122px] px-1.5 py-0.5 text-xs bg-white border border-neutral-200 rounded text-neutral-800 font-medium cursor-pointer"
            />
          </div>
        </div>

        {/* Live Filter Summary & Page Size Control */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500 pt-1 border-t border-neutral-100">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Found <strong>{totalFilteredMediaCount}</strong> media asset(s) across{" "}
              <strong>{totalTasks}</strong> task(s)
            </span>

            {/* Per-Page Selector (only for paginated views) */}
            {viewMode === "tasks" ? (
              <div className="flex items-center gap-1.5 pl-2 border-l border-neutral-200">
                <span className="text-neutral-400 font-medium">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-1.5 py-0.5 text-[11px] bg-neutral-50 border border-neutral-200 rounded font-semibold text-neutral-800 cursor-pointer"
                >
                  <option value={5}>5 tasks per page</option>
                  <option value={10}>10 tasks per page</option>
                  <option value={25}>25 tasks per page</option>
                  <option value={50}>50 tasks per page</option>
                </select>
              </div>
            ) : gridStructureFilter !== "ALL" ? (
              <div className="flex items-center gap-1.5 pl-2 border-l border-neutral-200">
                <span className="text-neutral-400 font-medium">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-1.5 py-0.5 text-[11px] bg-neutral-50 border border-neutral-200 rounded font-semibold text-neutral-800 cursor-pointer"
                >
                  <option value={10}>20 assets per page</option>
                  <option value={25}>50 assets per page</option>
                  <option value={50}>100 assets per page</option>
                </select>
              </div>
            ) : null}
          </div>

          {(searchQuery || selectedCategory || selectedStatus || selectedType !== "ALL" || datePreset || fromDate || toDate) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("");
                setSelectedStatus("");
                setSelectedType("ALL");
                setDatePreset("");
                setFromDate("");
                setToDate("");
              }}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main View Area */}
      {(viewMode === "tasks" ? filteredTasks.length : allFlatMedia.length) === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center">
            <Images className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900">No media assets found</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              {searchQuery || selectedCategory || selectedStatus || selectedType !== "ALL" || datePreset || fromDate || toDate
                ? "No media files match your current filters. Try resetting the filters above."
                : isEmployee
                ? "You haven't uploaded or received images for your assigned tasks yet."
                : "No deliverable images or reference assets have been stored for this department yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {viewMode === "tasks" ? (
            /* TASK-BY-TASK COMPACT MEDIA CARDS WITH DROPDOWN ACCORDION */
            <div className="space-y-4">
              {/* Expand All / Collapse All Quick Toolbar */}
              <div className="flex items-center justify-between px-1 text-xs text-neutral-500">
                <span className="text-[11px]">
                  Showing <strong className="text-neutral-900">{paginatedTasks.length}</strong> task cards · Click dropdown arrow to expand assets & deliverables
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => expandAll(paginatedTasks.map((t) => t.id))}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    Expand All
                  </button>
                  <span className="text-neutral-300">·</span>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:underline cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {paginatedTasks.map((task) => {
                const isExpanded = expandedTaskIds.has(task.id);
                const refAttachments = task.attachments.filter((a) => a.isReference === true && !a.versionNumber);
                const versionCount = task.versions.length;

                return (
                  <div
                    key={task.id}
                    className={`bg-white border rounded-xl shadow-2xs overflow-hidden transition-all ${
                      isExpanded ? "border-neutral-300 ring-1 ring-neutral-200" : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    {/* Task Header Box with Left Dropdown Button */}
                    <div
                      onClick={() => toggleTaskExpand(task.id)}
                      className={`px-4 py-3 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                        isExpanded ? "bg-neutral-50/90" : "bg-neutral-50/40 hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Left Dropdown / Chevron Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskExpand(task.id);
                          }}
                          className="mt-0.5 p-1.5 rounded-lg text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-200 hover:bg-neutral-100 shadow-2xs transition-all shrink-0 cursor-pointer"
                          title={isExpanded ? "Click to collapse task details" : "Click to view references & deliverables"}
                          aria-expanded={isExpanded}
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isExpanded ? "rotate-0 text-neutral-900" : "-rotate-90 text-neutral-500"
                            }`}
                          />
                        </button>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                              {task.taskCode || `#${task.id}`}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 text-neutral-800">
                              {task.department.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                task.status === "APPROVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : task.status === "UNDER_REVIEW"
                                  ? "bg-amber-100 text-amber-800"
                                  : task.status === "CHANGES_REQUESTED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {task.status.replace("_", " ")}
                            </span>
                            {task.approvedBy && (
                              <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Approved by {task.approvedBy.name}
                                {task.approvedBy.designation ? ` (${task.approvedBy.designation})` : ""}
                              </span>
                            )}

                            {/* Summary count pill when collapsed */}
                            {!isExpanded && (
                              <div className="flex items-center gap-1.5 text-[10px]">
                                {refAttachments.length > 0 && (
                                  <span className="bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.2 rounded font-medium">
                                    {refAttachments.length} reference asset{refAttachments.length > 1 ? "s" : ""}
                                  </span>
                                )}
                                {versionCount > 0 && (
                                  <span className="bg-neutral-100 text-neutral-700 border border-neutral-200 px-1.5 py-0.2 rounded font-medium">
                                    {versionCount} deliverable version{versionCount > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <h3 className="text-sm font-bold text-neutral-900 truncate">{task.title}</h3>

                          {/* Assignees & expand prompt */}
                          <div className="flex items-center gap-2 text-[10px] text-neutral-500 pt-0.5">
                            <UserIcon className="w-3 h-3 text-neutral-400" />
                            <span>
                              Assignees:{" "}
                              {task.assignees.length > 0
                                ? task.assignees.map((a) => a.name).join(", ")
                                : "Unassigned"}
                            </span>
                            <span className="text-neutral-300">·</span>
                            <span className="text-blue-600 font-semibold">
                              {isExpanded ? "Click to collapse" : "Click dropdown to show references & deliverables"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Direct Action Link to Task Workspace */}
                      <div className="shrink-0 self-start sm:self-center" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/tasks/${task.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs"
                        >
                          <span>Open Workspace</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Collapsible Dropdown Content Body: References & Deliverable Versions */}
                    {isExpanded && (
                      <div className="p-4 space-y-4 animate-in fade-in-50 duration-150 border-t border-neutral-100">
                        {/* Task Instructions / Brief Details ("Task ki details kia bola tha") */}
                        {(task.instructions || task.description || task.requirements) && (
                          <div className="text-[11px] text-neutral-600 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                            <span className="font-semibold text-neutral-800">
                              Task Brief ({task.assignor ? `Assigned by ${task.assignor.name}` : "Management"}):{" "}
                            </span>
                            <span className="italic text-neutral-700">
                              {task.instructions || task.description || task.requirements}
                            </span>
                          </div>
                        )}

                        {/* 1. REFERENCE MATERIALS & ASSETS FIRST (AT THE TOP) as requested */}
                {(() => {
                  const refAttachments = task.attachments.filter((a) => a.isReference === true && !a.versionNumber);
                  if (refAttachments.length === 0) return null;
                  return (
                    <div className="space-y-2 pb-3 border-b border-neutral-200/80">
                      <div className="flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-neutral-900">
                          Reference Materials & Assets
                        </h4>
                        <span className="text-[10px] text-neutral-400">
                          ({refAttachments.length} attachment{refAttachments.length > 1 ? "s" : ""})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                        {refAttachments.map((att) => {
                        const isImg = isImageMime(att.mimeType, att.fileName);

                        return (
                          <div
                            key={att.id}
                            className="flex items-center gap-2.5 p-2 bg-blue-50/20 border border-blue-100 rounded-lg shadow-2xs hover:border-blue-300 transition-colors"
                          >
                            {/* Strictly sized thumbnail (56x56) */}
                            <div
                              onClick={() =>
                                setPreviewAttachment({
                                  id: att.id,
                                  fileName: att.fileName,
                                  fileSize: att.fileSize,
                                  taskTitle: task.title,
                                  taskCode: task.taskCode,
                                  versionInfo: "Reference Asset",
                                })
                              }
                              className="w-14 h-14 shrink-0 rounded-md bg-neutral-100 border border-neutral-200 overflow-hidden cursor-pointer flex items-center justify-center relative group"
                              title="Click to preview"
                            >
                              {isImg ? (
                                <img
                                  src={`/api/files/${att.id}`}
                                  alt={att.fileName}
                                  loading="lazy"
                                  className="w-14 h-14 object-cover"
                                />
                              ) : (
                                <FileImage className="w-6 h-6 text-neutral-400" />
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Maximize2 className="w-3.5 h-3.5" />
                              </div>
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <p
                                onClick={() =>
                                  setPreviewAttachment({
                                    id: att.id,
                                    fileName: att.fileName,
                                    fileSize: att.fileSize,
                                    taskTitle: task.title,
                                    taskCode: task.taskCode,
                                    versionInfo: "Reference Asset",
                                  })
                                }
                                className="text-xs font-semibold text-neutral-900 truncate cursor-pointer hover:text-blue-600"
                                title={att.fileName}
                              >
                                {att.fileName}
                              </p>
                              <p className="text-[10px] text-neutral-400 font-mono">
                                {formatFileSize(att.fileSize)}
                              </p>
                              <div className="flex items-center gap-2 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewAttachment({
                                      id: att.id,
                                      fileName: att.fileName,
                                      fileSize: att.fileSize,
                                      taskTitle: task.title,
                                      taskCode: task.taskCode,
                                      versionInfo: "Reference Asset",
                                    })
                                  }
                                  className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
                                >
                                  <Eye className="w-3 h-3" /> Preview
                                </button>
                                <span className="text-neutral-300">·</span>
                                <a
                                  href={`/api/files/${att.id}?download=true`}
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
                  );
                })()}

                {/* 2. DELIVERABLE VERSIONS SECOND (BELOW REFERENCE ASSETS) */}
                {task.versions.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Deliverable Versions & Submissions</span>
                    </h4>

                    {task.versions.map((ver) => (
                      <div
                        key={ver.versionNumber}
                        className="border border-neutral-200/90 rounded-lg p-3 bg-neutral-50/30 space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-neutral-200/60">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-neutral-900 text-white font-mono text-[10px] font-bold rounded">
                              V{ver.versionNumber}
                            </span>
                            <span className="font-semibold text-neutral-800 text-[11px]">
                              Submitted by {ver.submitterName}
                            </span>
                            <span suppressHydrationWarning className="text-[10px] text-neutral-400">
                              {formatShortDateTime12(ver.submittedAt, false)}
                            </span>
                          </div>

                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              ver.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : ver.status === "CHANGES_REQUESTED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {ver.status}
                          </span>
                        </div>

                        {ver.comment && (
                          <p className="text-[11px] text-neutral-600 italic">"{ver.comment}"</p>
                        )}

                        {ver.reviewNotes && (
                          <div className="text-[10px] p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                            <strong>Reviewer Feedback:</strong> {ver.reviewNotes}
                          </div>
                        )}

                        {/* COMPACT THUMBNAILS LIST (Controlled 56x56, never huge) */}
                        {ver.attachments.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                            {ver.attachments.map((att) => {
                              const isImg = isImageMime(att.mimeType, att.fileName);

                              return (
                                <div
                                  key={att.id}
                                  className="flex items-center gap-2.5 p-2 bg-white border border-neutral-200 rounded-lg shadow-2xs hover:border-neutral-300 transition-colors"
                                >
                                  {/* Strictly 56x56 Thumbnail */}
                                  <div
                                    onClick={() =>
                                      setPreviewAttachment({
                                        id: att.id,
                                        fileName: att.fileName,
                                        fileSize: att.fileSize,
                                        taskTitle: task.title,
                                        taskCode: task.taskCode,
                                        versionInfo: `Version ${ver.versionNumber} (${ver.submitterName})`,
                                      })
                                    }
                                    className="w-14 h-14 shrink-0 rounded-md bg-neutral-100 border border-neutral-200 overflow-hidden cursor-pointer flex items-center justify-center relative group"
                                    title="Click to preview full image"
                                  >
                                    {isImg ? (
                                      <img
                                        src={`/api/files/${att.id}`}
                                        alt={att.fileName}
                                        loading="lazy"
                                        className="w-14 h-14 object-cover"
                                      />
                                    ) : (
                                      <FileImage className="w-6 h-6 text-neutral-400" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                      <Maximize2 className="w-3.5 h-3.5" />
                                    </div>
                                  </div>

                                  {/* File details & actions */}
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <p
                                      onClick={() =>
                                        setPreviewAttachment({
                                          id: att.id,
                                          fileName: att.fileName,
                                          fileSize: att.fileSize,
                                          taskTitle: task.title,
                                          taskCode: task.taskCode,
                                          versionInfo: `Version ${ver.versionNumber}`,
                                        })
                                      }
                                      className="text-xs font-semibold text-neutral-900 truncate cursor-pointer hover:text-blue-600"
                                      title={att.fileName}
                                    >
                                      {att.fileName}
                                    </p>
                                    <p className="text-[10px] text-neutral-400 font-mono">
                                      {formatFileSize(att.fileSize)}
                                    </p>
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewAttachment({
                                            id: att.id,
                                            fileName: att.fileName,
                                            fileSize: att.fileSize,
                                            taskTitle: task.title,
                                            taskCode: task.taskCode,
                                            versionInfo: `Version ${ver.versionNumber}`,
                                          })
                                        }
                                        className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
                                      >
                                        <Eye className="w-3 h-3" /> Preview
                                      </button>
                                      <span className="text-neutral-300">·</span>
                                      <a
                                        href={`/api/files/${att.id}?download=true`}
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
                        ) : (
                          <p className="text-[10px] text-neutral-400 italic">No files attached to this version.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
          ) : (
            /* STRUCTURED ASSET GRID VIEW */
            <div className="space-y-6">
              {/* Structure Filter Tabs Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-neutral-700" />
                  <span className="text-xs font-bold text-neutral-900">
                    Asset Structure:
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => { setGridStructureFilter("ALL"); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      gridStructureFilter === "ALL"
                        ? "bg-neutral-900 text-white border-neutral-900 shadow-2xs"
                        : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                    }`}
                  >
                    All Structured ({allFlatMedia.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => { setGridStructureFilter("APPROVED"); setCurrentPage(1); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      gridStructureFilter === "APPROVED"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : "bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approved ({structuredAssets.APPROVED.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setGridStructureFilter("REFERENCE"); setCurrentPage(1); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      gridStructureFilter === "REFERENCE"
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                        : "bg-blue-50/70 text-blue-800 border-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    <span>References ({structuredAssets.REFERENCE.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setGridStructureFilter("CHANGES_REQUESTED"); setCurrentPage(1); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      gridStructureFilter === "CHANGES_REQUESTED"
                        ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                        : "bg-rose-50/70 text-rose-800 border-rose-200 hover:bg-rose-100"
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Changes Requested ({structuredAssets.CHANGES_REQUESTED.length})</span>
                  </button>

                  {structuredAssets.UNDER_REVIEW.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setGridStructureFilter("UNDER_REVIEW"); setCurrentPage(1); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        gridStructureFilter === "UNDER_REVIEW"
                          ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                          : "bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Under Review ({structuredAssets.UNDER_REVIEW.length})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Structured Sections */}
              {allFlatMedia.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center shadow-2xs space-y-2">
                  <Images className="w-8 h-8 text-neutral-300 mx-auto" />
                  <p className="text-xs font-semibold text-neutral-700">No assets found</p>
                  <p className="text-[11px] text-neutral-400">Try adjusting your filters.</p>
                </div>
              ) : (
                (() => {
                  const sectionsToRender = [
                    {
                      id: "APPROVED",
                      title: "Approved Deliverables & Finished Assets",
                      desc: "Client-ready approved submissions and verified final deliverables",
                      icon: CheckCircle2,
                      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
                      totalCategoryCount: structuredAssets.APPROVED.length,
                      page: approvedPage,
                      setPage: setApprovedPage,
                      totalPages: Math.max(1, Math.ceil(structuredAssets.APPROVED.length / SECTION_PAGE_SIZE)),
                      items: gridStructureFilter === "ALL"
                        ? structuredAssets.APPROVED.slice((approvedPage - 1) * SECTION_PAGE_SIZE, approvedPage * SECTION_PAGE_SIZE)
                        : gridStructureFilter === "APPROVED"
                        ? paginatedGridAssets
                        : [],
                    },
                    {
                      id: "REFERENCE",
                      title: "Reference Materials & Guidelines",
                      desc: "Inspiration files, source briefs, and reference guidelines provided by task assignors",
                      icon: FolderTree,
                      badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
                      totalCategoryCount: structuredAssets.REFERENCE.length,
                      page: referencePage,
                      setPage: setReferencePage,
                      totalPages: Math.max(1, Math.ceil(structuredAssets.REFERENCE.length / SECTION_PAGE_SIZE)),
                      items: gridStructureFilter === "ALL"
                        ? structuredAssets.REFERENCE.slice((referencePage - 1) * SECTION_PAGE_SIZE, referencePage * SECTION_PAGE_SIZE)
                        : gridStructureFilter === "REFERENCE"
                        ? paginatedGridAssets
                        : [],
                    },
                    {
                      id: "CHANGES_REQUESTED",
                      title: "Changes Requested & Revisions",
                      desc: "Deliverable submissions requiring modifications based on manager feedback",
                      icon: AlertCircle,
                      badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
                      totalCategoryCount: structuredAssets.CHANGES_REQUESTED.length,
                      page: changesPage,
                      setPage: setChangesPage,
                      totalPages: Math.max(1, Math.ceil(structuredAssets.CHANGES_REQUESTED.length / SECTION_PAGE_SIZE)),
                      items: gridStructureFilter === "ALL"
                        ? structuredAssets.CHANGES_REQUESTED.slice((changesPage - 1) * SECTION_PAGE_SIZE, changesPage * SECTION_PAGE_SIZE)
                        : gridStructureFilter === "CHANGES_REQUESTED"
                        ? paginatedGridAssets
                        : [],
                    },
                    {
                      id: "UNDER_REVIEW",
                      title: "Under Review / Active Submissions",
                      desc: "Recent deliverable versions currently awaiting feedback or review",
                      icon: Clock,
                      badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
                      totalCategoryCount: structuredAssets.UNDER_REVIEW.length,
                      page: underReviewPage,
                      setPage: setUnderReviewPage,
                      totalPages: Math.max(1, Math.ceil(structuredAssets.UNDER_REVIEW.length / SECTION_PAGE_SIZE)),
                      items: gridStructureFilter === "ALL"
                        ? structuredAssets.UNDER_REVIEW.slice((underReviewPage - 1) * SECTION_PAGE_SIZE, underReviewPage * SECTION_PAGE_SIZE)
                        : gridStructureFilter === "UNDER_REVIEW"
                        ? paginatedGridAssets
                        : [],
                    },
                  ].filter((sec) => sec.totalCategoryCount > 0);

                  if (sectionsToRender.length === 0) {
                    const filterNameMap: Record<string, string> = {
                      CHANGES_REQUESTED: "Changes Requested",
                      UNDER_REVIEW: "Under Review",
                      APPROVED: "Approved Deliverables",
                      REFERENCE: "Reference Materials",
                    };
                    const label = filterNameMap[gridStructureFilter] || gridStructureFilter;

                    return (
                      <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center shadow-2xs space-y-3">
                        <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center">
                          <Images className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-900">
                            No assets in &quot;{label}&quot;
                          </p>
                          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                            No deliverable images or reference assets match this filter category.
                          </p>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setGridStructureFilter("ALL");
                              setCurrentPage(1);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                          >
                            <span>Back to All Structured ({allFlatMedia.length})</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      {sectionsToRender.map((sec) => (
                        <div
                          key={sec.id}
                          className="bg-white border border-neutral-200 rounded-xl p-4 shadow-2xs space-y-3"
                        >
                          {/* Section Header */}
                          <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`p-1.5 rounded-lg border ${sec.badgeClass}`}>
                                <sec.icon className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="text-xs font-bold text-neutral-900 flex items-center gap-2">
                                  <span>{sec.title}</span>
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded-full border ${sec.badgeClass}`}>
                                    {sec.items.length} {sec.items.length === 1 ? "asset" : "assets"}
                                  </span>
                                </h3>
                                <p className="text-[11px] text-neutral-500 mt-0.5">{sec.desc}</p>
                              </div>
                            </div>
                          </div>

                          {/* Section Assets Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {sec.items.map((item) => {
                              const isImg = isImageMime(item.attachment.mimeType, item.attachment.fileName);

                              return (
                                <div
                                  key={`${item.taskId}-${item.attachment.id}`}
                                  className="group relative bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs hover:shadow-md hover:border-neutral-400 transition-all flex flex-col"
                                >
                                  {/* Square Image / Thumbnail Area */}
                                  <div
                                    onClick={() =>
                                      setPreviewAttachment({
                                        id: item.attachment.id,
                                        fileName: item.attachment.fileName,
                                        fileSize: item.attachment.fileSize,
                                        taskTitle: item.taskTitle,
                                        taskCode: item.taskCode,
                                        versionInfo:
                                          item.kind === "DELIVERABLE"
                                            ? `Version ${item.versionNumber || 1} (${item.structureCategory})`
                                            : "Reference Asset",
                                      })
                                    }
                                    className="aspect-square bg-neutral-100 overflow-hidden cursor-pointer relative flex items-center justify-center"
                                  >
                                    {isImg ? (
                                      <img
                                        src={`/api/files/${item.attachment.id}`}
                                        alt={item.attachment.fileName}
                                        loading="lazy"
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                      />
                                    ) : (
                                      <div className="flex flex-col items-center justify-center p-3 text-neutral-400">
                                        <FileImage className="w-8 h-8 text-neutral-400" />
                                        <span className="text-[10px] uppercase font-mono mt-1 font-bold text-neutral-500">
                                          {item.attachment.fileName.split(".").pop()}
                                        </span>
                                      </div>
                                    )}

                                    {/* Top Badges */}
                                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs ${
                                          item.kind === "REFERENCE"
                                            ? "bg-blue-600/90 text-white"
                                            : "bg-purple-600/90 text-white"
                                        }`}
                                      >
                                        {item.kind === "REFERENCE" ? "REF" : `V${item.versionNumber || 1}`}
                                      </span>

                                      {item.structureCategory === "APPROVED" ? (
                                        <span className="bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                                          <CheckCircle2 className="w-2.5 h-2.5" />
                                          Approved
                                        </span>
                                      ) : item.structureCategory === "CHANGES_REQUESTED" ? (
                                        <span className="bg-rose-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                                          <AlertCircle className="w-2.5 h-2.5" />
                                          Revision
                                        </span>
                                      ) : item.structureCategory === "UNDER_REVIEW" ? (
                                        <span className="bg-amber-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                                          <Clock className="w-2.5 h-2.5" />
                                          Review
                                        </span>
                                      ) : (
                                        <span className="bg-blue-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                          Reference
                                        </span>
                                      )}
                                    </div>

                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-2">
                                      <button
                                        type="button"
                                        title="Preview in full size"
                                        className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-xs transition-colors cursor-pointer"
                                      >
                                        <Maximize2 className="w-4 h-4" />
                                      </button>
                                      <a
                                        href={`/api/files/${item.attachment.id}?download=true`}
                                        download={item.attachment.fileName}
                                        onClick={(e) => e.stopPropagation()}
                                        title="Direct Download"
                                        className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-xs transition-colors cursor-pointer"
                                      >
                                        <Download className="w-4 h-4" />
                                      </a>
                                    </div>
                                  </div>

                                  {/* Info Footer */}
                                  <div className="p-2 space-y-1 bg-white flex-1 flex flex-col justify-between">
                                    <div>
                                      <p
                                        className="text-xs font-semibold text-neutral-900 truncate hover:text-blue-600 cursor-pointer"
                                        title={item.attachment.fileName}
                                        onClick={() =>
                                          setPreviewAttachment({
                                            id: item.attachment.id,
                                            fileName: item.attachment.fileName,
                                            fileSize: item.attachment.fileSize,
                                            taskTitle: item.taskTitle,
                                            taskCode: item.taskCode,
                                            versionInfo:
                                              item.kind === "DELIVERABLE"
                                                ? `Version ${item.versionNumber || 1} (${item.structureCategory})`
                                                : "Reference Asset",
                                          })
                                        }
                                      >
                                        {item.attachment.fileName}
                                      </p>
                                      <p className="text-[10px] text-neutral-400 font-mono">
                                        {formatFileSize(item.attachment.fileSize)}
                                      </p>
                                    </div>

                                    <div className="pt-1 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-500">
                                      <span className="font-mono font-bold text-neutral-700 truncate max-w-[80px]" title={item.taskCode || `#${item.taskId}`}>
                                        {item.taskCode || `#${item.taskId}`}
                                      </span>
                                      <Link
                                        href={`/tasks/${item.taskId}`}
                                        className="text-blue-600 hover:underline flex items-center gap-0.5 font-medium"
                                        title="Open task workspace"
                                      >
                                        Task <ExternalLink className="w-2.5 h-2.5" />
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Section Pagination (For All Structured view when section has more than 10 items) */}
                          {gridStructureFilter === "ALL" && sec.totalPages > 1 && (
                            <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="text-neutral-500 font-medium">
                                Showing {(sec.page - 1) * SECTION_PAGE_SIZE + 1}–{Math.min(sec.page * SECTION_PAGE_SIZE, sec.totalCategoryCount)} of {sec.totalCategoryCount} items
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={sec.page <= 1}
                                  onClick={() => sec.setPage((p: number) => Math.max(1, p - 1))}
                                  className="px-2.5 py-1 text-xs font-semibold rounded border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  Previous
                                </button>
                                <span className="px-2 text-xs font-bold text-neutral-700">
                                  Page {sec.page} of {sec.totalPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={sec.page >= sec.totalPages}
                                  onClick={() => sec.setPage((p: number) => Math.min(sec.totalPages, p + 1))}
                                  className="px-2.5 py-1 text-xs font-semibold rounded border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Pagination Controls (Only when multiple pages exist) */}
          {((viewMode === "tasks" && totalPages > 1) || (viewMode === "grid" && gridStructureFilter !== "ALL" && totalPages > 1)) && (
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItemsCount}
                pageSize={effectivePageSize}
                onPageChange={(p) => {
                  setCurrentPage(p);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Lightbox Preview Modal (Opens ONLY when clicked) */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-3.5 bg-neutral-900 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-blue-400 font-bold">
                    {previewAttachment.taskCode || "TASK"}
                  </span>
                  <span className="text-xs text-neutral-400">·</span>
                  <h4 className="text-sm font-bold text-white truncate max-w-md">
                    {previewAttachment.taskTitle}
                  </h4>
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {previewAttachment.fileName} ({formatFileSize(previewAttachment.fileSize)})
                  {previewAttachment.versionInfo && ` · ${previewAttachment.versionInfo}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/files/${previewAttachment.id}?download=true`}
                  download={previewAttachment.fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 rounded-md text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image Box */}
            <div className="p-4 flex-1 overflow-auto bg-neutral-950 flex items-center justify-center min-h-[300px]">
              <img
                src={`/api/files/${previewAttachment.id}`}
                alt={previewAttachment.fileName}
                className="max-h-[65vh] max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
