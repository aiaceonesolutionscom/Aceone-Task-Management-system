"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors={false}
      theme="light"
      duration={3200}
      visibleToasts={4}
      toastOptions={{
        className:
          "!bg-white !text-neutral-900 !border !border-neutral-200/90 !shadow-xl !rounded-xl !py-3 !px-4 !font-sans !text-xs !font-medium",
        descriptionClassName: "!text-neutral-500 !text-[11px] !mt-0.5 !leading-relaxed",
        actionButtonStyle: {
          backgroundColor: "#171717",
          color: "#ffffff",
          fontSize: "11px",
          fontWeight: "600",
          borderRadius: "6px",
          padding: "4px 8px",
        },
      }}
    />
  );
}
