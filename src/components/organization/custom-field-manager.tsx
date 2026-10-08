"use client";

import React, { useState } from "react";
import { createCustomFieldAction } from "@/server/actions/custom-fields";
import { toast } from "sonner";
import { Plus, FileCode2, X } from "lucide-react";

export function CustomFieldManager({
  customFields,
  categories,
}: {
  customFields: any[];
  categories: any[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldType, setFieldType] = useState("TEXT");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      await createCustomFieldAction(formData);
      toast.success("Custom field created successfully!");
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create field");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Custom Field</span>
        </button>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f9fafb] text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
              <tr>
                <th className="py-2.5 px-4">Field Name</th>
                <th className="py-2.5 px-3">Field Key</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Entity</th>
                <th className="py-2.5 px-3">Category Scope</th>
                <th className="py-2.5 px-3">Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {customFields.map((f) => (
                <tr key={f.id} className="hover:bg-neutral-50/60">
                  <td className="py-3 px-4 font-bold text-neutral-900">{f.fieldName}</td>
                  <td className="py-3 px-3 font-mono text-neutral-500">{f.fieldKey}</td>
                  <td className="py-3 px-3 font-semibold text-neutral-700">{f.fieldType}</td>
                  <td className="py-3 px-3">
                    <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-800 rounded font-semibold text-[10px]">
                      {f.entityType}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-neutral-600">
                    {f.department ? f.department.name : "Global (All Categories)"}
                  </td>
                  <td className="py-3 px-3">
                    {f.isRequired ? (
                      <span className="text-red-600 font-bold text-[10px]">Yes</span>
                    ) : (
                      <span className="text-neutral-400">Optional</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-neutral-900">Create Custom Field</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Field Label / Name *</label>
                <input
                  type="text"
                  name="fieldName"
                  required
                  placeholder="e.g. Git Commit URL, Client Name, Calls Made..."
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">Applies To Entity</label>
                  <select name="entityType" className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded">
                    <option value="TASK">Task Form</option>
                    <option value="DAILY_REPORT">Daily Activity Report</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">Category Scope</label>
                  <select name="departmentId" className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded">
                    <option value="">Global (All Categories)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Field Data Type</label>
                <select
                  name="fieldType"
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded"
                >
                  <option value="TEXT">Short Text</option>
                  <option value="LONG_TEXT">Long Text / Paragraph</option>
                  <option value="NUMBER">Number</option>
                  <option value="DATE">Date</option>
                  <option value="DROPDOWN">Dropdown / Select</option>
                  <option value="CHECKBOX">Checkbox</option>
                  <option value="URL">URL Link</option>
                </select>
              </div>

              {fieldType === "DROPDOWN" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">Options (comma separated)</label>
                  <input
                    type="text"
                    name="options"
                    placeholder="Option 1, Option 2, Option 3..."
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Placeholder Help Text</label>
                <input
                  type="text"
                  name="placeholder"
                  placeholder="e.g. Enter details..."
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-800 cursor-pointer pt-1">
                <input type="checkbox" name="isRequired" value="true" className="rounded text-blue-600" />
                This field is mandatory / required
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-neutral-900 text-white rounded text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Save Field"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
