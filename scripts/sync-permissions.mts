import { db } from "../src/lib/db";
import { PERMISSIONS } from "../src/lib/permissions";

async function main() {
  console.log("Syncing", PERMISSIONS.length, "permissions...");
  for (const p of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, group: p.group },
      create: { key: p.key, label: p.label, group: p.group },
    });
  }
  console.log("All permissions successfully synced.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
