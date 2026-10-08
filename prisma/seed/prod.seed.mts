/**
 * Production seed — creates the permission registry, system roles and the
 * initial super admin account. Safe to run repeatedly.
 *
 * Run with:  npx prisma db seed   (uses dev seed by default)
 *            tsx prisma/seed/prod.seed.mts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createSeedClient, seedPermissionsAndRoles } from "./_shared.mts";

const db = createSeedClient();

async function main() {
  const roles = await seedPermissionsAndRoles(db);

  const email = (
    process.env.SUPER_ADMIN_EMAIL ?? "admin@aceone.com"
  ).toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "Aceone@Admin123";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super admin already exists: ${email}`);
  } else {
    await db.user.create({
      data: {
        name: "Super Admin",
        email,
        passwordHash: await bcrypt.hash(password, 12),
        roleId: roles.super_admin.id,
        status: "ACTIVE",
      },
    });
    console.log(`Created super admin: ${email}`);
  }

  console.log("Production seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
