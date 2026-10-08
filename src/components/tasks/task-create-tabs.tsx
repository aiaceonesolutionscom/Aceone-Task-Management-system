"use client";

import React, { useState } from "react";
import { TaskCreateForm } from "@/components/tasks/task-create-form";
import { BatchTaskDistributor } from "@/components/tasks/batch-task-distributor";
import { MonthlyCalendarPlanner } from "@/components/tasks/monthly-calendar-planner";
import { FilePlus, Split, CalendarDays, Sparkles } from "lucide-react";

export function TaskCreateTabs({
  categories,
  teamMembers,
  globalCustomFields,
  creatorName,
  creatorRole,
  initialTab = "single",
}: {
  categories: any[];
  teamMembers: any[];
  globalCustomFields: any[];
  creatorName: string;
  creatorRole: string;
  initialTab?: "single" | "batch" | "monthly";
}) {
  const [activeTab, setActiveTab] = useState<"single" | "batch" | "monthly">(initialTab);

  return (
    <div className="space-y-6">
      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-neutral-100 rounded-lg w-fit border border-neutral-200">
        <button
          type="button"
          onClick={() => setActiveTab("single")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "single"
              ? "bg-white text-neutral-900 shadow-2xs"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          <FilePlus className="w-3.5 h-3.5" />
          <span>Single Task</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("batch")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "batch"
              ? "bg-white text-neutral-900 shadow-2xs"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          <Split className="w-3.5 h-3.5 text-blue-600" />
          <span>Bulk & Equal Distribution</span>
          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-bold">
            Auto-Split
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("monthly")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "monthly"
              ? "bg-white text-neutral-900 shadow-2xs ring-1 ring-neutral-200"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
          <span>Monthly Calendar Planner</span>
          <span className="text-[10px] bg-gradient-to-r from-purple-100 to-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-bold border border-indigo-200">
            Scheduled Month
          </span>
        </button>
      </div>

      {activeTab === "single" ? (
        <TaskCreateForm
          categories={categories}
          teamMembers={teamMembers}
          globalCustomFields={globalCustomFields}
          creatorName={creatorName}
          creatorRole={creatorRole}
        />
      ) : activeTab === "batch" ? (
        <BatchTaskDistributor
          categories={categories}
          teamMembers={teamMembers}
        />
      ) : (
        <MonthlyCalendarPlanner
          categories={categories}
          teamMembers={teamMembers}
        />
      )}
    </div>
  );
}

