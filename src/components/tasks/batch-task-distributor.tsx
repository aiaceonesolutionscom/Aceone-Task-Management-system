"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBatchDistributedTasksAction } from "@/server/actions/tasks";
import { toast } from "sonner";
import {
  Users,
  Sparkles,
  Layers,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Loader2,
  ArrowRight,
  Split,
  UserCheck,
  Shuffle,
  Clock,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  Link2,
  X,
  ExternalLink,
  Plus,
  FileText,
} from "lucide-react";

type CategoryItem = {
  id: number;
  name: string;
  code: string | null;
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

interface TaskFile {
  fileName: string;
  mimeType: string;
  base64: string;
  size: number;
}

interface TaskLink {
  displayName: string;
  url: string;
}

interface TaskItem {
  id: string;
  title: string;
  assigneeId: number | null; // null = auto round-robin
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  files?: TaskFile[];
  referenceLinks?: TaskLink[];
}

const SAMPLE_10_TASKS = [
  "Design Homepage Hero Visuals & Banners",
  "Create Instagram Carousel Graphics (5 Slides)",
  "Export High-Res Vector Icons Set",
  "Design Mobile App Onboarding Flow UI",
  "Compile Brand Guidelines & Typography PDF",
  "Design Weekly Newsletter Email Layout",
  "Render 3D Product Presentation Mockups",
  "Design LinkedIn B2B Announcement Graphics",
  "Create Paid Social Media Ad Variants (1080x1080)",
  "Design Executive Pitch Deck Slides",
];

export function BatchTaskDistributor({
  categories,
  teamMembers,
}: {
  categories: CategoryItem[];
  teamMembers: TeamMemberItem[];
}) {
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(
    categories[0]?.id || 1
  );
  const [taskText, setTaskText] = useState<string>("");
  const [distributionMode, setDistributionMode] = useState<"auto" | "custom">("auto");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [deadline, setDeadline] = useState<string>("");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showOutsideMembers, setShowOutsideMembers] = useState(false);

  // Category membership helper
  const isMemberOfCategory = (m: TeamMemberItem, catId: number) => {
    if (m.primaryDepartmentId === catId) return true;
    if (m.memberships?.some((mem) => mem.departmentId === catId)) return true;
    return false;
  };

  // Active members in selected category
  const categoryMembers = teamMembers.filter(
    (m) => isMemberOfCategory(m, selectedCategoryId) && m.role.code !== "super_admin"
  );

  // Members outside the category
  const outsideMembers = teamMembers.filter(
    (m) => !isMemberOfCategory(m, selectedCategoryId) && m.role.code !== "super_admin"
  );

  // Effective members for round-robin / selection
  const effectiveMembers =
    showOutsideMembers || categoryMembers.length === 0
      ? [...categoryMembers, ...outsideMembers]
      : categoryMembers.length > 0
      ? categoryMembers
      : teamMembers.filter((m) => m.role.code === "employee" || m.role.code === "manager").slice(0, 6);

  // Individual task items for custom assignment mode
  const [taskItems, setTaskItems] = useState<TaskItem[]>([]);

  // Parse task titles from textarea while preserving existing attachments & links
  useEffect(() => {
    const lines = taskText
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setTaskItems((prev) => {
      return lines.map((title, idx) => {
        const existing = prev[idx];
        return {
          id: existing?.id || `task-${idx}-${Date.now()}`,
          title,
          assigneeId: existing?.assigneeId ?? null,
          priority: existing?.priority || priority,
          files: existing?.files || [],
          referenceLinks: existing?.referenceLinks || [],
        };
      });
    });
  }, [taskText, priority]);

  // Inline reference link adder state
  const [addingLinkForIndex, setAddingLinkForIndex] = useState<number | null>(null);
  const [inlineLinkTitle, setInlineLinkTitle] = useState("");
  const [inlineLinkUrl, setInlineLinkUrl] = useState("");

  const handlePreFill10 = () => {
    setTaskText(SAMPLE_10_TASKS.join("\n"));
  };

  // Auto assign tasks evenly in custom mode
  const handleAutoDistributeInCustomMode = () => {
    if (effectiveMembers.length === 0) return;
    setTaskItems((prev) =>
      prev.map((item, idx) => ({
        ...item,
        assigneeId: effectiveMembers[idx % effectiveMembers.length].id,
      }))
    );
    toast.success("Tasks auto-distributed evenly across category members!");
  };

  const handleTaskAssigneeChange = (index: number, newAssigneeId: number | null) => {
    setTaskItems((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], assigneeId: newAssigneeId };
      }
      return copy;
    });
  };

  // File upload for individual task
  const handleTaskFileUpload = async (taskIdx: number, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newFiles: TaskFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`File ${f.name} exceeds 20MB limit.`);
        continue;
      }
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            resolve(res.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
        newFiles.push({
          fileName: f.name,
          mimeType: f.type || "application/octet-stream",
          base64,
          size: f.size,
        });
      } catch {
        toast.error(`Could not read file ${f.name}`);
      }
    }

    if (newFiles.length > 0) {
      setTaskItems((prev) => {
        const copy = [...prev];
        if (copy[taskIdx]) {
          copy[taskIdx] = {
            ...copy[taskIdx],
            files: [...(copy[taskIdx].files || []), ...newFiles],
          };
        }
        return copy;
      });
      toast.success(`Attached ${newFiles.length} reference file(s) to Task #${taskIdx + 1}`);
    }
  };

  const handleRemoveTaskFile = (taskIdx: number, fileIdx: number) => {
    setTaskItems((prev) => {
      const copy = [...prev];
      if (copy[taskIdx]) {
        const updatedFiles = [...(copy[taskIdx].files || [])];
        updatedFiles.splice(fileIdx, 1);
        copy[taskIdx] = { ...copy[taskIdx], files: updatedFiles };
      }
      return copy;
    });
  };

  const handleAddTaskLink = (taskIdx: number) => {
    if (!inlineLinkUrl.trim()) return;
    const newLink: TaskLink = {
      displayName: inlineLinkTitle.trim() || inlineLinkUrl.trim(),
      url: inlineLinkUrl.trim(),
    };
    setTaskItems((prev) => {
      const copy = [...prev];
      if (copy[taskIdx]) {
        copy[taskIdx] = {
          ...copy[taskIdx],
          referenceLinks: [...(copy[taskIdx].referenceLinks || []), newLink],
        };
      }
      return copy;
    });
    setInlineLinkTitle("");
    setInlineLinkUrl("");
    setAddingLinkForIndex(null);
    toast.success(`Reference link added to Task #${taskIdx + 1}`);
  };

  const handleRemoveTaskLink = (taskIdx: number, linkIdx: number) => {
    setTaskItems((prev) => {
      const copy = [...prev];
      if (copy[taskIdx]) {
        const updatedLinks = [...(copy[taskIdx].referenceLinks || [])];
        updatedLinks.splice(linkIdx, 1);
        copy[taskIdx] = { ...copy[taskIdx], referenceLinks: updatedLinks };
      }
      return copy;
    });
  };

  const handleDistribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taskItems.length === 0) {
      toast.error("Please enter at least one task title.");
      return;
    }

    if (effectiveMembers.length === 0) {
      toast.error("No active team members found in this category.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading(
      `Creating and distributing ${taskItems.length} tasks...`,
      { description: "Generating automated task IDs and assigning team members..." }
    );

    try {
      const payloadTasks = taskItems.map((item, idx) => {
        // In auto mode, assign round-robin
        const finalAssigneeId =
          distributionMode === "auto" || item.assigneeId === null
            ? effectiveMembers[idx % effectiveMembers.length].id
            : item.assigneeId;

        return {
          title: item.title,
          assigneeId: finalAssigneeId,
          priority: item.priority || priority,
          deadline: deadline || undefined,
          referenceLinks: item.referenceLinks && item.referenceLinks.length > 0 ? item.referenceLinks : undefined,
          files: item.files?.map((f) => ({
            fileName: f.fileName,
            mimeType: f.mimeType,
            base64: f.base64,
          })),
        };
      });

      const res = await createBatchDistributedTasksAction({
        departmentId: selectedCategoryId,
        tasks: payloadTasks,
        priority,
        deadline: deadline || undefined,
        approvalRequired,
      });

      if (res?.success) {
        toast.success(
          `Successfully created & distributed ${res.totalCreated} tasks across category team!`,
          {
            id: toastId,
            description: "Assignees have received task notifications in real-time.",
            duration: 4500,
          }
        );
        setTimeout(() => {
          router.push("/tasks");
        }, 600);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to distribute tasks", { id: toastId });
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleDistribute} className="space-y-6">
      {/* 1. Target Category & Team Overview */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <Split className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-neutral-900">
              Bulk Category Task Creator & Distribution
            </h2>
          </div>
          <span className="text-[11px] text-neutral-500 font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
            Smart Team Allocation
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Target Category / Team *</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 font-medium"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Category Team Members</label>
            <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-md flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs font-bold text-neutral-800">
                  {effectiveMembers.length} Members in this Category
                </span>
              </div>
              <span className="text-[10px] text-neutral-500">
                {distributionMode === "auto" ? "Split evenly" : "Customizable per task"}
              </span>
            </div>
          </div>
        </div>

        {/* Member badges */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] text-neutral-400 font-medium">Available Assignees:</span>
          {effectiveMembers.map((m, idx) => (
            <span
              key={m.id}
              className="text-[11px] bg-neutral-100 border border-neutral-200 text-neutral-800 px-2 py-0.5 rounded-full font-medium"
            >
              #{idx + 1} {m.name} {m.designation ? `(${m.designation})` : ""}
            </span>
          ))}
        </div>
      </div>

      {/* 2. Tasks Input Area */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" /> Write or Paste Tasks ({taskItems.length})
            </h2>
            <p className="text-[11px] text-neutral-500">
              Paste or type all your task titles (one task per line).
            </p>
          </div>
          <button
            type="button"
            onClick={handlePreFill10}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Pre-fill 10 Tasks</span>
          </button>
        </div>

        <textarea
          rows={6}
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          placeholder="1. Design homepage header visuals
2. Create mobile app mockup
3. Export SVG vector icon set
4. Update design system brand guide..."
          className="w-full px-3 py-2.5 text-xs font-mono bg-neutral-50/50 border border-neutral-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 leading-relaxed"
        />

        {/* 3. Distribution Mode Selector (Auto Divide vs Custom Assign) */}
        {taskItems.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-neutral-800">
                How should these {taskItems.length} tasks be distributed?
              </label>

              <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-lg border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setDistributionMode("auto")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    distributionMode === "auto"
                      ? "bg-white text-neutral-900 shadow-2xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5 text-blue-600" />
                  <span>Auto Divide Equally (Round-Robin)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDistributionMode("custom")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    distributionMode === "custom"
                      ? "bg-white text-neutral-900 shadow-2xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Assign Specific Person Per Task</span>
                </button>
              </div>
            </div>

            {/* Mode 1: Auto Divide Live Preview */}
            {distributionMode === "auto" && (
              <div className="p-3.5 bg-blue-50/50 rounded-lg border border-blue-200/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                  <span className="flex items-center gap-1.5 text-blue-900">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Automatic Equal Distribution Summary</span>
                  </span>
                  <span className="text-[11px] text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                    ~{Math.ceil(taskItems.length / effectiveMembers.length)} tasks per member
                  </span>
                </div>

                {/* Cross-Department Toggle */}
                <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-neutral-800">
                    <input
                      type="checkbox"
                      checked={showOutsideMembers || categoryMembers.length === 0}
                      onChange={(e) => setShowOutsideMembers(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Assign member(s) outside this category (Cross-Department)</span>
                  </label>
                  <span className="text-[11px] text-neutral-500 font-medium">
                    {categoryMembers.length} in category • {outsideMembers.length} in other departments
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {effectiveMembers.map((member, memberIdx) => {
                    const assignedForMember = taskItems.filter(
                      (_, taskIdx) => taskIdx % effectiveMembers.length === memberIdx
                    );
                    const isOutside = !isMemberOfCategory(member, selectedCategoryId);
                    return (
                      <div
                        key={member.id}
                        className={`p-3 rounded-lg border space-y-1.5 text-xs shadow-2xs ${
                          isOutside
                            ? "bg-purple-50/40 border-purple-200"
                            : "bg-white border-neutral-200"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-neutral-900 border-b border-neutral-100 pb-1">
                          <div className="min-w-0">
                            <span className="truncate block">{member.name}</span>
                            {isOutside && (
                              <span className="text-[9px] text-purple-700 font-semibold block">
                                Dept: {member.primaryDepartment?.name || "Cross-Dept"}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono shrink-0">
                            {assignedForMember.length} tasks
                          </span>
                        </div>
                        <ul className="space-y-1 text-[11px] text-neutral-600 max-h-24 overflow-y-auto">
                          {assignedForMember.map((t, idx) => (
                            <li key={idx} className="truncate list-disc list-inside">
                              {t.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Task Items List: Assignee, Reference Images & Links */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      {distributionMode === "custom"
                        ? "Task Assignment & Reference Materials"
                        : "Task Reference Materials & Assets"}
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Attach reference images, briefs, or external links (Figma, Drive) to each task individually.
                  </p>
                </div>
                {distributionMode === "custom" && (
                  <button
                    type="button"
                    onClick={handleAutoDistributeInCustomMode}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 bg-white border border-blue-200 px-2.5 py-1 rounded shadow-2xs cursor-pointer"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Auto Distribute All</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden bg-white max-h-[500px] overflow-y-auto">
                {taskItems.map((item, idx) => {
                  const autoAssignee = effectiveMembers[idx % effectiveMembers.length];
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 space-y-2.5 hover:bg-neutral-50/70 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="w-6 h-6 rounded-full bg-neutral-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-neutral-900 leading-snug">
                              {item.title}
                            </p>
                          </div>
                        </div>

                        {/* Assignee Selection */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-neutral-500 font-medium">Assign To:</span>
                          {distributionMode === "custom" ? (
                            <select
                              value={item.assigneeId ?? ""}
                              onChange={(e) =>
                                handleTaskAssigneeChange(
                                  idx,
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                              className="px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-md font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900 min-w-[170px]"
                            >
                              <option value="">Auto (Round-Robin)</option>
                              {categoryMembers.length > 0 && (
                                <optgroup label={`${categories.find((c) => c.id === selectedCategoryId)?.name || "In-Category"} Members`}>
                                  {categoryMembers.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.designation || "Staff"}) - In-Category
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {(showOutsideMembers || categoryMembers.length === 0) && outsideMembers.length > 0 && (
                                <optgroup label="Other Departments (Cross-Department)">
                                  {outsideMembers.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.designation || "Staff"}) - {m.primaryDepartment?.name || "Other"} (Cross-Dept)
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          ) : (
                            <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-200 rounded text-xs font-medium text-neutral-700">
                              Auto: <strong>{autoAssignee?.name}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Reference Files & Links for THIS Task */}
                      <div className="pl-8 space-y-2">
                        {/* Display Attached Files & Images */}
                        {item.files && item.files.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {item.files.map((file, fileIdx) => {
                              const isImg = file.mimeType.startsWith("image/");
                              return (
                                <div
                                  key={fileIdx}
                                  className="flex items-center gap-1.5 p-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                                >
                                  {isImg ? (
                                    <img
                                      src={`data:${file.mimeType};base64,${file.base64}`}
                                      alt={file.fileName}
                                      className="w-7 h-7 rounded object-cover border border-neutral-200 shrink-0"
                                    />
                                  ) : (
                                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                  )}
                                  <div className="min-w-0 max-w-[140px]">
                                    <p className="truncate font-semibold text-neutral-800 text-[11px]">
                                      {file.fileName}
                                    </p>
                                    <p className="text-[10px] text-neutral-400">
                                      {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTaskFile(idx, fileIdx)}
                                    className="p-1 text-neutral-400 hover:text-rose-600 rounded cursor-pointer"
                                    title="Remove file"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Display Attached Links */}
                        {item.referenceLinks && item.referenceLinks.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {item.referenceLinks.map((link, linkIdx) => (
                              <div
                                key={linkIdx}
                                className="flex items-center gap-1.5 px-2 py-1 bg-blue-50/70 border border-blue-200 rounded-md text-xs text-blue-900"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="font-semibold truncate max-w-[140px] text-[11px]">
                                  {link.displayName}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTaskLink(idx, linkIdx)}
                                  className="p-0.5 text-blue-400 hover:text-rose-600 rounded cursor-pointer"
                                  title="Remove link"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline Link Input */}
                        {addingLinkForIndex === idx && (
                          <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-md space-y-2 max-w-md animate-in fade-in duration-100">
                            <span className="text-[11px] font-bold text-neutral-700">
                              Add Reference Link to Task #{idx + 1}
                            </span>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Title (e.g. Figma, Drive)"
                                value={inlineLinkTitle}
                                onChange={(e) => setInlineLinkTitle(e.target.value)}
                                className="w-1/3 px-2 py-1 text-xs bg-white border border-neutral-300 rounded"
                              />
                              <input
                                type="url"
                                placeholder="https://..."
                                value={inlineLinkUrl}
                                onChange={(e) => setInlineLinkUrl(e.target.value)}
                                className="flex-1 px-2 py-1 text-xs bg-white border border-neutral-300 rounded"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingLinkForIndex(null);
                                  setInlineLinkTitle("");
                                  setInlineLinkUrl("");
                                }}
                                className="px-2 py-1 text-[11px] text-neutral-500 hover:text-neutral-800 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddTaskLink(idx)}
                                disabled={!inlineLinkUrl.trim()}
                                className="px-2.5 py-1 text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded disabled:opacity-50 cursor-pointer"
                              >
                                Add Link
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons to attach image or link */}
                        <div className="flex items-center gap-2 pt-0.5">
                          <label className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded text-[11px] font-semibold text-neutral-700 cursor-pointer shadow-2xs">
                            <ImageIcon className="w-3 h-3 text-emerald-600" />
                            <span>Attach Reference Image/File</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*,.pdf,.zip,.doc,.docx"
                              onChange={(e) => {
                                handleTaskFileUpload(idx, e.target.files);
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              setAddingLinkForIndex(idx);
                              setInlineLinkTitle("");
                              setInlineLinkUrl("");
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded text-[11px] font-semibold text-neutral-700 cursor-pointer shadow-2xs"
                          >
                            <Link2 className="w-3 h-3 text-blue-600" />
                            <span>Add Reference Link</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Global Settings & Submission */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700">Default Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700">Unified Deadline (Optional)</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="flex items-center gap-2 font-semibold text-neutral-800 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={approvalRequired}
                onChange={(e) => setApprovalRequired(e.target.checked)}
                className="rounded text-blue-600 w-4 h-4"
              />
              <span>Reviewer Approval Required</span>
            </label>
          </div>
        </div>

        <div className="pt-3 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs text-neutral-500 font-medium">
            Ready to create: <strong>{taskItems.length} tasks</strong> across{" "}
            <strong>{effectiveMembers.length} team members</strong>.
          </span>

          <button
            type="submit"
            disabled={loading || taskItems.length === 0}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-md text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Distributing Tasks...</span>
              </>
            ) : (
              <>
                <span>Create & Distribute All Tasks</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
