"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFileAction, deleteFileAction, uploadStandaloneFileAction } from "@/server/actions/files";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  Pencil,
  Trash2,
  Upload,
  X,
  Loader2,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Search,
  AlertTriangle,
} from "lucide-react";

export type StoredFileItem = {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date | string;
  isReference: boolean;
  uploadedById?: number;
  uploadedBy: {
    id: number;
    name: string;
    email: string;
  };
  task?: {
    id: number;
    taskCode: string | null;
    title: string;
  } | null;
};

interface FilesDirectoryTableProps {
  files: StoredFileItem[];
  currentUserId: number;
  canUpload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isSuperAdmin: boolean;
}

export function FilesDirectoryTable({
  files,
  currentUserId,
  canUpload,
  canEdit,
  canDelete,
  isSuperAdmin,
}: FilesDirectoryTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Edit / Rename Modal
  const [editingFile, setEditingFile] = useState<StoredFileItem | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal
  const [fileToDelete, setFileToDelete] = useState<StoredFileItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Upload Modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Filtered files
  const filteredFiles = files.filter((f) => {
    const q = search.toLowerCase();
    return (
      f.fileName.toLowerCase().includes(q) ||
      f.mimeType.toLowerCase().includes(q) ||
      f.uploadedBy.name.toLowerCase().includes(q) ||
      (f.task?.taskCode && f.task.taskCode.toLowerCase().includes(q)) ||
      (f.task?.title && f.task.title.toLowerCase().includes(q))
    );
  });

  const handleOpenEdit = (file: StoredFileItem) => {
    setEditingFile(file);
    setNewFileName(file.fileName);
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile || !newFileName.trim()) return;

    setSavingEdit(true);
    try {
      const res = await updateFileAction(editingFile.id, newFileName.trim());
      if (res.success) {
        toast.success(`File renamed to "${res.fileName}"`);
        setEditingFile(null);
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to rename file.");
    } finally {
      setSavingEdit(false);
    }
  };

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

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("Please select a file to upload.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const res = await uploadStandaloneFileAction(formData);
      if (res.success) {
        toast.success(`File "${res.fileName}" uploaded successfully.`);
        setUploadModalOpen(false);
        setUploadFile(null);
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
      {/* Table Header Bar */}
      <div className="px-5 py-3.5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-neutral-900">Stored Files & Media Directory</h2>
          <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
            {filteredFiles.length} file(s)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 w-40 sm:w-48"
            />
          </div>

          {/* Upload Button */}
          {canUpload && (
            <button
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-900 text-white text-xs font-semibold rounded-md hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>
          )}
        </div>
      </div>

      {filteredFiles.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <FileText className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="text-xs text-neutral-500 font-medium">
            {search ? "No files match your search criteria." : "No files stored in database."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs min-w-[700px] md:min-w-full">
            <thead className="bg-[#f9fafb] text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
              <tr>
                <th className="py-2.5 px-4">Filename</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Associated Task</th>
                <th className="py-2.5 px-3">Uploaded By</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredFiles.map((file) => {
                const isImage = file.mimeType.startsWith("image/");
                const hasEditPerm = isSuperAdmin || canEdit || file.uploadedBy.id === currentUserId;
                const hasDeletePerm = isSuperAdmin || canDelete || file.uploadedBy.id === currentUserId;

                return (
                  <tr key={file.id} className="hover:bg-neutral-50/70 transition-colors group">
                    <td className="py-3 px-4 font-semibold text-neutral-900 max-w-xs truncate">
                      <div className="flex items-center gap-2">
                        {isImage ? (
                          <span className="p-1 rounded bg-blue-50 text-blue-600">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="p-1 rounded bg-neutral-100 text-neutral-600">
                            <Paperclip className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span className="truncate" title={file.fileName}>
                          {file.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-neutral-500 truncate max-w-[120px]">{file.mimeType}</td>
                    <td className="py-3 px-3 font-mono text-neutral-800">
                      {(file.fileSize / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3 px-3 text-neutral-700">
                      {file.task ? (
                        <a
                          href={`/tasks/${file.task.id}`}
                          className="font-mono text-blue-600 font-semibold hover:underline"
                        >
                          {file.task.taskCode || `#${file.task.id}`}
                        </a>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-neutral-600 truncate">{file.uploadedBy.name}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Preview in browser */}
                        <a
                          href={`/api/files/${file.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                          title="Preview in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        {/* Download */}
                        <a
                          href={`/api/files/${file.id}?download=1`}
                          download={file.fileName}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>

                        {/* Edit / Rename */}
                        {hasEditPerm && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(file)}
                            className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                            title="Rename file"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete */}
                        {hasDeletePerm && (
                          <button
                            type="button"
                            onClick={() => setFileToDelete(file)}
                            className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete file"
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
      )}

      {/* Modal: Edit / Rename File */}
      {editingFile !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <Pencil className="w-4 h-4 text-blue-600" /> Rename File
              </h3>
              <button
                type="button"
                onClick={() => setEditingFile(null)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRename} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">File Name</label>
                <input
                  type="text"
                  required
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  disabled={savingEdit}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !newFileName.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete File Confirmation */}
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
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              Are you sure you want to permanently delete <strong className="text-neutral-900">{fileToDelete.fileName}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={deleting}
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleting ? "Deleting..." : "Delete File"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Upload Standalone File */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-neutral-700" /> Upload File to Storage
              </h3>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Choose File</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-neutral-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={uploading}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{uploading ? "Uploading..." : "Upload File"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
