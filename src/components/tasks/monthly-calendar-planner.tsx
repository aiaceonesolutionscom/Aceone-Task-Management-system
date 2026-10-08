"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createMonthlyScheduledTasksAction, MonthlyScheduleTaskItem } from "@/server/actions/tasks";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Trash2,
  Plus,
  Sliders,
  Check,
  CheckSquare,
  Square,
  Layers,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  FileText,
  UserCheck,
  Zap,
} from "lucide-react";

type CategoryItem = {
  id: number;
  name: string;
  code: string | null;
  approvalRequired?: boolean;
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

interface PlannedTask {
  id: string; // client temporary ID
  title: string;
  description: string;
  scheduledDate: string; // "YYYY-MM-DD"
  dueTime: string; // "18:00"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeId: number | null; // null = auto divide
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthlyCalendarPlanner({
  categories,
  teamMembers,
}: {
  categories: CategoryItem[];
  teamMembers: TeamMemberItem[];
}) {
  const router = useRouter();

  // Current date anchor
  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(now.getMonth());

  // Form Configuration
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(categories[0]?.id || 1);
  const [distributionMode, setDistributionMode] = useState<"divide_equally" | "specific_person" | "per_task">("divide_equally");
  const [globalAssigneeId, setGlobalAssigneeId] = useState<number | null>(null);
  const [masterPriority, setMasterPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [defaultDueTime, setDefaultDueTime] = useState<string>("18:00");
  const [approvalRequired, setApprovalRequired] = useState(true);

  // Planned tasks list
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pattern Generator modal / inline state
  const [patternPrefix, setPatternPrefix] = useState("Task #{day}");
  const [pasteText, setPasteText] = useState("");
  const [showPatternTools, setShowPatternTools] = useState(false);

  // Determine category membership
  const isMemberOfCategory = (m: TeamMemberItem, catId: number) => {
    if (m.primaryDepartmentId === catId) return true;
    if (m.memberships?.some((mem) => mem.departmentId === catId)) return true;
    return false;
  };

  // Active category members (excluding super admins)
  const categoryMembers = useMemo(() => {
    return teamMembers.filter(
      (m) => isMemberOfCategory(m, selectedCategoryId) && m.role.code !== "super_admin"
    );
  }, [teamMembers, selectedCategoryId]);

  // Calendar calculations for current displayed month
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    // Monday = 0, Sunday = 6
    const firstDayOfWeek = (new Date(currentYear, currentMonthIndex, 1).getDay() + 6) % 7;

    const days: Array<{
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: boolean;
    }> = [];

    // Leading padding from previous month
    const prevMonthDays = new Date(currentYear, currentMonthIndex, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDay = prevMonthDays - i;
      const prevDate = new Date(currentYear, currentMonthIndex - 1, prevDay);
      const y = prevDate.getFullYear();
      const m = String(prevDate.getMonth() + 1).padStart(2, "0");
      const d = String(prevDay).padStart(2, "0");
      days.push({
        dateString: `${y}-${m}-${d}`,
        dayNumber: prevDay,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: prevDate.getDay() === 0 || prevDate.getDay() === 6,
      });
    }

    // Days of current month
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = String(day).padStart(2, "0");
      const mStr = String(currentMonthIndex + 1).padStart(2, "0");
      const dateString = `${currentYear}-${mStr}-${dStr}`;
      const dayDate = new Date(currentYear, currentMonthIndex, day);
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;

      days.push({
        dateString,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateString === todayStr,
        isWeekend,
      });
    }

    // Trailing padding to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const nextDate = new Date(currentYear, currentMonthIndex + 1, day);
      const y = nextDate.getFullYear();
      const m = String(nextDate.getMonth() + 1).padStart(2, "0");
      const d = String(day).padStart(2, "0");
      days.push({
        dateString: `${y}-${m}-${d}`,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: nextDate.getDay() === 0 || nextDate.getDay() === 6,
      });
    }

    return days;
  }, [currentYear, currentMonthIndex]);

  // Tasks grouped by date string
  const tasksByDate = useMemo(() => {
    const map: Record<string, PlannedTask[]> = {};
    for (const t of plannedTasks) {
      if (!map[t.scheduledDate]) map[t.scheduledDate] = [];
      map[t.scheduledDate].push(t);
    }
    return map;
  }, [plannedTasks]);

  // Workload count per member
  const memberWorkload = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const m of categoryMembers) counts[m.id] = 0;

    let roundRobinIdx = 0;
    plannedTasks.forEach((t) => {
      let targetId: number | null = null;
      if (distributionMode === "specific_person" && globalAssigneeId) {
        targetId = globalAssigneeId;
      } else if (t.assigneeId) {
        targetId = t.assigneeId;
      } else if (categoryMembers.length > 0) {
        targetId = categoryMembers[roundRobinIdx % categoryMembers.length].id;
        roundRobinIdx++;
      }
      if (targetId && counts[targetId] !== undefined) {
        counts[targetId]++;
      }
    });

    return counts;
  }, [plannedTasks, categoryMembers, distributionMode, globalAssigneeId]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    setCurrentYear(now.getFullYear());
    setCurrentMonthIndex(now.getMonth());
  };

  // Add a task to a specific date
  const handleAddTaskToDate = (dateString: string, title?: string) => {
    const newTask: PlannedTask = {
      id: Math.random().toString(36).substring(2, 9),
      title: title || `Task for ${dateString.split("-")[2]} ${MONTH_NAMES[parseInt(dateString.split("-")[1], 10) - 1]}`,
      description: "",
      scheduledDate: dateString,
      dueTime: defaultDueTime,
      priority: masterPriority,
      assigneeId: distributionMode === "specific_person" ? globalAssigneeId : null,
    };
    setPlannedTasks((prev) => [...prev, newTask]);
    setActiveDateFilter(dateString);
  };

  // Quick Action: Fill all weekdays (Mon-Fri) of current month
  const handleFillWeekdays = () => {
    const currentMonthDays = calendarDays.filter((d) => d.isCurrentMonth && !d.isWeekend);
    const existingDates = new Set(plannedTasks.map((t) => t.scheduledDate));

    const newTasks: PlannedTask[] = [];
    currentMonthDays.forEach((d) => {
      if (!existingDates.has(d.dateString)) {
        newTasks.push({
          id: Math.random().toString(36).substring(2, 9),
          title: `Daily Assignment - Day ${d.dayNumber}`,
          description: "",
          scheduledDate: d.dateString,
          dueTime: defaultDueTime,
          priority: masterPriority,
          assigneeId: distributionMode === "specific_person" ? globalAssigneeId : null,
        });
      }
    });

    if (newTasks.length === 0) {
      toast.info("All weekdays already have tasks planned.");
      return;
    }

    setPlannedTasks((prev) => [...prev, ...newTasks]);
    toast.success(`Added ${newTasks.length} tasks across working weekdays!`);
  };

  // Quick Action: Fill entire month (Every Day)
  const handleFillAllDays = () => {
    const currentMonthDays = calendarDays.filter((d) => d.isCurrentMonth);
    const existingDates = new Set(plannedTasks.map((t) => t.scheduledDate));

    const newTasks: PlannedTask[] = [];
    currentMonthDays.forEach((d) => {
      if (!existingDates.has(d.dateString)) {
        newTasks.push({
          id: Math.random().toString(36).substring(2, 9),
          title: `Daily Campaign Task - Day ${d.dayNumber}`,
          description: "",
          scheduledDate: d.dateString,
          dueTime: defaultDueTime,
          priority: masterPriority,
          assigneeId: distributionMode === "specific_person" ? globalAssigneeId : null,
        });
      }
    });

    if (newTasks.length === 0) {
      toast.info("Every day in this month already has tasks scheduled.");
      return;
    }

    setPlannedTasks((prev) => [...prev, ...newTasks]);
    toast.success(`Scheduled ${newTasks.length} tasks covering every day of the month!`);
  };

  // Quick Action: Generate titles using pattern
  const handleApplyPattern = () => {
    if (!patternPrefix.trim()) return;

    const currentMonthDays = calendarDays.filter((d) => d.isCurrentMonth);
    const newTasks: PlannedTask[] = [];

    currentMonthDays.forEach((d) => {
      const generatedTitle = patternPrefix.replace("{day}", String(d.dayNumber));
      newTasks.push({
        id: Math.random().toString(36).substring(2, 9),
        title: generatedTitle,
        description: "",
        scheduledDate: d.dateString,
        dueTime: defaultDueTime,
        priority: masterPriority,
        assigneeId: distributionMode === "specific_person" ? globalAssigneeId : null,
      });
    });

    setPlannedTasks(newTasks);
    toast.success(`Replaced with ${newTasks.length} pattern-generated tasks!`);
    setShowPatternTools(false);
  };

  // Quick Action: Paste titles line-by-line
  const handleApplyPastedLines = () => {
    const lines = pasteText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      toast.error("Please paste at least one task title.");
      return;
    }

    const currentMonthDays = calendarDays.filter((d) => d.isCurrentMonth);
    const newTasks: PlannedTask[] = [];

    lines.forEach((line, index) => {
      const targetDay = currentMonthDays[index % currentMonthDays.length];
      newTasks.push({
        id: Math.random().toString(36).substring(2, 9),
        title: line,
        description: "",
        scheduledDate: targetDay.dateString,
        dueTime: defaultDueTime,
        priority: masterPriority,
        assigneeId: distributionMode === "specific_person" ? globalAssigneeId : null,
      });
    });

    setPlannedTasks((prev) => [...prev, ...newTasks]);
    toast.success(`Added ${newTasks.length} tasks from pasted text!`);
    setPasteText("");
    setShowPatternTools(false);
  };

  // Bulk Priority: Apply Master Priority to ALL planned tasks
  const handleApplyMasterPriorityToAll = (newPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT") => {
    setMasterPriority(newPriority);
    setPlannedTasks((prev) => prev.map((t) => ({ ...t, priority: newPriority })));
    toast.success(`Updated all ${plannedTasks.length} planned tasks to ${newPriority} priority!`);
  };

  // Bulk Priority: Apply priority to selected checked tasks
  const handleApplyPriorityToSelected = (newPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT") => {
    if (selectedTaskIds.size === 0) {
      toast.error("Please select at least one task using the checkboxes.");
      return;
    }

    setPlannedTasks((prev) =>
      prev.map((t) => (selectedTaskIds.has(t.id) ? { ...t, priority: newPriority } : t))
    );
    toast.success(`Updated ${selectedTaskIds.size} selected tasks to ${newPriority} priority!`);
  };

  // Selection toggle
  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllTasks = () => {
    if (selectedTaskIds.size === plannedTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(plannedTasks.map((t) => t.id)));
    }
  };

  // Remove a task
  const handleRemoveTask = (id: string) => {
    setPlannedTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Submit and create all tasks in bulk
  const handleSubmitMonthlySchedule = async () => {
    if (plannedTasks.length === 0) {
      toast.error("Please plan at least one task on the calendar before saving.");
      return;
    }

    if (categoryMembers.length === 0 && distributionMode === "divide_equally") {
      toast.error("No active team members in this category to assign tasks to.");
      return;
    }

    setLoading(true);
    try {
      const monthString = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}`;

      const res = await createMonthlyScheduledTasksAction({
        departmentId: selectedCategoryId,
        month: monthString,
        distributionMode,
        globalAssigneeId: distributionMode === "specific_person" ? globalAssigneeId : null,
        priority: masterPriority,
        dueTime: defaultDueTime,
        approvalRequired,
        tasks: plannedTasks.map((t) => ({
          title: t.title,
          description: t.description,
          scheduledDate: t.scheduledDate,
          dueTime: t.dueTime || defaultDueTime,
          assigneeId: distributionMode === "per_task" ? t.assigneeId : null,
          priority: t.priority,
        })),
      });

      if (res.success) {
        toast.success(`Successfully created and scheduled ${res.totalCreated} tasks for ${MONTH_NAMES[currentMonthIndex]}!`);
        router.push("/tasks");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create scheduled tasks. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredTasksForList = activeDateFilter
    ? plannedTasks.filter((t) => t.scheduledDate === activeDateFilter)
    : plannedTasks;

  return (
    <div className="space-y-6">
      {/* Notice Banner explaining the scheduled unlock logic */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-purple-50/80 p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-600 p-2 text-white shadow-xs shrink-0 mt-0.5">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-900">
                Monthly Schedule & Automated Daily Task Unlock
              </h2>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 uppercase tracking-wider">
                Full Month Planner
              </span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Plan the entire month&apos;s assignments in one go. Each task is scheduled for its specific date (e.g. 1st of the month, 2nd, 3rd) and{" "}
              <strong className="text-neutral-900 font-semibold">will automatically unlock for the employee on that day</strong> — keeping upcoming days hidden until their date arrives.
            </p>
          </div>
        </div>
      </div>

      {/* Top Configuration Bar: Category, Assignment Mode & Global Priority */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-neutral-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
              Planner Configuration & Assignment
            </h3>
          </div>
          <div className="text-xs text-neutral-500 font-medium">
            Category Members: <span className="font-bold text-neutral-900">{categoryMembers.length} active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span>Target Category</span>
              <span className="text-[11px] text-neutral-400 font-normal">Department</span>
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(parseInt(e.target.value, 10));
                setGlobalAssigneeId(null);
              }}
              className="w-full text-xs font-medium bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.code || `#${cat.id}`})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-neutral-400">
              Tasks will be scoped and distributed within this department.
            </p>
          </div>

          {/* 2. Assignment Distribution Mode (Beside the calendar / right here) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span>Assignment Mode</span>
              <span className="text-[11px] text-blue-600 font-semibold">Bulk or Specific</span>
            </label>
            <select
              value={distributionMode}
              onChange={(e) => setDistributionMode(e.target.value as any)}
              className="w-full text-xs font-medium bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
            >
              <option value="divide_equally">⚡ Divide Equally Among Category Team (Auto-Split)</option>
              <option value="specific_person">👤 Specific Team Member (Assign All to 1 Person)</option>
              <option value="per_task">🎯 Per-Task Custom Assignee</option>
            </select>

            {distributionMode === "specific_person" && (
              <div className="pt-1.5">
                <select
                  value={globalAssigneeId || ""}
                  onChange={(e) => setGlobalAssigneeId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full text-xs font-semibold bg-blue-50/50 border border-blue-200 rounded-lg px-3 py-2 text-blue-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Select Specific Person...</option>
                  {categoryMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.designation || "Member"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {distributionMode === "divide_equally" && (
              <p className="text-[11px] text-neutral-500">
                Tasks will automatically rotate round-robin across all {categoryMembers.length} team members.
              </p>
            )}
          </div>

          {/* 3. Master Priority & Bulk Apply */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span>Master Task Priority</span>
              <span className="text-[11px] text-neutral-400 font-normal">All Tasks</span>
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => {
                const isSelected = masterPriority === p;
                const colors = {
                  LOW: isSelected ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                  MEDIUM: isSelected ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100",
                  HIGH: isSelected ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100",
                  URGENT: isSelected ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100",
                };
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleApplyMasterPriorityToAll(p)}
                    className={`text-[11px] font-bold py-1.5 rounded-md transition-colors cursor-pointer text-center ${colors[p]}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-neutral-400">
              Clicking a priority above updates all planned tasks instantly.
            </p>
          </div>
        </div>

        {/* Live Category Members Workload Preview Bar */}
        {categoryMembers.length > 0 && (
          <div className="border-t border-neutral-100 pt-3">
            <div className="text-[11px] font-semibold text-neutral-500 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Projected Workload Distribution ({plannedTasks.length} tasks total):</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {categoryMembers.map((member) => {
                const count = memberWorkload[member.id] || 0;
                return (
                  <div
                    key={member.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-200 text-xs"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-semibold text-neutral-800">{member.name}</span>
                    <span className="font-mono text-[10px] bg-white border border-neutral-200 px-1.5 py-0.2 rounded font-bold text-neutral-600">
                      {count} {count === 1 ? "task" : "tasks"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Calendar & Plan Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Monthly Calendar Grid (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4">
          {/* Calendar Header with Month Navigation */}
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-900 tracking-tight">
                {MONTH_NAMES[currentMonthIndex]} {currentYear}
              </h2>
              <button
                type="button"
                onClick={handleJumpToToday}
                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-700 transition-colors border border-neutral-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-700 transition-colors border border-neutral-200"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Schedule Generators Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFillWeekdays}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Fill All Weekdays (Mon-Fri)</span>
            </button>

            <button
              type="button"
              onClick={handleFillAllDays}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-800 hover:bg-neutral-200 transition-colors border border-neutral-200 cursor-pointer"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-neutral-600" />
              <span>Fill Full Month (Every Day)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPatternTools(!showPatternTools)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors border border-purple-200 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pattern / Paste Titles</span>
            </button>

            {plannedTasks.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Are you sure you want to clear all planned tasks?")) {
                    setPlannedTasks([]);
                    setSelectedTaskIds(new Set());
                    setActiveDateFilter(null);
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors ml-auto cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {/* Pattern / Paste Tools Drawer */}
          {showPatternTools && (
            <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Quick Batch Generators
                </span>
                <button
                  type="button"
                  onClick={() => setShowPatternTools(false)}
                  className="text-xs text-purple-600 hover:text-purple-900 font-semibold"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Method 1: Prefix Pattern */}
                <div className="space-y-1.5 bg-white p-3 rounded-lg border border-purple-100">
                  <label className="text-[11px] font-bold text-neutral-700 block">
                    Option A: Pattern Title (use &#123;day&#125; placeholder)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={patternPrefix}
                      onChange={(e) => setPatternPrefix(e.target.value)}
                      placeholder="e.g. Design Creative #{day}"
                      className="text-xs font-medium px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md w-full"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPattern}
                      className="px-3 py-1.5 rounded-md bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 shrink-0"
                    >
                      Generate
                    </button>
                  </div>
                  <span className="text-[10px] text-neutral-400 block">
                    Generates 1 task per day: &quot;Design Creative #1&quot;, &quot;#2&quot;, etc.
                  </span>
                </div>

                {/* Method 2: Paste List of Titles */}
                <div className="space-y-1.5 bg-white p-3 rounded-lg border border-purple-100">
                  <label className="text-[11px] font-bold text-neutral-700 block">
                    Option B: Paste Titles (One line per task)
                  </label>
                  <textarea
                    rows={2}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Hero Banner Design&#10;Carousel Graphics&#10;Icon Set Export"
                    className="w-full text-xs font-medium px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPastedLines}
                    className="px-3 py-1 rounded-md bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 w-full"
                  >
                    Distribute Across Days
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Calendar 7-Column Grid */}
          <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-100">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 bg-neutral-50 border-b border-neutral-200 text-center py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {WEEKDAY_NAMES.map((w) => (
                <div key={w} className={w === "Sat" || w === "Sun" ? "text-neutral-400" : ""}>
                  {w}
                </div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-px bg-neutral-200">
              {calendarDays.map((dayItem) => {
                const dayTasks = tasksByDate[dayItem.dateString] || [];
                const hasTasks = dayTasks.length > 0;
                const isSelected = activeDateFilter === dayItem.dateString;

                return (
                  <div
                    key={dayItem.dateString}
                    onClick={() => {
                      if (dayItem.isCurrentMonth) {
                        setActiveDateFilter(isSelected ? null : dayItem.dateString);
                      }
                    }}
                    className={`min-h-[72px] sm:min-h-[82px] p-1.5 transition-all flex flex-col justify-between cursor-pointer ${
                      !dayItem.isCurrentMonth
                        ? "bg-neutral-50/60 opacity-40 cursor-not-allowed"
                        : isSelected
                        ? "bg-blue-50 ring-2 ring-blue-600 inset-0 z-10"
                        : dayItem.isToday
                        ? "bg-amber-50/40 hover:bg-amber-50/70"
                        : "bg-white hover:bg-neutral-50/90"
                    }`}
                  >
                    {/* Top Row: Day Number + Add button */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-5 h-5 rounded-full inline-flex items-center justify-center ${
                          dayItem.isToday
                            ? "bg-blue-600 text-white shadow-2xs"
                            : isSelected
                            ? "text-blue-900 font-extrabold"
                            : dayItem.isCurrentMonth
                            ? "text-neutral-800"
                            : "text-neutral-400"
                        }`}
                      >
                        {dayItem.dayNumber}
                      </span>

                      {dayItem.isCurrentMonth && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddTaskToDate(dayItem.dateString);
                          }}
                          title="Add task to this date"
                          className="opacity-40 hover:opacity-100 p-0.5 rounded hover:bg-neutral-200 transition-opacity text-neutral-600"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Middle / Bottom: Planned Task indicators */}
                    <div className="space-y-1 mt-1">
                      {dayTasks.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded truncate border ${
                            t.priority === "URGENT"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : t.priority === "HIGH"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : t.priority === "LOW"
                              ? "bg-neutral-100 text-neutral-600 border-neutral-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                          title={`${t.title} (${t.priority})`}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="text-[9px] font-bold text-neutral-500 pl-1">
                          +{dayTasks.length - 2} more
                        </div>
                      )}
                    </div>

                    {/* Subtle status tag if tasks planned */}
                    {hasTasks && dayTasks.length <= 2 && (
                      <div className="text-[9px] font-semibold text-neutral-400 text-right mt-auto">
                        {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>Click any date to view or add tasks</span>
            </span>
            {activeDateFilter && (
              <button
                type="button"
                onClick={() => setActiveDateFilter(null)}
                className="text-blue-600 hover:underline font-semibold"
              >
                Clear date filter (showing all)
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Planned Tasks List & Bulk Actions (5 cols) */}
        <div className="lg:col-span-5 flex flex-col bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900">
                  {activeDateFilter ? `Tasks for ${activeDateFilter}` : "Planned Tasks Breakdown"}
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                  {plannedTasks.length} Total
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {activeDateFilter
                  ? `Filtered to selected date · Click date again to reset`
                  : `Showing all tasks across the month`}
              </p>
            </div>

            {activeDateFilter && (
              <button
                type="button"
                onClick={() => handleAddTaskToDate(activeDateFilter)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Task
              </button>
            )}
          </div>

          {/* Bulk Priority & Selection Toolbar */}
          {plannedTasks.length > 0 && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={selectAllTasks}
                  className="font-semibold text-neutral-700 hover:text-neutral-900 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {selectedTaskIds.size === plannedTasks.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-400" />
                  )}
                  <span>
                    {selectedTaskIds.size > 0
                      ? `${selectedTaskIds.size} Selected`
                      : "Select All Tasks"}
                  </span>
                </button>

                {selectedTaskIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlannedTasks((prev) => prev.filter((t) => !selectedTaskIds.has(t.id)));
                      setSelectedTaskIds(new Set());
                    }}
                    className="text-red-600 hover:underline text-[11px] font-semibold"
                  >
                    Delete Selected
                  </button>
                )}
              </div>

              {/* Bulk Priority Buttons for Selected Tasks */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-200/60">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider shrink-0">
                  Bulk Priority:
                </span>
                <div className="grid grid-cols-4 gap-1 w-full">
                  {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleApplyPriorityToSelected(p)}
                      disabled={selectedTaskIds.size === 0}
                      className={`text-[10px] font-bold py-1 rounded transition-colors text-center cursor-pointer ${
                        selectedTaskIds.size === 0
                          ? "opacity-40 cursor-not-allowed bg-neutral-200 text-neutral-500"
                          : p === "URGENT"
                          ? "bg-red-100 text-red-800 hover:bg-red-200"
                          : p === "HIGH"
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : p === "MEDIUM"
                          ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                          : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tasks List */}
          <div className="flex-1 overflow-y-auto max-h-[480px] space-y-2.5 pr-1 no-scrollbar">
            {filteredTasksForList.length === 0 ? (
              <div className="p-8 text-center space-y-2 border border-dashed border-neutral-200 rounded-xl">
                <CalendarIcon className="w-8 h-8 text-neutral-300 mx-auto" />
                <p className="text-xs font-semibold text-neutral-700">No tasks planned yet</p>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
                  Click any date on the calendar, or use &quot;Fill All Weekdays&quot; to generate the full month&apos;s schedule automatically.
                </p>
              </div>
            ) : (
              filteredTasksForList.map((task, index) => {
                const isSelected = selectedTaskIds.has(task.id);
                const dayNum = task.scheduledDate.split("-")[2];
                const monthNum = parseInt(task.scheduledDate.split("-")[1], 10);

                return (
                  <div
                    key={task.id}
                    className={`p-3 rounded-xl border transition-all space-y-2.5 ${
                      isSelected
                        ? "bg-blue-50/40 border-blue-300 shadow-xs"
                        : "bg-white border-neutral-200 hover:border-neutral-300 shadow-2xs"
                    }`}
                  >
                    {/* Header Row: Checkbox, Date Badge, Priority Chip, Delete */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSelectTask(task.id)}
                          className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                          {MONTH_NAMES[monthNum - 1]?.slice(0, 3)} {dayNum}
                        </span>

                        <span className="text-[10px] text-neutral-400 font-mono">
                          #{index + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Priority Selector for this specific task */}
                        <select
                          value={task.priority}
                          onChange={(e) => {
                            const newP = e.target.value as any;
                            setPlannedTasks((prev) =>
                              prev.map((t) => (t.id === task.id ? { ...t, priority: newP } : t))
                            );
                          }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border focus:outline-hidden cursor-pointer ${
                            task.priority === "URGENT"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : task.priority === "HIGH"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : task.priority === "MEDIUM"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-neutral-100 text-neutral-700 border-neutral-200"
                          }`}
                        >
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                          <option value="URGENT">URGENT</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveTask(task.id)}
                          className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title Input */}
                    <div>
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlannedTasks((prev) =>
                            prev.map((t) => (t.id === task.id ? { ...t, title: val } : t))
                          );
                        }}
                        placeholder="Enter task title..."
                        className="w-full text-xs font-semibold text-neutral-900 bg-neutral-50/60 border border-neutral-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>

                    {/* Secondary Row: Assignee + Due Time */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Assignee Selection for this task */}
                      <div>
                        {distributionMode === "per_task" ? (
                          <select
                            value={task.assigneeId || ""}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value, 10) : null;
                              setPlannedTasks((prev) =>
                                prev.map((t) => (t.id === task.id ? { ...t, assigneeId: val } : t))
                              );
                            }}
                            className="w-full text-[11px] font-medium bg-neutral-50 border border-neutral-200 rounded-md px-2 py-1"
                          >
                            <option value="">Auto Round-Robin</option>
                            {categoryMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        ) : distributionMode === "specific_person" ? (
                          <span className="text-[11px] font-medium text-neutral-600 block truncate">
                            Assigned to:{" "}
                            <strong className="text-neutral-900">
                              {categoryMembers.find((m) => m.id === globalAssigneeId)?.name || "Selected Member"}
                            </strong>
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-blue-600 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            <span>Auto-Divided among team</span>
                          </span>
                        )}
                      </div>

                      {/* Due Time */}
                      <div className="flex items-center justify-end gap-1.5 text-neutral-500">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        <input
                          type="time"
                          value={task.dueTime || defaultDueTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPlannedTasks((prev) =>
                              prev.map((t) => (t.id === task.id ? { ...t, dueTime: val } : t))
                            );
                          }}
                          className="text-[11px] font-mono font-medium bg-neutral-50 border border-neutral-200 rounded px-1.5 py-0.5"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Action Footer: Summary & Save */}
          <div className="border-t border-neutral-200 pt-3 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">
                Total Month Plan: <strong className="text-neutral-900">{plannedTasks.length} tasks</strong>
              </span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Scheduled Daily Release</span>
              </span>
            </div>

            <button
              type="button"
              onClick={handleSubmitMonthlySchedule}
              disabled={loading || plannedTasks.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-neutral-900 text-white font-bold text-xs hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scheduling & Creating Month&apos;s Tasks...</span>
                </>
              ) : (
                <>
                  <CalendarIcon className="w-4 h-4" />
                  <span>Save & Schedule {plannedTasks.length} Monthly Tasks</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
