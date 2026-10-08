import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getEffectiveUser, canApproveInCategory } from "../src/lib/scopes";

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function checkScopes() {
  for (const uid of [1, 2, 3, 4, 9]) {
    const user = await db.user.findUnique({ where: { id: uid }, include: { role: true } });
    if (!user) continue;
    const effective = await getEffectiveUser(uid);
    console.log(`\n--- User ${user.name} (${user.email}) [Role: ${user.role.code}] ---`);
    console.log("isSystem:", effective?.role.isSystem);
    console.log("permissions:", Array.from(effective?.permissions || []));
    console.log("approvalScopes:", effective?.approvalScopeIds);
    console.log("primaryDept:", effective?.primaryDepartmentId);
    console.log("canApprove in Dept 1 (Design):", effective ? canApproveInCategory(effective, 1) : false);
  }
}

checkScopes().then(() => db.$disconnect());
