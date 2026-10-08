"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCheck,
  Check,
  User,
  Sparkles,
  ArrowRight,
} from "lucide-react";

interface TasksCalendarViewProps {
  tasks: Array<{
    id: number;
    taskCode: string | null;
    title: string;
    description: string | null;
    startDate: Date | string | null;
    deadline: Date | string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status: string;
    department: { id: number; name: string };
    assignor: { id: number; name: string } | null;
    assignees: Array<{ user: { id: number; name: string } }>;
  }>;
  canCreateTask: boolean;
  isEmployee: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TasksCalendarView({
  tasks,
  canCreateTask,
  isEmployee,
}: TasksCalendarViewProps) {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(now.getMonth());
  const [selectedDayTasks, setSelectedDayTasks] = useState<{
    dateStr: string;
    label: string;
    tasks: typeof tasks;
  } | null>(null);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
    setSelectedDayTasks(null);
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
    setSelectedDayTasks(null);
  };

  const handleToday = () => {
    setCurrentYear(now.getFullYear());
    setCurrentMonthIndex(now.getMonth());
    setSelectedDayTasks(null);
  };

  // Calendar cells calculation
  const calendarCells = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    // 0 = Mon, 6 = Sun
    const firstDayOfWeek = (new Date(currentYear, currentMonthIndex, 1).getDay() + 6) % 7;

    const days: Array<{
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Leading padding
    const prevMonthDays = new Date(currentYear, currentMonthIndex, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const prevDate = new Date(currentYear, currentMonthIndex - 1, day);
      const y = prevDate.getFullYear();
      const m = String(prevDate.getMonth() + 1).padStart(2, "0");
      const d = String(day).padStart(2, "0");
      days.push({
        dateString: `${y}-${m}-${d}`,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Current month days
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = String(day).padStart(2, "0");
      const mStr = String(currentMonthIndex + 1).padStart(2, "0");
      const dateString = `${currentYear}-${mStr}-${dStr}`;
      days.push({
        dateString,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateString === todayStr,
      });
    }

    // Trailing padding to make full weeks
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
      });
    }

