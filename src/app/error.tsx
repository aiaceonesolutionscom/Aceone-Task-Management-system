"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client-side error to console
    console.error("[Application Error Caught by Boundary]:", error);

    // Call logging endpoint
    fetch("/api/logs/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: typeof window !== "undefined" ? window.location.href : "",
      }),
    }).catch(() => {
      // Ignore failure to prevent infinite crash loop
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-neutral-200 rounded-xl p-6 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900 mb-1">Something went wrong!</h2>
        <p className="text-xs text-neutral-500 mb-6">
          An unexpected error occurred. This incident has been recorded in the production error logs for diagnostics.
        </p>

        {error.message && (
          <div className="mb-6 p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-left">
            <p className="text-[11px] font-mono text-neutral-700 break-words line-clamp-3">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-[10px] font-mono text-neutral-400 mt-1">Digest: {error.digest}</p>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg transition"
          >
            <Home className="w-3.5 h-3.5" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
