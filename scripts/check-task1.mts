import { db } from "../src/lib/db.ts";

async function main() {
  const task1 = await db.task.findUnique({
    where: { id: 1 },
    include: {
      versions: true,
      approvals: true,
      assignees: true,
      reviewers: true,
    },
  });

  console.log("TASK 1 INFO:");
  console.log("Status:", task1?.status);
  console.log("Versions count:", task1?.versions.length);
  console.log("Versions:", task1?.versions);
  console.log("Approvals:", task1?.approvals);
}

main().catch(console.error).finally(() => process.exit(0));
