"use client";

import React, { useState } from "react";
import { updateRoleAction, deleteRoleAction } from "@/server/actions/roles";
import { toast } from "sonner";
import {
  Edit3,
  Shield,
  KeyRound,
  Trash2,
  X,
  Search,
  CheckSquare,
  Square,
} from "lucide-react";
import type { PermissionItem } from "./role-create-modal";

export type RoleData = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permissionId: number }[];
  _count: { users: number };
};

export function RoleEditModal({
  role,
  permissions,
}: {
  role: RoleData;
  permissions: PermissionItem[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPermIds, setSelectedPermIds] = useState<number[]>(
    role.permissions.map((p) => p.permissionId)
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleUpdate = async () => {
    if (!name.trim()) {
      toast.error("Role name cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      await updateRoleAction({
        roleId: role.id,
        name,
        description,
        permissionIds: selectedPermIds,
      });

      toast.success(`Role '${name}' updated successfully!`);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteRoleAction(role.id);
      toast.success(`Role '${role.name}' deleted.`);
      setShowDeleteConfirm(false);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete role");
    } finally {
      setDeleting(false);
    }
  };

  if (role.isSystem) {
    return null; // System roles (super_admin) cannot be edited
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-700 text-[11px] font-semibold transition-all border border-neutral-200"
      >
        <Edit3 className="w-3 h-3" />
        <span>Edit Role</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-neutral-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/70 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-neutral-900" />
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                    Edit Role: {role.name}
                  </h3>
                  <span className="font-mono text-[10px] text-neutral-500 bg-neutral-200/80 px-2 py-0.5 rounded uppercase font-semibold">
                    {role.code}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Update role capabilities and permissions across modules.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-800">Role Title / Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-800">Role Code</label>
                  <input
                    type="text"
                    disabled
                    value={role.code}
                    className="w-full font-mono text-xs bg-neutral-100 border border-neutral-200 rounded-md px-3 py-2 text-neutral-500 cursor-not-allowed"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-neutral-800">Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
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
                      <span>Role Permissions ({selectedPermIds.length} Selected)</span>
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      Modifying these permissions updates access for all {role._count.users} assigned user(s).
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
                    placeholder="Search permissions..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md text-neutral-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                {/* Groups */}
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
              {role._count.users === 0 ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Role</span>
                </button>
              ) : (
                <span className="text-[11px] text-neutral-400">
                  {role._count.users} user(s) currently assigned
                </span>
              )}

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
                  onClick={handleUpdate}
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

      {/* Role Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-neutral-900">Delete Role?</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Are you sure you want to delete role <strong className="text-neutral-900 font-semibold">{role.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
