"use server";

import { requireUser } from "@/lib/auth";
import { getEffectiveUser } from "@/lib/scopes";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createCustomFieldAction(formData: FormData) {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser?.role.isSystem && !effectiveUser?.permissions.has("settings.manage")) {
    throw new Error("Forbidden");
  }

  const fieldName = (formData.get("fieldName") as string)?.trim();
  const fieldKey = (formData.get("fieldKey") as string)?.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const fieldType = formData.get("fieldType") as any;
  const entityType = (formData.get("entityType") as "TASK" | "DAILY_REPORT") || "TASK";
  const departmentIdStr = formData.get("departmentId") as string;
  const departmentId = departmentIdStr ? parseInt(departmentIdStr, 10) : null;
  const isRequired = formData.get("isRequired") === "true";
  const placeholder = (formData.get("placeholder") as string) || null;
  const optionsStr = formData.get("options") as string;

  let options: string[] | undefined;
  if (optionsStr) {
    options = optionsStr.split(",").map((s) => s.trim()).filter(Boolean);
  }

  const field = await db.customField.create({
    data: {
      fieldName,
      fieldKey,
      fieldType,
      entityType,
      departmentId: isNaN(departmentId as any) ? null : departmentId,
      isRequired,
      placeholder,
      options: options ? (options as any) : undefined,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "custom_field.create",
    entityType: "SETTINGS",
    entityId: field.id,
    metadata: { fieldName, fieldKey, entityType },
  });

  revalidatePath("/organization/custom-fields");
  return { success: true };
}
