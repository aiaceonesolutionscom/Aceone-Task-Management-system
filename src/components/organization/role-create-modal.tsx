"use client";

import React, { useState } from "react";
import { createRoleAction } from "@/server/actions/roles";
import { toast } from "sonner";
import {
  Plus,
  Shield,
  KeyRound,
  Check,
  X,
  Search,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";

export type PermissionItem = {
  id: number;
  key: string;
  label: string;
  group: string;
};

export function RoleCreateModal({
  permissions,
}: {
  permissions: PermissionItem[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPermIds, setSelectedPermIds] = useState<number[]>([]);

  // Auto-slugify code when name changes (if code was not manually edited)
  const handleNameChange = (val: string) => {
    setName(val);
    const slug = val
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_");
    setCode(slug);
  };

  const togglePermission = (id: number) => {
    if (selectedPermIds.includes(id)) {
      setSelectedPermIds(selectedPermIds.filter((p) => p !== id));
    } else {
      setSelectedPermIds([...selectedPermIds, id]);
    }
  };

  const toggleGroup = (groupPermIds: number[]) => {
    const allSelected = groupPermIds.every((id) => selectedPermIds.includes(id));
    if (allSelected) {
      setSelectedPermIds(selectedPermIds.filter((id) => !groupPermIds.includes(id)));
    } else {
      setSelectedPermIds(Array.from(new Set([...selectedPermIds, ...groupPermIds])));
    }
  };

  const handleSelectAll = () => {
    setSelectedPermIds(permissions.map((p) => p.id));
  };

  const handleClearAll = () => {
    setSelectedPermIds([]);
  };

  // Group permissions
  const groups: Record<string, PermissionItem[]> = {};
  for (const p of permissions) {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p);
  }

  const filteredGroups = Object.entries(groups).map(([groupName, groupPerms]) => {
    if (!searchQuery) return [groupName, groupPerms] as const;
    const filtered = groupPerms.filter(
      (p) =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        groupName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return [groupName, filtered] as const;
  }).filter(([, perms]) => perms.length > 0);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a role name.");
      return;
    }
    if (!code.trim()) {
      toast.error("Please enter a unique role code.");
      return;
    }

    setLoading(true);
    try {
      const res = await createRoleAction({
        name,
        code,
        description,
        permissionIds: selectedPermIds,
      });

      if (res.success) {
        toast.success(`Role '${name}' created successfully with ${selectedPermIds.length} permission(s)!`);
        setOpen(false);
        setName("");
        setCode("");
        setDescription("");
        setSelectedPermIds([]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Create Role</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 space-y-5 shadow-2xl border border-neutral-200 my-8 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-neutral-900" />
                  <h3 className="text-base font-bold text-neutral-900">Create Custom Role</h3>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Define new organizational role and assign dynamic capabilities and operational permissions.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-800">
                    Role Title / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. QA Lead, Creative Director, Senior Auditor"
                    className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-800">
                    Role Code (Identifier) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                    placeholder="e.g. qa_lead"
                    className="w-full font-mono text-xs bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-neutral-800">Role Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the duties and responsibilities for this role..."
                    className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-none"
                  />
                </div>
              </div>

              {/* Permissions Section */}
              <div className="space-y-3 pt-2 border-t border-neutral-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                      <span>Configure Granted Permissions ({selectedPermIds.length} Selected)</span>
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      Users assigned to this role will automatically inherit these capabilities.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-2 py-1 text-[11px] font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Search Bar for Permissions */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search permissions by name or code..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md text-neutral-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                {/* Groups & Permission Cards */}
                <div className="space-y-3 pt-1">
                  {filteredGroups.map(([groupName, groupPerms]) => {
                    const groupIds = groupPerms.map((p) => p.id);
                    const allInGroupSelected = groupIds.every((id) => selectedPermIds.includes(id));
                    const someInGroupSelected =
                      groupIds.some((id) => selectedPermIds.includes(id)) && !allInGroupSelected;

                    return (
                      <div
                        key={groupName}
                        className="border border-neutral-200 rounded-lg p-3 bg-white space-y-2 shadow-2xs"
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-neutral-100">
                          <button
                            type="button"
                            onClick={() => toggleGroup(groupIds)}
                            className="flex items-center gap-2 text-xs font-bold text-neutral-900 hover:text-neutral-600 transition-colors"
                          >
                            {allInGroupSelected ? (
                              <CheckSquare className="w-4 h-4 text-neutral-900" />
                            ) : someInGroupSelected ? (
                              <div className="w-4 h-4 rounded border-2 border-neutral-900 flex items-center justify-center">
                                <div className="w-2 h-2 bg-neutral-900 rounded-xs" />
                              </div>
                            ) : (
                              <Square className="w-4 h-4 text-neutral-400" />
                            )}
                            <span>{groupName}</span>
                            <span className="text-[10px] font-normal text-neutral-400">
                              ({groupPerms.filter((p) => selectedPermIds.includes(p.id)).length}/
                              {groupPerms.length})
                            </span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 pt-1">
                          {groupPerms.map((perm) => {
                            const isSelected = selectedPermIds.includes(perm.id);

                            return (
                              <label
                                key={perm.id}
                                className={`flex items-start gap-2 p-2 rounded-md border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-neutral-900 text-white border-neutral-900 font-semibold"
                                    : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => togglePermission(perm.id)}
                                  className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-3.5 w-3.5 shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="truncate leading-tight">{perm.label}</p>
                                  <span
                                    className={`font-mono text-[9px] block truncate ${
                                      isSelected ? "text-neutral-300" : "text-neutral-400"
                                    }`}
                                  >
                                    {perm.key}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-100 shrink-0">
              <span className="text-xs text-neutral-500">
                {selectedPermIds.length} permission(s) configured
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-md shadow-xs transition-colors disabled:opacity-50"
                >
                  {loading ? "Creating Role..." : "Save Role"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
