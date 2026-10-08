import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  console.log("Connected to PostgreSQL. Adding ChatMessageDelivery table...");

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ChatMessageDelivery" (
        "id" SERIAL PRIMARY KEY,
        "commentId" INTEGER NOT NULL REFERENCES "TaskComment"("id") ON DELETE CASCADE,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ChatMessageDelivery_commentId_userId_key" UNIQUE ("commentId", "userId")
      );

      CREATE INDEX IF NOT EXISTS "ChatMessageDelivery_commentId_idx" ON "ChatMessageDelivery"("commentId");
      CREATE INDEX IF NOT EXISTS "ChatMessageDelivery_userId_idx" ON "ChatMessageDelivery"("userId");
    `);

    console.log("ChatMessageDelivery table created successfully!");
  } catch (err) {
    console.error("Migration error:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
