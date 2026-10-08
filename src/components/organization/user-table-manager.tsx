"use client";

import React, { useState, useMemo } from "react";
import { UserEditModal } from "./user-edit-modal";
import { UserPasswordModal } from "./user-password-modal";
import { toggleUserStatusAction, deleteUserAction } from "@/server/actions/users";
import { toast } from "sonner";
import {
  Edit2,
  Trash2,
  Power,
  Search,
  AlertTriangle,
  UserCheck,
  UserX,
  X,
  ChevronLeft,
  ChevronRight,
  KeyRound,
} from "lucide-react";

interface UserTableManagerProps {
  users: any[];
  roles: any[];
  categories: any[];
  currentUserId: number;
  isSuperAdmin?: boolean;
  vault?: Record<string, any>;
}

const PAGE_SIZE = 10;

export function UserTableManager({
  users,
  roles,
  categories,
  currentUserId,
  isSuperAdmin = false,
  vault = {},
}: UserTableManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [togglingUser, setTogglingUser] = useState<any | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<any | null>(null);
  const [vaultState, setVaultState] = useState<Record<string, any>>(vault || {});
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesEmpId = (u.employeeId || "").toLowerCase().includes(q);
        const matchesRole = (u.role?.name || "").toLowerCase().includes(q);
        const matchesDept = (u.primaryDepartment?.name || "").toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesEmpId && !matchesRole && !matchesDept) {
          return false;
        }
      }
      if (roleFilter && u.role?.code !== roleFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, currentPage]);

  const handleToggleStatus = async (user: any) => {
    if (user.id === currentUserId) {
      toast.error("You cannot disable your own active account.");
      return;
    }
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setActionLoading(true);
    try {
      await toggleUserStatusAction(user.id, newStatus);
      toast.success(
        `User ${user.name} is now ${newStatus === "ACTIVE" ? "activated" : "deactivated"}.`
      );
      setTogglingUser(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setActionLoading(true);
    try {
      const res = await deleteUserAction(deletingUser.id);
      if (res.success) {
        toast.success(res.message || "User deleted.");
        setDeletingUser(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Live Auto Filters (No Apply Button needed) */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-2xs flex flex-wrap sm:flex-nowrap gap-2 sm:gap-2.5 items-center">
        <div className="relative w-full sm:flex-1">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by name, email, employee ID, role..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 cursor-pointer"
        >
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        {(searchQuery || roleFilter || statusFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setRoleFilter("");
              setStatusFilter("");
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md font-semibold transition-colors cursor-pointer text-center"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Users Data Table */}
      <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs min-w-[700px] md:min-w-full">
            <thead className="bg-[#f9fafb] text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
              <tr>
                <th className="py-2.5 px-4">Employee</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Primary Dept</th>
                <th className="py-2.5 px-3">Task Assignment</th>
                <th className="py-2.5 px-3">Approval Scope</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-center">Tasks</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-400">
                    No users matching the filters.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const isSuperAdmin = u.role?.code === "super_admin";

                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/60">
                      <td className="py-3 px-4">
                        <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {isSelf && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.5 rounded border border-blue-100">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                          <span>{u.email}</span>
                          {u.employeeId && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-neutral-600 font-semibold">
                                {u.employeeId}
                              </span>
                            </>
                          )}
                        </div>
                        {u.designation && (
                          <div className="text-[10px] text-neutral-500 italic mt-0.5">
                            {u.designation}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-medium text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                          {u.role?.name || "No Role"}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-neutral-700 font-medium">
                        {u.primaryDepartment?.name || "—"}
                      </td>

                      <td className="py-3 px-3 max-w-[130px] truncate text-[11px] text-neutral-600">
                        {u.assignmentScopes?.length > 0
                          ? u.assignmentScopes.map((s: any) => s.department.name).join(", ")
                          : "Primary Only"}
                      </td>

                      <td className="py-3 px-3 max-w-[130px] truncate text-[11px] text-neutral-600">
                        {u.approvalScopes?.length > 0
                          ? u.approvalScopes.map((s: any) => s.department.name).join(", ")
                          : "Primary Only"}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            u.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-semibold text-neutral-700">
                        {u._count?.taskAssignments ?? 0}
                      </td>

                      {/* CRUD Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {/* Super Admin Password Vault & Credentials View */}
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => setPasswordModalUser(u)}
                              className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors cursor-pointer"
                              title="View / Reset Password & Credentials"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => setEditingUser(u)}
                            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                            title="Edit User"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Inactive */}
                          {!isSelf && (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => {
                                if (u.status === "ACTIVE") {
                                  setTogglingUser(u);
                                } else {
                                  handleToggleStatus(u);
                                }
                              }}
                              className={`p-1.5 rounded transition-colors cursor-pointer ${
                                u.status === "ACTIVE"
                                  ? "text-amber-600 hover:bg-amber-50"
                                  : "text-emerald-600 hover:bg-emerald-50"
                              }`}
                              title={u.status === "ACTIVE" ? "Deactivate User" : "Activate User"}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete button */}
                          {!isSelf && (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-neutral-100 bg-[#f9fafb] flex items-center justify-between text-xs text-neutral-500">
            <div>
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Previous Page"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5 pointer-events-none" />
              </button>
              <span className="font-semibold text-neutral-800 px-1">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Next Page"
                aria-label="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5 pointer-events-none" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          roles={roles}
          categories={categories}
          onClose={() => setEditingUser(null)}
        />
      )}

      {/* Super Admin Password Vault Modal */}
      {passwordModalUser && (
        <UserPasswordModal
          user={passwordModalUser}
          initialPassword={vaultState[String(passwordModalUser.id)]?.password}
          onClose={() => setPasswordModalUser(null)}
          onPasswordUpdated={(newPwd) => {
            setVaultState((prev) => ({
              ...prev,
              [String(passwordModalUser.id)]: {
                password: newPwd,
                updatedAt: new Date().toISOString(),
                changedBy: "Super Admin",
              },
            }));
          }}
        />
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-3.5 shadow-xl border border-neutral-200">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-neutral-900">Confirm User Deletion</h3>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Are you sure you want to delete user{" "}
              <strong className="text-neutral-900 font-semibold">{deletingUser.name}</strong> (
              {deletingUser.email})?
            </p>

            {deletingUser._count?.taskAssignments > 0 && (
              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                Notice: This user has{" "}
                <strong>{deletingUser._count.taskAssignments} linked tasks</strong>. To preserve system
                history and deliverables, this account will be safely deactivated (set to INACTIVE).
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setDeletingUser(null)}
                className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDelete}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs"
              >
                {actionLoading ? "Processing..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate User Confirmation Modal */}
      {togglingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-3.5 shadow-xl border border-neutral-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-amber-600">
              <Power className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-neutral-900">Deactivate User Account?</h3>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Are you sure you want to deactivate <strong className="text-neutral-900 font-semibold">{togglingUser.name}</strong>?
              They will not be able to log in or receive new tasks while inactive.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setTogglingUser(null)}
                className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleToggleStatus(togglingUser)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {actionLoading ? "Processing..." : "Deactivate User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