    return days;
  }, [currentYear, currentMonthIndex]);

  // Map tasks to dates (by startDate or deadline)
  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof tasks> = {};

    tasks.forEach((task) => {
      // Find relevant date string YYYY-MM-DD
      const dateSource = task.startDate || task.deadline;
      if (!dateSource) return;

      const dateObj = new Date(dateSource);
      if (isNaN(dateObj.getTime())) return;

      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, "0");
      const d = String(dateObj.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${d}`;

      if (!map[key]) map[key] = [];
      map[key].push(task);
    });

    return map;
  }, [tasks]);

  return (
    <div className="space-y-4">
      {/* Calendar Top Control Header */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-700 transition-colors border border-neutral-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-700 transition-colors border border-neutral-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base font-bold text-neutral-900 tracking-tight">
            {MONTH_NAMES[currentMonthIndex]} {currentYear}
          </h2>

          <button
            type="button"
            onClick={handleToday}
            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
          >
            Today
          </button>
        </div>

        {/* Action Button: Schedule Monthly Tasks */}
        <div className="flex items-center gap-2">
          {canCreateTask && (
            <Link
              href="/tasks/new?tab=monthly"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>+ Schedule Month&apos;s Tasks</span>
            </Link>
          )}
        </div>
      </div>

      {/* 7-Column Calendar Grid */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
        {/* Weekday Row */}
        <div className="grid grid-cols-7 bg-neutral-50/80 border-b border-neutral-200 text-center py-2.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
          {WEEKDAYS.map((w) => (
            <div key={w} className={w === "Sat" || w === "Sun" ? "text-neutral-400" : ""}>
              {w}
            </div>
          ))}
        </div>

        {/* Days Matrix */}
        <div className="grid grid-cols-7 gap-px bg-neutral-200">
          {calendarCells.map((dayItem) => {
            const dayTasks = tasksByDate[dayItem.dateString] || [];
            const hasTasks = dayTasks.length > 0;
            const isSelected = selectedDayTasks?.dateStr === dayItem.dateString;

            return (
              <div
                key={dayItem.dateString}
                onClick={() => {
                  if (hasTasks) {
                    setSelectedDayTasks({
                      dateStr: dayItem.dateString,
                      label: `${dayItem.dayNumber} ${MONTH_NAMES[parseInt(dayItem.dateString.split("-")[1], 10) - 1]}`,
                      tasks: dayTasks,
                    });
                  }
                }}
                className={`min-h-[96px] sm:min-h-[110px] p-2 flex flex-col justify-between transition-colors ${
                  !dayItem.isCurrentMonth
                    ? "bg-neutral-50/50 opacity-40"
                    : isSelected
                    ? "bg-indigo-50/70 ring-2 ring-indigo-500 inset-0 z-10"
                    : dayItem.isToday
                    ? "bg-blue-50/30 hover:bg-neutral-50"
                    : "bg-white hover:bg-neutral-50/80"
                } ${hasTasks ? "cursor-pointer" : ""}`}
              >
                {/* Header: Date Number + Task count badge */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-bold w-6 h-6 rounded-full inline-flex items-center justify-center ${
                      dayItem.isToday
                        ? "bg-blue-600 text-white shadow-2xs"
                        : dayItem.isCurrentMonth
                        ? "text-neutral-800"
                        : "text-neutral-400"
                    }`}
                  >
                    {dayItem.dayNumber}
                  </span>

                  {hasTasks && (
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full bg-neutral-100 text-neutral-600">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                {/* Task Items in Day Cell */}
                <div className="space-y-1 overflow-hidden">
                  {dayTasks.slice(0, 3).map((task) => {
                    const priorityClass =
                      task.priority === "URGENT"
                        ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                        : task.priority === "HIGH"
                        ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                        : task.priority === "LOW"
                        ? "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200"
                        : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";

                    return (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className={`block text-[10px] font-medium px-1.5 py-0.5 rounded truncate border transition-colors ${priorityClass}`}
                        title={`${task.taskCode || `#${task.id}`}: ${task.title}`}
                      >
                        <span className="font-bold mr-1">{task.taskCode || `#${task.id}`}:</span>
                        <span>{task.title}</span>
                      </Link>
                    );
                  })}

                  {dayTasks.length > 3 && (
                    <div className="text-[10px] font-bold text-neutral-500 pl-1">
                      +{dayTasks.length - 3} more...
                    </div>
                  )}
                </div>

                {/* Bottom padding or indicator */}
                <div />
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Detail Drawer (when clicking a date with tasks) */}
      {selectedDayTasks && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-neutral-900">
                Tasks Scheduled for {selectedDayTasks.label}
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                {selectedDayTasks.tasks.length} {selectedDayTasks.tasks.length === 1 ? "task" : "tasks"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDayTasks(null)}
              className="text-xs text-neutral-500 hover:text-neutral-900 font-semibold"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedDayTasks.tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="p-3 rounded-lg border border-neutral-200 hover:border-neutral-300 hover:shadow-2xs transition-all space-y-2 group block"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-600 group-hover:underline">
                    {task.taskCode || `#${task.id}`}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      task.priority === "URGENT"
                        ? "bg-red-100 text-red-800"
                        : task.priority === "HIGH"
                        ? "bg-amber-100 text-amber-800"
                        : task.priority === "LOW"
                        ? "bg-neutral-100 text-neutral-600"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>

                <p className="text-xs font-semibold text-neutral-900 truncate">
                  {task.title}
                </p>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-100">
                  <span className="truncate">
                    Assignees: {task.assignees.map((a) => a.user.name).join(", ") || "None"}
                  </span>
                  <span className="text-neutral-400 capitalize">
                    {task.status.toLowerCase().replace("_", " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
