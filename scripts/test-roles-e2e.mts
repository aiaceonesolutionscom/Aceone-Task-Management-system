import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function run() {
  const users = [
    { email: "ali@aceone.com", role: "Employee" },
    { email: "manager@aceone.com", role: "Creative Manager" },
    { email: "admin@aceone.com", role: "Super Admin" },
  ];

  console.log("=== TESTING E2E ROLE VIEWS ON DEV SERVER (port 3007) ===\n");

  for (const u of users) {
    const dbUser = await db.user.findUnique({
      where: { email: u.email },
      include: { role: true, primaryDepartment: true },
    });
    if (!dbUser) {
      console.log(`User ${u.email} not found`);
      continue;
    }

    // Create session in DB
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.session.create({
      data: {
        userId: dbUser.id,
        tokenHash: hashToken(token),
        expiresAt,
      },
    });

    const cookieHeader = `aceone.session=${token}`;

    console.log(`--- Testing ${u.role}: ${u.email} ---`);

    // 1. Dashboard
    const resDash = await fetch("http://localhost:3007/dashboard", {
      headers: { Cookie: cookieHeader },
    });
    const htmlDash = await resDash.text();
    console.log(`  /dashboard status: ${resDash.status}`);
    if (u.role === "Employee") {
      console.log(`  Shows 'Employee Workspace': ${htmlDash.includes("Employee Workspace")}`);
      console.log(`  No 'Create Task' button on page: ${!htmlDash.includes("<span>Create Task</span>")}`);
      console.log(`  Shows 'Daily Report': ${htmlDash.includes("Daily Report")}`);
    } else {
      console.log(`  Shows 'Create Task' button: ${htmlDash.includes("<span>Create Task</span>")}`);
    }

    // 2. Tasks List
    const resTasks = await fetch("http://localhost:3007/tasks", {
      headers: { Cookie: cookieHeader },
    });
    const htmlTasks = await resTasks.text();
    console.log(`  /tasks status: ${resTasks.status}`);
    if (u.role === "Employee") {
      console.log(`  Tasks title is 'My Assigned Tasks': ${htmlTasks.includes("My Assigned Tasks")}`);
      console.log(`  No 'Create Task' on tasks page: ${!htmlTasks.includes("<span>Create Task</span>")}`);
    }

    // 3. Task Detail #4 ("Campaign Banner")
    const resTask4 = await fetch("http://localhost:3007/tasks/4", {
      headers: { Cookie: cookieHeader },
    });
    const htmlTask4 = await resTask4.text();
    console.log(`  /tasks/4 status: ${resTask4.status}`);
    console.log(`  Task 4 has Image Thumbnail / Deliverable: ${htmlTask4.includes("/api/files/") || htmlTask4.includes("campaign-banner")}`);
    console.log(`  Task 4 has Image Review tab: ${htmlTask4.includes("Image Review")}`);
    if (u.role === "Creative Manager" || u.role === "Super Admin") {
      console.log(`  Has 'Approve Task' button: ${htmlTask4.includes("Approve Task")}`);
      console.log(`  Has 'Request Changes' button: ${htmlTask4.includes("Request Changes")}`);
    } else {
      console.log(`  Has 'Submit Work' button: ${htmlTask4.includes("Submit Work")}`);
      console.log(`  Has Reviewer Approval Notice: ${htmlTask4.includes("approval required") || htmlTask4.includes("restricted")}`);
    }

    // 4. Approvals Queue
    if (u.role !== "Employee") {
      const resApp = await fetch("http://localhost:3007/approvals", {
        headers: { Cookie: cookieHeader },
      });
      console.log(`  /approvals status: ${resApp.status}`);
    }

    console.log("");
  }
}

run().then(() => db.$disconnect());
