"use client";

import React, { useState, useEffect } from "react";
import { Bell, ShieldAlert, CheckCircle2, Lock, ArrowRight, RefreshCw, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/audio-chime";

export function MandatoryPushModal() {
  const [permission, setPermission] = useState<string>("granted");
  const [checking, setChecking] = useState<boolean>(true);
  const [requesting, setRequesting] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setChecking(false);
      return;
    }

    setPermission(Notification.permission);
    setChecking(false);
  }, []);

  const handleRequestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("granted");
      return;
    }

    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        toast.success("Push notifications enabled! Welcome to AceOne Solutions.");

        // If service worker is supported, register subscription
        if ("serviceWorker" in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
              const rawKey = sub.getKey ? sub.getKey("p256dh") : null;
              const rawAuth = sub.getKey ? sub.getKey("auth") : null;
              const p256dh = rawKey
                ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey))))
                : "";
              const auth = rawAuth
                ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))))
                : "";

              await fetch("/api/notifications/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  endpoint: sub.endpoint,
                  p256dh,
                  auth,
                }),
              });
            }
          } catch {
            // Non-blocking fallback
          }
        }
      } else if (result === "denied") {
        toast.error("Notification permission was denied. You must allow it to continue.");
      }
    } catch (err: any) {
      toast.error("Could not request notification permission: " + err.message);
    } finally {
      setRequesting(false);
    }
  };

  const handleCheckAgain = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const current = Notification.permission;
      setPermission(current);
      if (current === "granted") {
        toast.success("Permission verified! Access granted.");
      } else {
        toast.error("Notifications are still not allowed in browser settings.");
      }
    }
  };

  // If already granted or loading initial state, do not block
  if (checking || permission === "granted") {
    return null;
  }

  // Blocking full-screen modal gate
  return (
    <div className="fixed inset-0 z-[100] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Animated Bell Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
          <Bell className="w-8 h-8 animate-bounce" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-white text-[9px] font-bold items-center justify-center">
              !
            </span>
          </span>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Mandatory Step · Action Required
          </span>
          <h2 className="text-xl font-bold text-neutral-900 pt-1">
            Enable Push Notifications to Proceed
          </h2>
          <p className="text-xs text-neutral-600 leading-relaxed max-w-md mx-auto">
            AceOne Task Management System requires Web Push notification access for instant task assignments, reviewer change requests, approval alerts, and team chat messages.
          </p>
        </div>

        {/* Informative Feature Bullets */}
        <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200 text-left text-xs space-y-2.5">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="text-neutral-700">
              <strong>Instant Task Dispatch:</strong> Receive alerts when new tasks are assigned to you or your department.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="text-neutral-700">
              <strong>Review & Approvals:</strong> Instant alerts when revisions are requested or tasks are approved.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <Volume2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span className="text-neutral-700">
              <strong>Audio Ringtone Chime:</strong> Pleasant audio notification whenever a team member messages you.
            </span>
          </div>
        </div>

        {/* If user previously clicked Block / Deny in browser */}
        {permission === "denied" && (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 text-left space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Notifications are currently blocked in your browser</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              1. Click the <strong>tune / lock icon (🔒)</strong> in your browser address bar next to <code>localhost:3007</code>.
              <br />
              2. Change <strong>Notifications</strong> to <strong>"Allow"</strong>.
              <br />
              3. Click the button below to verify and enter.
            </p>
          </div>
        )}

        {/* Action Button */}
        <div className="space-y-2.5 pt-1">
          {permission === "denied" ? (
            <button
              type="button"
              onClick={handleCheckAgain}
              className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>I Have Allowed Notifications · Check Again</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={requesting}
              onClick={handleRequestPermission}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{requesting ? "Waiting for Browser Prompt..." : "Allow & Enable Notifications"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <p className="text-[10px] text-neutral-400">
            Access to the workspace is blocked until notification permission is allowed.
          </p>
        </div>
      </div>
    </div>
  );
}
