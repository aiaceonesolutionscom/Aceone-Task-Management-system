"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { loginSchema, zodIssueMap } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSession, destroySession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { logAudit } from "@/lib/activity";

export type LoginState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const LOGIN_LIMIT = 8;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: zodIssueMap(parsed.error) };
  }

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const rate = checkRateLimit(
    `login:${ip}:${parsed.data.email}`,
    LOGIN_LIMIT,
    LOGIN_WINDOW_MS,
  );
  if (!rate.allowed) {
    return { error: "Too many sign-in attempts. Please try again shortly." };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }

  if (user.status !== "ACTIVE") {
    return {
      error: "This account is inactive. Please contact an administrator.",
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user.id);
  await logAudit("auth.login", user.id);

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}