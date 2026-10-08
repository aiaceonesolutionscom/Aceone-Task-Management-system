"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Users,
  ShieldCheck,
  Search,
  Send,
  ExternalLink,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Shield,
  Layers,
  Sparkles,
  ArrowLeft,
  Check,
  CheckCheck,
  Info,
  X,
  Eye,
} from "lucide-react";
import { playNotificationSound } from "@/lib/audio-chime";
import { toast } from "sonner";
import { formatTime12, formatDateTime12 } from "@/lib/date-utils";

function formatMessageDateHeader(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) {
    return "Today";
  } else if (msgDay.getTime() === yesterday.getTime()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

interface ChannelItem {
  id: number;
  taskCode: string;
  title: string;
  isTeamChannel?: boolean;
  status?: string;
  department: { id: number; name: string };
  members?: {
    id: number;
    name: string;
    designation?: string | null;
    role: string;
    status: string;
  }[];
  creator?: { id: number; name: string; designation?: string | null } | null;
  assignor?: { id: number; name: string; designation?: string | null } | null;
  reviewers?: { id: number; name: string; designation?: string | null }[];
  assignees: { id: number; name: string; designation?: string | null }[];
  departmentManagers?: { id: number; name: string; designation?: string | null }[];
  comments: any[];
  createdAt?: string;
  updatedAt: string;
}

interface ChatHubViewProps {
  teamChannels: ChannelItem[];
  taskChannels: ChannelItem[];
  currentUserId: number;
  isEmployee: boolean;
}

export function ChatHubView({
  teamChannels,
  taskChannels,
  currentUserId,
  isEmployee,
}: ChatHubViewProps) {
  // Mode: "everyone" (Category Team Chat) or "manager" (Manager & Task Review)
  const [activeTab, setActiveTab] = useState<"everyone" | "manager">("everyone");
  const [mobileView, setMobileView] = useState<"channels" | "chat">("channels");

  // Task discussions filter controls (avoids cluttering when hundreds of tasks exist)
  const [taskStatusFilter, setTaskStatusFilter] = useState<"active" | "messages" | "all">("active");
  const [timelineFilter, setTimelineFilter] = useState<"all" | "today" | "week">("all");

  const channelsList = activeTab === "everyone" ? teamChannels : taskChannels;

  const [activeChannelId, setActiveChannelId] = useState<number | null>(
    channelsList[0]?.id ?? null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const soundEnabled = true;
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeComments, setActiveComments] = useState<any[]>(
    channelsList[0]?.comments ?? []
  );

  const activeCount = useMemo(
    () =>
      taskChannels.filter(
        (c) =>
          c.status !== "APPROVED" &&
          c.status !== "COMPLETED" &&
          c.status !== "CANCELLED"
      ).length,
    [taskChannels]
  );

  const withMessagesCount = useMemo(
    () => taskChannels.filter((c) => c.comments && c.comments.length > 0).length,
    [taskChannels]
  );

  const [selectedMessageInfo, setSelectedMessageInfo] = useState<any | null>(null);

  const activeChannel =
    channelsList.find((c) => c.id === activeChannelId) || channelsList[0] || null;

  const channelMembers = useMemo(() => {
    if (!activeChannel) return [];
    if (activeChannel.isTeamChannel && activeChannel.members) {
      return activeChannel.members;
    }
    const list: { id: number; name: string; designation?: string | null }[] = [];
    if (activeChannel.creator && !list.some((m) => m.id === activeChannel.creator?.id)) {
      list.push(activeChannel.creator);
    }
    if (activeChannel.assignor && !list.some((m) => m.id === activeChannel.assignor?.id)) {
      list.push(activeChannel.assignor);
    }
    if (activeChannel.reviewers) {
      activeChannel.reviewers.forEach((r) => {
        if (!list.some((m) => m.id === r.id)) {
          list.push(r);
        }
      });
    }
    if (activeChannel.assignees) {
      activeChannel.assignees.forEach((a) => {
        if (!list.some((m) => m.id === a.id)) {
          list.push(a);
        }
      });
    }
    if (activeChannel.departmentManagers) {
      activeChannel.departmentManagers.forEach((m) => {
        if (!list.some((x) => x.id === m.id)) {
          list.push(m);
        }
      });
    }
    return list;
  }, [activeChannel]);

  const otherMembers = useMemo(() => {
    return channelMembers.filter((m) => m.id !== currentUserId);
  }, [channelMembers, currentUserId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef<number>(activeComments.length);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  // Switch channel when tab changes
  useEffect(() => {
    const list = activeTab === "everyone" ? teamChannels : taskChannels;
    if (list.length > 0) {
      setActiveChannelId(list[0].id);
      setActiveComments(list[0].comments || []);
      lastCountRef.current = list[0].comments?.length || 0;
      setTimeout(() => scrollToBottom(false), 50);
    } else {
      setActiveChannelId(null);
      setActiveComments([]);
    }
  }, [activeTab]);

  // When active channel changes, immediately sync to mark incoming comments as read
  useEffect(() => {
    if (!activeChannelId) return;

    if (activeChannel) {
      setActiveComments(activeChannel.comments || []);
      lastCountRef.current = activeChannel.comments?.length || 0;
      setTimeout(() => scrollToBottom(false), 50);
    }

    // Immediately fetch & mark as delivered/read for this user viewing the channel!
    const markAndSync = async () => {
      try {
        const res = await fetch(`/api/chat/${activeChannelId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.comments)) {
          setActiveComments(data.comments);
          lastCountRef.current = data.comments.length;
        }
      } catch {}
    };

    markAndSync();
  }, [activeChannelId]);

  // Real-time polling (1.5 seconds for snappy updates)
  useEffect(() => {
    if (!activeChannelId) return;

    const fetchFresh = async () => {
      try {
        const res = await fetch(`/api/chat/${activeChannelId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.comments)) {
          const fresh = data.comments;
          if (fresh.length > lastCountRef.current) {
            const lastMsg = fresh[fresh.length - 1];
            if (lastMsg && lastMsg.userId !== currentUserId) {
              if (soundEnabled) {
                playNotificationSound();
              }
              toast.info(
                `New message from ${lastMsg.user?.name || "Team Member"} in ${
                  activeTab === "everyone" ? "Category Channel" : "Task Discussion"
                }`,
                { description: lastMsg.body }
              );
            }
            scrollToBottom(true);
          }
          lastCountRef.current = fresh.length;
          setActiveComments(fresh);
        }
      } catch (err) {
        // Suppress polling error
      }
    };

    const interval = setInterval(fetchFresh, 1500);
    return () => clearInterval(interval);
  }, [activeChannelId, soundEnabled, currentUserId, activeTab]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeChannelId || sending) return;

    const textToSend = messageInput.trim();
    setMessageInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/chat/${activeChannelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: textToSend }),
      });

      const data = await res.json();
      if (data.success && data.comment) {
        const updated = [...activeComments, data.comment];
        setActiveComments(updated);
        lastCountRef.current = updated.length;
        scrollToBottom(true);
      } else {
        toast.error(data.error || "Failed to send message");
        setMessageInput(textToSend);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
      setMessageInput(textToSend);
    } finally {
      setSending(false);
    }
  };

  const filteredChannels = useMemo(() => {
    let list = channelsList;

    if (activeTab === "manager") {
      // 1. Task Status Filter: Default to active tasks only to prevent clutter
      if (taskStatusFilter === "active") {
        list = list.filter(
          (c) =>
            c.status !== "APPROVED" &&
            c.status !== "COMPLETED" &&
            c.status !== "CANCELLED"
        );
      } else if (taskStatusFilter === "messages") {
        list = list.filter((c) => c.comments && c.comments.length > 0);
      }

      // 2. Timeline Filter
      if (timelineFilter !== "all") {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        list = list.filter((c) => {
          const rawDate = c.updatedAt || c.createdAt;
          const d = rawDate ? new Date(rawDate) : now;
          if (timelineFilter === "today") return d >= today;
          if (timelineFilter === "week") return d >= weekAgo;
          return true;
        });
      }
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((c) => {
      const inTitle = c.title.toLowerCase().includes(q);
      const inCode = c.taskCode.toLowerCase().includes(q);
      const inDept = c.department.name.toLowerCase().includes(q);
      return inTitle || inCode || inDept;
    });
  }, [channelsList, activeTab, taskStatusFilter, timelineFilter, searchQuery]);

  // Keep active channel in sync with filter results
  useEffect(() => {
    if (filteredChannels.length > 0) {
      if (!filteredChannels.some((c) => c.id === activeChannelId)) {
        setActiveChannelId(filteredChannels[0].id);
      }
    }
  }, [filteredChannels, activeChannelId]);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Team & Task Chat Hub
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase">
              Dedicated Chat Center
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Switch between Category Team Group Chat (Everyone) and Manager / Reviewer Task threads.
          </p>
        </div>
      </div>

      {/* Mode Selector Tabs (Everyone vs Manager Review) */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
        <button
          onClick={() => setActiveTab("everyone")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === "everyone"
              ? "bg-neutral-900 text-white shadow-xs"
              : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
          }`}
        >
          <Users className="w-4 h-4 text-blue-400" />
          <span>Everyone (Category Team Room)</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded font-mono">
            {teamChannels.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("manager")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === "manager"
              ? "bg-neutral-900 text-white shadow-xs"
              : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Manager & Approver Only (Task Reviews)</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded font-mono">
            {taskChannels.length}
          </span>
        </button>
      </div>

      {/* Main 2-Pane Chat Hub Interface */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-2xs overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[500px] h-[calc(100vh-210px)] max-h-[740px]">
        {/* Left Pane: Conversation Channels List (Col 4) */}
        <div
          className={`${
            mobileView === "chat" ? "hidden md:flex" : "flex"
          } md:col-span-4 border-r border-neutral-200 flex-col bg-[#fbfcfd] h-full overflow-hidden`}
        >
          {/* Channel Search & Smart Filter Controls */}
          <div className="p-3 border-b border-neutral-200 bg-white space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "everyone"
                    ? "Search category team channel..."
                    : "Search task discussion or ID..."
                }
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            {/* Smart Filter Pills: Only shown in Manager/Task mode to manage large task counts */}
            {activeTab === "manager" && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setTaskStatusFilter("active")}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      taskStatusFilter === "active"
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    Active Only ({activeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskStatusFilter("messages")}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      taskStatusFilter === "messages"
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    Has Messages ({withMessagesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskStatusFilter("all")}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      taskStatusFilter === "all"
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    All ({taskChannels.length})
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-0.5">
                  <span className="font-medium text-neutral-400">Timeline:</span>
                  <div className="flex items-center gap-1">
                    {(["all", "today", "week"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTimelineFilter(t)}
                        className={`px-1.5 py-0.5 rounded uppercase font-semibold cursor-pointer ${
                          timelineFilter === t
                            ? "text-blue-600 font-bold bg-blue-50"
                            : "text-neutral-500 hover:text-neutral-900"
                        }`}
                      >
                        {t === "all" ? "All" : t === "today" ? "Today" : "This Week"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
            {filteredChannels.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400 space-y-2">
                <p>
                  {activeTab === "everyone"
                    ? "No team channels available for your category."
                    : "No task review discussions match this filter."}
                </p>
                {activeTab === "manager" && (taskStatusFilter !== "all" || timelineFilter !== "all" || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTaskStatusFilter("all");
                      setTimelineFilter("all");
                      setSearchQuery("");
                    }}
                    className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                  >
                    Reset filters & show all ({taskChannels.length})
                  </button>
                )}
              </div>
            ) : (
              filteredChannels.map((c) => {
                const isActive = c.id === activeChannelId;
                const lastComment =
                  c.comments && c.comments.length > 0
                    ? c.comments[c.comments.length - 1]
                    : null;

                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveChannelId(c.id);
                      setMobileView("chat");
                    }}
                    className={`w-full text-left p-3.5 transition-colors flex flex-col gap-1.5 cursor-pointer ${
                      isActive
                        ? "bg-blue-50/70 border-l-4 border-blue-600"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        {activeTab === "everyone" ? (
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className="font-mono text-[10px] font-bold text-neutral-700 bg-white px-1.5 py-0.5 rounded border border-neutral-200">
                          {c.taskCode}
                        </span>
                      </div>

                      {c.status && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            c.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.status === "CHANGES_REQUESTED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {c.status.replace("_", " ")}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-neutral-900 line-clamp-1">
                      {c.title}
                    </h4>

                    {lastComment ? (
                      <p className="text-[11px] text-neutral-500 line-clamp-1 italic">
                        <span className="font-semibold text-neutral-700 not-italic">
                          {lastComment.user?.name || "Member"}:{" "}
                        </span>
                        {lastComment.body}
                      </p>
                    ) : (
                      <p className="text-[10px] text-neutral-400 italic">
                        No messages yet · Click to talk
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-0.5">
                      <span>{c.department.name}</span>
                      <span>
                        {lastComment
                          ? formatTime12(lastComment.createdAt)
                          : ""}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Discussion Window (Col 8) */}
        <div
          className={`${
            mobileView === "channels" ? "hidden md:flex" : "flex"
          } md:col-span-8 flex-col h-full overflow-hidden bg-white`}
        >
          {activeChannel ? (
            <>
              {/* Channel Header */}
              <div className="p-3 sm:p-3.5 px-3.5 sm:px-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/60 shrink-0">
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <button
                    type="button"
                    onClick={() => setMobileView("channels")}
                    className="md:hidden p-1.5 -ml-1 text-neutral-600 hover:text-neutral-900 rounded-md hover:bg-neutral-200 flex items-center gap-1 text-xs font-semibold shrink-0"
                    title="Back to Channels list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Channels</span>
                  </button>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {activeChannel.taskCode}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-200 text-neutral-800">
                        {activeChannel.department.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 hidden sm:inline-block">
                        {activeTab === "everyone" ? "Category All Members" : "Manager & Approver Review"}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-neutral-900 truncate">
                      {activeChannel.title}
                    </h3>
                    {activeTab === "everyone" && activeChannel.members && (
                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 pt-0.5">
                        <Users className="w-3 h-3 text-neutral-400" />
                        <span>
                          {activeChannel.members.length} Members in this category:{" "}
                          {activeChannel.members.map((m) => m.name).join(", ")}
                        </span>
                      </div>
                    )}
                    {activeTab === "manager" && activeChannel.assignor && (
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500 pt-0.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>
                          Manager / Reviewer: <strong>{activeChannel.assignor.name}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {!activeChannel.isTeamChannel && (
                  <Link
                    href={`/tasks/${activeChannel.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md text-xs font-semibold transition-colors shadow-2xs shrink-0"
                  >
                    <span>Task Workspace</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#f9fafb]">
                {activeComments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-1">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-neutral-800">
                      {activeTab === "everyone"
                        ? `Welcome to ${activeChannel.department.name} Team Channel!`
                        : `Start Discussion for ${activeChannel.taskCode}`}
                    </h4>
                    <p className="text-xs text-neutral-500 max-w-sm">
                      {activeTab === "everyone"
                        ? "All members of this category can communicate here in real-time."
                        : "Communicate directly with the Manager / Reviewer for approvals, revisions, and feedback."}
                    </p>
                  </div>
                ) : (
                  activeComments.map((msg, index) => {
                    const isSelf =
                      msg.userId === currentUserId || msg.user?.id === currentUserId;

                    // Date header check
                    const currentDateHeader = formatMessageDateHeader(msg.createdAt);
                    const prevDateHeader =
                      index > 0
                        ? formatMessageDateHeader(activeComments[index - 1]?.createdAt)
                        : null;
                    const showDateHeader = currentDateHeader !== prevDateHeader;

                    // Read & Delivery calculations
                    const readers = (msg.reads || []).filter(
                      (r: any) => r.userId !== currentUserId
                    );
                    const readersCount = readers.length;

                    const deliveries = (msg.deliveries || []).filter(
                      (d: any) => d.userId !== currentUserId
                    );
                    const deliveriesCount = deliveries.length;
                    const totalOther = otherMembers.length;

                    // Double blue tick if read by all other members (or at least 1 in 1-on-1 discussion)
                    const isDoubleBlue =
                      totalOther > 0 ? readersCount >= totalOther : readersCount > 0;

                    // Double grey tick if delivered to all other members (or at least 1 in 1-on-1 discussion)
                    const isDelivered =
                      totalOther > 0
                        ? (deliveriesCount >= totalOther || readersCount >= totalOther)
                        : (deliveriesCount > 0 || readersCount > 0);

                    return (
                      <React.Fragment key={msg.id}>
                        {/* WhatsApp-Style Centered Sticky Date Header ("Today", "Yesterday", etc.) */}
                        {showDateHeader && (
                          <div className="flex items-center justify-center my-3.5 sticky top-1 z-10 pointer-events-none">
                            <span className="px-3 py-1 bg-white/95 backdrop-blur-xs border border-neutral-200/80 text-[11px] font-bold text-neutral-600 rounded-full shadow-2xs tracking-wide">
                              {currentDateHeader}
                            </span>
                          </div>
                        )}

                        <div
                          className={`flex gap-2.5 max-w-[85%] ${
                            isSelf ? "ml-auto flex-row-reverse" : "mr-auto"
                          }`}
                        >
                          {/* Avatar */}
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSelf
                                ? "bg-neutral-900 text-white"
                                : "bg-blue-600 text-white"
                            }`}
                          >
                            {(msg.user?.name || "U").charAt(0).toUpperCase()}
                          </div>

                          {/* Bubble */}
                          <div className="space-y-1">
                            <div
                              className={`flex items-center gap-2 text-[10px] text-neutral-400 ${
                                isSelf ? "justify-end" : "justify-start"
                              }`}
                            >
                              <span className="font-semibold text-neutral-700">
                                {isSelf ? "You" : msg.user?.name || "Team Member"}
                              </span>
                              {msg.user?.designation && !isSelf && (
                                <span className="text-neutral-400">
                                  ({msg.user.designation})
                                </span>
                              )}
                              <span>·</span>
                              <span>
                                {formatTime12(msg.createdAt)}
                              </span>
                            </div>

                            <div
                              className={`p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap shadow-2xs ${
                                isSelf
                                  ? "bg-neutral-900 text-white rounded-tr-none"
                                  : "bg-white text-neutral-900 border border-neutral-200 rounded-tl-none"
                              }`}
                            >
                              <div>{msg.body}</div>

                              {/* WhatsApp-Style Timestamp & Read Ticks (inside/bottom-right of bubble) */}
                              <div
                                className={`flex items-center justify-end gap-1.5 mt-1.5 pt-0.5 text-[10px] select-none ${
                                  isSelf ? "text-neutral-400" : "text-neutral-400"
                                }`}
                              >
                                <span>
                                  {formatTime12(msg.createdAt)}
                                </span>

                                {isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMessageInfo(msg)}
                                    className="cursor-pointer hover:opacity-80 flex items-center gap-0.5 ml-0.5 transition-opacity"
                                    title={
                                      isDoubleBlue
                                        ? "Read by everyone (Click to see who read)"
                                        : readersCount > 0
                                        ? `Read by ${readersCount} member(s) (Click to see who read)`
                                        : isDelivered
                                        ? "Delivered (Click for message info)"
                                        : "Sent to server · Waiting for delivery (Recipient offline)"
                                    }
                                  >
                                    {isDoubleBlue ? (
                                      <CheckCheck className="w-3.5 h-3.5 text-sky-400 stroke-[2.8]" />
                                    ) : readersCount > 0 ? (
                                      <div className="flex items-center gap-0.5">
                                        <CheckCheck className="w-3.5 h-3.5 text-neutral-400 stroke-[2]" />
                                        <span className="text-[9px] text-sky-400 font-bold font-mono">
                                          {readersCount}
                                        </span>
                                      </div>
                                    ) : isDelivered ? (
                                      <CheckCheck className="w-3.5 h-3.5 text-neutral-400 stroke-[2]" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5 text-neutral-400 stroke-[2.2]" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose Message Box */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-neutral-200 bg-white flex items-center gap-2"
              >
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    activeTab === "everyone"
                      ? `Message everyone in ${activeChannel.department.name}... (Press Enter)`
                      : `Message manager/reviewer on ${activeChannel.taskCode}... (Press Enter)`
                  }
                  className="flex-1 px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sending}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex items-center justify-center p-8 text-neutral-400 text-xs">
              Select a conversation channel from the left to start chatting.
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp-Style Message Read Receipts Modal */}
      {selectedMessageInfo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-neutral-50/70">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-neutral-900">Message Info</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessageInfo(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Preview */}
            <div className="p-4 border-b border-neutral-100 bg-neutral-50/30">
              <p className="text-xs text-neutral-900 bg-white p-3 rounded-lg border border-neutral-200/80 shadow-2xs whitespace-pre-wrap leading-relaxed">
                {selectedMessageInfo.body}
              </p>
              <span className="text-[10px] text-neutral-400 mt-1.5 block">
                Sent {formatDateTime12(selectedMessageInfo.createdAt)}
              </span>
            </div>

            {/* Read Status List */}
            <div className="p-4 max-h-72 overflow-y-auto space-y-4">
              {/* Read By List */}
              <div>
                <h4 className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                  <CheckCheck className="w-4 h-4 text-sky-500 stroke-[2.5]" />
                  <span>
                    Read by (
                    {(selectedMessageInfo.reads || []).filter(
                      (r: any) => r.userId !== currentUserId
                    ).length}
                    )
                  </span>
                </h4>

                {(() => {
                  const readers = (selectedMessageInfo.reads || []).filter(
                    (r: any) => r.userId !== currentUserId
                  );
                  if (readers.length === 0) {
                    return (
                      <p className="text-xs text-neutral-400 italic p-2 bg-neutral-50 rounded-lg">
                        No team members have opened this message yet.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-1.5">
                      {readers.map((r: any) => (
                        <div
                          key={r.userId}
                          className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-neutral-50 border border-neutral-100"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                              {(r.user?.name || "U").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-neutral-900 block">
                                {r.user?.name || "Team Member"}
                              </span>
                              {r.user?.designation && (
                                <span className="text-[10px] text-neutral-400">
                                  {r.user.designation}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {formatTime12(r.readAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Delivery Status & Recipient Breakdown */}
              {(() => {
                const readUserIds = new Set(
                  (selectedMessageInfo.reads || []).map((r: any) => r.userId)
                );
                const deliveriesMap = new Map<number, any>(
                  (selectedMessageInfo.deliveries || []).map((d: any) => [d.userId, d])
                );

                // Members who received the message but haven't read yet
                const deliveredMembers = otherMembers.filter(
                  (m) => !readUserIds.has(m.id) && deliveriesMap.has(m.id)
                );

                // Members who have NOT received it yet (offline / logged out)
                const pendingDeliveryMembers = otherMembers.filter(
                  (m) => !readUserIds.has(m.id) && !deliveriesMap.has(m.id)
                );

                return (
                  <div className="space-y-3 pt-2 border-t border-neutral-100">
                    {/* Delivered List */}
                    {deliveredMembers.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                          <CheckCheck className="w-4 h-4 text-neutral-400 stroke-[2]" />
                          <span>Delivered to ({deliveredMembers.length})</span>
                        </h4>
                        <div className="space-y-1.5">
                          {deliveredMembers.map((m) => {
                            const dRecord = deliveriesMap.get(m.id);
                            return (
                              <div
                                key={m.id}
                                className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-neutral-50/70 border border-neutral-100"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                    {(m.name || "U").charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-neutral-700 block">
                                      {m.name}
                                    </span>
                                    {m.designation && (
                                      <span className="text-[10px] text-neutral-400">
                                        {m.designation}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  {dRecord?.deliveredAt
                                    ? formatTime12(dRecord.deliveredAt)
                                    : "Delivered"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Pending Delivery (Offline / Logged out) */}
                    {pendingDeliveryMembers.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                          <Check className="w-4 h-4 text-amber-500 stroke-[2]" />
                          <span>Pending Delivery ({pendingDeliveryMembers.length})</span>
                        </h4>
                        <div className="space-y-1.5">
                          {pendingDeliveryMembers.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-amber-50/40 border border-amber-200/50"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {(m.name || "U").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-semibold text-neutral-700 block">
                                    {m.name}
                                  </span>
                                  {m.designation && (
                                    <span className="text-[10px] text-neutral-400">
                                      {m.designation}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] text-amber-600 font-medium">
                                Offline / Logged out
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-neutral-100 bg-neutral-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMessageInfo(null)}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-neutral-200 rounded-md text-neutral-700 hover:bg-neutral-100 cursor-pointer shadow-2xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
