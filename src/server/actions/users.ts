"use server";

import { requireUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission } from "@/lib/scopes";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { recordUserPassword, getPasswordAuditHistory } from "@/lib/password-vault";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

/**
 * Generates automated Employee ID e.g. "AS1-DES-0004"
 */
async function generateEmployeeId(categoryId?: number): Promise<string> {
  let catCode = "EMP";
  if (categoryId) {
    const cat = await db.department.findUnique({
      where: { id: categoryId },
      select: { code: true },
    });
    if (cat?.code) catCode = cat.code;
  }

  const count = await db.user.count();
  const nextNum = (count + 1).toString().padStart(4, "0");
  return `AS1-${catCode}-${nextNum}`;
}

export async function createUserAction(formData: FormData) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "user.create")) {
    throw new Error("Forbidden: You do not have permission to create users.");
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const username = (formData.get("username") as string)?.trim().toLowerCase() || null;
  const password = formData.get("password") as string;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const designation = (formData.get("designation") as string)?.trim() || null;
  const roleId = parseInt(formData.get("roleId") as string, 10);
  const primaryDepartmentId = formData.get("departmentId")
    ? parseInt(formData.get("departmentId") as string, 10)
    : null;

  if (!name || !email || !password || isNaN(roleId)) {
    throw new Error("Name, email, password, and role are required.");
  }

  const targetRole = await db.role.findUnique({ where: { id: roleId } });
  if (!targetRole) throw new Error("Invalid role selected.");
  const isSuperAdminUser = user.role.code === "super_admin" || user.role.isSystem;
  if (targetRole.code === "super_admin" && !isSuperAdminUser) {
    throw new Error("Forbidden: Only a Super Admin can create a Super Admin user.");
  }

  const existingEmail = await db.user.findUnique({ where: { email } });
  if (existingEmail) throw new Error("A user with this email already exists.");

  const employeeId = await generateEmployeeId(primaryDepartmentId ?? undefined);
  const passwordHash = await bcrypt.hash(password, 12);

  // Scopes
  const assignmentScopeIds = formData
    .getAll("assignmentScopes")
    .map((v) => parseInt(v as string, 10))
    .filter((id) => !isNaN(id));

  const approvalScopeIds = formData
    .getAll("approvalScopes")
    .map((v) => parseInt(v as string, 10))
    .filter((id) => !isNaN(id));

  const newUser = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name,
        email,
        username: username || email.split("@")[0],
        employeeId,
        passwordHash,
        phone,
        designation,
        roleId,
        primaryDepartmentId,
        status: "ACTIVE",
        createdByUserId: user.id,
      },
    });

    // Add assignment scopes
    for (const dId of assignmentScopeIds) {
      await tx.userAssignmentScope.create({
        data: { userId: u.id, departmentId: dId },
      });
    }

    // Add approval scopes
    for (const dId of approvalScopeIds) {
      await tx.userApprovalScope.create({
        data: { userId: u.id, departmentId: dId },
      });
    }

    // Add password vault permission override if granted
    if (formData.get("canViewPasswords") === "true") {
      await tx.userPermissionOverride.create({
        data: {
          userId: u.id,
          permissionKey: "user.view_passwords",
          isGranted: true,
        },
      });
    }

    return u;
  });

  await recordAudit({
    actorId: user.id,
    action: "user.create",
    entityType: "USER",
    entityId: String(newUser.id),
    metadata: {
      name,
      email,
      employeeId,
      designation,
      roleId,
      initialPassword: password,
    },
  });

  // Save to Super Admin password vault & audit history
  await recordUserPassword(newUser.id, password, "initial_setup", user.name, {
    name: newUser.name,
    email: newUser.email,
  });

  revalidatePath("/organization/users");
  revalidatePath("/settings");
  return { success: true, userId: newUser.id, employeeId };
}

export async function toggleUserStatusAction(userId: number, newStatus: "ACTIVE" | "INACTIVE") {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || (!hasEffectivePermission(effectiveUser, "user.delete") && !hasEffectivePermission(effectiveUser, "user.edit"))) {
    throw new Error("Forbidden: You do not have permission to modify user status.");
  }

  await db.user.update({
    where: { id: userId },
    data: { status: newStatus },
  });

  await recordAudit({
    actorId: user.id,
    action: "user.status_change",
    entityType: "USER",
    entityId: userId,
    metadata: { newStatus },
  });

  revalidatePath("/organization/users");
  return { success: true };
}

