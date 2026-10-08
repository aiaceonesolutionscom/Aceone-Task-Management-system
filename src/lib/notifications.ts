import { db } from "@/lib/db";
import webpush from "web-push";

// Configure VAPID if keys are provided
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@aceone.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export type NotificationPayload = {
  userId: number;
  type:
    | "TASK_ASSIGNED"
    | "TASK_REASSIGNED"
    | "TASK_VIEWED"
    | "REVIEW_REQUIRED"
    | "NEW_COMMENT"
    | "MENTION"
    | "CHANGES_REQUESTED"
    | "NEW_VERSION_SUBMITTED"
    | "APPROVAL_REQUIRED"
    | "TASK_APPROVED"
    | "TASK_REJECTED"
    | "DEADLINE_APPROACHING"
    | "TASK_OVERDUE"
    | "DAILY_REPORT_REMINDER"
    | "DAILY_REPORT_SUBMITTED"
    | "SYSTEM";
  title: string;
  message: string;
  taskId?: number | null;
  entityType?: string;
  entityId?: string | number | null;
};

/**
 * Creates in-app notification record and dispatches Web Push notification if subscribed.
 */
export async function sendNotification(payload: NotificationPayload) {
  const notif = await db.notification.create({
    data: {
      userId: payload.userId,
      taskId: payload.taskId ?? null,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      entityType: payload.entityType ?? (payload.taskId ? "TASK" : undefined),
      entityId: payload.entityId ? String(payload.entityId) : payload.taskId ? String(payload.taskId) : null,
      isRead: false,
    },
  });

  // Try delivering Web Push if user has active push subscriptions
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    try {
      const subscriptions = await db.pushSubscription.findMany({
        where: { userId: payload.userId },
      });

      const pushData = JSON.stringify({
        title: payload.title,
        body: payload.message,
        url: payload.taskId ? `/tasks/${payload.taskId}` : "/notifications",
        type: payload.type,
      });

      for (const sub of subscriptions) {
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushData
          )
          .catch(async (err) => {
            // Delete expired or invalid push subscriptions (404 / 410)
            if (err.statusCode === 404 || err.statusCode === 410) {
              await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          });
      }
    } catch (e) {
      console.error("Web Push delivery notice:", e);
    }
  }

  return notif;
}