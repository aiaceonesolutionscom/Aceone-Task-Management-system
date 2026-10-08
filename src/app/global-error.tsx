"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Fatal Global Error]:", error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans antialiased text-gray-900">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Fatal Application Error</h2>
          <p className="text-xs text-gray-500 mb-6">
            A critical system error occurred. The incident has been recorded in the server logs.
          </p>

          <div className="flex gap-2 justify-center">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
