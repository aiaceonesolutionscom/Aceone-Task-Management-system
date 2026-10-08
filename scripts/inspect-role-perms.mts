import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function checkDetails() {
  const rolePerms = await db.rolePermission.findMany({
    include: { role: true, permission: true },
  });
  console.log(`=== ROLE PERMISSIONS COUNT: ${rolePerms.length} ===`);
  const byRole: Record<string, string[]> = {};
  for (const rp of rolePerms) {
    if (!byRole[rp.role.code]) byRole[rp.role.code] = [];
    byRole[rp.role.code].push(rp.permission.key);
  }
  for (const [r, list] of Object.entries(byRole)) {
    console.log(`Role ${r} (${list.length}):`, list.sort().join(", "));
  }

  const overrides = await db.userPermissionOverride.findMany({
    include: { user: true },
  });
  console.log(`\n=== USER OVERRIDES COUNT: ${overrides.length} ===`);
  for (const o of overrides) {
    console.log(`User ${o.user.name}: ${o.permissionKey} -> ${o.isGranted ? 'GRANT' : 'DENY'}`);
  }
}

checkDetails().catch(console.error).finally(() => db.$disconnect());
