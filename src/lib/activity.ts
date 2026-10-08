import { db } from "@/lib/db";

/**
 * Append-only activity/audit log. Every meaningful state change writes one
 * row here; task timelines, employee history and audit views are all queries
 * over this single table.
 */
export type ActivityInput = {
  action: string;
  taskId?: number | null;
  userId?: number | null;
  metadata?: Record<string, unknown> | null;
};

export async function logActivity(input: ActivityInput): Promise<void> {
  await db.taskActivityLog.create({
    data: {
      action: input.action,
      taskId: input.taskId ?? null,
      userId: input.userId ?? null,
      metadata: (input.metadata ?? undefined) as never,
    },
  });
}

/** Audit actions are namespaced with the `audit.` prefix. */
export async function logAudit(
  action: string,
  userId: number | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await logActivity({
    action: `audit.${action}`,
    userId,
    metadata,
  });
}