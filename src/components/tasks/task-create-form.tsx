"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction } from "@/server/actions/tasks";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Paperclip,
  Plus,
  Trash2,
  Users,
  ShieldCheck,
  CheckCircle2,
  FileText,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";

type CategoryItem = {
  id: number;
  name: string;
  code: string | null;
  approvalRequired: boolean;
  customFields: Array<{
    id: number;
    fieldName: string;
    fieldKey: string;
    fieldType: string;
    options: any;
    isRequired: boolean;
    placeholder: string | null;
  }>;
};

type TeamMemberItem = {
  id: number;
  name: string;
  email: string;
  designation: string | null;
  primaryDepartmentId: number | null;
  primaryDepartment?: { id: number; name: string; code: string | null } | null;
  memberships?: Array<{
    departmentId: number;
    department?: { id: number; name: string; code: string | null };
  }>;
  role: { code: string; name: string };
};

type CustomFieldItem = {
  id: number;
  fieldName: string;
  fieldKey: string;
  fieldType: string;
  options: any;
  isRequired: boolean;
  placeholder: string | null;
};

export function TaskCreateForm({
  categories,
  teamMembers,
  globalCustomFields,
  creatorName,
  creatorRole,
}: {
  categories: CategoryItem[];
  teamMembers: TeamMemberItem[];
  globalCustomFields: CustomFieldItem[];
  creatorName: string;
  creatorRole: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form State
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(categories[0]?.id || 1);
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<number[]>([]);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [approvalMode, setApprovalMode] = useState<"ANY_ONE" | "ALL_REQUIRED">("ANY_ONE");
  const [referenceLinks, setReferenceLinks] = useState<Array<{ displayName: string; url: string }>>([]);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [showCrossDeptMembers, setShowCrossDeptMembers] = useState(false);

  const currentCategory = categories.find((c) => c.id === selectedCategoryId);

  // Determine membership in currently selected category
  const isMemberOfCategory = (member: TeamMemberItem, catId: number) => {
    if (member.primaryDepartmentId === catId) return true;
    if (member.memberships?.some((m) => m.departmentId === catId)) return true;
    return false;
  };

  const categoryMembers = teamMembers.filter((m) => isMemberOfCategory(m, selectedCategoryId));
  const outsideMembers = teamMembers.filter((m) => !isMemberOfCategory(m, selectedCategoryId));

  // Cross-department selected assignees
  const crossDeptSelected = teamMembers.filter(
    (m) => selectedAssignees.includes(m.id) && !isMemberOfCategory(m, selectedCategoryId)
  );
  const customFields = [
    ...globalCustomFields,
    ...(currentCategory?.customFields || []),
  ];

  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;
    setReferenceLinks([
      ...referenceLinks,
      {
        displayName: newLinkTitle.trim() || newLinkUrl.trim(),
        url: newLinkUrl.trim(),
      },
    ]);
    setNewLinkTitle("");
    setNewLinkUrl("");
  };

  const handleRemoveLink = (index: number) => {
    setReferenceLinks(referenceLinks.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const toggleAssignee = (userId: number) => {
    if (selectedAssignees.includes(userId)) {
      setSelectedAssignees(selectedAssignees.filter((id) => id !== userId));
    } else {
      setSelectedAssignees([...selectedAssignees, userId]);
    }
  };

  const toggleReviewer = (userId: number) => {
    if (selectedReviewers.includes(userId)) {
      setSelectedReviewers(selectedReviewers.filter((id) => id !== userId));
    } else {
      setSelectedReviewers([...selectedReviewers, userId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedAssignees.length === 0) {
      toast.error("Please select at least one assignee for this task.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Creating and assigning task...", {
      description: "Uploading files, generating code, and notifying team members...",
    });

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("departmentId", selectedCategoryId.toString());
      formData.set("priority", priority);
      formData.set("approvalRequired", approvalRequired ? "true" : "false");
      formData.set("approvalMode", approvalMode);

      // Append assignees
      formData.delete("assignees");
      selectedAssignees.forEach((id) => formData.append("assignees", id.toString()));

      // Append reviewers
      formData.delete("reviewers");
      selectedReviewers.forEach((id) => formData.append("reviewers", id.toString()));

      // Append reference links
      if (referenceLinks.length > 0) {
        formData.set("referenceLinks", JSON.stringify(referenceLinks));
      }

      // Append files
      formData.delete("files");
      files.forEach((f) => formData.append("files", f));

      const res = await createTaskAction(formData);
      if (res?.success) {
        toast.success(`Task ${res.taskCode} created successfully!`, {
          id: toastId,
          description: "Navigating to task workspace...",
          duration: 3500,
        });
        setTimeout(() => {
          router.push(`/tasks/${res.taskId}`);
        }, 500);
      } else {
        toast.error((res as any)?.error || "Failed to create task", { id: toastId });
        setLoading(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create task", { id: toastId });
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Basic Information Card */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" /> Basic Information
          </h2>
          <span className="text-[11px] text-neutral-500">
            Assigned By: <strong className="text-neutral-900">{creatorName}</strong> ({creatorRole})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              required
              placeholder="e.g. Design company brand identity kit"
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">
              Category / Department <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-900"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-700">Summary / Overview</label>
          <textarea
            name="description"
            rows={2}
            placeholder="Brief high-level summary of the task objectives"
            className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-900 resize-y"
          />
        </div>

        {/* Priority Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-700">Priority Level</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((lvl) => (
              <button
                type="button"
                key={lvl}
                onClick={() => setPriority(lvl)}
                className={`py-2 px-3 rounded-md text-xs font-semibold border transition-all text-center ${
                  priority === lvl
                    ? lvl === "URGENT"
                      ? "bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500"
                      : lvl === "HIGH"
                      ? "bg-amber-50 border-amber-500 text-amber-700 ring-1 ring-amber-500"
                      : "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Team Assignment Card (Category-first + Cross-department options) */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-neutral-100 gap-2">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" /> Assign To Team Member(s)
            </h2>
            <p className="text-[11px] text-neutral-500">
              Only members of <strong>{currentCategory?.name || "this category"}</strong> are shown by default.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded">
              {selectedAssignees.length} selected
            </span>
          </div>
        </div>

        {/* Cross-department assignment notice */}
        {crossDeptSelected.length > 0 && (
          <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Cross-Department Assignment Active:</span>{" "}
              <span>
                {crossDeptSelected.map((m) => `${m.name} (${m.primaryDepartment?.name || "External Dept"})`).join(", ")} will receive this task as cross-department deliverables.
              </span>
            </div>
          </div>
        )}

        {/* In-Category Members Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <span>{currentCategory?.name || "Selected Category"} Team</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full font-mono">
                {categoryMembers.length}
              </span>
            </span>
            <span className="text-[11px] text-neutral-400">Direct Category Members</span>
          </div>

          {categoryMembers.length === 0 ? (
            <div className="p-4 bg-neutral-50 border border-dashed border-neutral-300 rounded-lg text-center text-xs text-neutral-500">
              No members are currently assigned directly to {currentCategory?.name || "this category"}. You can assign members from other departments below.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
              {categoryMembers.map((member) => {
                const isSelected = selectedAssignees.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => toggleAssignee(member.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? "bg-blue-50/80 border-blue-400 text-blue-900 shadow-2xs"
                        : "bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-semibold truncate">{member.name}</p>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded shrink-0">
                          In-Category
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-500 truncate">
                        {member.designation || member.role.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cross-Department Toggle & Section */}
        <div className="pt-2 border-t border-neutral-100 space-y-3">
          <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-neutral-800">
              <input
                type="checkbox"
                checked={showCrossDeptMembers || categoryMembers.length === 0}
                onChange={(e) => setShowCrossDeptMembers(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>Assign member(s) outside this category (Cross-Department)</span>
            </label>
            <span className="text-[11px] text-neutral-500 font-medium">
              {outsideMembers.length} available in other departments
            </span>
          </div>

          {(showCrossDeptMembers || categoryMembers.length === 0) && (
            <div className="space-y-2 pl-1 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Other Departments & Categories</span>
                  <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded-full font-mono">
                    {outsideMembers.length}
                  </span>
                </span>
                <span className="text-[10px] text-purple-600 font-semibold">
                  Department affiliation clearly labeled
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
                {outsideMembers.map((member) => {
                  const isSelected = selectedAssignees.includes(member.id);
                  const deptName = member.primaryDepartment?.name || "Other Dept";
                  return (
                    <div
                      key={member.id}
                      onClick={() => toggleAssignee(member.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors text-xs ${
                        isSelected
                          ? "bg-purple-50/90 border-purple-400 text-purple-950 shadow-2xs ring-1 ring-purple-300"
                          : "bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-semibold truncate">{member.name}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-100 text-purple-800 border border-purple-200 rounded shrink-0">
                            {deptName} (Cross-Dept)
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-500 truncate">
                          {member.designation || member.role.name} • Dept: {deptName}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Schedule & Deadlines (Section 21) */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2 pb-2 border-b border-neutral-100">
          <Calendar className="w-4 h-4 text-blue-600" /> Schedule & Deadlines
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Start Date</label>
            <input
              type="date"
              name="startDate"
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Due Date</label>
            <input
              type="date"
              name="deadline"
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Due Time</label>
            <input
              type="time"
              name="dueTime"
              defaultValue="18:00"
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-900"
            />
          </div>
        </div>
      </div>

      {/* 4. Detailed Instructions & Guidelines (Section 24) */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2 pb-2 border-b border-neutral-100">
          <FileText className="w-4 h-4 text-blue-600" /> Detailed Instructions
        </h2>

        <div className="space-y-1.5">
          <p className="text-[11px] text-neutral-500">
            Write clear directions, deliverables, checklist points, and specifications.
          </p>
          <textarea
            name="instructions"
            rows={5}
            placeholder={`Example:
1. Maintain consistent branding spacing.
2. Submit preview PNG and editable source files.
3. Light and dark versions required.`}
            className="w-full px-3 py-2.5 text-xs font-mono bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-900 resize-y"
          />
        </div>
      </div>

      {/* 5. References & Attachments (Section 25-26, PostgreSQL BYTEA storage) */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2 pb-2 border-b border-neutral-100">
          <Paperclip className="w-4 h-4 text-blue-600" /> References & Attachments
        </h2>

        {/* File Upload Box */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-neutral-700">
            Upload Reference Files (stored securely in PostgreSQL)
          </label>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="block w-full text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer"
          />

          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs p-2 bg-neutral-50 border border-neutral-200 rounded-md"
                >
                  <span className="truncate max-w-xs font-medium">{f.name} ({(f.size / 1024).toFixed(1)} KB)</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(i)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* External Links */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-semibold text-neutral-700">External Links (Drive, Git, Figma, etc.)</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Title (e.g. Figma Design)"
              value={newLinkTitle}
              onChange={(e) => setNewLinkTitle(e.target.value)}
              className="w-1/3 px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-md"
            />
            <input
              type="url"
              placeholder="https://..."
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-md"
            />
            <button
              type="button"
              onClick={handleAddLink}
              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-md flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {referenceLinks.length > 0 && (
            <div className="space-y-1 mt-1">
              {referenceLinks.map((l, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs p-2 bg-neutral-50 border border-neutral-200 rounded-md"
                >
                  <span className="font-semibold text-blue-600">{l.displayName}: <span className="font-normal text-neutral-500">{l.url}</span></span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(i)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. Approval Workflow Configuration (Section 33-35) */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> Approval Workflow
          </h2>
          <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={approvalRequired}
              onChange={(e) => setApprovalRequired(e.target.checked)}
              className="rounded text-blue-600"
            />
            Approval Required
          </label>
        </div>

        {approvalRequired && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">Approval Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`p-3 rounded-md border cursor-pointer text-xs space-y-1 ${
                    approvalMode === "ANY_ONE"
                      ? "bg-blue-50/70 border-blue-400 text-blue-900"
                      : "bg-white border-neutral-200 text-neutral-700"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    <input
                      type="radio"
                      name="approvalModeRadio"
                      checked={approvalMode === "ANY_ONE"}
                      onChange={() => setApprovalMode("ANY_ONE")}
                      className="text-blue-600"
                    />
                    Any One Approver
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    The first authorized approver who approves will complete the approval.
                  </p>
                </label>

                <label
                  className={`p-3 rounded-md border cursor-pointer text-xs space-y-1 ${
                    approvalMode === "ALL_REQUIRED"
                      ? "bg-blue-50/70 border-blue-400 text-blue-900"
                      : "bg-white border-neutral-200 text-neutral-700"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    <input
                      type="radio"
                      name="approvalModeRadio"
                      checked={approvalMode === "ALL_REQUIRED"}
                      onChange={() => setApprovalMode("ALL_REQUIRED")}
                      className="text-blue-600"
                    />
                    All Required
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    All designated approvers must approve before task is marked completed.
                  </p>
                </label>
              </div>
            </div>

            {/* Designated Approvers */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">
                Designated Reviewers / Approvers
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {teamMembers
                  .filter((m) => m.role.code !== "employee")
                  .map((m) => {
                    const isSelected = selectedReviewers.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleReviewer(m.id)}
                        className={`p-2 rounded-md border cursor-pointer text-xs flex items-center gap-2 ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold"
                            : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded text-emerald-600"
                        />
                        <span className="truncate">{m.name} ({m.role.name})</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. Dynamic Category Custom Fields (Section 59) */}
      {customFields.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2 pb-2 border-b border-neutral-100">
            Category Specific Fields ({currentCategory?.name})
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customFields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700">
                  {field.fieldName} {field.isRequired && <span className="text-red-500">*</span>}
                </label>
                {field.fieldType === "DROPDOWN" && Array.isArray(field.options) ? (
                  <select
                    name={`cf_${field.fieldKey}`}
                    required={field.isRequired}
                    className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md"
                  >
                    <option value="">Select option...</option>
                    {field.options.map((opt: string) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.fieldType === "LONG_TEXT" ? (
                  <textarea
                    name={`cf_${field.fieldKey}`}
                    required={field.isRequired}
                    placeholder={field.placeholder || ""}
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md"
                  />
                ) : (
                  <input
                    type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : "text"}
                    name={`cf_${field.fieldKey}`}
                    required={field.isRequired}
                    placeholder={field.placeholder || ""}
                    className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-100">
        <div>
          {loading && (
            <div className="flex items-center gap-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-md animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Creating task and sending notifications...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={() => router.back()}
            className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-md transition-colors shadow-xs"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Creating Task...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Create & Assign Task</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
