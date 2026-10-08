import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  console.log("Connected to PostgreSQL for AceOne schema migration...");

  try {
    await client.query("BEGIN");

    // 1. Enums
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "ApprovalMode" AS ENUM ('ANY_ONE', 'ALL_REQUIRED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      DO $$ BEGIN
        CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'TIME', 'DATETIME', 'DROPDOWN', 'MULTI_SELECT', 'CHECKBOX', 'RADIO', 'URL');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      DO $$ BEGIN
        CREATE TYPE "CustomFieldEntityType" AS ENUM ('TASK', 'DAILY_REPORT');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      DO $$ BEGIN
        CREATE TYPE "DailyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Add columns to Department
    await client.query(`
      ALTER TABLE "Department"
        ADD COLUMN IF NOT EXISTS "code" TEXT,
        ADD COLUMN IF NOT EXISTS "dailyReportRequired" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "dashboardConfig" JSONB;

      CREATE UNIQUE INDEX IF NOT EXISTS "Department_code_key" ON "Department"("code") WHERE "code" IS NOT NULL;
    `);

    // Update existing departments with default codes if null
    await client.query(`
      UPDATE "Department" SET "code" = 'DES' WHERE "name" ILIKE '%design%' AND "code" IS NULL;
      UPDATE "Department" SET "code" = 'DEV' WHERE "name" ILIKE '%software%' AND "code" IS NULL;
      UPDATE "Department" SET "code" = 'AI'  WHERE "name" ILIKE '%ai%' AND "code" IS NULL;
      UPDATE "Department" SET "code" = 'SAL' WHERE "name" ILIKE '%sale%' AND "code" IS NULL;
      UPDATE "Department" SET "code" = 'VID' WHERE "name" ILIKE '%video%' AND "code" IS NULL;
      UPDATE "Department" SET "code" = 'GEN' || id WHERE "code" IS NULL;
    `);

    // 3. Add columns to User
    await client.query(`
      ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "username" TEXT,
        ADD COLUMN IF NOT EXISTS "employeeId" TEXT,
        ADD COLUMN IF NOT EXISTS "phone" TEXT,
        ADD COLUMN IF NOT EXISTS "designation" TEXT,
        ADD COLUMN IF NOT EXISTS "description" TEXT,
        ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "enabledFacilities" JSONB;

      CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username") WHERE "username" IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "User_employeeId_key" ON "User"("employeeId") WHERE "employeeId" IS NOT NULL;
    `);

    // Assign initial username / employeeId for existing users if null
    await client.query(`
      UPDATE "User"
      SET "username" = LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]', '', 'g')) || id,
          "employeeId" = 'AS1-EMP-' || LPAD(id::text, 4, '0')
      WHERE "username" IS NULL;
    `);

    // 4. Add columns to Task
    await client.query(`
      ALTER TABLE "Task"
        ADD COLUMN IF NOT EXISTS "taskCode" TEXT,
        ADD COLUMN IF NOT EXISTS "instructions" TEXT,
        ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "dueTime" TEXT,
        ADD COLUMN IF NOT EXISTS "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'ANY_ONE',
        ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "firstViewedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "lastViewedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "assignedBy" INTEGER REFERENCES "User"("id") ON DELETE SET NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS "Task_taskCode_key" ON "Task"("taskCode") WHERE "taskCode" IS NOT NULL;
    `);

    // Assign initial taskCode for existing tasks if null
    await client.query(`
      UPDATE "Task"
      SET "taskCode" = 'AS1-' || (1000 + id)
      WHERE "taskCode" IS NULL;
    `);

    // 5. Add columns to TaskAssignee
    await client.query(`
      ALTER TABLE "TaskAssignee"
        ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
        ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
    `);

    // 6. UserCategoryScope
    await client.query(`
      CREATE TABLE IF NOT EXISTS "UserCategoryScope" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "departmentId" INTEGER NOT NULL REFERENCES "Department"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserCategoryScope_userId_departmentId_key" UNIQUE ("userId", "departmentId")
      );
      CREATE INDEX IF NOT EXISTS "UserCategoryScope_userId_idx" ON "UserCategoryScope"("userId");
      CREATE INDEX IF NOT EXISTS "UserCategoryScope_departmentId_idx" ON "UserCategoryScope"("departmentId");
    `);

    // 7. UserAssignmentScope
    await client.query(`
      CREATE TABLE IF NOT EXISTS "UserAssignmentScope" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "departmentId" INTEGER NOT NULL REFERENCES "Department"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserAssignmentScope_userId_departmentId_key" UNIQUE ("userId", "departmentId")
      );
      CREATE INDEX IF NOT EXISTS "UserAssignmentScope_userId_idx" ON "UserAssignmentScope"("userId");
      CREATE INDEX IF NOT EXISTS "UserAssignmentScope_departmentId_idx" ON "UserAssignmentScope"("departmentId");
    `);

    // 8. UserApprovalScope
    await client.query(`
      CREATE TABLE IF NOT EXISTS "UserApprovalScope" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "departmentId" INTEGER NOT NULL REFERENCES "Department"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserApprovalScope_userId_departmentId_key" UNIQUE ("userId", "departmentId")
      );
      CREATE INDEX IF NOT EXISTS "UserApprovalScope_userId_idx" ON "UserApprovalScope"("userId");
      CREATE INDEX IF NOT EXISTS "UserApprovalScope_departmentId_idx" ON "UserApprovalScope"("departmentId");
    `);

    // 9. UserPermissionOverride
    await client.query(`
      CREATE TABLE IF NOT EXISTS "UserPermissionOverride" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "permissionKey" TEXT NOT NULL,
        "isGranted" BOOLEAN NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserPermissionOverride_userId_permissionKey_key" UNIQUE ("userId", "permissionKey")
      );
      CREATE INDEX IF NOT EXISTS "UserPermissionOverride_userId_idx" ON "UserPermissionOverride"("userId");
    `);

    // 10. TaskVersion (rename from TaskSubmission if needed or keep both compatible)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "TaskVersion" (
        "id" SERIAL PRIMARY KEY,
        "taskId" INTEGER NOT NULL REFERENCES "Task"("id") ON DELETE CASCADE,
        "versionNumber" INTEGER NOT NULL,
        "submittedById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "comment" TEXT,
        "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
        "reviewerId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "reviewNotes" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TaskVersion_taskId_versionNumber_key" UNIQUE ("taskId", "versionNumber")
      );
      CREATE INDEX IF NOT EXISTS "TaskVersion_submittedById_idx" ON "TaskVersion"("submittedById");
    `);

    // Copy any rows from TaskSubmission to TaskVersion if TaskVersion is empty
    await client.query(`
      INSERT INTO "TaskVersion" ("id", "taskId", "versionNumber", "submittedById", "comment", "status", "submittedAt")
      SELECT "id", "taskId", "versionNumber", "submittedBy", "comment", "status", "submittedAt"
      FROM "TaskSubmission"
      ON CONFLICT DO NOTHING;
    `);

    // 11. Attachments with BYTEA binary data
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Attachment" (
        "id" SERIAL PRIMARY KEY,
        "taskId" INTEGER REFERENCES "Task"("id") ON DELETE CASCADE,
        "versionId" INTEGER REFERENCES "TaskVersion"("id") ON DELETE CASCADE,
        "commentId" INTEGER,
        "fileName" TEXT NOT NULL,
        "mimeType" TEXT NOT NULL,
        "fileSize" INTEGER NOT NULL,
        "fileData" BYTEA NOT NULL,
        "checksum" TEXT,
        "isReference" BOOLEAN NOT NULL DEFAULT false,
        "isArchived" BOOLEAN NOT NULL DEFAULT false,
        "uploadedById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP(3)
      );
      CREATE INDEX IF NOT EXISTS "Attachment_taskId_idx" ON "Attachment"("taskId");
      CREATE INDEX IF NOT EXISTS "Attachment_versionId_idx" ON "Attachment"("versionId");
      CREATE INDEX IF NOT EXISTS "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");
      CREATE INDEX IF NOT EXISTS "Attachment_isArchived_idx" ON "Attachment"("isArchived");
    `);

    // 12. Image Annotations
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ImageAnnotation" (
        "id" SERIAL PRIMARY KEY,
        "attachmentId" INTEGER NOT NULL REFERENCES "Attachment"("id") ON DELETE CASCADE,
        "versionId" INTEGER REFERENCES "TaskVersion"("id") ON DELETE CASCADE,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "tool" TEXT NOT NULL,
        "x" DOUBLE PRECISION NOT NULL,
        "y" DOUBLE PRECISION NOT NULL,
        "width" DOUBLE PRECISION,
        "height" DOUBLE PRECISION,
        "points" JSONB,
        "comment" TEXT,
        "color" TEXT NOT NULL DEFAULT '#ef4444',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "ImageAnnotation_attachmentId_idx" ON "ImageAnnotation"("attachmentId");
      CREATE INDEX IF NOT EXISTS "ImageAnnotation_versionId_idx" ON "ImageAnnotation"("versionId");
    `);

    // 13. TaskComment updates
    await client.query(`
      ALTER TABLE "TaskComment"
        ADD COLUMN IF NOT EXISTS "versionId" INTEGER REFERENCES "TaskVersion"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "parentId" INTEGER REFERENCES "TaskComment"("id") ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS "isEdited" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

      CREATE INDEX IF NOT EXISTS "TaskComment_parentId_idx" ON "TaskComment"("parentId");
    `);

    // 14. AuditLog
    await client.query(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" SERIAL PRIMARY KEY,
        "actorId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "action" TEXT NOT NULL,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT,
        "metadata" JSONB,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
      CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
      CREATE INDEX IF NOT EXISTS "AuditLog_entityType_idx" ON "AuditLog"("entityType");
      CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
    `);

    // 15. PushSubscription
    await client.query(`
      CREATE TABLE IF NOT EXISTS "PushSubscription" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "endpoint" TEXT NOT NULL UNIQUE,
        "p256dh" TEXT NOT NULL,
        "auth" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
    `);

    // 16. DailyReport
    await client.query(`
      CREATE TABLE IF NOT EXISTS "DailyReport" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
        "departmentId" INTEGER NOT NULL REFERENCES "Department"("id") ON DELETE RESTRICT,
        "reportDate" TIMESTAMP(3) NOT NULL,
        "status" "DailyReportStatus" NOT NULL DEFAULT 'SUBMITTED',
        "notes" TEXT,
        "reviewerId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "reviewNotes" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "DailyReport_userId_idx" ON "DailyReport"("userId");
      CREATE INDEX IF NOT EXISTS "DailyReport_departmentId_idx" ON "DailyReport"("departmentId");
      CREATE INDEX IF NOT EXISTS "DailyReport_reportDate_idx" ON "DailyReport"("reportDate");
      CREATE INDEX IF NOT EXISTS "DailyReport_status_idx" ON "DailyReport"("status");
    `);

    // 17. CustomField & CustomFieldValue
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CustomField" (
        "id" SERIAL PRIMARY KEY,
        "departmentId" INTEGER REFERENCES "Department"("id") ON DELETE CASCADE,
        "entityType" "CustomFieldEntityType" NOT NULL DEFAULT 'TASK',
        "fieldName" TEXT NOT NULL,
        "fieldKey" TEXT NOT NULL,
        "fieldType" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
        "options" JSONB,
        "isRequired" BOOLEAN NOT NULL DEFAULT false,
        "placeholder" TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CustomField_departmentId_entityType_fieldKey_key" UNIQUE ("departmentId", "entityType", "fieldKey")
      );
      CREATE INDEX IF NOT EXISTS "CustomField_departmentId_idx" ON "CustomField"("departmentId");

      CREATE TABLE IF NOT EXISTS "CustomFieldValue" (
        "id" SERIAL PRIMARY KEY,
        "customFieldId" INTEGER NOT NULL REFERENCES "CustomField"("id") ON DELETE CASCADE,
        "taskId" INTEGER REFERENCES "Task"("id") ON DELETE CASCADE,
        "dailyReportId" INTEGER REFERENCES "DailyReport"("id") ON DELETE CASCADE,
        "value" TEXT
      );
      CREATE INDEX IF NOT EXISTS "CustomFieldValue_customFieldId_idx" ON "CustomFieldValue"("customFieldId");
      CREATE INDEX IF NOT EXISTS "CustomFieldValue_taskId_idx" ON "CustomFieldValue"("taskId");
      CREATE INDEX IF NOT EXISTS "CustomFieldValue_dailyReportId_idx" ON "CustomFieldValue"("dailyReportId");
    `);

    // 18. TaskView
    await client.query(`
      CREATE TABLE IF NOT EXISTS "TaskView" (
        "id" SERIAL PRIMARY KEY,
        "taskId" INTEGER NOT NULL REFERENCES "Task"("id") ON DELETE CASCADE,
        "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TaskView_taskId_userId_key" UNIQUE ("taskId", "userId")
      );
      CREATE INDEX IF NOT EXISTS "TaskView_userId_idx" ON "TaskView"("userId");
    `);

    // 19. Update ApprovalRecord
    await client.query(`
      ALTER TABLE "ApprovalRecord"
        ADD COLUMN IF NOT EXISTS "versionId" INTEGER REFERENCES "TaskVersion"("id") ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'APPROVED',
        ADD COLUMN IF NOT EXISTS "comment" TEXT;

      ALTER TABLE "ApprovalRecord" DROP CONSTRAINT IF EXISTS "ApprovalRecord_taskId_submissionId_key";
    `);

    // 20. Update Notification
    await client.query(`
      ALTER TABLE "Notification"
        ADD COLUMN IF NOT EXISTS "entityType" TEXT,
        ADD COLUMN IF NOT EXISTS "entityId" TEXT,
        ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
    `);

    await client.query("COMMIT");
    console.log("AceOne database schema migration completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration error:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
