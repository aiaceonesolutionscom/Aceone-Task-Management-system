import { db } from "@/lib/db";
import type { PermissionKey } from "@/lib/permissions";

export type EffectiveUser = {
  id: number;
  name: string;
  email: string;
  username: string | null;
  employeeId: string | null;
  designation: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  roleId: number;
  primaryDepartmentId: number | null;
  role: {
    code: string;
    name: string;
    isSystem: boolean;
  };
  permissions: Set<string>;
  categoryScopeIds: number[];
  assignmentScopeIds: number[];
  approvalScopeIds: number[];
  enabledFacilities: string[];
};

/**
 * Computes a user's effective permissions, scopes and facilities from database.
 * Formula:
 * Effective Permissions = Role Permissions + User Permission Overrides (grant/deny)
 * If role is system (Super Admin / CEO with isSystem), all permissions are implicitly held.
 */
export async function getEffectiveUser(userId: number): Promise<EffectiveUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
      categoryScopes: true,
      assignmentScopes: true,
      approvalScopes: true,
      permissionOverrides: true,
    },
  });

  if (!user || user.status !== "ACTIVE") return null;

  const permissions = new Set<string>();

  if (user.role.isSystem) {
    // Super admin / CEO holds every permission
    permissions.add("*");
  } else {
    // Base role permissions
    for (const rp of user.role.permissions) {
      permissions.add(rp.permission.key);
    }

    // Apply user overrides
    for (const override of user.permissionOverrides) {
      if (override.isGranted) {
        permissions.add(override.permissionKey);
      } else {
        permissions.delete(override.permissionKey);
      }
    }
  }

  const enabledFacilities = Array.isArray(user.enabledFacilities)
    ? (user.enabledFacilities as string[])
    : ["tasks", "calendar", "reports", "approvals", "comments", "notifications", "files"];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    employeeId: user.employeeId,
    designation: user.designation,
    status: user.status as "ACTIVE" | "INACTIVE" | "SUSPENDED",
    roleId: user.roleId,
    primaryDepartmentId: user.primaryDepartmentId,
    role: {
      code: user.role.code,
      name: user.role.name,
      isSystem: user.role.isSystem,
    },
    permissions,
    categoryScopeIds: user.categoryScopes.map((s) => s.departmentId),
    assignmentScopeIds: user.assignmentScopes.map((s) => s.departmentId),
    approvalScopeIds: user.approvalScopes.map((s) => s.departmentId),
    enabledFacilities,
  };
}

/** Check if user holds a specific permission */
export function hasEffectivePermission(user: EffectiveUser | null | undefined, key: PermissionKey | string): boolean {
  if (!user) return false;
  if (user.role.isSystem || user.role.code === "super_admin" || user.permissions.has("*")) return true;
  return user.permissions.has(key);
}

/**
 * Check if user can create or assign tasks in a specific department/category.
 * User must have task.create or task.assign AND (be super admin OR have category in assignmentScopes OR assignmentScopes is empty allowing primary dept).
 */
export function canAssignInCategory(user: EffectiveUser, departmentId: number): boolean {
  if (user.role.isSystem || user.role.code === "super_admin" || user.role.code === "admin") return true;
  if (!hasEffectivePermission(user, "task.assign") && !hasEffectivePermission(user, "task.create")) {
    return false;
  }
  if (user.assignmentScopeIds.length === 0) {
    return user.primaryDepartmentId === null || user.primaryDepartmentId === departmentId;
  }
  return user.assignmentScopeIds.includes(departmentId);
}

/**
 * Check if user can review/approve tasks in a specific department/category.
 * User must have approval permission AND (be super admin OR have category in approvalScopes).
 */
export function canApproveInCategory(user: EffectiveUser, departmentId: number): boolean {
  if (user.role.isSystem || user.role.code === "super_admin" || user.role.code === "admin") return true;
  const hasPerm =
    hasEffectivePermission(user, "task.approve") ||
    hasEffectivePermission(user, "approval.approve") ||
    hasEffectivePermission(user, "task.review");

  if (!hasPerm) {
    return false;
  }
  if (user.approvalScopeIds.length === 0) {
    return user.primaryDepartmentId === null || user.primaryDepartmentId === departmentId;
  }
  return user.approvalScopeIds.includes(departmentId);
}

/**
 * Returns list of allowed department IDs that the user can view/access.
 * Returns null if user is Super Admin or Admin (meaning full access to all categories).
 */
export function getAllowedDepartmentIds(user: EffectiveUser): number[] | null {
  if (user.role.isSystem || user.role.code === "super_admin" || user.role.code === "admin") {
    return null;
  }
  const allowed = new Set<number>();
  if (user.primaryDepartmentId) {
    allowed.add(user.primaryDepartmentId);
  }
  for (const id of user.categoryScopeIds) {
    allowed.add(id);
  }
  return Array.from(allowed);
}

/**
 * Check if user can view tasks or data for a department/category.
 */
export function canViewCategory(user: EffectiveUser, departmentId: number): boolean {
  if (user.role.isSystem || user.role.code === "super_admin" || user.role.code === "admin") return true;
  if (user.primaryDepartmentId === departmentId) return true;
  return user.categoryScopeIds.includes(departmentId);
}

