/**
 * Development seed — clearly separate from production.
 * Creates sample departments, users, a project and tasks so the UI has
 * realistic data during development. Idempotent.
 *
 * Run with:  npm run db:seed:dev
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createSeedClient, seedPermissionsAndRoles } from "./_shared.mts";

const db = createSeedClient();
const DEV_PASSWORD = "Password@123";

async function upsertUser(input: {
  name: string;
  email: string;
  roleId: number;
  primaryDepartmentId?: number | null;
  createdByUserId?: number | null;
}) {
  const email = input.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  return db.user.create({
    data: {
      name: input.name,
      email,
      passwordHash: await bcrypt.hash(DEV_PASSWORD, 12),
      roleId: input.roleId,
      primaryDepartmentId: input.primaryDepartmentId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      status: "ACTIVE",
    },
  });
}

async function main() {
  const roles = await seedPermissionsAndRoles(db);

  const departments = {} as Record<string, { id: number }>;
  for (const name of [
    "Design",
    "Software Engineering",
    "AI Engineering",
    "Sales",
    "Video Editing",
  ]) {
    departments[name] = await db.department.upsert({
      where: { name },
      update: {},
      create: { name, status: "ACTIVE" },
    });
  }

  const superAdmin = await upsertUser({
    name: "Super Admin",
    email: process.env.SUPER_ADMIN_EMAIL ?? "admin@aceone.com",
    roleId: roles.super_admin.id,
  });

  const founder = await upsertUser({
    name: "Founder",
    email: "founder@aceone.com",
    roleId: roles.admin.id,
    createdByUserId: superAdmin.id,
  });

  const manager = await upsertUser({
    name: "Creative Manager",
    email: "manager@aceone.com",
    roleId: roles.manager.id,
    primaryDepartmentId: departments["Design"].id,
    createdByUserId: superAdmin.id,
  });

  const ali = await upsertUser({
    name: "Ali Ahmed",
    email: "ali@aceone.com",
    roleId: roles.employee.id,
    primaryDepartmentId: departments["Design"].id,
    createdByUserId: superAdmin.id,
  });
  const ahmed = await upsertUser({
    name: "Ahmed Khan",
    email: "ahmed@aceone.com",
    roleId: roles.employee.id,
    primaryDepartmentId: departments["Design"].id,
    createdByUserId: superAdmin.id,
  });
  const sara = await upsertUser({
    name: "Sara Malik",
    email: "sara@aceone.com",
    roleId: roles.employee.id,
    primaryDepartmentId: departments["Design"].id,
    createdByUserId: superAdmin.id,
  });
  const hamza = await upsertUser({
    name: "Hamza Tariq",
    email: "hamza@aceone.com",
    roleId: roles.employee.id,
    primaryDepartmentId: departments["Software Engineering"].id,
    createdByUserId: superAdmin.id,
  });
  const usman = await upsertUser({
    name: "Usman Riaz",
    email: "usman@aceone.com",
    roleId: roles.employee.id,
    primaryDepartmentId: departments["AI Engineering"].id,
    createdByUserId: superAdmin.id,
  });

  const memberships: Array<[number, number]> = [
    [ali.id, departments["Design"].id],
    [ahmed.id, departments["Design"].id],
    [sara.id, departments["Design"].id],
    [manager.id, departments["Design"].id],
    [hamza.id, departments["Software Engineering"].id],
    [usman.id, departments["AI Engineering"].id],
  ];
  for (const [userId, departmentId] of memberships) {
    await db.departmentMember.upsert({
      where: { departmentId_userId: { departmentId, userId } },
      update: {},
      create: { departmentId, userId },
    });
  }

  const project =
    (await db.project.findFirst({
      where: { name: "ABC Restaurant Social Campaign" },
    })) ??
    (await db.project.create({
      data: {
        name: "ABC Restaurant Social Campaign",
        description: "Social media launch campaign for ABC Restaurant.",
        createdBy: founder.id,
      },
    }));

  const existingTasks = await db.task.count();
  if (existingTasks === 0) {
    const sample = [
      {
        title: "Instagram Campaign Post",
        description: "Create the primary Instagram post for the launch.",
        assignee: ali.id,
        priority: "HIGH" as const,
      },
      {
        title: "Instagram Story",
        description: "Vertical story variant of the campaign post.",
        assignee: ahmed.id,
        priority: "MEDIUM" as const,
      },
      {
        title: "Promotional Reel Cover",
        description: "Cover frame and title treatment for the reel.",
        assignee: sara.id,
        priority: "MEDIUM" as const,
      },
      {
        title: "Campaign Banner",
        description: "Wide banner for the website hero section.",
        assignee: ali.id,
        priority: "LOW" as const,
      },
      {
        title: "Landing Page Section",
        description: "Build the campaign landing page section.",
        assignee: hamza.id,
        priority: "HIGH" as const,
        departmentId: departments["Software Engineering"].id,
      },
    ];

    for (const item of sample) {
      const departmentId = item.departmentId ?? departments["Design"].id;
      const task = await db.task.create({
        data: {
          title: item.title,
          description: item.description,
          departmentId,
          projectId: project.id,
          priority: item.priority,
          status: "NEW",
          assignmentMode: "SPECIFIC",
          createdBy: founder.id,
          assignees: {
            create: { userId: item.assignee, assignedBy: founder.id },
          },
          reviewers: {
            create: { userId: founder.id, assignedBy: founder.id },
          },
          activities: {
            create: [
              {
                action: "task.created",
                userId: founder.id,
                metadata: { title: item.title },
              },
              {
                action: "task.assigned",
                userId: founder.id,
                metadata: { assigneeId: item.assignee },
              },
            ],
          },
        },
      });

      await db.notification.create({
        data: {
          userId: item.assignee,
          taskId: task.id,
          type: "TASK_ASSIGNED",
          title: "New task assigned",
          message: `You have been assigned: ${item.title}`,
        },
      });
    }
    console.log(`Created ${sample.length} sample tasks.`);
  } else {
    console.log("Tasks already exist; skipping sample task creation.");
  }

  console.log("Development seed complete.");
  console.log(`Dev users password: ${DEV_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
