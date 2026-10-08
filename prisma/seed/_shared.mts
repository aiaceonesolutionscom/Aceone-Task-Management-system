import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  type PermissionKey,
} from "../../src/lib/permissions";

export function createSeedClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to run seeds.");
  }
  return new PrismaClient({ adapter: new PrismaPg(url) });
}

export type SeedClient = ReturnType<typeof createSeedClient>;

const ROLE_DEFINITIONS = [
  {
    code: "super_admin",
    name: "Super Admin",
    description: "Full system access. Holds every permission implicitly.",
    isSystem: true,
  },
  {
    code: "admin",
    name: "Admin",
    description: "Manages people, departments and tasks. Configurable.",
    isSystem: false,
  },
  {
    code: "manager",
    name: "Manager",
    description: "Creates and assigns tasks, performs reviews.",
    isSystem: false,
  },
  {
    code: "employee",
    name: "Employee",
    description: "Works on assigned tasks and submits results.",
    isSystem: false,
  },
] as const;

/**
 * Idempotent setup of permissions, roles and role-permission mappings.
 * Safe to run repeatedly; used by both prod and dev seeds.
 */
export async function seedPermissionsAndRoles(db: SeedClient) {
  for (const permission of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: permission.key },
      update: { label: permission.label, group: permission.group },
      create: {
        key: permission.key,
        label: permission.label,
        group: permission.group,
      },
    });
  }

  const roles = {} as Record<string, { id: number }>;
  for (const role of ROLE_DEFINITIONS) {
    const saved = await db.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
    });
    roles[role.code] = saved;
  }

  for (const [roleCode, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = roles[roleCode];
    if (!role) continue;
    const permissions = await db.permission.findMany({
      where: { key: { in: keys as PermissionKey[] } },
    });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({
      data: permissions.map((p) => ({
        roleId: role.id,
        permissionId: p.id,
      })),
      skipDuplicates: true,
    });
  }

  return roles;
}
