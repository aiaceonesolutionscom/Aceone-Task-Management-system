import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

const ali = await db.user.findUnique({ where: { email: "ali@aceone.com" } });
console.log("ali found:", Boolean(ali));
console.log("ali password verifies:", ali ? await bcrypt.compare("Password@123", ali.passwordHash) : false);

const admin = await db.user.findUnique({
  where: { email: "admin@aceone.com" },
  include: { role: { include: { permissions: { include: { permission: true } } } } },
});
console.log("admin role:", admin?.role.code, "isSystem:", admin?.role.isSystem);
console.log("admin direct permissions:", admin?.role.permissions.length);

const founder = await db.user.findUnique({
  where: { email: "founder@aceone.com" },
  include: { role: { include: { permissions: { include: { permission: true } } } } },
});
console.log("founder role:", founder?.role.code, "permissions:", founder?.role.permissions.length);

console.log("counts:", {
  users: await db.user.count(),
  departments: await db.department.count(),
  tasks: await db.task.count(),
  assignments: await db.taskAssignee.count(),
  reviewers: await db.taskReviewer.count(),
  notifications: await db.notification.count(),
  activities: await db.taskActivityLog.count(),
});

await db.$disconnect();
