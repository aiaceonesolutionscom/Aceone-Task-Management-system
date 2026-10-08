"use client";

import React, { useState } from "react";
import { updateUserAction } from "@/server/actions/users";
import { toast } from "sonner";
import { User, Shield, Lock, X, CheckCircle2, KeyRound } from "lucide-react";

interface UserEditModalProps {
  user: {
    id: number;
    name: string;
    email: string;
    username?: string | null;
    phone?: string | null;
    designation?: string | null;
    roleId: number;
    primaryDepartmentId?: number | null;
    status: string;
    permissionOverrides?: Array<{ permissionKey: string; isGranted: boolean }>;
  };
  roles: any[];
  categories: any[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function UserEditModal({
  user,
  roles,
  categories,
  onClose,
  onSuccess,
}: UserEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [designation, setDesignation] = useState(user.designation || "");
  const [roleId, setRoleId] = useState<number>(user.roleId);
  const [departmentId, setDepartmentId] = useState<number | "">(
    user.primaryDepartmentId ?? ""
  );
  const [status, setStatus] = useState(user.status || "ACTIVE");
  const [newPassword, setNewPassword] = useState("");
  const [canViewPasswords, setCanViewPasswords] = useState<boolean>(
    Boolean(
      user.permissionOverrides?.some(
        (o) => o.permissionKey === "user.view_passwords" && o.isGranted
      )
    )
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      toast.error("Name and email are required.");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("userId", user.id.toString());
      formData.set("name", name);
      formData.set("email", email);
      formData.set("username", username);
      formData.set("phone", phone);
      formData.set("designation", designation);
      formData.set("roleId", roleId.toString());
      if (departmentId !== "") {
        formData.set("departmentId", departmentId.toString());
      }
      formData.set("status", status);
      if (newPassword) {
        formData.set("password", newPassword);
      }
      formData.set("canViewPasswords", canViewPasswords ? "true" : "false");

      await updateUserAction(formData);
      toast.success("User updated successfully!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-neutral-200">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-neutral-800" />
            <h3 className="text-sm font-bold text-neutral-900">
              Edit User: {user.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">Designation / Title</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Senior Graphic Designer"
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">System Role *</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(parseInt(e.target.value, 10))}
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">Primary Department</label>
              <select
                value={departmentId}
                onChange={(e) =>
                  setDepartmentId(e.target.value ? parseInt(e.target.value, 10) : "")
                }
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
              >
                <option value="">None / Executive</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          {/* Reset Password */}
          <div className="pt-2 border-t border-neutral-100">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Reset Password (leave empty to keep current password)</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min. 6 characters)"
              className="mt-1 w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {/* Password Vault Access Permission Override */}
          <div className="pt-2 border-t border-neutral-100">
            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-purple-50/70 border border-purple-200 cursor-pointer hover:bg-purple-50 transition-colors">
              <input
                type="checkbox"
                checked={canViewPasswords}
                onChange={(e) => setCanViewPasswords(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300 text-purple-600 focus:ring-purple-600 h-4 w-4"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-purple-600" />
                  <span>Grant Password Vault &amp; Credentials Recovery Permission</span>
                </span>
                <p className="text-[11px] text-neutral-600 leading-relaxed">
                  Allows this user (e.g. CEO, Department Executive) to view employee passwords and recovery logs.
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-neutral-900 text-white rounded text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
