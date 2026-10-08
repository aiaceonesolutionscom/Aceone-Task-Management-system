import { db } from "../src/lib/db.ts";

async function main() {
  console.log("Fixing ApprovalRecord constraints in PostgreSQL...");

  // 1. Drop old foreign key constraint pointing to TaskSubmission
  await db.$executeRawUnsafe(`
    ALTER TABLE "ApprovalRecord" DROP CONSTRAINT IF EXISTS "ApprovalRecord_submissionId_fkey";
  `);
  console.log("Dropped old ApprovalRecord_submissionId_fkey.");

  // 2. Make submissionId nullable in database
  await db.$executeRawUnsafe(`
    ALTER TABLE "ApprovalRecord" ALTER COLUMN "submissionId" DROP NOT NULL;
  `);
  console.log("Made submissionId nullable.");

  // 3. Add proper constraint referencing TaskVersion(id)
  await db.$executeRawUnsafe(`
    ALTER TABLE "ApprovalRecord" 
    ADD CONSTRAINT "ApprovalRecord_submissionId_fkey" 
    FOREIGN KEY ("submissionId") REFERENCES "TaskVersion"(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
  `);
  console.log("Added correct constraint referencing TaskVersion(id).");

  console.log("Migration complete!");
}

main().catch(console.error).finally(() => process.exit(0));