export async function updateUserScopesAction(data: {
  userId: number;
  primaryDepartmentId?: number | null;
  categoryScopeIds: number[];
  assignmentScopeIds: number[];
  approvalScopeIds: number[];
}) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || (!hasEffectivePermission(effectiveUser, "scope.manage") && !hasEffectivePermission(effectiveUser, "user.edit"))) {
    throw new Error("Forbidden: You do not have permission to manage user scopes.");
  }

  const { userId, primaryDepartmentId, categoryScopeIds, assignmentScopeIds, approvalScopeIds } = data;

  await db.$transaction(async (tx) => {
    // Update primary department if specified
    if (primaryDepartmentId !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: { primaryDepartmentId: primaryDepartmentId || null },
      });
    }

    // 1. Sync UserCategoryScope (which category tasks user can see)
    await tx.userCategoryScope.deleteMany({ where: { userId } });
    for (const dId of categoryScopeIds) {
      await tx.userCategoryScope.create({
        data: { userId, departmentId: dId },
      });
    }

    // 2. Sync UserAssignmentScope (which categories user can assign)
    await tx.userAssignmentScope.deleteMany({ where: { userId } });
    for (const dId of assignmentScopeIds) {
      await tx.userAssignmentScope.create({
        data: { userId, departmentId: dId },
      });
    }

    // 3. Sync UserApprovalScope (which categories user can approve)
    await tx.userApprovalScope.deleteMany({ where: { userId } });
    for (const dId of approvalScopeIds) {
      await tx.userApprovalScope.create({
        data: { userId, departmentId: dId },
      });
    }
  });

  await recordAudit({
    actorId: user.id,
    action: "user.scopes_updated",
    entityType: "USER",
    entityId: userId,
    metadata: {
      primaryDepartmentId,
      categoryScopeIds,
      assignmentScopeIds,
      approvalScopeIds,
    },
  });

  revalidatePath("/organization/scopes");
  revalidatePath("/organization/users");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateUserAction(formData: FormData) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "user.edit")) {
    throw new Error("Forbidden: You do not have permission to edit users.");
  }

  const userId = parseInt(formData.get("userId") as string, 10);
  if (isNaN(userId)) throw new Error("Invalid user ID.");

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const username = (formData.get("username") as string)?.trim().toLowerCase() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const designation = (formData.get("designation") as string)?.trim() || null;
  const roleId = parseInt(formData.get("roleId") as string, 10);
  const primaryDepartmentId = formData.get("departmentId")
    ? parseInt(formData.get("departmentId") as string, 10)
    : null;
  const status = (formData.get("status") as "ACTIVE" | "INACTIVE") || "ACTIVE";
  const password = (formData.get("password") as string)?.trim();

  if (!name || !email || isNaN(roleId)) {
    throw new Error("Name, email, and role are required.");
  }

  const targetUser = await db.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!targetUser) throw new Error("User not found.");

  const isSuperAdminUser = user.role.code === "super_admin" || user.role.isSystem;
  if (targetUser.role.code === "super_admin" && !isSuperAdminUser) {
    throw new Error("Forbidden: Only a Super Admin can modify a Super Admin account.");
  }

  const targetRole = await db.role.findUnique({ where: { id: roleId } });
  if (!targetRole) throw new Error("Invalid role selected.");
  if (targetRole.code === "super_admin" && !isSuperAdminUser) {
    throw new Error("Forbidden: Only a Super Admin can assign the Super Admin role.");
  }

  // Check unique email
  const existingEmail = await db.user.findFirst({
    where: {
      email,
      id: { not: userId },
    },
  });
  if (existingEmail) throw new Error("Another user already has this email address.");

  const updateData: any = {
    name,
    email,
    username: username || email.split("@")[0],
    phone,
    designation,
    roleId,
    primaryDepartmentId,
    status,
  };

  if (password && password.length >= 6) {
    updateData.passwordHash = await bcrypt.hash(password, 12);
  }

  await db.user.update({
    where: { id: userId },
    data: updateData,
  });

  if (password && password.length >= 6) {
    // Record in Super Admin vault & audit log
    await recordUserPassword(userId, password, "admin_reset", user.name, {
      name,
      email,
    });
  }

  // Handle user-specific password vault permission override
  const canViewPasswordsParam = formData.get("canViewPasswords");
  if (canViewPasswordsParam !== null) {
    const isGranted = canViewPasswordsParam === "true";
    if (isGranted) {
      await db.userPermissionOverride.upsert({
        where: {
          userId_permissionKey: {
            userId,
            permissionKey: "user.view_passwords",
          },
        },
        create: {
          userId,
          permissionKey: "user.view_passwords",
          isGranted: true,
        },
        update: {
          isGranted: true,
        },
      });
    } else {
      await db.userPermissionOverride.deleteMany({
        where: {
          userId,
          permissionKey: "user.view_passwords",
        },
      });
    }
  }

  await recordAudit({
    actorId: user.id,
    action: "user.update",
    entityType: "USER",
    entityId: String(userId),
    metadata: {
      name,
      email,
      designation,
      roleId,
      status,
      passwordChanged: Boolean(password && password.length >= 6),
    },
  });

  revalidatePath("/organization/users");
  revalidatePath("/organization/scopes");
  revalidatePath("/tasks");
  revalidatePath("/settings");
  return { success: true };
}

