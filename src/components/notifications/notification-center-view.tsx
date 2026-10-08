"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, CheckCheck, ExternalLink, ArrowRight } from "lucide-react";
import { formatDateTime12 } from "@/lib/date-utils";

export function NotificationCenterView({
  initialNotifications,
}: {
  initialNotifications: any[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [pushStatus, setPushStatus] = useState<string>("default");

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
      if (res.ok) {
        setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
        toast.success("All notifications marked as read");
      }
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const handleEnablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      toast.error("Push notifications not supported in this browser.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission);
      if (permission === "granted") {
        const reg = await navigator.serviceWorker.ready;
        // Check VAPID public key
        toast.success("Browser push notifications enabled!");
      } else {
        toast.error("Notification permission denied");
      }
    } catch (err) {
      toast.error("Could not enable push notifications");
    }
  };

  const filtered = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded text-xs font-semibold ${
              filter === "all" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1 rounded text-xs font-semibold ${
              filter === "unread" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleEnablePush}
            className="px-3 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 rounded text-xs font-semibold text-neutral-700 flex items-center gap-1.5"
          >
            <Bell className="w-3.5 h-3.5 text-blue-600" />
            <span>Enable Web Push</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded text-xs font-semibold flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-400 space-y-1">
            <Bell className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="font-semibold text-neutral-700">No notifications to display</p>
            <p>You're all caught up with your tasks and discussions.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                  item.isRead ? "bg-white hover:bg-neutral-50/70" : "bg-blue-50/30 hover:bg-blue-50/50"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      item.isRead ? "bg-transparent" : "bg-blue-600"
                    }`}
                  />
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900">{item.title}</h3>
                    <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">{item.message}</p>
                    <span className="text-[10px] text-neutral-400 mt-1 block">
                      {formatDateTime12(item.createdAt)}
                    </span>
                  </div>
                </div>

                {item.taskId && (
                  <Link
                    href={`/tasks/${item.taskId}`}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 rounded text-xs font-semibold text-neutral-700 shrink-0"
                  >
                    <span>View Task</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
