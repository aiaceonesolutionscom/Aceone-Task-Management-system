"use client";

import React, { useState, useMemo } from "react";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/server/actions/categories";
import { toast } from "sonner";
import {
  Plus,
  FolderTree,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  Search,
  AlertTriangle,
} from "lucide-react";

export function CategoryManager({ categories }: { categories: any[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: any) => {
    setEditingCategory(cat);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      if (editingCategory) {
        formData.set("id", editingCategory.id.toString());
        await updateCategoryAction(formData);
        toast.success("Category updated successfully!");
      } else {
        await createCategoryAction(formData);
        toast.success("Category created successfully!");
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save category");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    setDeleteLoading(true);
    try {
      const res = await deleteCategoryAction(deletingCategory.id);
      if (res.success) {
        toast.success(res.message);
        setDeletingCategory(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete category");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Live Search without Apply button */}
        <div className="relative max-w-sm flex-1">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories by name or code..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Category</span>
        </button>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f9fafb] text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
              <tr>
                <th className="py-2.5 px-4">Name</th>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Daily Report</th>
                <th className="py-2.5 px-3">Approval Req.</th>
                <th className="py-2.5 px-3">Tasks</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400">
                    No categories found.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/60">
                    <td className="py-3 px-4 font-bold text-neutral-900">
                      {c.name}
                      {c.description && (
                        <p className="text-[11px] text-neutral-400 font-normal mt-0.5">
                          {c.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-neutral-600 font-bold">
                      {c.code || "—"}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {c.dailyReportRequired ? (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          Required
                        </span>
                      ) : (
                        <span className="text-neutral-400">Optional</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {c.approvalRequired ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          Required
                        </span>
                      ) : (
                        <span className="text-neutral-400">Not required</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-neutral-700">
                      {c._count?.tasks ?? 0}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCategory(c)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] flex flex-col shadow-xl border border-neutral-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 bg-neutral-50/70 shrink-0">
              <h3 className="text-sm font-bold text-neutral-900">
                {editingCategory ? "Edit Category" : "Create New Category"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">Category Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingCategory?.name || ""}
                    placeholder="e.g. Graphic Design, Sales, Legal..."
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">
                    Category Code (2-5 letters) *
                  </label>
                  <input
                    type="text"
                    name="code"
                    required
                    maxLength={6}
                    defaultValue={editingCategory?.code || ""}
                    placeholder="e.g. DES, SAL, DEV, MKT"
                    className="w-full px-3 py-2 text-xs uppercase font-mono border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                  <p className="text-[10px] text-neutral-400">
                    Used for generating automated employee IDs (e.g. AS1-DES-0001).
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">Description</label>
                  <textarea
                    name="description"
                    rows={2}
                    defaultValue={editingCategory?.description || ""}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                {editingCategory && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-700">Status</label>
                    <select
                      name="status"
                      defaultValue={editingCategory?.status || "ACTIVE"}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 rounded"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="ARCHIVED">ARCHIVED</option>
                    </select>
                  </div>
                )}

                <div className="pt-2 border-t border-neutral-100 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      name="dailyReportRequired"
                      value="true"
                      defaultChecked={editingCategory?.dailyReportRequired || false}
                      className="rounded text-blue-600"
                    />
                    Daily Activity Reporting Required
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      name="approvalRequired"
                      value="true"
                      defaultChecked={editingCategory?.approvalRequired ?? true}
                      className="rounded text-blue-600"
                    />
                    Tasks Require Approval Workflow by Default
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-neutral-100 bg-neutral-50/70 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-semibold rounded hover:bg-neutral-200/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-neutral-900 text-white rounded text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {loading ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-3.5 shadow-xl border border-neutral-200">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-neutral-900">Delete Category</h3>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Are you sure you want to delete category{" "}
              <strong className="text-neutral-900 font-semibold">{deletingCategory.name}</strong>?
            </p>

            {deletingCategory._count?.tasks > 0 && (
              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                Notice: This category has{" "}
                <strong>{deletingCategory._count.tasks} existing tasks</strong>. It will be safely
                moved to <strong>ARCHIVED</strong> status to prevent data loss.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeletingCategory(null)}
                className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDelete}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs"
              >
                {deleteLoading ? "Processing..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
