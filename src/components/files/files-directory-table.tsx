"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteFileAction } from "@/server/actions/files";
import { toast } from "sonner";
import {
  FileText,
  Image as ImageIcon,
  Paperclip,
  Search,
  AlertTriangle,
  Download,
  Trash2,
  Eye,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Calendar,
  User as UserIcon,
  X,
  Maximize2,
  ExternalLink,
  Layers,
  FileArchive,
  FileSpreadsheet,
  FileCode,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { formatShortDateTime12 } from "@/lib/date-utils";

export type StoredFileAttachment = {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  isReference: boolean;
  createdAt: string | Date;
  uploadedBy?: {
    id: number;
    name: string;
    email?: string;
  } | null;
};

export type StoredTaskGroup = {
  id: number;
  taskCode: string | null;
  title: string;
  status: string;
  department: {
    id: number;
    name: string;
  };
  assignor?: {
    id: number;
    name: string;
  } | null;
  assignees: {
    id: number;
    name: string;
    designation?: string | null;
  }[];
  createdAt: string | Date;
  referenceFiles: StoredFileAttachment[];
  versions: {
    id?: number;
    versionNumber: number;
    submitterName: string;
    submittedAt: string | Date;
    status: string;
    comment?: string | null;
    attachments: StoredFileAttachment[];
  }[];
  totalFiles: number;
  totalBytes: number;
};

interface FilesDirectoryTableProps {
  tasks: StoredTaskGroup[];
  categories: { id: number; name: string }[];
  currentUserId: number;
  canDelete: boolean;
  isSuperAdmin: boolean;
}

export function FilesDirectoryTable({
  tasks,
  categories,
  currentUserId,
  canDelete,
  isSuperAdmin,
}: FilesDirectoryTableProps) {
  const router = useRouter();

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedFileType, setSelectedFileType] = useState<"ALL" | "IMAGE" | "DOCUMENT">("ALL");

  // Accordion open/close state
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(() => {
    // Expand first 3 tasks by default
    return new Set(tasks.slice(0, 3).map((t) => t.id));
  });

  // Lightbox preview modal
  const [previewFile, setPreviewFile] = useState<{
    id: number;
    fileName: string;
    mimeType: string;
    fileSize: number;
    taskTitle: string;
    taskCode: string | null;
    uploaderName?: string;
  } | null>(null);

  // Delete modal state
  const [fileToDelete, setFileToDelete] = useState<{
    id: number;
    fileName: string;
    fileSize: number;
    taskTitle?: string;
    taskCode?: string | null;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleTask = (taskId: number) => {
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

  const expandAll = () => {
    setExpandedTaskIds(new Set(tasks.map((t) => t.id)));
  };

  const collapseAll = () => {
    setExpandedTaskIds(new Set());
  };

  const isImageMime = (mime: string, fileName: string) => {
    if (mime?.startsWith("image/")) return true;
    const ext = fileName.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "avif"].includes(ext || "");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (mime: string, fileName: string) => {
    if (isImageMime(mime, fileName)) {
      return <ImageIcon className="w-5 h-5 text-blue-500 shrink-0" />;
    }
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["pdf"].includes(ext || "")) {
      return <FileText className="w-5 h-5 text-red-500 shrink-0" />;
    }
    if (["zip", "rar", "tar", "gz", "7z"].includes(ext || "")) {
      return <FileArchive className="w-5 h-5 text-amber-500 shrink-0" />;
    }
    if (["xls", "xlsx", "csv"].includes(ext || "")) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />;
    }
    if (["js", "ts", "html", "css", "json", "py"].includes(ext || "")) {
      return <FileCode className="w-5 h-5 text-purple-500 shrink-0" />;
    }
    return <Paperclip className="w-5 h-5 text-neutral-500 shrink-0" />;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "APPROVED" || s === "COMPLETED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> {s}
        </span>
      );
    }
    if (s === "CHANGES_REQUESTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3" /> REVISION
        </span>
      );
    }
    if (s === "SUBMITTED" || s === "IN_REVIEW") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Clock className="w-3 h-3" /> IN REVIEW
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
        {s}
      </span>
    );
  };

  // Filter tasks and their files
  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return tasks
      .map((task) => {
        // Category filter
        if (selectedCategory && task.department.id.toString() !== selectedCategory) {
          return null;
        }

        const taskMatchesQuery =
          !q ||
          (task.taskCode && task.taskCode.toLowerCase().includes(q)) ||
          task.title.toLowerCase().includes(q) ||
          task.department.name.toLowerCase().includes(q);

        // Filter reference files
        const filteredReferences = task.referenceFiles.filter((f) => {
          if (selectedFileType === "IMAGE" && !isImageMime(f.mimeType, f.fileName)) return false;
          if (selectedFileType === "DOCUMENT" && isImageMime(f.mimeType, f.fileName)) return false;
          if (taskMatchesQuery) return true;
          return (
            f.fileName.toLowerCase().includes(q) ||
            (f.uploadedBy?.name && f.uploadedBy.name.toLowerCase().includes(q))
          );
        });

        // Filter versions and their files
        const filteredVersions = task.versions
          .map((v) => {
            const vFiles = v.attachments.filter((f) => {
              if (selectedFileType === "IMAGE" && !isImageMime(f.mimeType, f.fileName)) return false;
              if (selectedFileType === "DOCUMENT" && isImageMime(f.mimeType, f.fileName)) return false;
              if (taskMatchesQuery) return true;
              return (
                f.fileName.toLowerCase().includes(q) ||
                (v.submitterName && v.submitterName.toLowerCase().includes(q)) ||
                (f.uploadedBy?.name && f.uploadedBy.name.toLowerCase().includes(q))
              );
            });

            return {
              ...v,
              attachments: vFiles,
            };
          })
          .filter((v) => v.attachments.length > 0 || taskMatchesQuery);

        const totalRemainingFiles =
          filteredReferences.length +
          filteredVersions.reduce((acc, v) => acc + v.attachments.length, 0);

        if (totalRemainingFiles === 0 && !taskMatchesQuery) {
          return null;
        }

        return {
          ...task,
          referenceFiles: filteredReferences,
          versions: filteredVersions,
          totalFiles: totalRemainingFiles,
        };
      })
      .filter(Boolean) as StoredTaskGroup[];
  }, [tasks, searchQuery, selectedCategory, selectedFileType]);

  // Handle file deletion
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setDeleting(true);

    try {
      const res = await deleteFileAction(fileToDelete.id);
      if (res.success) {
        toast.success(res.message || "File deleted successfully.");
        setFileToDelete(null);
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete file.");
    } finally {
      setDeleting(false);
    }
  };

  const totalFilesCount = useMemo(() => {
    return filteredTasks.reduce((acc, t) => acc + t.totalFiles, 0);
  }, [filteredTasks]);

  return (
    <div className="space-y-4">
      {/* Search & Filters Controls */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-neutral-700" />
            <h2 className="text-sm font-bold text-neutral-900">Task File Storage & Deliverables</h2>
            <span className="text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
              {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"} &bull; {totalFilesCount} file{totalFilesCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={expandAll}
              className="text-neutral-600 hover:text-neutral-900 font-medium px-2 py-1 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Expand All
            </button>
            <span className="text-neutral-300">|</span>
            <button
              onClick={collapseAll}
              className="text-neutral-600 hover:text-neutral-900 font-medium px-2 py-1 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Filter inputs row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by file, task code, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Department / Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 text-neutral-700"
            >
              <option value="">All Categories & Departments</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* File Type Filter */}
          <div className="relative">
            <select
              value={selectedFileType}
              onChange={(e) => setSelectedFileType(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 text-neutral-700"
            >
              <option value="ALL">All File Types</option>
              <option value="IMAGE">Images Only (PNG, JPG, SVG, WebP)</option>
              <option value="DOCUMENT">Documents & Deliverables Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task Dropdowns / Accordions List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-10 text-center space-y-2">
          <FileText className="w-10 h-10 text-neutral-300 mx-auto" />
          <p className="text-sm font-semibold text-neutral-700">No stored files match your filters.</p>
          <p className="text-xs text-neutral-400">
            Files attached to tasks or submitted during task revisions will appear here grouped by task.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isExpanded = expandedTaskIds.has(task.id);
            const totalTaskSize =
              task.referenceFiles.reduce((acc, f) => acc + f.fileSize, 0) +
              task.versions.reduce(
                (acc, v) => acc + v.attachments.reduce((sub, f) => sub + f.fileSize, 0),
                0
              );

            return (
              <div
                key={task.id}
                className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs transition-shadow hover:shadow-xs"
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleTask(task.id)}
                  className="px-4 py-3 bg-[#fafbfc] border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-2.5 cursor-pointer hover:bg-neutral-50 transition-colors select-none"
                >
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      aria-label="Toggle task dropdown"
                      className="p-1 rounded text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/60 transition-colors shrink-0 mt-0.5 sm:mt-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-neutral-700" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-neutral-500" />
                      )}
                    </button>

                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      {task.taskCode && (
                        <Link
                          href={`/tasks/${task.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0"
                        >
                          {task.taskCode}
                        </Link>
                      )}

                      <span className="font-semibold text-xs sm:text-sm text-neutral-900 truncate">
                        {task.title}
                      </span>

                      <span className="text-[11px] font-medium text-neutral-600 bg-neutral-200/60 px-2 py-0.5 rounded shrink-0">
                        {task.department.name}
                      </span>

                      {getStatusBadge(task.status)}
                    </div>
                  </div>

                  {/* Summary badges */}
                  <div className="flex items-center gap-3 shrink-0 text-xs text-neutral-500 pl-6 md:pl-0">
                    <span className="text-[11px] font-medium bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                      {task.totalFiles} file{task.totalFiles === 1 ? "" : "s"} &bull; {formatFileSize(totalTaskSize)}
                    </span>

                    {task.assignees.length > 0 && (
                      <div className="hidden lg:flex items-center gap-1 text-[11px] text-neutral-500">
                        <UserIcon className="w-3 h-3 text-neutral-400" />
                        <span className="truncate max-w-[150px]">
                          {task.assignees.map((a) => a.name).join(", ")}
                        </span>
                      </div>
                    )}

                    <Link
                      href={`/tasks/${task.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline shrink-0"
                    >
                      <span>Task View</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="p-4 space-y-5 divide-y divide-neutral-100">
                    {/* Reference Files Section */}
                    {task.referenceFiles.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-700">
                          <Paperclip className="w-3.5 h-3.5 text-neutral-500" />
                          <span>Task Reference Materials & Attachments ({task.referenceFiles.length})</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {task.referenceFiles.map((file) => (
                            <FileCard
                              key={file.id}
                              file={file}
                              taskId={task.id}
                              taskCode={task.taskCode}
                              taskTitle={task.title}
                              currentUserId={currentUserId}
                              canDelete={canDelete}
                              isSuperAdmin={isSuperAdmin}
                              isImage={isImageMime(file.mimeType, file.fileName)}
                              fileIcon={getFileIcon(file.mimeType, file.fileName)}
                              formattedSize={formatFileSize(file.fileSize)}
                              onPreview={() =>
                                setPreviewFile({
                                  id: file.id,
                                  fileName: file.fileName,
                                  mimeType: file.mimeType,
                                  fileSize: file.fileSize,
                                  taskTitle: task.title,
                                  taskCode: task.taskCode,
                                  uploaderName: file.uploadedBy?.name,
                                })
                              }
                              onDelete={() =>
                                setFileToDelete({
                                  id: file.id,
                                  fileName: file.fileName,
                                  fileSize: file.fileSize,
                                  taskTitle: task.title,
                                  taskCode: task.taskCode,
                                })
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Versions / Deliverables Submissions Section */}
                    {task.versions.length > 0 && (
                      <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-700">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          <span>Deliverable Submissions & Revisions ({task.versions.length} versions)</span>
                        </div>

                        {task.versions.map((ver) => (
                          <div
                            key={ver.versionNumber}
                            className="bg-[#fcfcfd] border border-neutral-200/80 rounded-md p-3 space-y-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold bg-neutral-900 text-white px-2 py-0.5 rounded">
                                  v{ver.versionNumber}
                                </span>
                                <span className="text-xs font-medium text-neutral-800">
                                  Submitted by {ver.submitterName}
                                </span>
                                <span className="text-[11px] text-neutral-400">
                                  &bull; {formatShortDateTime12(ver.submittedAt)}
                                </span>
                              </div>

                              <div>{getStatusBadge(ver.status)}</div>
                            </div>

                            {ver.comment && (
                              <p className="text-xs text-neutral-600 italic bg-white p-2 rounded border border-neutral-100">
                                &ldquo;{ver.comment}&rdquo;
                              </p>
                            )}

                            {ver.attachments.length === 0 ? (
                              <p className="text-[11px] text-neutral-400 italic">
                                No files attached to this revision.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
                                {ver.attachments.map((file) => (
                                  <FileCard
                                    key={file.id}
                                    file={file}
                                    taskId={task.id}
                                    taskCode={task.taskCode}
                                    taskTitle={task.title}
                                    currentUserId={currentUserId}
                                    canDelete={canDelete}
                                    isSuperAdmin={isSuperAdmin}
                                    isImage={isImageMime(file.mimeType, file.fileName)}
                                    fileIcon={getFileIcon(file.mimeType, file.fileName)}
                                    formattedSize={formatFileSize(file.fileSize)}
                                    onPreview={() =>
                                      setPreviewFile({
                                        id: file.id,
                                        fileName: file.fileName,
                                        mimeType: file.mimeType,
                                        fileSize: file.fileSize,
                                        taskTitle: task.title,
                                        taskCode: task.taskCode,
                                        uploaderName: file.uploadedBy?.name || ver.submitterName,
                                      })
                                    }
                                    onDelete={() =>
                                      setFileToDelete({
                                        id: file.id,
                                        fileName: file.fileName,
                                        fileSize: file.fileSize,
                                        taskTitle: task.title,
                                        taskCode: task.taskCode,
                                      })
                                    }
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {task.referenceFiles.length === 0 && task.versions.length === 0 && (
                      <p className="text-xs text-neutral-400 italic py-2">
                        No active files or deliverables attached to this task.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox / Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  {previewFile.taskCode && (
                    <span className="font-mono text-xs font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      {previewFile.taskCode}
                    </span>
                  )}
                  <h3 className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                    {previewFile.fileName}
                  </h3>
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                  {formatFileSize(previewFile.fileSize)} &bull; {previewFile.mimeType}
                  {previewFile.uploaderName ? ` &bull; Uploaded by ${previewFile.uploaderName}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/files/${previewFile.id}?download=1`}
                  download
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-1 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content view */}
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-neutral-900/90 min-h-[300px]">
              {isImageMime(previewFile.mimeType, previewFile.fileName) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/${previewFile.id}`}
                  alt={previewFile.fileName}
                  className="max-h-[70vh] max-w-full object-contain rounded shadow-lg"
                />
              ) : (
                <div className="text-center space-y-3 p-8 bg-white rounded-lg max-w-md">
                  <FileText className="w-12 h-12 text-blue-600 mx-auto" />
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{previewFile.fileName}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Direct browser preview is not available for this file type.
                    </p>
                  </div>
                  <a
                    href={`/api/files/${previewFile.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in New Tab</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Delete Stored File</h3>
                <p className="text-xs text-neutral-500">
                  This action permanently removes the binary data.
                </p>
              </div>
            </div>

            <div className="bg-neutral-50 p-3 rounded-md border border-neutral-200 text-xs space-y-1">
              <p className="font-semibold text-neutral-900 break-all">{fileToDelete.fileName}</p>
              <p className="text-neutral-500">
                Size: {formatFileSize(fileToDelete.fileSize)}
                {fileToDelete.taskCode ? ` &bull; Task: ${fileToDelete.taskCode}` : ""}
              </p>
            </div>

            <p className="text-xs text-neutral-600">
              Are you sure you want to permanently delete this file? Users will no longer be able to preview or download it.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-semibold rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual file item card
function FileCard({
  file,
  taskId,
  taskCode,
  taskTitle,
  currentUserId,
  canDelete,
  isSuperAdmin,
  isImage,
  fileIcon,
  formattedSize,
  onPreview,
  onDelete,
}: {
  file: StoredFileAttachment;
  taskId: number;
  taskCode: string | null;
  taskTitle: string;
  currentUserId: number;
  canDelete: boolean;
  isSuperAdmin: boolean;
  isImage: boolean;
  fileIcon: React.ReactNode;
  formattedSize: string;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const hasDeletePermission =
    isSuperAdmin || canDelete || (file.uploadedBy && file.uploadedBy.id === currentUserId);

  return (
    <div className="group relative bg-white border border-neutral-200 rounded-lg overflow-hidden hover:border-neutral-300 hover:shadow-xs transition-all flex flex-col justify-between">
      {/* Thumbnail / Preview Area */}
      <div
        onClick={onPreview}
        className="relative bg-neutral-100 h-28 w-full flex items-center justify-center overflow-hidden cursor-pointer select-none"
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${file.id}`}
            alt={file.fileName}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-neutral-400">
            {fileIcon}
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider">
              {file.fileName.split(".").pop() || "FILE"}
            </span>
          </div>
        )}

        {/* Hover overlay with quick preview icon */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <span className="p-1.5 rounded-full bg-white/90 text-neutral-800 shadow hover:bg-white transition-colors">
            <Eye className="w-4 h-4" />
          </span>
        </div>
      </div>

      {/* File Details & Actions Footer */}
      <div className="p-2.5 space-y-1.5 bg-white">
        <div className="flex items-start justify-between gap-1">
          <p
            className="text-xs font-semibold text-neutral-900 truncate flex-1"
            title={file.fileName}
          >
            {file.fileName}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-neutral-400">
          <span className="font-mono text-neutral-600 font-medium">{formattedSize}</span>
          <span className="truncate max-w-[100px]">
            {file.uploadedBy?.name || "Uploaded"}
          </span>
        </div>

        <div className="pt-1.5 border-t border-neutral-100 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button
              onClick={onPreview}
              type="button"
              className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
              title="Preview file"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <a
              href={`/api/files/${file.id}?download=1`}
              download
              className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>

          {hasDeletePermission && (
            <button
              onClick={onDelete}
              type="button"
              className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
              title="Delete this file"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
