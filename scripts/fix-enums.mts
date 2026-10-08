import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ENUM_DEFINITIONS: Record<string, string[]> = {
  UserStatus: ["ACTIVE", "INACTIVE", "SUSPENDED"],
  DepartmentStatus: ["ACTIVE", "INACTIVE", "ARCHIVED"],
  TaskStatus: [
    "DRAFT",
    "NEW",
    "ASSIGNED",
    "VIEWED",
    "IN_PROGRESS",
    "SUBMITTED",
    "PENDING_REVIEW",
    "UNDER_REVIEW",
    "CHANGES_REQUESTED",
    "RESUBMITTED",
    "APPROVED",
    "REJECTED",
    "COMPLETED",
    "CANCELLED",
    "ARCHIVED",
  ],
  TaskPriority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
  AssignmentMode: ["SPECIFIC", "MULTIPLE", "DEPARTMENT", "AUTO"],
  ApprovalMode: ["ANY_ONE", "ALL_REQUIRED"],
  SubmissionStatus: ["SUBMITTED", "CHANGES_REQUESTED", "APPROVED", "REJECTED"],
  NotificationType: [
    "TASK_ASSIGNED",
    "TASK_REASSIGNED",
    "TASK_VIEWED",
    "REVIEW_REQUIRED",
    "NEW_COMMENT",
    "MENTION",
    "CHANGES_REQUESTED",
    "NEW_VERSION_SUBMITTED",
    "APPROVAL_REQUIRED",
    "TASK_APPROVED",
    "TASK_REJECTED",
    "DEADLINE_APPROACHING",
    "TASK_OVERDUE",
    "DAILY_REPORT_REMINDER",
    "DAILY_REPORT_SUBMITTED",
    "SYSTEM",
  ],
  CustomFieldType: [
    "TEXT",
    "LONG_TEXT",
    "NUMBER",
    "DATE",
    "TIME",
    "DATETIME",
    "DROPDOWN",
    "MULTI_SELECT",
    "CHECKBOX",
    "RADIO",
    "URL",
  ],
  CustomFieldEntityType: ["TASK", "DAILY_REPORT"],
  DailyReportStatus: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED"],
};

async function run() {
  const client = await pool.connect();
  try {
    console.log("Checking all PostgreSQL enums against Prisma schema...");

    for (const [enumName, values] of Object.entries(ENUM_DEFINITIONS)) {
      // Check if enum exists
      const typeCheck = await client.query(
        `SELECT typname FROM pg_type WHERE typname = $1;`,
        [enumName]
      );

      if (typeCheck.rows.length === 0) {
        console.log(`Creating enum type "${enumName}"...`);
        const valStr = values.map((v) => `'${v}'`).join(", ");
        await client.query(`CREATE TYPE "${enumName}" AS ENUM (${valStr});`);
      } else {
        const res = await client.query(
          `SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = $1;`,
          [enumName]
        );
        const existing = new Set(res.rows.map((r) => r.enumlabel));
        for (const val of values) {
          if (!existing.has(val)) {
            console.log(`Adding '${val}' to enum "${enumName}"...`);
            await client.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${val}';`);
          }
        }
      }
    }

    console.log("All enums verified and in sync with Prisma schema!");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error("Enum sync error:", e);
  process.exit(1);
});
