import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log("Tables in database:", res.rows.map(r => r.table_name));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
