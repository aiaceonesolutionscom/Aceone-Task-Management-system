import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function seedSubmissionWithImage() {
  const task = await db.task.findFirst({
    where: { id: 4 },
    include: { versions: true, assignees: true }
  });

  if (!task) {
    console.log("Task 4 not found");
    return;
  }

  // Load sample logo image from public/aceone-logo.webp
  const logoPath = path.resolve("./public/aceone-logo.webp");
  const fileBuffer = fs.readFileSync(logoPath);

  // Check if version 1 exists
  let version = task.versions[0];
  if (!version) {
    version = await db.taskVersion.create({
      data: {
        taskId: task.id,
        versionNumber: 1,
        submittedById: 4, // Ali Ahmed
        comment: "Hi! Completed the Campaign Banner creative according to specifications. Please review.",
        status: "SUBMITTED",
      }
    });
    console.log("Created TaskVersion 1 for task 4");
  }

  // Create attachment for Version 1 if not exists
  const existingAtt = await db.attachment.findFirst({
    where: { versionId: version.id }
  });

  if (!existingAtt) {
    await db.attachment.create({
      data: {
        taskId: task.id,
        versionId: version.id,
        fileName: "campaign-banner-v1.webp",
        mimeType: "image/webp",
        fileSize: fileBuffer.length,
        fileData: fileBuffer,
        isReference: false,
        uploadedById: 4,
      }
    });
    console.log("Created version attachment image for Version 1");
  }

  // Also add a reference attachment for Task 1 ("Instagram Campaign Post") so reference preview is tested
  const task1 = await db.task.findFirst({ where: { id: 1 } });
  if (task1) {
    const existingRef = await db.attachment.findFirst({
      where: { taskId: task1.id, isReference: true }
    });
    if (!existingRef) {
      await db.attachment.create({
        data: {
          taskId: task1.id,
          fileName: "brand-reference-guide.webp",
          mimeType: "image/webp",
          fileSize: fileBuffer.length,
          fileData: fileBuffer,
          isReference: true,
          uploadedById: 2, // Founder
        }
      });
      console.log("Created reference image for Task 1");
    }
  }

  // Ensure task 4 status is UNDER_REVIEW so it appears in approvals
  await db.task.update({
    where: { id: 4 },
    data: { status: "UNDER_REVIEW" }
  });
  console.log("Task 4 status confirmed as UNDER_REVIEW");
}

seedSubmissionWithImage().then(() => db.$disconnect());
