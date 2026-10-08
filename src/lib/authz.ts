import { PermissionError } from "@/lib/errors";
import type { PermissionKey } from "@/lib/permissions";

export type PermissionedUser = {
  role: {
    isSystem: boolean;
    permissions: Array<{ permission: { key: string } }>;
  };
};

/**
 * True when the user's role carries the given permission.
 * The system (super admin) role implicitly holds every permission so that no
 * role_permissions rows are ever needed for it.
 */
export function hasPermission(
  user: PermissionedUser | null | undefined,
  key: PermissionKey,
): boolean {
  if (!user) return false;
  if (user.role.isSystem) return true;
  return user.role.permissions.some((rp) => rp.permission.key === key);
}

/**
 * Same as hasPermission but throws a PermissionError. Used inside server
 * actions and route handlers where authorization failures should abort.
 */
export function assertPermission(
  user: PermissionedUser | null | undefined,
  key: PermissionKey,
): void {
  if (!hasPermission(user, key)) {
    throw new PermissionError();
  }
}