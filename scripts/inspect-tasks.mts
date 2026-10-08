import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function check() {
  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, designation: true, role: { select: { code: true, name: true } } }
  });
  console.log("USERS:", JSON.stringify(users, null, 2));

  const tasks = await db.task.findMany({
    include: {
      assignees: { include: { user: { select: { name: true, email: true } } } },
      reviewers: { include: { user: { select: { name: true, email: true } } } },
      versions: { include: { attachments: true } },
      attachments: true,
      department: true
    }
  });
  console.log("TASKS WITH ATTACHMENTS:", JSON.stringify(tasks.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    dept: t.department.name,
    taskAttachments: t.attachments.map(a => ({ id: a.id, name: a.fileName, isRef: a.isReference, mime: a.mimeType })),
    versions: t.versions.map(v => ({
      versionNumber: v.versionNumber,
      status: v.status,
      attachments: v.attachments.map(a => ({ id: a.id, name: a.fileName, mime: a.mimeType }))
    }))
  })), null, 2));
}

check().then(() => db.$disconnect());
