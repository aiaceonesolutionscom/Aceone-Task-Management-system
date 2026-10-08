"use server";

import { requireUser } from "@/lib/auth";
import { getEffectiveUser, hasEffectivePermission } from "@/lib/scopes";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createCategoryAction(formData: FormData) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "category.create")) {
    throw new Error("Forbidden: You do not have permission to create categories.");
  }

  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().toUpperCase();
  const description = (formData.get("description") as string)?.trim() || null;
  const dailyReportRequired = formData.get("dailyReportRequired") === "true";
  const approvalRequired = formData.get("approvalRequired") === "true";

  if (!name || !code) {
    throw new Error("Category Name and Code are required.");
  }

  const category = await db.department.create({
    data: {
      name,
      code,
      description,
      dailyReportRequired,
      approvalRequired,
      status: "ACTIVE",
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "category.create",
    entityType: "CATEGORY",
    entityId: category.id,
    metadata: { name, code },
  });

  revalidatePath("/organization/categories");
  return { success: true, categoryId: category.id };
}

export async function updateCategoryAction(formData: FormData) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "category.edit")) {
    throw new Error("Forbidden: You do not have permission to edit categories.");
  }

  const id = parseInt(formData.get("id") as string, 10);
  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().toUpperCase();
  const description = (formData.get("description") as string)?.trim() || null;
  const status = formData.get("status") as "ACTIVE" | "INACTIVE" | "ARCHIVED";
  const dailyReportRequired = formData.get("dailyReportRequired") === "true";
  const approvalRequired = formData.get("approvalRequired") === "true";

  await db.department.update({
    where: { id },
    data: {
      name,
      code,
      description,
      status,
      dailyReportRequired,
      approvalRequired,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "category.edit",
    entityType: "CATEGORY",
    entityId: id,
    metadata: { name, code, status },
  });

  revalidatePath("/organization/categories");
  return { success: true };
}

export async function deleteCategoryAction(id: number) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser || !hasEffectivePermission(effectiveUser, "category.delete")) {
    throw new Error("Forbidden: You do not have permission to delete categories.");
  }

  const category = await db.department.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          tasks: true,
          members: true,
        },
      },
    },
  });

  if (!category) throw new Error("Category not found.");

  // If department has tasks or users, archive it safely
  if (category._count.tasks > 0 || category._count.members > 0) {
    await db.department.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    await recordAudit({
      actorId: user.id,
      action: "category.archive",
      entityType: "CATEGORY",
      entityId: id,
      metadata: { reason: "Category has linked tasks or members; archived instead of deleted." },
    });

    revalidatePath("/organization/categories");
    return {
      success: true,
      message: `Category "${category.name}" has ${category._count.tasks} tasks. It has been moved to ARCHIVED status.`,
    };
  }

  // Otherwise clean delete
  await db.$transaction(async (tx) => {
    await tx.userCategoryScope.deleteMany({ where: { departmentId: id } });
    await tx.userAssignmentScope.deleteMany({ where: { departmentId: id } });
    await tx.userApprovalScope.deleteMany({ where: { departmentId: id } });
    await tx.department.delete({ where: { id } });
  });

  await recordAudit({
    actorId: user.id,
    action: "category.delete",
    entityType: "CATEGORY",
    entityId: id,
    metadata: { name: category.name, code: category.code },
  });

  revalidatePath("/organization/categories");
  return { success: true, message: `Category "${category.name}" deleted successfully.` };
}

