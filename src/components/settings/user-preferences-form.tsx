"use client";

import React, { useState, useEffect } from "react";
import { Bell, Volume2, LayoutTemplate, Sliders, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function UserPreferencesForm() {
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [taskPushAlerts, setTaskPushAlerts] = useState(true);
  const [compactDensity, setCompactDensity] = useState(false);
  const [autoCollapseSidebar, setAutoCollapseSidebar] = useState(false);
  const [emailDigests, setEmailDigests] = useState(true);

  useEffect(() => {
    try {
      const savedPrefs = localStorage.getItem("aceone_user_preferences");
      if (savedPrefs) {
        const p = JSON.parse(savedPrefs);
        if (p.soundAlerts !== undefined) setSoundAlerts(p.soundAlerts);
        if (p.taskPushAlerts !== undefined) setTaskPushAlerts(p.taskPushAlerts);
        if (p.compactDensity !== undefined) setCompactDensity(p.compactDensity);
        if (p.autoCollapseSidebar !== undefined) setAutoCollapseSidebar(p.autoCollapseSidebar);
        if (p.emailDigests !== undefined) setEmailDigests(p.emailDigests);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSave = () => {
    try {
      const prefs = {
        soundAlerts,
        taskPushAlerts,
        compactDensity,
        autoCollapseSidebar,
        emailDigests,
      };
      localStorage.setItem("aceone_user_preferences", JSON.stringify(prefs));
      toast.success("Preferences saved successfully!");
    } catch {
      toast.error("Failed to save preferences.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Sound alerts */}
        <label className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-100 hover:border-neutral-200 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={soundAlerts}
            onChange={(e) => setSoundAlerts(e.target.checked)}
            className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-4 w-4"
          />
          <div className="space-y-0.5">
            <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Audio Chime on Events</span>
            </span>
            <p className="text-[11px] text-neutral-500">
              Play a subtle sound when a task is assigned, reviewed, or approved.
            </p>
          </div>
        </label>

        {/* Task Push alerts */}
        <label className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-100 hover:border-neutral-200 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={taskPushAlerts}
            onChange={(e) => setTaskPushAlerts(e.target.checked)}
            className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-4 w-4"
          />
          <div className="space-y-0.5">
            <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-emerald-600" />
              <span>In-App Popover Alerts</span>
            </span>
            <p className="text-[11px] text-neutral-500">
              Display badge counters and live popovers for critical workspace notices.
            </p>
          </div>
        </label>

        {/* Compact list density */}
        <label className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-100 hover:border-neutral-200 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={compactDensity}
            onChange={(e) => setCompactDensity(e.target.checked)}
            className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-4 w-4"
          />
          <div className="space-y-0.5">
            <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
              <LayoutTemplate className="w-3.5 h-3.5 text-purple-600" />
              <span>Compact Density Mode</span>
            </span>
            <p className="text-[11px] text-neutral-500">
              Reduce row spacing in task lists and data tables for increased information density.
            </p>
          </div>
        </label>

        {/* Auto collapse sidebar */}
        <label className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-100 hover:border-neutral-200 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={autoCollapseSidebar}
            onChange={(e) => setAutoCollapseSidebar(e.target.checked)}
            className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-4 w-4"
          />
          <div className="space-y-0.5">
            <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              <span>Auto-Collapse Sidebar</span>
            </span>
            <p className="text-[11px] text-neutral-500">
              Automatically keep navigation collapsed to icon-only mode for maximum screen width.
            </p>
          </div>
        </label>
      </div>

      <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
        <p className="text-[11px] text-neutral-400">
          Preferences apply to your active browser session and local workspace.
        </p>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-md text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Save Preferences</span>
        </button>
      </div>
    </div>
  );
}
