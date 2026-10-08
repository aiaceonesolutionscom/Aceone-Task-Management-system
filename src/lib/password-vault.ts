import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export interface VaultRecord {
  password: string;
  updatedAt: string;
  changedBy: string;
  source?: "initial_setup" | "user_change" | "admin_reset";
}

export type VaultMap = Record<string, VaultRecord>;

const VAULT_SETTING_KEY = "user_passwords_vault";

/**
 * Saves or updates a user's password in the system vault and logs it in the audit trail.
 */
export async function recordUserPassword(
  userId: number,
  password: string,
  source: "initial_setup" | "user_change" | "admin_reset",
  changedByName: string,
  userInfo?: { name?: string; email?: string }
) {
  try {
    // 1. Update SystemSetting key-value vault
    const existing = await db.systemSetting.findUnique({
      where: { key: VAULT_SETTING_KEY },
    });

    const vault: VaultMap = (existing?.value as any) || {};
    vault[String(userId)] = {
      password,
      updatedAt: new Date().toISOString(),
      changedBy: changedByName,
      source,
    };

    await db.systemSetting.upsert({
      where: { key: VAULT_SETTING_KEY },
      create: {
        key: VAULT_SETTING_KEY,
        value: vault as any,
      },
      update: {
        value: vault as any,
      },
    });

    // 2. Also record an audit log for full chronological history
    let userName = userInfo?.name;
    let userEmail = userInfo?.email;

    if (!userName || !userEmail) {
      const u = await db.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      if (u) {
        userName = u.name;
        userEmail = u.email;
      }
    }

    await recordAudit({
      actorId: userId,
      action: "user.password_change",
      entityType: "USER",
      entityId: String(userId),
      metadata: {
        userId,
        userName: userName || `User #${userId}`,
        userEmail: userEmail || "",
        newPasswordSet: password,
        source,
        changedBy: changedByName,
        changedAt: new Date().toISOString(),
        note:
          source === "initial_setup"
            ? "Initial account password set"
            : source === "admin_reset"
            ? `Admin (${changedByName}) reset password`
            : "User self-changed password in settings",
      },
    });
  } catch (err) {
    console.error("Failed to record password in vault:", err);
  }
}

/**
 * Retrieves the full password vault map, populated from SystemSetting
 * and augmented with recent audit logs for any missing accounts.
 */
export async function getFullPasswordVault(): Promise<VaultMap> {
  const vault: VaultMap = {};

  try {
    // Read from SystemSetting
    const setting = await db.systemSetting.findUnique({
      where: { key: VAULT_SETTING_KEY },
    });
    if (setting?.value && typeof setting.value === "object") {
      Object.assign(vault, setting.value);
    }

    // Also look at audit logs to backfill any user passwords recorded there
    const auditLogs = await db.auditLog.findMany({
      where: {
        action: "user.password_change",
        entityType: "USER",
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    for (const log of auditLogs) {
      if (!log.entityId) continue;
      const uid = String(log.entityId);
      const meta = (log.metadata as any) || {};
      const pwd = meta.newPasswordSet;

      // If this user is not yet in vault or the audit log is newer
      if (pwd && !vault[uid]) {
        vault[uid] = {
          password: pwd,
          updatedAt: log.createdAt.toISOString(),
          changedBy: meta.changedBy || log.actorId ? `User #${log.actorId}` : "Self",
          source: meta.source || "user_change",
        };
      }
    }
  } catch (err) {
    console.error("Error reading password vault:", err);
  }

  return vault;
}

/**
 * Retrieves the password change history for all users or a specific user.
 */
export async function getPasswordAuditHistory(userId?: number, limit = 50) {
  try {
    const where: any = {
      action: "user.password_change",
    };
    if (userId) {
      where.entityId = String(userId);
    }

    const logs = await db.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return logs;
  } catch (err) {
    console.error("Error fetching password audit history:", err);
    return [];
  }
}