export async function deleteUserAction(userId: number) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "user.delete")) {
    throw new Error("Forbidden: You do not have permission to delete users.");
  }

  if (user.id === userId) {
    throw new Error("You cannot delete your own account.");
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      _count: {
        select: {
          taskAssignments: true,
          createdTasks: true,
          taskVersions: true,
        },
      },
    },
  });

  if (!target) throw new Error("User not found.");

  if (target.role.code === "super_admin") {
    const isSuperAdminUser = user.role.code === "super_admin" || user.role.isSystem;
    if (!isSuperAdminUser) {
      throw new Error("Forbidden: Only a Super Admin can delete a Super Admin account.");
    }
    const superAdminCount = await db.user.count({
      where: { role: { code: "super_admin" }, status: "ACTIVE" },
    });
    if (superAdminCount <= 1) {
      throw new Error("Cannot delete the only active Super Admin.");
    }
  }

  // If user has operational records, soft-delete by deactivating to preserve audit trail
  const hasRecords =
    target._count.taskAssignments > 0 ||
    target._count.createdTasks > 0 ||
    target._count.taskVersions > 0;

  if (hasRecords) {
    await db.user.update({
      where: { id: userId },
      data: { status: "INACTIVE" },
    });

    await recordAudit({
      actorId: user.id,
      action: "user.deactivate_soft_delete",
      entityType: "USER",
      entityId: userId,
      metadata: { reason: "User has linked tasks/submissions; set to INACTIVE." },
    });

    revalidatePath("/organization/users");
    return {
      success: true,
      message: "User has existing tasks/records. Status changed to INACTIVE to preserve system history.",
    };
  }

  // Otherwise clean delete
  await db.$transaction(async (tx) => {
    await tx.userCategoryScope.deleteMany({ where: { userId } });
    await tx.userAssignmentScope.deleteMany({ where: { userId } });
    await tx.userApprovalScope.deleteMany({ where: { userId } });
    await tx.departmentMember.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  await recordAudit({
    actorId: user.id,
    action: "user.delete",
    entityType: "USER",
    entityId: userId,
    metadata: { email: target.email, name: target.name },
  });

  revalidatePath("/organization/users");
  return { success: true, message: "User deleted successfully." };
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser();
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword) {
    throw new Error("Both current and new passwords are required.");
  }
  if (newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters.");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("New password and confirmation password do not match.");
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
  });
  if (!dbUser) throw new Error("User account not found.");

  const isValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!isValid) {
    throw new Error("Current password is incorrect.");
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newPasswordHash },
  });

  // Record into Super Admin password vault & audit logs
  await recordUserPassword(user.id, newPassword, "user_change", "Self", {
    name: user.name,
    email: user.email,
  });

  revalidatePath("/settings");
  return { success: true, message: "Your password has been changed successfully." };
}

/**
 * Super Admin or authorized manager resets another user's password directly.
 */
export async function adminResetUserPasswordAction(userId: number, newPassword: string) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  const canManage = Boolean(
    user.role.isSystem ||
    user.role.code === "super_admin" ||
    user.role.code === "admin" ||
    user.effectivePermissions?.includes("*") ||
    user.effectivePermissions?.includes("user.view_passwords") ||
    (effectiveUser && hasEffectivePermission(effectiveUser, "user.view_passwords")) ||
    (effectiveUser && hasEffectivePermission(effectiveUser, "user.edit"))
  );

  if (!canManage) {
    throw new Error("Forbidden: You do not have permission to reset user passwords.");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters.");
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!target) throw new Error("User not found.");

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  // Record in Super Admin vault & audit history
  await recordUserPassword(userId, newPassword, "admin_reset", user.name, {
    name: target.name,
    email: target.email,
  });

  revalidatePath("/organization/users");
  revalidatePath("/settings");
  return {
    success: true,
    message: `Password for ${target.name} has been updated to "${newPassword}".`,
  };
}

/**
 * Updates profile details for the currently logged in user (any employee/user).
 */
export async function updateProfileSettingsAction(formData: FormData) {
  const user = await requireUser();
  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name) {
    throw new Error("Full name cannot be empty.");
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      name,
      phone,
      description,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "user.profile_update",
    entityType: "USER",
    entityId: String(user.id),
    metadata: { name, phone, description },
  });

  revalidatePath("/settings");
  revalidatePath("/profile");
  return { success: true, message: "Profile settings saved successfully." };
}

/**
 * Super Admin retrieves password history logs for a specific user.
 */
export async function getUserPasswordHistoryAction(userId: number) {
  const user = await requireUser();
  const canView = Boolean(
    user.role.isSystem ||
    user.role.code === "super_admin" ||
    user.role.code === "admin" ||
    user.effectivePermissions?.includes("*") ||
    user.effectivePermissions?.includes("user.view_passwords")
  );

  if (!canView) {
    throw new Error("Forbidden: You do not have permission to view user password logs.");
  }

  const logs = await getPasswordAuditHistory(userId, 20);
  return { success: true, logs };
}



