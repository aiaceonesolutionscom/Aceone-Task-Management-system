"use client";

import React, { useState } from "react";
import { updateUserScopesAction } from "@/server/actions/users";
import { toast } from "sonner";
import {
  Compass,
  Shield,
  Layers,
  CheckCircle2,
  X,
  Eye,
  Send,
  ClipboardCheck,
  Check,
  Building2,
  FolderTree,
} from "lucide-react";

export type ScopeUser = {
  id: number;
  name: string;
  email: string;
  employeeId?: string | null;
  designation?: string | null;
  role: { code: string; name: string; isSystem: boolean };
  primaryDepartmentId: number | null;
  primaryDepartment?: { id: number; name: string } | null;
  categoryScopes: { departmentId: number }[];
  assignmentScopes: { departmentId: number }[];
  approvalScopes: { departmentId: number }[];
};

export type DepartmentItem = {
  id: number;
  name: string;
  code?: string | null;
};

export function UserScopeEditorModal({
  user,
  categories,
}: {
  user: ScopeUser;
  categories: DepartmentItem[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [primaryDeptId, setPrimaryDeptId] = useState<number | null>(user.primaryDepartmentId);
  const [categoryScopeIds, setCategoryScopeIds] = useState<number[]>(
    user.categoryScopes.map((s) => s.departmentId)
  );
  const [assignmentScopeIds, setAssignmentScopeIds] = useState<number[]>(
    user.assignmentScopes.map((s) => s.departmentId)
  );
  const [approvalScopeIds, setApprovalScopeIds] = useState<number[]>(
    user.approvalScopes.map((s) => s.departmentId)
  );

  const toggleItem = (list: number[], setList: (l: number[]) => void, id: number) => {
    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
    } else {
      setList([...list, id]);
    }
  };

  const handleSelectAll = (setList: (l: number[]) => void) => {
    setList(categories.map((c) => c.id));
  };

  const handleClearAll = (setList: (l: number[]) => void) => {
    setList([]);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateUserScopesAction({
        userId: user.id,
        primaryDepartmentId: primaryDeptId,
        categoryScopeIds,
        assignmentScopeIds,
        approvalScopeIds,
      });

      toast.success(`Access scopes updated successfully for ${user.name}`);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update user scopes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-700 text-[11px] font-semibold transition-all border border-neutral-200"
      >
        <Compass className="w-3 h-3" />
        <span>Manage Access</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-neutral-200 my-8">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-neutral-900">
                    Category Access & Scopes — {user.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 uppercase">
                    {user.role.name}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Configure department visibility, task assignment boundaries, and approval authority.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Primary Department Selector */}
            <div className="bg-neutral-50 rounded-lg p-3.5 border border-neutral-200 space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                <span>Primary Assigned Department</span>
              </label>
              <p className="text-[11px] text-neutral-500">
                Default category for daily reports and direct department affiliation.
              </p>
              <select
                value={primaryDeptId || ""}
                onChange={(e) =>
                  setPrimaryDeptId(e.target.value ? parseInt(e.target.value, 10) : null)
                }
                className="w-full text-xs bg-white border border-neutral-300 rounded-md px-3 py-2 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              >
                <option value="">None / Global</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Scope 1: Category Task Visibility */}
            <div className="space-y-2 border border-neutral-200 rounded-lg p-3.5 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>Task Visibility Access (Which Category Tasks Can They See?)</span>
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Managers only see tasks from checked categories in the Task Directory.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(setCategoryScopeIds)}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    All
                  </button>
                  <span className="text-neutral-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleClearAll(setCategoryScopeIds)}
                    className="text-neutral-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {categories.map((cat) => {
                  const isPrimary = cat.id === primaryDeptId;
                  const isChecked = isPrimary || categoryScopeIds.includes(cat.id);

                  return (
                    <label
                      key={cat.id}
                      className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? "bg-blue-50/70 border-blue-200 text-blue-950 font-semibold"
                          : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isPrimary}
                        checked={isChecked}
                        onChange={() => toggleItem(categoryScopeIds, setCategoryScopeIds, cat.id)}
                        className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="truncate">
                        {cat.name}
                        {isPrimary && (
                          <span className="text-[9px] font-bold text-blue-700 block">(Primary)</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Scope 2: Task Assignment Scope */}
            <div className="space-y-2 border border-neutral-200 rounded-lg p-3.5 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-purple-600" />
                    <span>Task Assignment Scope (Where Can They Assign Tasks?)</span>
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Restricts which categories appear when creating tasks or batch distributing.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(setAssignmentScopeIds)}
                    className="text-purple-600 hover:underline font-semibold"
                  >
                    All
                  </button>
                  <span className="text-neutral-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleClearAll(setAssignmentScopeIds)}
                    className="text-neutral-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {categories.map((cat) => {
                  const isChecked = assignmentScopeIds.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? "bg-purple-50/70 border-purple-200 text-purple-950 font-semibold"
                          : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(assignmentScopeIds, setAssignmentScopeIds, cat.id)}
                        className="rounded border-neutral-300 text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                      />
                      <span className="truncate">{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Scope 3: Approval Authority Scope */}
            <div className="space-y-2 border border-neutral-200 rounded-lg p-3.5 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Approval Authority Scope (Where Can They Review/Approve?)</span>
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Controls which category deliverables appear in the Approvals Queue.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(setApprovalScopeIds)}
                    className="text-emerald-600 hover:underline font-semibold"
                  >
                    All
                  </button>
                  <span className="text-neutral-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleClearAll(setApprovalScopeIds)}
                    className="text-neutral-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {categories.map((cat) => {
                  const isChecked = approvalScopeIds.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? "bg-emerald-50/70 border-emerald-200 text-emerald-950 font-semibold"
                          : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(approvalScopeIds, setApprovalScopeIds, cat.id)}
                        className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                      />
                      <span className="truncate">{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-md shadow-xs transition-colors disabled:opacity-50"
              >
                {loading ? "Saving Scopes..." : "Save Scope Access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
