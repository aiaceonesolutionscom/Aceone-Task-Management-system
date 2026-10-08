import { db } from "../src/lib/db.ts";

async function main() {
  const result: any = await db.$queryRaw`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ApprovalRecord';
  `;
  console.log("ApprovalRecord Columns:", result);

  const constraints: any = await db.$queryRaw`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'public."ApprovalRecord"'::regclass;
  `;
  console.log("ApprovalRecord Constraints:", constraints);

  const versions: any = await db.$queryRaw`
    SELECT id, "taskId", "versionNumber" FROM "TaskVersion";
  `;
  console.log("All TaskVersions in DB:", versions);
}

main().catch(console.error).finally(() => process.exit(0));
