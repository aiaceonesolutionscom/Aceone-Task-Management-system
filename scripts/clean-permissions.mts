import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

const CANONICAL_PERMISSIONS = [
  // Tasks
  { key: "task.view", label: "View tasks", group: "Tasks" },
  { key: "task.create", label: "Create tasks", group: "Tasks" },
  { key: "task.edit", label: "Edit tasks", group: "Tasks" },
  { key: "task.delete", label: "Delete tasks", group: "Tasks" },
  { key: "task.assign", label: "Assign & reassign tasks", group: "Tasks" },
  { key: "task.comment", label: "Comment on tasks", group: "Tasks" },
  { key: "task.submit", label: "Submit task work", group: "Tasks" },
  { key: "task.review", label: "Review submissions & request changes", group: "Tasks" },
  { key: "task.approve", label: "Approve task submissions", group: "Tasks" },

  // Categories / Departments
  { key: "category.view", label: "View categories & departments", group: "Categories" },
  { key: "category.create", label: "Create categories", group: "Categories" },
  { key: "category.edit", label: "Edit categories", group: "Categories" },
  { key: "category.delete", label: "Delete / archive categories", group: "Categories" },

  // Users & Team
  { key: "user.view", label: "View team members & directory", group: "Users" },
  { key: "user.create", label: "Create user accounts", group: "Users" },
  { key: "user.edit", label: "Edit user accounts", group: "Users" },
  { key: "user.delete", label: "Delete / deactivate users", group: "Users" },

  // Daily Reports
  { key: "report.view", label: "View reports & analytics", group: "Reports" },
  { key: "report.category.view", label: "View category & team reports", group: "Reports" },
  { key: "report.create", label: "Submit daily reports", group: "Reports" },
  { key: "report.review", label: "Review daily reports & request revisions", group: "Reports" },
  { key: "report.approve", label: "Approve daily reports", group: "Reports" },

  // Approvals Center
  { key: "approval.view", label: "View approvals queue", group: "Approvals" },
  { key: "approval.review", label: "Review & request changes on approvals", group: "Approvals" },
  { key: "approval.approve", label: "Approve workflow items", group: "Approvals" },

  // Files & Media Storage
  { key: "file.view", label: "View & preview files", group: "Files" },
  { key: "file.upload", label: "Upload files & attachments", group: "Files" },
  { key: "file.download", label: "Download files", group: "Files" },
  { key: "file.delete", label: "Delete & archive stored files", group: "Files" },

  // Chat & Communication
  { key: "chat.view", label: "Access chat & team discussions", group: "Chat" },
  { key: "chat.send", label: "Send messages & media in chat", group: "Chat" },

  // Administration & Governance
  { key: "role.view", label: "View roles", group: "Administration" },
  { key: "role.manage", label: "Manage & configure roles", group: "Administration" },
  { key: "permission.view", label: "View permissions matrix", group: "Administration" },
  { key: "permission.assign", label: "Assign permissions & user overrides", group: "Administration" },
  { key: "scope.view", label: "View user scopes", group: "Administration" },
  { key: "scope.manage", label: "Manage category, assignment & approval scopes", group: "Administration" },
  { key: "audit.view", label: "View system audit logs", group: "Administration" },
  { key: "settings.manage", label: "Manage system settings & custom fields", group: "Administration" },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    "task.view", "task.create", "task.edit", "task.delete", "task.assign", "task.comment", "task.submit", "task.review", "task.approve",
    "category.view", "category.create", "category.edit", "category.delete",
    "user.view", "user.create", "user.edit", "user.delete",
    "report.view", "report.category.view", "report.create", "report.review", "report.approve",
    "approval.view", "approval.review", "approval.approve",
    "file.view", "file.upload", "file.download", "file.delete",
    "chat.view", "chat.send",
    "role.view", "role.manage", "permission.view", "permission.assign", "scope.view", "scope.manage",
    "audit.view", "settings.manage",
  ],
  manager: [
    "task.view", "task.create", "task.edit", "task.assign", "task.comment", "task.submit", "task.review", "task.approve",
    "category.view",
    "user.view",
    "report.view", "report.category.view", "report.create", "report.review", "report.approve",
    "approval.view", "approval.review", "approval.approve",
    "file.view", "file.upload", "file.download",
    "chat.view", "chat.send",
  ],
  employee: [
    "task.view", "task.comment", "task.submit",
    "report.view", "report.create",
    "file.view", "file.upload", "file.download",
    "chat.view", "chat.send",
  ],
};

async function main() {
  console.log("=== CLEANING & NORMALIZING PERMISSIONS TABLE ===");

  // 1. Upsert all canonical permissions
  for (const p of CANONICAL_PERMISSIONS) {
    await db.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, label: p.label, group: p.group },
      update: { label: p.label, group: p.group },
    });
  }
  console.log(`✓ Upserted ${CANONICAL_PERMISSIONS.length} canonical permissions`);

  // 2. Identify redundant duplicate keys
  const canonicalKeys = new Set(CANONICAL_PERMISSIONS.map(p => p.key));
  const allDbPerms = await db.permission.findMany();
  const redundant = allDbPerms.filter(p => !canonicalKeys.has(p.key));
  console.log(`Found ${redundant.length} redundant/duplicate permissions to clean up:`, redundant.map(r => r.key).join(", "));

  // 3. Remove RolePermission links pointing to redundant permissions
  const redundantIds = redundant.map(r => r.id);
  if (redundantIds.length > 0) {
    const deletedLinks = await db.rolePermission.deleteMany({
      where: { permissionId: { in: redundantIds } },
    });
    console.log(`✓ Removed ${deletedLinks.count} redundant role_permission links`);

    // Remove the redundant permissions themselves
    const deletedPerms = await db.permission.deleteMany({
      where: { id: { in: redundantIds } },
    });
    console.log(`✓ Deleted ${deletedPerms.count} redundant permissions from DB`);
  }

  // 4. Update RolePermission for each standard role
  const canonicalPermMap = new Map((await db.permission.findMany()).map(p => [p.key, p.id]));

  for (const [roleCode, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await db.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      console.warn(`Role ${roleCode} not found in DB`);
      continue;
    }

    // Clear existing links
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });

    // Insert new links
    for (const key of permKeys) {
      const pId = canonicalPermMap.get(key);
      if (pId) {
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId: pId },
        });
      }
    }
    console.log(`✓ Role [${roleCode}] configured with ${permKeys.length} permissions`);
  }

  console.log("\n=== PERMISSIONS CLEANUP COMPLETE ===");
}

main().catch(console.error).finally(() => db.$disconnect());
