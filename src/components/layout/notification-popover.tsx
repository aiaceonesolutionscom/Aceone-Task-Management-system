"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Clock,
  ShieldAlert,
  ClipboardList,
  Check,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/audio-chime";
import { formatDateTime12 } from "@/lib/date-utils";

// Global session cache to prevent duplicate toasts across desktop & mobile instances
const globalToastedIds = new Set<number>();

export type NotificationItem = {
  id: number;
  userId: number;
  taskId: number | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationPopover({
  initialUnreadCount = 0,
  onSyncCounts,
  isPrimary = true,
}: {
  initialUnreadCount?: number;
  onSyncCounts?: (counts: {
    activeTasksCount: number;
    pendingApprovalsCount: number;
    unreadCount: number;
  }) => void;
  isPrimary?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const initialFetchDone = useRef(false);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Polling function for real-time notifications and counters
  const fetchSyncData = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();

      const notifs: NotificationItem[] = data.notifications || [];
      const newUnread = data.unreadCount ?? 0;
      setUnreadCount(newUnread);

      // Check for incoming new unread notifications in real-time (ONLY primary instance fires alerts)
      if (initialFetchDone.current && isPrimary) {
        for (const n of notifs) {
          if (!n.isRead && !globalToastedIds.has(n.id)) {
            globalToastedIds.add(n.id);
            playNotificationSound();
            toast.info(n.title, {
              id: `notif-${n.id}`,
              description: n.message,
              duration: 5000,
              action: n.taskId
                ? {
                    label: "Open Task",
                    onClick: () => router.push(`/tasks/${n.taskId}`),
                  }
                : undefined,
            });
          }
        }
      }

      // Mark existing as known
      notifs.forEach((n) => globalToastedIds.add(n.id));
      initialFetchDone.current = true;
      setNotifications(notifs);

      if (onSyncCounts) {
        onSyncCounts({
          activeTasksCount: data.activeTasksCount ?? 0,
          pendingApprovalsCount: data.pendingApprovalsCount ?? 0,
          unreadCount: newUnread,
        });
      }
    } catch {
      // Quiet ignore on network blip
    }
  };

  // Poll every 3 seconds for real-time responsiveness
  useEffect(() => {
    fetchSyncData();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchSyncData();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isPrimary]);

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark notifications read");
    }
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    // Mark this notification as read
    if (!item.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        });
      } catch {}
    }

    setOpen(false);

    if (item.taskId) {
      router.push(`/tasks/${item.taskId}`);
    } else {
      router.push("/notifications");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "TASK_ASSIGNED":
      case "TASK_REASSIGNED":
        return <ClipboardList className="w-3.5 h-3.5 text-blue-600" />;
      case "CHANGES_REQUESTED":
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />;
      case "APPROVAL_REQUIRED":
      case "REVIEW_REQUIRED":
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />;
      case "TASK_APPROVED":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case "NEW_COMMENT":
      case "MENTION":
        return <MessageSquare className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-neutral-600" />;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "";
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Top Header Bell Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 text-neutral-600 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors cursor-pointer"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-75">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown Popover */}
      {open && (
        <div className="absolute -right-8 sm:right-0 mt-2 w-[calc(100vw-32px)] max-w-sm sm:w-96 bg-white border border-neutral-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Popover Header */}
          <div className="px-4 py-3 bg-neutral-50/80 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-neutral-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-neutral-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-9 h-9 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                  <Bell className="w-4 h-4" />
                </div>
                <p className="text-xs text-neutral-500 font-medium">No notifications yet</p>
                <p className="text-[11px] text-neutral-400">
                  You'll be alerted here for task assignments, feedback, and approvals.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 hover:bg-neutral-50 ${
                    !item.isRead ? "bg-blue-50/30" : ""
                  }`}
                >
                  <div className="p-1.5 rounded-md bg-white border border-neutral-200 shrink-0 mt-0.5 shadow-2xs">
                    {getNotificationIcon(item.type)}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs truncate ${
                          !item.isRead ? "font-bold text-neutral-900" : "font-medium text-neutral-700"
                        }`}
                      >
                        {item.title}
                      </p>
                      <span
                        title={formatDateTime12(item.createdAt)}
                        className="text-[10px] text-neutral-400 shrink-0 cursor-default"
                      >
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-600 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {!item.isRead && (
                    <span
                      className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5"
                      title="Unread"
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Popover Footer */}
          <div className="px-4 py-2.5 bg-[#fbfcfd] border-t border-neutral-100 flex items-center justify-between">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 transition-colors flex items-center gap-1"
            >
              <span>View full notification history</span>
              <ExternalLink className="w-3 h-3 text-neutral-400" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
