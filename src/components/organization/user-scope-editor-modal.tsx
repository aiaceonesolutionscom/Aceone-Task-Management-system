"use client";

import React, { useState, useMemo } from "react";
import { updateUserScopesAction } from "@/server/actions/users";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
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
  Lock,
  Key,
  Sparkles,
  RotateCcw,
  Sliders,
  FileCheck2,
  BarChart3,
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
  permissionOverrides?: { permissionKey: string; isGranted: boolean }[];
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
  const [activeTab, setActiveTab] = useState<"scopes" | "permissions">("scopes");

  // Scopes State
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

  // Initial Permission Overrides: map permissionKey -> boolean (true=granted, false=denied)
  const initialOverridesMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (user.permissionOverrides) {
      for (const po of user.permissionOverrides) {
        map[po.permissionKey] = po.isGranted;
      }
    }
    return map;
  }, [user.permissionOverrides]);

  const [overrides, setOverrides] = useState<Record<string, boolean>>(initialOverridesMap);

  // Base role permissions
  const baseRolePerms = useMemo(() => {
    return new Set(DEFAULT_ROLE_PERMISSIONS[user.role.code] || []);
  }, [user.role.code]);

  // Group permissions by module
  const permissionGroups = useMemo(() => {
    const groups: Record<string, typeof PERMISSIONS[number][]> = {};
    for (const p of PERMISSIONS) {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    }
    return groups;
  }, []);

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

  // Toggle specific permission override
  const handleTogglePermission = (key: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const isBaseRoleGranted = baseRolePerms.has(key as any);

      if (key in next) {
        // If already overridden, cycle or remove override
        if (next[key] === true) {
          // Flip to explicitly denied
          next[key] = false;
        } else {
          // Remove override and revert to role default
          delete next[key];
        }
      } else {
        // If not overridden yet: if base was granted, override to deny; if base was denied, override to grant
        next[key] = !isBaseRoleGranted;
      }
      return next;
    });
  };

  // Quick Preset Actions
  const applyPreset = (presetType: "manager_approvals" | "task_assignment" | "executive_reports" | "reset") => {
    if (presetType === "reset") {
      setOverrides({});
      toast.info("Permissions reset to role defaults.");
      return;
    }

    setOverrides((prev) => {
      const next = { ...prev };
      if (presetType === "manager_approvals") {
        next["task.review"] = true;
        next["task.approve"] = true;
        next["approval.view"] = true;
        next["approval.review"] = true;
        next["approval.approve"] = true;
        toast.success("Manager approval authority granted to " + user.name);
      } else if (presetType === "task_assignment") {
        next["task.create"] = true;
        next["task.assign"] = true;
        next["task.edit"] = true;
        toast.success("Task creation & delegation authority granted to " + user.name);
      } else if (presetType === "executive_reports") {
        next["report.view"] = true;
        next["report.category.view"] = true;
        next["report.crm.view"] = true;
        next["report.export"] = true;
        toast.success("Executive reporting & CRM visibility granted to " + user.name);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const formattedOverrides = Object.entries(overrides).map(([permissionKey, isGranted]) => ({
        permissionKey,
        isGranted,
      }));

      await updateUserScopesAction({
        userId: user.id,
        primaryDepartmentId: primaryDeptId,
        categoryScopeIds,
        assignmentScopeIds,
        approvalScopeIds,
        permissionOverrides: formattedOverrides,
      });

      toast.success(`Access & custom permissions updated for ${user.name}`);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update user access");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-700 text-[11px] font-semibold transition-all border border-neutral-200 cursor-pointer shadow-2xs"
      >
        <Compass className="w-3 h-3 text-blue-600" />
        <span>Manage Access</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-neutral-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-100 bg-white shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-neutral-900 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                    Manage Access: {user.name}
                  </h3>
                  <span className="font-mono text-[10px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded uppercase font-semibold border border-neutral-200">
                    {user.role.name}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Configure department boundaries and customize individual permissions & rights.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 px-5 pt-3 bg-neutral-50/70 border-b border-neutral-200 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("scopes")}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "scopes"
                    ? "border-neutral-900 text-neutral-900 bg-white rounded-t-md shadow-2xs"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <FolderTree className="w-3.5 h-3.5 text-blue-600" />
                <span>Category & Operational Scopes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("permissions")}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "permissions"
                    ? "border-neutral-900 text-neutral-900 bg-white rounded-t-md shadow-2xs"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                <span>Custom Permissions & Specific Rights</span>
                {Object.keys(overrides).length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                    {Object.keys(overrides).length} custom
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === "scopes" ? (
                <div className="space-y-6">
                  {/* Primary Department Selector */}
                  <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200/80 space-y-2">
                    <label className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-neutral-700" />
                      Primary Category / Home Department
                    </label>
                    <p className="text-[11px] text-neutral-500">
                      The core team this user belongs to. Tasks will default to this department.
                    </p>
                    <select
                      value={primaryDeptId || ""}
                      onChange={(e) => setPrimaryDeptId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full sm:w-80 px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 font-medium"
                    >
                      <option value="">Global / No Primary Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.code ? `(${c.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 1. Category Visibility Scopes */}
                  <div className="space-y-2 border-t border-neutral-100 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          Category Visibility Scopes (Task Directory Access)
                        </h4>
                        <p className="text-[11px] text-neutral-500">
                          Which departments' tasks this member is authorized to view in the workspace.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleSelectAll(setCategoryScopeIds)}
                          className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearAll(setCategoryScopeIds)}
                          className="px-2 py-0.5 font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                      {categories.map((cat) => {
                        const isChecked = categoryScopeIds.includes(cat.id);
                        return (
                          <label
                            key={cat.id}
                            className={`flex items-center gap-2 p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                              isChecked
                                ? "bg-neutral-900 text-white border-neutral-900 font-semibold shadow-2xs"
                                : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleItem(categoryScopeIds, setCategoryScopeIds, cat.id)}
                              className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-3.5 w-3.5 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate leading-tight">{cat.name}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Assignment Scopes */}
                  <div className="space-y-2 border-t border-neutral-100 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5 text-purple-600" />
                          Assignment Scopes (Assign Work To Departments)
                        </h4>
                        <p className="text-[11px] text-neutral-500">
                          Which departments this user can create and assign tasks into.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleSelectAll(setAssignmentScopeIds)}
                          className="px-2 py-0.5 font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded transition-colors cursor-pointer"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearAll(setAssignmentScopeIds)}
                          className="px-2 py-0.5 font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors cursor-pointer"
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
                            className={`flex items-center gap-2 p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                              isChecked
                                ? "bg-neutral-900 text-white border-neutral-900 font-semibold shadow-2xs"
                                : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleItem(assignmentScopeIds, setAssignmentScopeIds, cat.id)}
                              className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-3.5 w-3.5 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate leading-tight">{cat.name}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Approval Scopes */}
                  <div className="space-y-2 border-t border-neutral-100 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                          <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Approval Scopes (Review & Decision Authority)
                        </h4>
                        <p className="text-[11px] text-neutral-500">
                          Which departments' submissions this member can evaluate, review and approve.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleSelectAll(setApprovalScopeIds)}
                          className="px-2 py-0.5 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearAll(setApprovalScopeIds)}
                          className="px-2 py-0.5 font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors cursor-pointer"
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
                            className={`flex items-center gap-2 p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                              isChecked
                                ? "bg-neutral-900 text-white border-neutral-900 font-semibold shadow-2xs"
                                : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleItem(approvalScopeIds, setApprovalScopeIds, cat.id)}
                              className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-3.5 w-3.5 shrink-0"
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
              ) : (
                /* Tab 2: Granular Custom Permissions Overrides */
                <div className="space-y-6">
                  {/* Preset Buttons Header */}
                  <div className="p-3.5 rounded-lg bg-purple-50/70 border border-purple-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        Quick Authority Presets (Give Manager / CEO Powers)
                      </span>
                      <button
                        type="button"
                        onClick={() => applyPreset("reset")}
                        className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset Overrides
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyPreset("manager_approvals")}
                        className="px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50 text-[11px] font-bold shadow-2xs cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <ClipboardCheck className="w-3 h-3 text-emerald-600" />
                        Grant Manager Approvals
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset("task_assignment")}
                        className="px-2.5 py-1 rounded bg-white text-blue-800 border border-blue-200 hover:bg-blue-50 text-[11px] font-bold shadow-2xs cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <Send className="w-3 h-3 text-blue-600" />
                        Grant Task Delegation & Assignment
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset("executive_reports")}
                        className="px-2.5 py-1 rounded bg-white text-purple-800 border border-purple-200 hover:bg-purple-50 text-[11px] font-bold shadow-2xs cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <BarChart3 className="w-3 h-3 text-purple-600" />
                        Grant Executive Reports & CRM
                      </button>
                    </div>
                  </div>

                  {/* Modules Grouping */}
                  <div className="space-y-4">
                    {Object.entries(permissionGroups).map(([groupName, groupPerms]) => (
                      <div key={groupName} className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                        <div className="px-3.5 py-2 bg-neutral-50/80 border-b border-neutral-200 flex items-center justify-between">
                          <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                            {groupName} Permissions
                          </h4>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {groupPerms.length} rights
                          </span>
                        </div>

                        <div className="divide-y divide-neutral-100">
                          {groupPerms.map((perm) => {
                            const isBaseGranted = baseRolePerms.has(perm.key as any);
                            const hasOverride = perm.key in overrides;
                            const isEffectiveGranted = hasOverride
                              ? overrides[perm.key]
                              : isBaseGranted;

                            return (
                              <div
                                key={perm.key}
                                className={`px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                                  hasOverride
                                    ? isEffectiveGranted
                                      ? "bg-emerald-50/40"
                                      : "bg-rose-50/40"
                                    : "hover:bg-neutral-50/50"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold text-neutral-900">{perm.label}</p>
                                    <span className="font-mono text-[9px] text-neutral-400">
                                      {perm.key}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {hasOverride ? (
                                      isEffectiveGranted ? (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          CUSTOM OVERRIDE: GRANTED
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                          CUSTOM OVERRIDE: REVOKED
                                        </span>
                                      )
                                    ) : isBaseGranted ? (
                                      <span className="text-[9px] font-medium text-neutral-500">
                                        Granted by base role ({user.role.name})
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-medium text-neutral-400">
                                        Not allowed by base role
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleTogglePermission(perm.key)}
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer border ${
                                    isEffectiveGranted
                                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-2xs"
                                      : "bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border-neutral-300"
                                  }`}
                                >
                                  {isEffectiveGranted ? "Granted" : "Denied"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-md shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Saving Changes..." : "Save All Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
