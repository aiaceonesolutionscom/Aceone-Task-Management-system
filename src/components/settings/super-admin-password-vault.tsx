"use client";

import React, { useState, useMemo } from "react";
import {
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Search,
  History,
  Lock,
  RefreshCw,
  ShieldAlert,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime12 } from "@/lib/date-utils";
import { adminResetUserPasswordAction } from "@/server/actions/users";

interface UserItem {
  id: number;
  name: string;
  email: string;
  employeeId?: string | null;
  role: {
    name: string;
    code: string;
  };
  primaryDepartment?: {
    name: string;
  } | null;
  status: string;
}

interface VaultItem {
  password: string;
  updatedAt: string;
  changedBy: string;
  source?: string;
}

interface SuperAdminPasswordVaultProps {
  users: UserItem[];
  vault: Record<string, VaultItem>;
  auditLogs: any[];
}

export function SuperAdminPasswordVault({
  users,
  vault: initialVault,
  auditLogs,
}: SuperAdminPasswordVaultProps) {
  const [vault, setVault] = useState<Record<string, VaultItem>>(initialVault);
  const [activeTab, setActiveTab] = useState<"vault" | "logs">("vault");
  const [searchQuery, setSearchQuery] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick Reset Modal State
  const [resetModalUser, setResetModalUser] = useState<UserItem | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [resetting, setResetting] = useState(false);

  // History Modal State
  const [historyModalUser, setHistoryModalUser] = useState<UserItem | null>(null);

  // Copy password helper
  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Password copied to clipboard!");
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const togglePasswordVisibility = (key: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPasswordInput(pwd);
  };

  const handleAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    if (!newPasswordInput || newPasswordInput.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setResetting(true);
    try {
      const res = await adminResetUserPasswordAction(resetModalUser.id, newPasswordInput);
      if (res.success) {
        toast.success(res.message);
        // Update local state
        setVault((prev) => ({
          ...prev,
          [String(resetModalUser.id)]: {
            password: newPasswordInput,
            updatedAt: new Date().toISOString(),
            changedBy: "Super Admin",
            source: "admin_reset",
          },
        }));
        setResetModalUser(null);
        setNewPasswordInput("");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setResetting(false);
    }
  };

  // Filtered Users for Vault
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u) => {
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.employeeId || "").toLowerCase().includes(q) ||
        u.role.name.toLowerCase().includes(q) ||
        (u.primaryDepartment?.name || "").toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  // Filtered Audit Logs
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return auditLogs;
    const q = searchQuery.toLowerCase();
    return auditLogs.filter((log) => {
      const meta = log.metadata || {};
      const name = (meta.userName || "").toLowerCase();
      const email = (meta.userEmail || "").toLowerCase();
      const actor = (log.actor?.name || "").toLowerCase();
      const pwd = (meta.newPasswordSet || "").toLowerCase();
      return name.includes(q) || email.includes(q) || actor.includes(q) || pwd.includes(q);
    });
  }, [auditLogs, searchQuery]);

  // Specific user history
  const userHistoryLogs = useMemo(() => {
    if (!historyModalUser) return [];
    return auditLogs.filter(
      (log) => String(log.entityId) === String(historyModalUser.id)
    );
  }, [auditLogs, historyModalUser]);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-900">
                Super Admin Password Vault &amp; Recovery
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
                Restricted Access
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Instant password lookup and history recovery for employees who forget or change their passwords.
            </p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-lg self-start sm:self-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("vault")}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "vault"
                ? "bg-white text-neutral-900 shadow-2xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-purple-600" />
            <span>Active Passwords ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "logs"
                ? "bg-white text-neutral-900 shadow-2xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>Change Logs ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Search and Global Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee name, email, ID..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        {activeTab === "vault" && (
          <button
            type="button"
            onClick={() => setShowAllPasswords(!showAllPasswords)}
            className="text-xs font-semibold px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md transition-colors flex items-center gap-1.5 self-end sm:self-auto cursor-pointer"
          >
            {showAllPasswords ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Mask All Passwords</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Reveal All Passwords</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* TAB 1: USER PASSWORDS VAULT */}
      {activeTab === "vault" && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#f9fafb] text-[11px] font-bold uppercase text-neutral-600 border-b border-neutral-200">
              <tr>
                <th className="py-2.5 px-3">Employee</th>
                <th className="py-2.5 px-3">Role / Dept</th>
                <th className="py-2.5 px-3">Current Password</th>
                <th className="py-2.5 px-3">Last Updated</th>
                <th className="py-2.5 px-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-neutral-400">
                    No users matching search query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const vaultEntry = vault[String(u.id)];
                  const rawPassword = vaultEntry?.password;
                  const isVisible = showAllPasswords || Boolean(visiblePasswords[String(u.id)]);
                  const isCopied = copiedId === `vault-${u.id}`;

                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/70 transition-colors">
                      {/* Employee Info */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-neutral-900">{u.name}</div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono">{u.email}</span>
                          {u.employeeId && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-neutral-600 font-semibold">
                                {u.employeeId}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Role & Dept */}
                      <td className="py-2.5 px-3">
                        <span className="inline-block font-semibold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                          {u.role.name}
                        </span>
                        <div className="text-[10px] text-neutral-500 mt-0.5">
                          {u.primaryDepartment?.name || "Global Workspace"}
                        </div>
                      </td>

                      {/* Current Password Field */}
                      <td className="py-2.5 px-3">
                        {rawPassword ? (
                          <div className="inline-flex items-center gap-1.5 bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200">
                            <span className="font-mono font-bold text-neutral-900 text-xs tracking-wider select-all">
                              {isVisible ? rawPassword : "••••••••••••"}
                            </span>

                            {/* Show/Hide eye button */}
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(String(u.id))}
                              className="p-1 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                              title={isVisible ? "Hide Password" : "Show Password"}
                            >
                              {isVisible ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Copy button */}
                            <button
                              type="button"
                              onClick={() => handleCopy(rawPassword, `vault-${u.id}`)}
                              className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                              title="Copy password to clipboard"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-neutral-400 italic">
                              Initial / Not recorded
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setResetModalUser(u);
                                setNewPasswordInput("Password@123");
                              }}
                              className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                            >
                              Set Password
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Last updated */}
                      <td className="py-2.5 px-3 text-[11px] text-neutral-500">
                        {vaultEntry?.updatedAt ? (
                          <div>
                            <div className="font-medium text-neutral-700">
                              {formatDateTime12(vaultEntry.updatedAt)}
                            </div>
                            <span className="text-[10px] text-neutral-400">
                              By {vaultEntry.changedBy || "System"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* History button */}
                          <button
                            type="button"
                            onClick={() => setHistoryModalUser(u)}
                            className="px-2 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            title="View full password change history for this user"
                          >
                            <History className="w-3 h-3 text-neutral-500" />
                            <span>History</span>
                          </button>

                          {/* Quick Reset button */}
                          <button
                            type="button"
                            onClick={() => {
                              setResetModalUser(u);
                              setNewPasswordInput("");
                            }}
                            className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            title="Reset password for this employee"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: AUDIT LOGS HISTORY */}
      {activeTab === "logs" && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#f9fafb] text-[11px] font-bold uppercase text-neutral-600 border-b border-neutral-200">
              <tr>
                <th className="py-2.5 px-3">Target Employee</th>
                <th className="py-2.5 px-3">Changed By</th>
                <th className="py-2.5 px-3">Password Recorded</th>
                <th className="py-2.5 px-3">Event Date &amp; Time</th>
                <th className="py-2.5 px-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-neutral-400">
                    No password audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const meta = log.metadata || {};
                  const targetName =
                    meta.userName || meta.targetUserEmail || `User #${log.entityId}`;
                  const targetEmail = meta.userEmail || meta.targetUserEmail || "";
                  const rawPwd = meta.newPasswordSet || "";
                  const isVisible = showAllPasswords || Boolean(visiblePasswords[`log-${log.id}`]);
                  const isCopied = copiedId === `log-${log.id}`;

                  return (
                    <tr key={log.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-neutral-900">{targetName}</div>
                        {targetEmail && (
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {targetEmail}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-neutral-800">
                          {log.actor?.name || meta.changedBy || "Self"}
                        </span>
                        {log.actor?.email && (
                          <div className="text-[10px] text-neutral-400 font-mono">
                            {log.actor.email}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {rawPwd ? (
                          <div className="inline-flex items-center gap-1.5 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                            <span className="font-mono font-bold text-neutral-900 text-[11px] tracking-wider select-all">
                              {isVisible ? rawPwd : "••••••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(`log-${log.id}`)}
                              className="p-1 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                              title="Toggle password view"
                            >
                              {isVisible ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(rawPwd, `log-${log.id}`)}
                              className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                              title="Copy password"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-[11px] italic">Protected</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-neutral-600 font-mono text-[11px]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-400 shrink-0" />
                          <span>{formatDateTime12(log.createdAt)}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{meta.note || "Verified Log"}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* QUICK RESET MODAL */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2 text-neutral-900 font-bold text-sm">
                <RefreshCw className="w-4 h-4 text-purple-600" />
                <span>Reset Password for {resetModalUser.name}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 font-semibold">
                {resetModalUser.email}
              </span>
            </div>

            <form onSubmit={handleAdminReset} className="space-y-3.5">
              <p className="text-xs text-neutral-600 leading-relaxed">
                As Super Admin, you can set a new password for this user. The new password will immediately be saved to the vault and logged so you can share it with the employee.
              </p>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700">New Password *</label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Strong Password</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter or generate new password"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 font-mono bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{resetting ? "Resetting..." : "Confirm & Save Password"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER HISTORY MODAL */}
      {historyModalUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2 text-neutral-900 font-bold text-sm">
                <History className="w-4 h-4 text-purple-600" />
                <span>Password History: {historyModalUser.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalUser(null)}
                className="text-xs text-neutral-500 hover:text-neutral-900 font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              {userHistoryLogs.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-400">
                  No historical password changes recorded for this user yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar pr-1">
                  {userHistoryLogs.map((log) => {
                    const meta = log.metadata || {};
                    const pwd = meta.newPasswordSet;
                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-neutral-800">
                            {meta.note || "Password Updated"}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {formatDateTime12(log.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase">
                              Password Set:
                            </span>
                            <span className="font-mono font-bold text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200">
                              {pwd || "••••••••"}
                            </span>
                          </div>
                          {pwd && (
                            <button
                              type="button"
                              onClick={() => handleCopy(pwd, `hist-${log.id}`)}
                              className="p-1 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                              title="Copy password"
                            >
                              {copiedId === `hist-${log.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        <div className="text-[10px] text-neutral-500">
                          Changed by: <strong>{log.actor?.name || meta.changedBy || "Self"}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setHistoryModalUser(null)}
                className="px-4 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded text-xs font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
