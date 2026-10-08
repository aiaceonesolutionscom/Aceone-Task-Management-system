import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getEffectiveUser, hasEffectivePermission } from "../src/lib/scopes";
import { hasUserPermission } from "../src/lib/permissions";

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function runTests() {
  console.log("==================================================");
  console.log(" COMPREHENSIVE ROLE & PERMISSION VERIFICATION ");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${label}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${label}`);
      failed++;
    }
  }

  // 1. Test Super Admin (admin@aceone.com)
  console.log("\n[TEST GROUP 1: Super Admin Access]");
  const superAdminUser = await db.user.findFirst({ where: { email: "admin@aceone.com" } });
  if (!superAdminUser) throw new Error("Super Admin user not found");
  const superAdminEffective = await getEffectiveUser(superAdminUser.id);

  assert(Boolean(superAdminEffective?.role.isSystem), "Super Admin has isSystem: true");
  assert(hasEffectivePermission(superAdminEffective, "task.view"), "Super Admin has task.view");
  assert(hasEffectivePermission(superAdminEffective, "task.create"), "Super Admin has task.create");
  assert(hasEffectivePermission(superAdminEffective, "task.delete"), "Super Admin has task.delete");
  assert(hasEffectivePermission(superAdminEffective, "task.approve"), "Super Admin has task.approve");
  assert(hasEffectivePermission(superAdminEffective, "user.delete"), "Super Admin has user.delete");
  assert(hasEffectivePermission(superAdminEffective, "settings.manage"), "Super Admin has settings.manage");

  // 2. Test Admin / CEO (ceo@aceone.com)
  console.log("\n[TEST GROUP 2: Admin / CEO Access]");
  const ceoUser = await db.user.findFirst({ where: { email: "ceo@aceone.com" } });
  if (!ceoUser) throw new Error("CEO user not found");
  const ceoEffective = await getEffectiveUser(ceoUser.id);

  assert(ceoEffective?.role.code === "admin", "CEO has role 'admin'");
  assert(hasEffectivePermission(ceoEffective, "task.create"), "Admin has task.create");
  assert(hasEffectivePermission(ceoEffective, "task.approve"), "Admin has task.approve");
  assert(hasEffectivePermission(ceoEffective, "task.delete"), "Admin has task.delete");
  assert(hasEffectivePermission(ceoEffective, "user.create"), "Admin has user.create");
  assert(hasEffectivePermission(ceoEffective, "category.create"), "Admin has category.create");
  assert(hasEffectivePermission(ceoEffective, "report.approve"), "Admin has report.approve");

  // 3. Test Manager (manager@aceone.com)
  console.log("\n[TEST GROUP 3: Manager Access]");
  const managerUser = await db.user.findFirst({ where: { email: "manager@aceone.com" } });
  if (!managerUser) throw new Error("Manager user not found");
  const managerEffective = await getEffectiveUser(managerUser.id);

  assert(managerEffective?.role.code === "manager", "Manager has role 'manager'");
  assert(hasEffectivePermission(managerEffective, "task.create"), "Manager has task.create");
  assert(hasEffectivePermission(managerEffective, "task.assign"), "Manager has task.assign");
  assert(hasEffectivePermission(managerEffective, "task.review"), "Manager has task.review");
  assert(hasEffectivePermission(managerEffective, "task.approve"), "Manager has task.approve");
  assert(hasEffectivePermission(managerEffective, "report.review"), "Manager has report.review");
  assert(hasEffectivePermission(managerEffective, "report.approve"), "Manager has report.approve");
  // Manager must NOT have user.create or role.manage
  assert(!hasEffectivePermission(managerEffective, "user.create"), "Manager does NOT have user.create (blocked)");
  assert(!hasEffectivePermission(managerEffective, "role.manage"), "Manager does NOT have role.manage (blocked)");

  // 4. Test Employee (ali@aceone.com)
  console.log("\n[TEST GROUP 4: Employee Access]");
  const empUser = await db.user.findFirst({ where: { email: "ali@aceone.com" } });
  if (!empUser) throw new Error("Employee user not found");
  const empEffective = await getEffectiveUser(empUser.id);

  assert(empEffective?.role.code === "employee", "Employee has role 'employee'");
  assert(hasEffectivePermission(empEffective, "task.view"), "Employee has task.view");
  assert(hasEffectivePermission(empEffective, "task.submit"), "Employee has task.submit");
  assert(hasEffectivePermission(empEffective, "task.comment"), "Employee has task.comment");
  assert(hasEffectivePermission(empEffective, "report.create"), "Employee has report.create");
  // Employee must NOT have task.create, task.review, task.approve, or report.approve
  assert(!hasEffectivePermission(empEffective, "task.create"), "Employee does NOT have task.create (blocked)");
  assert(!hasEffectivePermission(empEffective, "task.review"), "Employee does NOT have task.review (blocked)");
  assert(!hasEffectivePermission(empEffective, "task.approve"), "Employee does NOT have task.approve (blocked)");
  assert(!hasEffectivePermission(empEffective, "report.approve"), "Employee does NOT have report.approve (blocked)");

  // 5. Test Granular User Overrides (Grant & Deny)
  console.log("\n[TEST GROUP 5: User Permission Overrides]");
  // Test A: Revoke task.approve from Manager
  await db.userPermissionOverride.upsert({
    where: { userId_permissionKey: { userId: managerUser.id, permissionKey: "task.approve" } },
    create: { userId: managerUser.id, permissionKey: "task.approve", isGranted: false },
    update: { isGranted: false },
  });
  const managerOverridden = await getEffectiveUser(managerUser.id);
  assert(!hasEffectivePermission(managerOverridden, "task.approve"), "Override DENY: Manager task.approve is now BLOCKED");
  assert(hasEffectivePermission(managerOverridden, "task.review"), "Manager still retains task.review");

  // Test B: Grant task.create to Employee
  await db.userPermissionOverride.upsert({
    where: { userId_permissionKey: { userId: empUser.id, permissionKey: "task.create" } },
    create: { userId: empUser.id, permissionKey: "task.create", isGranted: true },
    update: { isGranted: true },
  });
  const empOverridden = await getEffectiveUser(empUser.id);
  assert(hasEffectivePermission(empOverridden, "task.create"), "Override GRANT: Employee now HAS task.create");

  // Clean up test overrides to restore database cleanly
  await db.userPermissionOverride.deleteMany({
    where: {
      userId: { in: [managerUser.id, empUser.id] },
      permissionKey: { in: ["task.approve", "task.create"] },
    },
  });
  const managerRestored = await getEffectiveUser(managerUser.id);
  const empRestored = await getEffectiveUser(empUser.id);
  assert(hasEffectivePermission(managerRestored, "task.approve"), "Cleanup: Manager task.approve restored");
  assert(!hasEffectivePermission(empRestored, "task.create"), "Cleanup: Employee task.create revoked back to baseline");

  // 6. Test Client Helper hasUserPermission
  console.log("\n[TEST GROUP 6: Client Helper hasUserPermission]");
  const mockEmpUser = {
    role: { code: "employee", isSystem: false },
    effectivePermissions: ["task.view", "task.submit", "report.create"],
  };
  const mockAdminUser = {
    role: { code: "admin", isSystem: false },
    effectivePermissions: ["*"],
  };
  assert(hasUserPermission(mockEmpUser, "task.view"), "Client helper: employee has task.view");
  assert(!hasUserPermission(mockEmpUser, "task.create"), "Client helper: employee does not have task.create");
  assert(hasUserPermission(mockAdminUser, "task.create"), "Client helper: admin with '*' has task.create");

  console.log("\n==================================================");
  console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED `);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error).finally(() => db.$disconnect());
