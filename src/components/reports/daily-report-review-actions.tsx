"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export function DailyReportReviewActions({
  reportId,
  canApprove = true,
  canReview = true,
}: {
  reportId: number;
  canApprove?: boolean;
  canReview?: boolean;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReview = async (status: "APPROVED" | "CHANGES_REQUESTED") => {
    if (status === "CHANGES_REQUESTED" && !notes.trim()) {
      setShowPrompt(true);
      return;
    }

    setLoading(true);
    const toastId = toast.loading(status === "APPROVED" ? "Approving report..." : "Submitting revision request...");
    try {
      const res = await fetch("/api/daily-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status, reviewNotes: notes }),
      });

      if (res.ok) {
        toast.success(status === "APPROVED" ? "Daily report approved successfully!" : "Revision requested on daily report!", {
          id: toastId,
          duration: 3500,
        });
        setTimeout(() => {
          window.location.reload();
        }, 700);
      } else {
        toast.error("Failed to update daily report status", { id: toastId });
        setLoading(false);
      }
    } catch {
      toast.error("Network error updating report", { id: toastId });
      setLoading(false);
    }
  };

  return (
    <div className="pt-2 flex flex-col gap-2">
      {showPrompt && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Reason for requested revision..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 px-3 py-1 text-xs border border-neutral-300 rounded"
          />
          <button
            onClick={() => handleReview("CHANGES_REQUESTED")}
            disabled={loading}
            className="px-3 py-1 bg-rose-600 text-white rounded text-xs font-semibold"
          >
            Confirm
          </button>
          <button
            onClick={() => setShowPrompt(false)}
            className="px-2 py-1 text-neutral-500 text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      {!showPrompt && (
        <div className="flex items-center gap-2">
          {canApprove && (
            <button
              onClick={() => handleReview("APPROVED")}
              disabled={loading}
              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-3 h-3" /> Approve Report
            </button>
          )}
          {canReview && (
            <button
              onClick={() => setShowPrompt(true)}
              disabled={loading}
              className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <AlertTriangle className="w-3 h-3" /> Request Revision
            </button>
          )}
        </div>
      )}
    </div>
  );
}
