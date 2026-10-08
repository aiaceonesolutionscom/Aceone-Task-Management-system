import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationCenterView } from "@/components/notifications/notification-center-view";

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Notification Center</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            System alerts, mentions, task assignments, and review notifications.
          </p>
        </div>

        <NotificationCenterView initialNotifications={notifications} />
      </div>
    </AppShell>
  );
}
