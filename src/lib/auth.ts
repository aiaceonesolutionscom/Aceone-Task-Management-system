import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { AuthUser } from "@/lib/auth-types";

const SESSION_TTL_MS = env.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const store = await cookies();
  store.set(env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(env.AUTH_COOKIE_NAME)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(env.AUTH_COOKIE_NAME);
}

/**
 * Load the signed-in user for the current request. Memoized per request via
 * React cache so repeated calls in a render pass hit the database once.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  const token = store.get(env.AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          primaryDepartment: true,
          role: {
            include: { permissions: { include: { permission: true } } },
          },
          permissionOverrides: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (session.user.status !== "ACTIVE") return null;

  const permsSet = new Set<string>();
  if (session.user.role.isSystem || session.user.role.code === "super_admin") {
    permsSet.add("*");
  } else {
    for (const rp of session.user.role.permissions) {
      permsSet.add(rp.permission.key);
    }
    for (const override of session.user.permissionOverrides) {
      if (override.isGranted) {
        permsSet.add(override.permissionKey);
      } else {
        permsSet.delete(override.permissionKey);
      }
    }
  }

  const { passwordHash: _hash, ...safeUser } = session.user;

  return {
    ...safeUser,
    effectivePermissions: Array.from(permsSet),
  };
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireActiveUser(): Promise<AuthUser> {
  return requireUser();
}