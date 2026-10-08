import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  console.log("Connected to PostgreSQL. Adding ChatMessageRead table...");

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ChatMessageRead" (
        "id" SERIAL PRIMARY KEY,
        "commentId" INTEGER NOT NULL REFERENCES "TaskComment"("id") ON DELETE CASCADE,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ChatMessageRead_commentId_userId_key" UNIQUE ("commentId", "userId")
      );

      CREATE INDEX IF NOT EXISTS "ChatMessageRead_commentId_idx" ON "ChatMessageRead"("commentId");
      CREATE INDEX IF NOT EXISTS "ChatMessageRead_userId_idx" ON "ChatMessageRead"("userId");
    `);

    console.log("ChatMessageRead table created successfully!");
  } catch (err) {
    console.error("Migration error:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
