import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function main() {
  console.log("=========================================");
  console.log(" ACEONE SYSTEM AUDIT: DB & PERMISSIONS ");
  console.log("=========================================");

  // 1. Roles & Permissions count
  const roles = await db.role.findMany({
    include: {
      permissions: {
        include: { permission: true },
      },
      _count: { select: { users: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log("\n--- ROLES IN SYSTEM ---");
  for (const r of roles) {
    console.log(`Role [${r.code}] "${r.name}" (ID: ${r.id}, isSystem: ${r.isSystem}, Users: ${r._count.users})`);
    console.log(`  Permissions (${r.permissions.length}):`, r.permissions.map(p => p.permission.key).join(", "));
  }

  // 2. Users in system
  const users = await db.user.findMany({
    include: {
      role: true,
      primaryDepartment: true,
      categoryScopes: { include: { department: true } },
      assignmentScopes: { include: { department: true } },
      approvalScopes: { include: { department: true } },
      permissionOverrides: true,
    },
    orderBy: { id: "asc" },
  });

  console.log("\n--- USERS IN SYSTEM ---");
  for (const u of users) {
    console.log(`User #${u.id}: "${u.name}" (${u.email})`);
    console.log(`  Role: ${u.role.code} ("${u.role.name}"), Status: ${u.status}`);
    console.log(`  Primary Dept: ${u.primaryDepartment?.name ?? "None"}`);
    if (u.categoryScopes.length) console.log(`  Category Scopes: ${u.categoryScopes.map(s => s.department.name).join(", ")}`);
    if (u.assignmentScopes.length) console.log(`  Assignment Scopes: ${u.assignmentScopes.map(s => s.department.name).join(", ")}`);
    if (u.approvalScopes.length) console.log(`  Approval Scopes: ${u.approvalScopes.map(s => s.department.name).join(", ")}`);
    if (u.permissionOverrides.length) {
      console.log(`  Overrides:`, u.permissionOverrides.map(o => `${o.permissionKey}: ${o.isGranted ? 'GRANT' : 'DENY'}`).join(", "));
    }
  }

  // 3. All Permissions in DB
  const perms = await db.permission.findMany({
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });
  console.log(`\n--- ALL PERMISSION DEFINITIONS IN DB (${perms.length}) ---`);
  const groupedPerms: Record<string, string[]> = {};
  for (const p of perms) {
    if (!groupedPerms[p.group]) groupedPerms[p.group] = [];
    groupedPerms[p.group].push(`${p.key} - "${p.label}"`);
  }
  for (const [group, list] of Object.entries(groupedPerms)) {
    console.log(`[${group}] (${list.length}):`);
    for (const item of list) {
      console.log(`  • ${item}`);
    }
  }

  // 4. Tasks counts
  const taskCount = await db.task.count();
  const tasksByStatus = await db.task.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  console.log(`\n--- TASKS IN SYSTEM (Total: ${taskCount}) ---`);
  for (const s of tasksByStatus) {
    console.log(`  ${s.status}: ${s._count.id}`);
  }

  // 5. Daily Reports counts
  const reportCount = await db.dailyReport.count();
  const reportsByStatus = await db.dailyReport.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  console.log(`\n--- DAILY REPORTS IN SYSTEM (Total: ${reportCount}) ---`);
  for (const s of reportsByStatus) {
    console.log(`  ${s.status}: ${s._count.id}`);
  }

  // 6. Departments / Categories
  const depts = await db.department.findMany({
    include: { _count: { select: { tasks: true, primaryMembers: true } } },
  });
  console.log(`\n--- DEPARTMENTS / CATEGORIES (${depts.length}) ---`);
  for (const d of depts) {
    console.log(`  Dept #${d.id}: "${d.name}" (${d.code}) - Tasks: ${d._count.tasks}, Users: ${d._count.primaryMembers}`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
