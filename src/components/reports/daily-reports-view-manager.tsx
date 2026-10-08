"use client";

import React, { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  PenLine,
  Search,
  Filter,
  Calendar,
  User as UserIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Building2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { DailyReportForm } from "@/components/reports/daily-report-form";
import { DailyReportReviewActions } from "@/components/reports/daily-report-review-actions";

type CustomFieldValueItem = {
  id: number;
  value: string | null;
  customField: {
    id: number;
    fieldName: string;
    fieldType: string;
  };
};

export type DailyReportItem = {
  id: number;
  userId: number;
  departmentId: number;
  reportDate: string | Date;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED";
  notes: string | null;
  reviewerId: number | null;
  reviewNotes: string | null;
  reviewedAt: string | Date | null;
  createdAt: string | Date;
  user: {
    id: number;
    name: string;
    designation: string | null;
  };
  department: {
    id: number;
    name: string;
    code: string | null;
  };
  reviewer?: {
    id: number;
    name: string;
  } | null;
  fieldValues: CustomFieldValueItem[];
};

export type ReporterUserItem = {
  id: number;
  name: string;
  designation: string | null;
  primaryDepartment?: { id: number; name: string } | null;
};

export function DailyReportsViewManager({
  reports,
  categories,
  users,
  currentUserId,
  userPrimaryDepartmentId,
  isEmployee,
  isManager,
  canReview = true,
  canApprove = true,
  canSubmit = true,
  initialTab = "view",
}: {
  reports: DailyReportItem[];
  categories: Array<{ id: number; name: string; code: string | null; customFields: any[] }>;
  users: ReporterUserItem[];
  currentUserId: number;
  userPrimaryDepartmentId?: number | null;
  isEmployee: boolean;
  isManager: boolean;
  canReview?: boolean;
  canApprove?: boolean;
  canSubmit?: boolean;
  initialTab?: "submit" | "view";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab State: default to initialTab or query param
  const urlTab = searchParams.get("tab") as "submit" | "view" | null;
  const [activeTab, setActiveTab] = useState<"submit" | "view">(urlTab || initialTab);

  // Filters State
  const [datePreset, setDatePreset] = useState<"all" | "today" | "yesterday" | "last7" | "this_month" | "custom">("all");
  const [customDate, setCustomDate] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Helpers to get YYYY-MM-DD for local comparisons
  const toDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => toDateString(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return toDateString(y);
  }, []);

  const last7DaysStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toDateString(d);
  }, []);

  const firstDayOfMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const repDate = new Date(report.reportDate);
      const repDateStr = toDateString(repDate);

      // Date Preset Filter
      if (datePreset === "today") {
        if (repDateStr !== todayStr) return false;
      } else if (datePreset === "yesterday") {
        if (repDateStr !== yesterdayStr) return false;
      } else if (datePreset === "last7") {
        if (repDateStr < last7DaysStr) return false;
      } else if (datePreset === "this_month") {
        if (repDateStr < firstDayOfMonthStr) return false;
      } else if (datePreset === "custom" && customDate) {
        if (repDateStr !== customDate) return false;
      }

      // Specific Person Filter
      if (selectedUserId !== "all") {
        if (report.userId !== Number(selectedUserId)) return false;
      }

      // Category / Department Filter
      if (selectedDepartmentId !== "all") {
        if (report.departmentId !== Number(selectedDepartmentId)) return false;
      }

      // Status Filter
      if (selectedStatus !== "all") {
        if (report.status !== selectedStatus) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const userName = report.user.name.toLowerCase();
        const deptName = report.department.name.toLowerCase();
        const notes = (report.notes || "").toLowerCase();
        const customValues = report.fieldValues
          .map((fv) => (fv.value || "").toLowerCase())
          .join(" ");

        if (
          !userName.includes(query) &&
          !deptName.includes(query) &&
          !notes.includes(query) &&
          !customValues.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    reports,
    datePreset,
    customDate,
    selectedUserId,
    selectedDepartmentId,
    selectedStatus,
    searchQuery,
    todayStr,
    yesterdayStr,
    last7DaysStr,
    firstDayOfMonthStr,
  ]);

  // Overall Statistics across loaded reports
  const stats = useMemo(() => {
    const todayCount = reports.filter((r) => toDateString(new Date(r.reportDate)) === todayStr).length;
    const yesterdayCount = reports.filter((r) => toDateString(new Date(r.reportDate)) === yesterdayStr).length;
    const pendingCount = reports.filter((r) => r.status === "SUBMITTED").length;
    const approvedCount = reports.filter((r) => r.status === "APPROVED").length;

    return {
      total: reports.length,
      today: todayCount,
      yesterday: yesterdayCount,
      pending: pendingCount,
      approved: approvedCount,
    };
  }, [reports, todayStr, yesterdayStr]);

  const hasActiveFilters =
    datePreset !== "all" ||
    customDate !== "" ||
    selectedUserId !== "all" ||
    selectedDepartmentId !== "all" ||
    selectedStatus !== "all" ||
    searchQuery !== "";

  const handleResetFilters = () => {
    setDatePreset("all");
    setCustomDate("");
    setSelectedUserId("all");
    setSelectedDepartmentId("all");
    setSelectedStatus("all");
    setSearchQuery("");
  };

  const handleTabChange = (tab: "submit" | "view") => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(window.location.search);
    newParams.set("tab", tab);
    router.replace(`/daily-reports?${newParams.toString()}`);
  };

  // Helper to format date with relative tag
  const formatReportDate = (dString: string | Date) => {
    const d = new Date(dString);
    const ds = toDateString(d);
    if (ds === todayStr) {
      return { label: `Today, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, isToday: true, isYesterday: false };
    }
    if (ds === yesterdayStr) {
      return { label: `Yesterday, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, isToday: false, isYesterday: true };
    }
    return {
      label: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      isToday: false,
      isYesterday: false,
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Nav Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
        <div className="flex items-center gap-2 p-1 bg-neutral-100 rounded-lg w-fit border border-neutral-200">
          <button
            type="button"
            onClick={() => handleTabChange("view")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === "view"
                ? "bg-white text-neutral-900 shadow-2xs border border-neutral-200/60"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>{isEmployee ? "My Past Reports" : "View Reports Directory"}</span>
            <span className="text-[10px] bg-blue-100 text-blue-800 font-mono font-bold px-1.5 py-0.2 rounded-full">
              {reports.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("submit")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === "submit"
                ? "bg-white text-neutral-900 shadow-2xs border border-neutral-200/60"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <PenLine className="w-4 h-4 text-emerald-600" />
            <span>Submit Daily Report</span>
            {isEmployee && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                Log
              </span>
            )}
          </button>
        </div>

        {/* Quick info tag */}
        <div className="text-xs text-neutral-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time Activity & Sales Tracker</span>
        </div>
      </div>

      {/* TAB 1: SUBMIT REPORT */}
      {activeTab === "submit" && (
        <div className="space-y-4">
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>
                Submit your daily progress, metrics, and key achievements. Your manager or director will review your report.
              </span>
            </div>
            <button
              onClick={() => handleTabChange("view")}
              className="text-emerald-700 font-semibold underline hover:text-emerald-900 cursor-pointer"
            >
              Browse all past reports →
            </button>
          </div>

          <DailyReportForm
            categories={categories}
            currentUserId={currentUserId}
            defaultDepartmentId={userPrimaryDepartmentId}
            isEmployee={isEmployee}
            userDepartmentName={categories.find((c) => c.id === userPrimaryDepartmentId)?.name}
          />
        </div>
      )}

      {/* TAB 2: VIEW REPORTS DIRECTORY & FILTERS */}
      {activeTab === "view" && (
        <div className="space-y-5">
          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => setDatePreset("today")}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                datePreset === "today"
                  ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/30"
                  : "bg-white border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Today's Reports
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{stats.today}</p>
              <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                {datePreset === "today" ? "✓ Filtering Today" : "Click to view today's reports"}
              </span>
            </div>

            <div
              onClick={() => setDatePreset("yesterday")}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                datePreset === "yesterday"
                  ? "bg-blue-50 border-blue-400 ring-2 ring-blue-400/30"
                  : "bg-white border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Yesterday's Reports
                </span>
                <Clock className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{stats.yesterday}</p>
              <span className="text-[10px] text-blue-700 font-semibold block mt-0.5">
                {datePreset === "yesterday" ? "✓ Filtering Yesterday" : "Click to view yesterday's reports"}
              </span>
            </div>

            <div
              onClick={() => setSelectedStatus(selectedStatus === "SUBMITTED" ? "all" : "SUBMITTED")}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                selectedStatus === "SUBMITTED"
                  ? "bg-amber-50 border-amber-400 ring-2 ring-amber-400/30"
                  : "bg-white border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Pending Review
                </span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{stats.pending}</p>
              <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                {selectedStatus === "SUBMITTED" ? "✓ Filtering Pending" : "Awaiting approval"}
              </span>
            </div>

            <div
              onClick={() => setSelectedStatus(selectedStatus === "APPROVED" ? "all" : "APPROVED")}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                selectedStatus === "APPROVED"
                  ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/30"
                  : "bg-white border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Approved
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{stats.approved}</p>
              <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                {selectedStatus === "APPROVED" ? "✓ Filtering Approved" : "Successfully approved"}
              </span>
            </div>
          </div>

          {/* Dedicated Filter Bar */}
          <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                  Report Filters & Directory
                </h3>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Filters</span>
                </button>
              )}
            </div>

            {/* Quick Date Presets */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-bold text-neutral-500 mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" /> Date Preset:
              </span>
              <button
                type="button"
                onClick={() => {
                  setDatePreset("all");
                  setCustomDate("");
                }}
                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
                  datePreset === "all"
                    ? "bg-neutral-900 text-white shadow-2xs"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                All Dates
              </button>

              <button
                type="button"
                onClick={() => {
                  setDatePreset("today");
                  setCustomDate("");
                }}
                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  datePreset === "today"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80"
                }`}
              >
                <span>Today</span>
                <span className="font-mono text-[10px] opacity-80">({stats.today})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDatePreset("yesterday");
                  setCustomDate("");
                }}
                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  datePreset === "yesterday"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/80"
                }`}
              >
                <span>Yesterday</span>
                <span className="font-mono text-[10px] opacity-80">({stats.yesterday})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDatePreset("last7");
                  setCustomDate("");
                }}
                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
                  datePreset === "last7"
                    ? "bg-neutral-900 text-white shadow-2xs"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                Last 7 Days
              </button>

              <button
                type="button"
                onClick={() => {
                  setDatePreset("this_month");
                  setCustomDate("");
                }}
                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
                  datePreset === "this_month"
                    ? "bg-neutral-900 text-white shadow-2xs"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                This Month
              </button>

              {/* Specific Date Input */}
              <div className="flex items-center gap-1.5 ml-auto sm:ml-2">
                <span className="text-[11px] text-neutral-400 font-medium">Or Pick Date:</span>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    if (e.target.value) {
                      setDatePreset("custom");
                    } else {
                      setDatePreset("all");
                    }
                  }}
                  className="px-2 py-1 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 text-neutral-800 font-medium cursor-pointer"
                />
              </div>
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
              {/* 1. Specific Person Filter — hidden for employees (they only see their own) */}
              {!isEmployee && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-600 flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-neutral-400" />
                    <span>Team Member / Person</span>
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-md font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                  >
                    <option value="all">All Team Members ({users.length})</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.designation || "Staff"}{" "}
                        {u.primaryDepartment?.name ? `• ${u.primaryDepartment.name}` : ""})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 2. Category / Department Filter — hidden for employees */}
              {!isEmployee && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-600 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-neutral-400" />
                    <span>Category / Department</span>
                  </label>
                  <select
                    value={selectedDepartmentId}
                    onChange={(e) => setSelectedDepartmentId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-md font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                  >
                    <option value="all">All Categories ({categories.length})</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 3. Review Status Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-neutral-400" />
                  <span>Review Status</span>
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-md font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="SUBMITTED">Submitted (Pending Review)</option>
                  <option value="APPROVED">Approved</option>
                  <option value="CHANGES_REQUESTED">Changes Requested</option>
                </select>
              </div>

              {/* 4. Keyword Search */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 flex items-center gap-1">
                  <Search className="w-3 h-3 text-neutral-400" />
                  <span>Search Keyword</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search member, notes, metrics..."
                    className="w-full pl-7 pr-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 text-neutral-800 placeholder:text-neutral-400"
                  />
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-2" />
                </div>
              </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-bold text-neutral-500">Active Filters:</span>
                {datePreset !== "all" && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-semibold border border-blue-200">
                    Date: {datePreset.replace("_", " ").toUpperCase()}{" "}
                    {customDate ? `(${customDate})` : ""}
                  </span>
                )}
                {selectedUserId !== "all" && (
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-800 rounded font-semibold border border-purple-200">
                    Member: {users.find((u) => u.id === Number(selectedUserId))?.name || selectedUserId}
                  </span>
                )}
                {selectedDepartmentId !== "all" && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded font-semibold border border-emerald-200">
                    Category:{" "}
                    {categories.find((c) => c.id === Number(selectedDepartmentId))?.name ||
                      selectedDepartmentId}
                  </span>
                )}
                {selectedStatus !== "all" && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded font-semibold border border-amber-200">
                    Status: {selectedStatus}
                  </span>
                )}
                {searchQuery && (
                  <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 rounded font-semibold border border-neutral-300">
                    Keyword: "{searchQuery}"
                  </span>
                )}
                <span className="text-neutral-400 ml-auto">
                  Showing <strong>{filteredReports.length}</strong> of <strong>{reports.length}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Submitted Reports Feed / Table */}
          <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-neutral-900">
                  Daily Reports Activity Feed ({filteredReports.length})
                </h2>
              </div>
              <span className="text-[11px] text-neutral-400">
                Sorted by most recent submission
              </span>
            </div>

            {filteredReports.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-800">No Daily Reports Found</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                    {hasActiveFilters
                      ? "No reports match your current filter criteria. Try adjusting the date, selecting another team member, or clearing filters."
                      : "No daily reports have been submitted yet. Click 'Submit Daily Report' to log activity."}
                  </p>
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-md text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Filters</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {filteredReports.map((report) => {
                  const dateInfo = formatReportDate(report.reportDate);
                  const isCurrentUser = report.userId === currentUserId;

                  return (
                    <div
                      key={report.id}
                      className="p-5 space-y-3 hover:bg-neutral-50/70 transition-colors"
                    >
                      {/* Top Header of Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3">
                          {/* Avatar Initials */}
                          <div className="w-8 h-8 rounded-full bg-neutral-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {report.user.name.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-neutral-900 text-xs">
                                {report.user.name}
                              </span>
                              {isCurrentUser && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">
                                  You
                                </span>
                              )}
                              <span className="text-[11px] text-neutral-500">
                                ({report.user.designation || "Team Member"})
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-0.5">
                              {/* Department Badge */}
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-neutral-100 rounded text-neutral-700 border border-neutral-200">
                                {report.department.name}
                              </span>

                              {/* Relative Date Badge */}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  dateInfo.isToday
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : dateInfo.isYesterday
                                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                                    : "bg-neutral-100 text-neutral-600"
                                }`}
                              >
                                {dateInfo.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status & Review State */}
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              report.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : report.status === "CHANGES_REQUESTED"
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {report.status === "SUBMITTED"
                              ? "Pending Review"
                              : report.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>

                      {/* Custom Field Metric Values (e.g. Calls, Leads, Target, Hours) */}
                      {report.fieldValues.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                          {report.fieldValues.map((fv) => (
                            <div
                              key={fv.id}
                              className="p-2.5 bg-neutral-50 rounded-md border border-neutral-200/80"
                            >
                              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block">
                                {fv.customField.fieldName}
                              </span>
                              <span className="font-semibold text-neutral-900 mt-0.5 block truncate">
                                {fv.value || "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Work Notes / Summary */}
                      {report.notes && (
                        <div className="p-3 rounded-md bg-[#fcfdfe] border border-neutral-200 text-xs text-neutral-800 leading-relaxed space-y-1">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                            Daily Activity & Achievements
                          </span>
                          <p className="whitespace-pre-line">{report.notes}</p>
                        </div>
                      )}

                      {/* Review Feedback Banner if reviewed */}
                      {report.reviewNotes && (
                        <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Review Feedback:</span>{" "}
                            {report.reviewNotes}{" "}
                            <span className="text-[10px] text-rose-600 opacity-80">
                              (by {report.reviewer?.name || "Reviewer"})
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Review Actions for Manager / CEO if status is SUBMITTED */}
                      {(canReview || canApprove) && report.status === "SUBMITTED" && (
                        <div className="pt-1">
                          <DailyReportReviewActions
                            reportId={report.id}
                            canApprove={canApprove}
                            canReview={canReview}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
