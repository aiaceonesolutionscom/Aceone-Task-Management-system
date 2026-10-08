"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

interface TasksFilterBarProps {
  availableCategories: { id: number; name: string }[];
  isEmployee: boolean;
  isCategoryRestricted: boolean;
  initialSearch?: string;
  initialCategory?: string;
  initialStatus?: string;
  initialDatePreset?: string;
  initialFrom?: string;
  initialTo?: string;
}

export function TasksFilterBar({
  availableCategories,
  isEmployee,
  isCategoryRestricted,
  initialSearch = "",
  initialCategory = "",
  initialStatus = "",
  initialDatePreset = "",
  initialFrom = "",
  initialTo = "",
}: TasksFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState(initialStatus);
  const [datePreset, setDatePreset] = useState(initialDatePreset);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  // Sync state with URL params if they change externally
  useEffect(() => {
    setSearch(searchParams.get("q") || "");
    setCategory(searchParams.get("category") || "");
    setStatus(searchParams.get("status") || initialStatus || "ACTIVE");
    setDatePreset(searchParams.get("datePreset") || "");
    setFrom(searchParams.get("from") || "");
    setTo(searchParams.get("to") || "");
  }, [searchParams, initialStatus]);

  // Helper to push updated URL
  const pushFilters = (updates: {
    q?: string;
    category?: string;
    status?: string;
    datePreset?: string;
    from?: string;
    to?: string;
  }) => {
    const params = new URLSearchParams();

    const qVal = updates.q !== undefined ? updates.q : search;
    const catVal = updates.category !== undefined ? updates.category : category;
    const statusVal = updates.status !== undefined ? updates.status : status;
    const dpVal = updates.datePreset !== undefined ? updates.datePreset : datePreset;
    const fromVal = updates.from !== undefined ? updates.from : from;
    const toVal = updates.to !== undefined ? updates.to : to;

    if (qVal?.trim()) params.set("q", qVal.trim());
    if (catVal?.trim()) params.set("category", catVal.trim());
    if (statusVal?.trim()) params.set("status", statusVal.trim());
    if (dpVal?.trim()) params.set("datePreset", dpVal.trim());
    if (fromVal?.trim()) params.set("from", fromVal.trim());
    if (toVal?.trim()) params.set("to", toVal.trim());

    // Reset to page 1 whenever filters change
    params.set("page", "1");

    startTransition(() => {
      router.push(`/tasks?${params.toString()}`);
    });
  };

  // Debounced live search auto-filtering without pressing Enter
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentQ = searchParams.get("q") || "";
      if (search !== currentQ) {
        pushFilters({ q: search });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    pushFilters({ category: newCat });
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    pushFilters({ status: newStatus });
  };

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    setFrom("");
    setTo("");
    pushFilters({ datePreset: preset, from: "", to: "" });
  };

  const handleFromChange = (newFrom: string) => {
    setFrom(newFrom);
    setDatePreset("");
    pushFilters({ from: newFrom, datePreset: "" });
  };

  const handleToChange = (newTo: string) => {
    setTo(newTo);
    setDatePreset("");
    pushFilters({ to: newTo, datePreset: "" });
  };

  const handleClearFilters = () => {
    setSearch("");
    setCategory("");
    setStatus("ACTIVE");
    setDatePreset("");
    setFrom("");
    setTo("");
    startTransition(() => {
      router.push("/tasks");
    });
  };

  const hasActiveFilters = Boolean(
    search || category || (status && status !== "ACTIVE") || datePreset || from || to
  );

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-2xs space-y-2.5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        {/* Live Auto Search (Auto enters, no enter needed) */}
        <div className="relative w-full sm:flex-1 sm:min-w-[180px]">
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin absolute left-2.5 top-2.5" />
          ) : (
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, ID (AS1-1024), keywords..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                pushFilters({ q: "" });
              }}
              className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Filter — Hidden for Employees */}
        {!isEmployee && (
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 shrink-0 sm:min-w-[130px]"
          >
            <option value="">
              {isCategoryRestricted && availableCategories.length === 1
                ? `Dept: ${availableCategories[0].name}`
                : "All Categories"}
            </option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id.toString()}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {/* Status Filter */}
        <select
          value={status || "ACTIVE"}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 shrink-0 sm:min-w-[130px]"
        >
          <option value="ACTIVE">Active Tasks (Default)</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="VIEWED">Viewed</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="CHANGES_REQUESTED">Needs Revision</option>
          <option value="APPROVED">Approved / Completed</option>
          <option value="ALL">All Statuses</option>
        </select>

        {/* Date Preset Filter */}
        <select
          value={datePreset}
          onChange={(e) => handleDatePresetChange(e.target.value)}
          className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 shrink-0 sm:min-w-[110px]"
        >
          <option value="">All Dates</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
        </select>

        {/* Date Range Inputs */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-1.5 px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-md shrink-0">
          <input
            type="date"
            value={from}
            onChange={(e) => handleFromChange(e.target.value)}
            title="From Date"
            className="w-28 text-[11px] bg-transparent text-neutral-700 focus:outline-none cursor-pointer"
          />
          <span className="text-neutral-400 text-[10px] font-medium">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => handleToChange(e.target.value)}
            title="To Date"
            className="w-28 text-[11px] bg-transparent text-neutral-700 focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-100 text-neutral-500">
          <span>Active filters applied automatically</span>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-neutral-700 hover:text-neutral-900 font-semibold hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
