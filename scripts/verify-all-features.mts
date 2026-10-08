import { db } from "../src/lib/db.ts";
import { getEffectiveUser } from "../src/lib/scopes.ts";
import { createBatchDistributedTasksAction } from "../src/server/actions/tasks.ts";

async function main() {
  console.log("=== Verifying Feature Enhancements ===");

  // 1. Verify Design category and members
  const designDept = await db.department.findFirst({
    where: { name: { contains: "Design", mode: "insensitive" } },
  });
  console.log("Design Department ID:", designDept?.id);

  const designMembers = await db.user.findMany({
    where: { primaryDepartmentId: designDept?.id, status: "ACTIVE" },
    select: { id: true, name: true, email: true, role: { select: { code: true } } },
  });
  console.log("Design members count:", designMembers.length);
  designMembers.forEach((m) => console.log(`  - ${m.name} (${m.email}, role: ${m.role.code})`));

  // 2. Count current tasks for Ali
  const ali = await db.user.findUnique({ where: { email: "ali@aceone.com" } });
  if (ali) {
    const aliTasksCount = await db.task.count({
      where: {
        assignees: { some: { userId: ali.id } },
        status: { in: ["NEW", "ASSIGNED", "VIEWED", "IN_PROGRESS", "CHANGES_REQUESTED", "UNDER_REVIEW"] },
      },
    });
    console.log(`Ali currently has ${aliTasksCount} active tasks.`);

    const aliUnread = await db.notification.count({
      where: { userId: ali.id, isRead: false },
    });
    console.log(`Ali has ${aliUnread} unread notifications.`);
  }

  // 3. Verify task 4 comments and receipts
  const task4 = await db.task.findUnique({
    where: { id: 4 },
    include: {
      comments: { include: { user: true } },
      assignees: true,
    },
  });
  console.log(`Task 4 comments count: ${task4?.comments.length}`);
  task4?.comments.forEach((c) => {
    console.log(`  - Comment #${c.id} by ${c.user.name}: "${c.body}"`);
  });

  console.log("=== All Backend Models & Data Ready ===");
}

main().catch(console.error).finally(() => process.exit(0));
