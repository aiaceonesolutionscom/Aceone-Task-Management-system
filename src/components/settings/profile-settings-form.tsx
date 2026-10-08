"use client";

import React, { useState } from "react";
import { User, Phone, FileText, CheckCircle2, Shield, Mail, Hash, Building2 } from "lucide-react";
import { toast } from "sonner";
import { updateProfileSettingsAction } from "@/server/actions/users";

interface ProfileSettingsFormProps {
  user: {
    id: number;
    name: string;
    email: string;
    username?: string | null;
    employeeId?: string | null;
    phone?: string | null;
    designation?: string | null;
    description?: string | null;
    role: {
      name: string;
      code: string;
    };
    primaryDepartment?: {
      name: string;
    } | null;
  };
}

export function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [description, setDescription] = useState(user.description || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Full name cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("phone", phone);
      formData.set("description", description);

      const res = await updateProfileSettingsAction(formData);
      if (res.success) {
        toast.success(res.message || "Profile updated successfully!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Read-only system identifiers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-100">
          <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1 mb-1">
            <Mail className="w-3 h-3 text-neutral-400" /> Work Email
          </span>
          <p className="font-semibold text-neutral-800 text-xs truncate">{user.email}</p>
        </div>

        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-100">
          <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1 mb-1">
            <Hash className="w-3 h-3 text-neutral-400" /> Employee ID
          </span>
          <p className="font-mono font-bold text-neutral-900 text-xs">
            {user.employeeId || "NOT ASSIGNED"}
          </p>
        </div>

        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-100">
          <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1 mb-1">
            <Shield className="w-3 h-3 text-blue-600" /> System Role
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
            {user.role.name}
          </span>
        </div>

        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-100">
          <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1 mb-1">
            <Building2 className="w-3 h-3 text-neutral-400" /> Department
          </span>
          <p className="font-semibold text-neutral-800 text-xs truncate">
            {user.primaryDepartment?.name || "Global Workspace"}
          </p>
        </div>
      </div>

      {/* Editable Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-neutral-400" />
            <span>Full Name *</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your official name"
            required
            className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-neutral-400" />
            <span>Contact Phone Number</span>
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+92 300 1234567"
            className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-neutral-400" />
          <span>Professional Bio / Notes</span>
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief summary of your professional role, responsibilities, or contact hours..."
          className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
        />
      </div>

      <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
        <p className="text-[11px] text-neutral-400">
          Your profile details are visible to team members on shared tasks and reviews.
        </p>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-md text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{loading ? "Saving Changes..." : "Save Profile"}</span>
        </button>
      </div>
    </form>
  );
}
