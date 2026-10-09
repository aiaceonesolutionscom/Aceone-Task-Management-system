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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-neutral-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-100 bg-white shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-neutral-900 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                    Edit Scopes: {user.name}
                  </h3>
                  <span className="font-mono text-[10px] text-neutral-500 bg-neutral-200/80 px-2 py-0.5 rounded uppercase font-semibold">
                    {user.role.name}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Update category visibility, assignment boundaries, and approval authority.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 p-1.5 rounded-md transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Primary Department Selector */}
              <div className="space-y-1.5 bg-neutral-50/70 p-3.5 rounded-lg border border-neutral-200">
                <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-neutral-600" />
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
                  <option value="">None / Global (All Categories)</option>
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
                      <span>Task Visibility Access ({categoryScopeIds.length + (primaryDeptId ? 1 : 0)}/{categories.length})</span>
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      Which category tasks can this user see in the Task Directory?
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(setCategoryScopeIds)}
                      className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClearAll(setCategoryScopeIds)}
                      className="px-2 py-0.5 font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {categories.map((cat) => {
                    const isPrimary = cat.id === primaryDeptId;
                    const isChecked = isPrimary || categoryScopeIds.includes(cat.id);

                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-neutral-900 text-white border-neutral-900 font-semibold shadow-2xs"
                            : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isPrimary}
                          checked={isChecked}
                          onChange={() => toggleItem(categoryScopeIds, setCategoryScopeIds, cat.id)}
                          className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-3.5 w-3.5 shrink-0"
                        />
                        <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                          <span className="truncate leading-tight">{cat.name}</span>
                          {isPrimary && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${isChecked ? "bg-neutral-800 text-neutral-300 border border-neutral-700" : "bg-blue-100 text-blue-800"}`}>
                              Primary
                            </span>
                          )}
                        </div>
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
                      <span>Task Assignment Scope ({assignmentScopeIds.length}/{categories.length})</span>
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      Where can this user assign work or create new tasks?
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(setAssignmentScopeIds)}
                      className="px-2 py-0.5 font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClearAll(setAssignmentScopeIds)}
                      className="px-2 py-0.5 font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {categories.map((cat) => {
                    const isChecked = assignmentScopeIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-neutral-900 text-white border-neutral-900 font-semibold shadow-2xs"
                            : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleItem(assignmentScopeIds, setAssignmentScopeIds, cat.id)}
                          className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-3.5 w-3.5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate leading-tight">{cat.name}</p>
                        </div>
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
                      <span>Approval Authority Scope ({approvalScopeIds.length}/{categories.length})</span>
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      Which category deliverables appear in their Approvals Queue?
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(setApprovalScopeIds)}
                      className="px-2 py-0.5 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClearAll(setApprovalScopeIds)}
                      className="px-2 py-0.5 font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {categories.map((cat) => {
                    const isChecked = approvalScopeIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-neutral-900 text-white border-neutral-900 font-semibold shadow-2xs"
                            : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleItem(approvalScopeIds, setApprovalScopeIds, cat.id)}
                          className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-3.5 w-3.5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate leading-tight">{cat.name}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-neutral-100 bg-neutral-50/70 shrink-0">
              <span className="text-[11px] text-neutral-500 truncate max-w-[200px] sm:max-w-none">
                {user.email || user.employeeId || "Configuring access boundaries"}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-md shadow-xs transition-colors disabled:opacity-50"
                >
                  {loading ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
