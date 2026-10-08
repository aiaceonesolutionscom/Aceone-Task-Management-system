"use client";

import React, { useState } from "react";
import { createUserAction } from "@/server/actions/users";
import { toast } from "sonner";
import { Plus, User, Shield, Compass, CheckCircle2, ArrowLeft, X, KeyRound } from "lucide-react";

export function UserCreateModal({
  categories,
  roles,
}: {
  categories: any[];
  roles: any[];
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("Password@123");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("");
  const [roleId, setRoleId] = useState<number>(roles[0]?.id || 1);
  const [departmentId, setDepartmentId] = useState<number>(categories[0]?.id || 1);
  const [canViewPasswords, setCanViewPasswords] = useState(false);
  const [canViewReportsCRM, setCanViewReportsCRM] = useState(false);
  const [assignmentScopes, setAssignmentScopes] = useState<number[]>([]);
  const [approvalScopes, setApprovalScopes] = useState<number[]>([]);

  const toggleScope = (list: number[], setList: (l: number[]) => void, id: number) => {
    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
    } else {
      setList([...list, id]);
    }
  };

  const handleCreate = async () => {
    if (!name || !email || !password) {
      toast.error("Name, email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("email", email);
      formData.set("username", username);
      formData.set("password", password);
      formData.set("phone", phone);
      formData.set("designation", designation);
      formData.set("roleId", roleId.toString());
      formData.set("departmentId", departmentId.toString());
      formData.set("canViewPasswords", canViewPasswords ? "true" : "false");
      formData.set("canViewReportsCRM", canViewReportsCRM ? "true" : "false");

      assignmentScopes.forEach((id) => formData.append("assignmentScopes", id.toString()));
      approvalScopes.forEach((id) => formData.append("approvalScopes", id.toString()));

      const res = await createUserAction(formData);
      if (res.success) {
        toast.success(`User created! Assigned Employee ID: ${res.employeeId}`);
        setOpen(false);
        setStep(1);
        setName("");
        setEmail("");
        setUsername("");
        setCanViewPasswords(false);
        setCanViewReportsCRM(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
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
        <span>Add Employee / User</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 bg-neutral-50/50 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">User Setup & Onboarding Wizard</h3>
                <p className="text-[11px] text-neutral-500">Step {step} of 3</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[1, 2, 3].map((s) => (
                    <div
                      key={s}
                      className={`w-6 h-1.5 rounded-full transition-colors ${
                        step >= s ? "bg-neutral-900" : "bg-neutral-200"
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Step 1: Basic Information */}
              {step === 1 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-700">Full Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Muneeb Khan"
                      className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">Work Email *</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="muneeb@aceone.com"
                        className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">Username / ID</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="muneeb.ceo"
                        className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">Initial Password *</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">Phone</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+92 300 ..."
                        className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="px-3.5 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-semibold border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!name || !email) {
                          toast.error("Name and email are required.");
                          return;
                        }
                        setStep(2);
                      }}
                      className="px-4 py-1.5 bg-neutral-900 text-white rounded-md text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs"
                    >
                      Next: Role & Designation
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Role, Designation & Category */}
              {step === 2 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-700">Designation / Title</label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Lead UI Designer, Sales Manager..."
                      className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">Organizational Role *</label>
                      <select
                        value={roleId}
                        onChange={(e) => setRoleId(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">Primary Department *</label>
                      <select
                        value={departmentId}
                        onChange={(e) => setDepartmentId(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.code ? `(${c.code})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Password Vault Access Permission Override */}
                  <div className="pt-2 space-y-2">
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
                          Allows this user (e.g. CEO, Executive Director) to view employee passwords and recovery logs.
                        </p>
                      </div>
                    </label>

                    {/* Reports & Analytics CRM Access Permission Override */}
                    <label className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50/70 border border-blue-200 cursor-pointer hover:bg-blue-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={canViewReportsCRM}
                        onChange={(e) => setCanViewReportsCRM(e.target.checked)}
                        className="mt-0.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-600 h-4 w-4"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-blue-600" />
                          <span>Grant Reports CRM &amp; Deep Analytics Access</span>
                        </span>
                        <p className="text-[11px] text-neutral-600 leading-relaxed">
                          Allows this user to access the Advanced CRM records explorer, deep filters, and custom exports in Reports &amp; Analytics.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-neutral-700 hover:text-neutral-900 font-semibold border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-4 py-1.5 bg-neutral-900 text-white rounded-md text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs"
                    >
                      Next: Configure Scopes
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Assignment & Approval Scopes */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Helpful Guidance Banner */}
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-900 leading-relaxed">
                    <p className="font-semibold flex items-center gap-1.5 text-blue-950 mb-0.5">
                      <Compass className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      Permissions Scope Guide
                    </p>
                    <p className="text-[11px] text-blue-800">
                      If adding a <strong>Standard Employee</strong> who only works on their own assigned tasks, you can leave both scopes unselected and click <strong>&ldquo;Activate &amp; Save User&rdquo;</strong> directly.
                    </p>
                  </div>

                  {/* Section 1: Task Assignment Scope */}
                  <div className="space-y-2.5 border border-neutral-200 rounded-lg p-3 sm:p-3.5 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <label className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          Task Delegation Scope
                        </label>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          Which departments can this user assign tasks to?
                          <span className="text-neutral-400 block font-normal">(Leave empty for standard members)</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] shrink-0 font-medium self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setAssignmentScopes(categories.map((c) => c.id))}
                          className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          All
                        </button>
                        {departmentId && (
                          <button
                            type="button"
                            onClick={() => setAssignmentScopes([departmentId])}
                            className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
                          >
                            Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setAssignmentScopes([])}
                          className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-neutral-50/60 rounded-md border border-neutral-100">
                      {categories.map((c) => {
                        const isSelected = assignmentScopes.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-all ${
                              isSelected
                                ? "bg-blue-50 border-blue-300 text-blue-950 font-semibold shadow-2xs"
                                : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleScope(assignmentScopes, setAssignmentScopes, c.id)}
                              className="rounded text-blue-600 focus:ring-0"
                            />
                            <span className="truncate">{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-neutral-400 font-medium">
                      {assignmentScopes.length === 0
                        ? "✓ No delegation rights selected (Standard Member)"
                        : `Selected for ${assignmentScopes.length} department(s)`}
                    </p>
                  </div>

                  {/* Section 2: Review & Approval Scope */}
                  <div className="space-y-2.5 border border-neutral-200 rounded-lg p-3 sm:p-3.5 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <label className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          Review &amp; Approval Authority
                        </label>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          Which departments can this user review and approve work in?
                          <span className="text-neutral-400 block font-normal">(Typically Managers or Team Leads only)</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] shrink-0 font-medium self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setApprovalScopes(categories.map((c) => c.id))}
                          className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          All
                        </button>
                        {departmentId && (
                          <button
                            type="button"
                            onClick={() => setApprovalScopes([departmentId])}
                            className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
                          >
                            Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setApprovalScopes([])}
                          className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-neutral-50/60 rounded-md border border-neutral-100">
                      {categories.map((c) => {
                        const isSelected = approvalScopes.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-all ${
                              isSelected
                                ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold shadow-2xs"
                                : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleScope(approvalScopes, setApprovalScopes, c.id)}
                              className="rounded text-emerald-600 focus:ring-0"
                            />
                            <span className="truncate">{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-neutral-400 font-medium">
                      {approvalScopes.length === 0
                        ? "✓ No review rights selected (Standard Member)"
                        : `Selected for ${approvalScopes.length} department(s)`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-neutral-700 hover:text-neutral-900 font-semibold border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={loading}
                      className="px-4 py-1.5 bg-neutral-900 text-white rounded-md text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-xs"
                    >
                      {loading ? "Activating..." : "Activate & Save User"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
