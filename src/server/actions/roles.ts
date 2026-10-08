"use server";

import { requireUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission } from "@/lib/scopes";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createRoleAction(data: {
  name: string;
  code: string;
  description?: string;
  permissionIds: number[];
}) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "role.manage")) {
    throw new Error("Forbidden: You do not have permission to create roles.");
  }

  const name = data.name.trim();
  const rawCode = data.code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const code = rawCode.startsWith("role_") ? rawCode : rawCode;

  if (!name || !code) {
    throw new Error("Role name and code are required.");
  }

  const existing = await db.role.findUnique({ where: { code } });
  if (existing) {
    throw new Error(`A role with code '${code}' already exists.`);
  }

  const newRole = await db.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        name,
        code,
        description: data.description?.trim() || null,
        isSystem: false,
      },
    });

    if (data.permissionIds && data.permissionIds.length > 0) {
      for (const permId of data.permissionIds) {
        await tx.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }

    return role;
  });

  await recordAudit({
    actorId: user.id,
    action: "role.create",
    entityType: "ROLE",
    entityId: newRole.id,
    metadata: {
      name,
      code,
      permissionCount: data.permissionIds?.length || 0,
    },
  });

  revalidatePath("/organization/roles");
  revalidatePath("/organization/users");
  return { success: true, roleId: newRole.id };
}

export async function updateRoleAction(data: {
  roleId: number;
  name: string;
  description?: string;
  permissionIds: number[];
}) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "role.manage")) {
    throw new Error("Forbidden: You do not have permission to edit roles.");
  }

  const existingRole = await db.role.findUnique({ where: { id: data.roleId } });
  if (!existingRole) {
    throw new Error("Role not found.");
  }

  if (existingRole.isSystem) {
    throw new Error("System roles cannot be modified.");
  }

  await db.$transaction(async (tx) => {
    await tx.role.update({
      where: { id: data.roleId },
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
      },
    });

    // Replace permissions
    await tx.rolePermission.deleteMany({
      where: { roleId: data.roleId },
    });

    for (const permId of data.permissionIds) {
      await tx.rolePermission.create({
        data: {
          roleId: data.roleId,
          permissionId: permId,
        },
      });
    }
  });

  await recordAudit({
    actorId: user.id,
    action: "role.update",
    entityType: "ROLE",
    entityId: data.roleId,
    metadata: {
      name: data.name,
      permissionCount: data.permissionIds.length,
    },
  });

  revalidatePath("/organization/roles");
  revalidatePath("/organization/users");
  return { success: true };
}

export async function deleteRoleAction(roleId: number) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "role.manage")) {
    throw new Error("Forbidden: You do not have permission to delete roles.");
  }

  const role = await db.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  });

  if (!role) throw new Error("Role not found.");
  if (role.isSystem) throw new Error("System roles cannot be deleted.");
  if (role._count.users > 0) {
    throw new Error(`Cannot delete role '${role.name}' because it has ${role._count.users} assigned user(s).`);
  }

  await db.role.delete({ where: { id: roleId } });

  await recordAudit({
    actorId: user.id,
    action: "role.delete",
    entityType: "ROLE",
    entityId: roleId,
    metadata: { name: role.name, code: role.code },
  });

  revalidatePath("/organization/roles");
  revalidatePath("/organization/users");
  return { success: true };
}
