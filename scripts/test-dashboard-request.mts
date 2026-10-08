import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const uRes = await client.query(`SELECT id FROM "User" WHERE email = 'admin@aceone.com';`);
    const userId = uRes.rows[0].id;

    await client.query(
      `INSERT INTO "Session" ("userId", "tokenHash", "expiresAt", "lastUsedAt", "createdAt")
       VALUES ($1, $2, $3, NOW(), NOW());`,
      [userId, tokenHash, expiresAt]
    );

    const routes = [
      "/dashboard",
      "/tasks",
      "/tasks/new",
      "/approvals",
      "/calendar",
      "/daily-reports",
      "/reports",
      "/organization/categories",
      "/organization/users",
      "/organization/roles",
      "/organization/scopes",
      "/organization/custom-fields",
      "/organization/permissions",
      "/settings",
      "/profile",
      "/files",
    ];

    console.log("Testing all routes with active admin session...");
    let allPassed = true;

    for (const route of routes) {
      const res = await fetch(`http://localhost:3007${route}`, {
        headers: {
          Cookie: `aceone.session=${rawToken}`,
        },
      });
      if (res.status === 200) {
        console.log(`✓ ${route} -> 200 OK`);
      } else {
        console.error(`✗ ${route} -> Status ${res.status}`);
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log("\nALL 16 CORE ROUTES RETURNED 200 OK!");
    } else {
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
