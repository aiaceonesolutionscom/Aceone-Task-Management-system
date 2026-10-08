"use client";

import React, { useState, useEffect } from "react";
import {
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  History,
  RefreshCw,
  X,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime12 } from "@/lib/date-utils";
import {
  adminResetUserPasswordAction,
  getUserPasswordHistoryAction,
} from "@/server/actions/users";

interface UserPasswordModalProps {
  user: {
    id: number;
    name: string;
    email: string;
    employeeId?: string | null;
    role: {
      name: string;
    };
    primaryDepartment?: {
      name: string;
    } | null;
  };
  initialPassword?: string;
  onClose: () => void;
  onPasswordUpdated?: (newPwd: string) => void;
}

export function UserPasswordModal({
  user,
  initialPassword,
  onClose,
  onPasswordUpdated,
}: UserPasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState(initialPassword || "");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [resetting, setResetting] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Load history on open
  useEffect(() => {
    let isMounted = true;
    getUserPasswordHistoryAction(user.id)
      .then((res) => {
        if (isMounted && res.success && res.logs) {
          setHistoryLogs(res.logs);
          // If currentPassword is blank, pick up latest from history
          if (!currentPassword && res.logs.length > 0) {
            const meta = (res.logs[0].metadata as any) || {};
            if (meta.newPasswordSet) {
              setCurrentPassword(meta.newPasswordSet);
            }
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load user password history:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user.id, currentPassword]);

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Password copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPasswordInput(pwd);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordInput || newPasswordInput.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setResetting(true);
    try {
      const res = await adminResetUserPasswordAction(user.id, newPasswordInput);
      if (res.success) {
        toast.success(res.message);
        setCurrentPassword(newPasswordInput);
        if (onPasswordUpdated) onPasswordUpdated(newPasswordInput);
        setNewPasswordInput("");
        // Reload history
        const updated = await getUserPasswordHistoryAction(user.id);
        if (updated.success && updated.logs) {
          setHistoryLogs(updated.logs);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Credentials &amp; Password: {user.name}
              </h3>
              <p className="text-[11px] text-neutral-500 font-mono">
                {user.email} {user.employeeId ? `· ${user.employeeId}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Password Card */}
        <div className="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Current Active Password
            </span>
            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              Super Admin Visible
            </span>
          </div>

          <div className="flex items-center justify-between bg-white px-3 py-2 rounded-md border border-neutral-200">
            <span className="font-mono font-bold text-neutral-900 text-sm tracking-wider select-all">
              {currentPassword
                ? showPassword
                  ? currentPassword
                  : "••••••••••••"
                : "No password recorded in vault"}
            </span>

            <div className="flex items-center gap-1.5">
              {currentPassword && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(currentPassword)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                    title="Copy password to tell user"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="text-[10px] text-neutral-400">
            If the user forgot their password, you can copy this and share it with them.
          </p>
        </div>

        {/* Quick Reset Form */}
        <form onSubmit={handleReset} className="space-y-2 pt-1 border-t border-neutral-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-neutral-500" />
              <span>Reset &amp; Assign New Password</span>
            </label>
            <button
              type="button"
              onClick={handleGenerate}
              className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Generate Strong</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              placeholder="Type new password (min. 6 chars)"
              className="flex-1 px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 font-mono bg-white"
            />
            <button
              type="submit"
              disabled={resetting || !newPasswordInput}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer shrink-0"
            >
              {resetting ? "Saving..." : "Set Password"}
            </button>
          </div>
        </form>

        {/* Password History Log */}
        <div className="space-y-2 pt-1 border-t border-neutral-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
            <History className="w-3.5 h-3.5 text-neutral-500" />
            <span>Password Change History</span>
          </div>

          {loadingHistory ? (
            <div className="py-4 text-center text-xs text-neutral-400">
              Loading history trail...
            </div>
          ) : historyLogs.length === 0 ? (
            <div className="py-3 text-center text-xs text-neutral-400 italic">
              No previous password change logs recorded.
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
              {historyLogs.map((log) => {
                const meta = (log.metadata as any) || {};
                const pwd = meta.newPasswordSet;
                return (
                  <div
                    key={log.id}
                    className="p-2.5 bg-neutral-50 rounded border border-neutral-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-neutral-900">
                        {meta.note || "Password change"}
                      </div>
                      <div className="text-[10px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        <span>{formatDateTime12(log.createdAt)}</span>
                        <span>·</span>
                        <span>By {log.actor?.name || meta.changedBy || "User"}</span>
                      </div>
                    </div>

                    {pwd && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-neutral-800 bg-white px-2 py-0.5 rounded border border-neutral-200">
                          {pwd}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(pwd)}
                          className="p-1 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                          title="Copy historical password"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-2 flex justify-end border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
