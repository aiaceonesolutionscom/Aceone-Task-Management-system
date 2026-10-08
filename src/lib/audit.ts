import { db } from "@/lib/db";
import { headers } from "next/headers";

export type AuditLogInput = {
  actorId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  metadata?: Record<string, unknown>;
};

/**
 * Records an immutable audit log entry in PostgreSQL.
 */
export async function recordAudit(input: AuditLogInput) {
  let ipAddress: string | undefined;
  let userAgent: string | undefined;

  try {
    const h = await headers();
    ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
    userAgent = h.get("user-agent") || undefined;
  } catch {
    // Background or script context where headers are not present
  }

  return db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ? String(input.entityId) : null,
      metadata: input.metadata ? (input.metadata as object) : undefined,
      ipAddress,
      userAgent,
    },
  });
}
