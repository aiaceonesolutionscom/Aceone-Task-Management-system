"use client";

import React, { useState } from "react";
import { submitDailyReport } from "@/lib/daily-reports";
import { toast } from "sonner";
import { Send, FileText, CheckCircle2 } from "lucide-react";

export function DailyReportForm({
  categories,
  currentUserId,
  defaultDepartmentId,
  isEmployee,
  userDepartmentName,
}: {
  categories: any[];
  currentUserId: number;
  defaultDepartmentId?: number | null;
  isEmployee?: boolean;
  userDepartmentName?: string;
}) {
  const initialCatId =
    defaultDepartmentId && categories.some((c) => c.id === defaultDepartmentId)
      ? defaultDepartmentId
      : categories[0]?.id || 1;

  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(initialCatId);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const currentCategory = categories.find((c) => c.id === selectedCategoryId);
  const customFields = currentCategory?.customFields || [];

  const handleFieldChange = (key: string, val: string) => {
    setCustomValues({ ...customValues, [key]: val });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading("Submitting daily report...", {
      description: "Recording activity and notifying department reviewer...",
    });

    try {
      const res = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: selectedCategoryId,
          reportDate,
          notes,
          fieldValues: customValues,
        }),
      });

      if (res.ok) {
        toast.success("Daily report submitted successfully!", {
          id: toastId,
          description: "Your report has been logged and sent for review.",
          duration: 4000,
        });
        setNotes("");
        setCustomValues({});
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to submit daily report", { id: toastId });
        setLoading(false);
      }
    } catch {
      toast.error("Network error submitting daily report", { id: toastId });
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
      <div className="pb-2 border-b border-neutral-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" /> Submit Daily Activity Report
        </h2>
        <span className="text-[11px] text-neutral-400">Recorded for department oversight</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Category — hidden for employees (auto-assigned from their department) */}
        {!(isEmployee && defaultDepartmentId) && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-700">Category / Team</label>
            </div>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-700">Report Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>
      </div>

      {/* Dynamic Category Custom Fields (e.g. Calls, Meetings, Client Updates for Sales) */}
      {customFields.length > 0 && (
        <div className="pt-2 border-t border-neutral-100 space-y-3">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide block">
            {currentCategory?.name} Activity Metrics
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {customFields.map((field: any) => (
              <div key={field.id} className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">
                  {field.fieldName} {field.isRequired && <span className="text-red-500">*</span>}
                </label>
                <input
                  type={field.fieldType === "NUMBER" ? "number" : "text"}
                  required={field.isRequired}
                  placeholder={field.placeholder || ""}
                  value={customValues[field.fieldKey] || ""}
                  onChange={(e) => handleFieldChange(field.fieldKey, e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-neutral-700">Daily Summary & Key Highlights</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Summary of accomplishments, roadblocks, client responses or next steps..."
          className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-y"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 shadow-xs disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{loading ? "Submitting..." : "Submit Daily Report"}</span>
        </button>
      </div>
    </form>
  );
}
