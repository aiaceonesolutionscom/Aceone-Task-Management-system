import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — AceOne Task Management",
  description: "Sign in to AceOne Task Management System for internal collaboration, approvals and workflow operations.",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="min-h-svh flex items-center justify-center p-4 bg-gradient-to-br from-[#fafbfc] via-white to-[#f5f0f8]">
      <div className="w-full max-w-[400px]">
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 px-6 sm:px-8 py-8 sm:py-10 space-y-6">
          {/* Logo & Title */}
          <div className="flex flex-col items-center text-center space-y-2">
            <Image
              src="/aceone-logo.webp"
              alt="AceOne Solutions"
              width={200}
              height={52}
              className="h-12 w-auto object-contain"
              priority
            />
            <p className="text-xs text-neutral-500 font-medium mt-1">
              Sign in to the task management system
            </p>
          </div>

          {/* Form */}
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="text-neutral-400 text-center text-[11px] mt-5">
          AceOne Solutions — Authorised personnel only
        </p>
      </div>
    </main>
  );
}