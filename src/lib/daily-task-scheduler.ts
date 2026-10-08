import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";

/**
 * Checks and dispatches daily scheduled task notifications.
 * - Suppresses sending 30/31 days of notifications in bulk.
 * - Triggers at day start (midnight 12:00 AM / when day begins) to notify employees
 *   about their unlocked task(s) for that day.
 * - Automatically cleans up any previously created premature future notifications.
 */
export async function dispatchDailyScheduledNotifications(targetUserId?: number) {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 1. One-time auto cleanup of any premature future notifications previously created in bulk
    await db.notification.deleteMany({
      where: {
        type: "TASK_ASSIGNED",
        task: {
          startDate: { gt: endOfToday },
        },
      },
    }).catch(() => {});

    // 2. Find tasks that have unlocked today (or earlier) and are still ASSIGNED/VIEWED/IN_PROGRESS
    const whereTasks: any = {
      taskCode: { not: { contains: "-GENERAL" } },
      startDate: { lte: now },
      status: { in: ["ASSIGNED", "NEW", "VIEWED", "IN_PROGRESS"] },
    };

    if (targetUserId) {
      whereTasks.assignees = { some: { userId: targetUserId } };
    }

    const unlockedTasks = await db.task.findMany({
      where: whereTasks,
      include: {
        assignees: {
          select: { userId: true },
        },
        assignor: {
          select: { id: true, name: true },
        },
      },
    });

    if (unlockedTasks.length === 0) return { dispatched: 0 };

    // Group tasks by assignee to send both individual unlock notices and daily briefings
    const userTasksMap = new Map<number, typeof unlockedTasks>();

    for (const task of unlockedTasks) {
      for (const assignee of task.assignees) {
        if (targetUserId && assignee.userId !== targetUserId) continue;

        if (!userTasksMap.has(assignee.userId)) {
          userTasksMap.set(assignee.userId, []);
        }
        userTasksMap.get(assignee.userId)!.push(task);

        // Check if individual notification already sent for this task
        const existing = await db.notification.findFirst({
          where: {
            userId: assignee.userId,
            taskId: task.id,
            type: "TASK_ASSIGNED",
          },
          select: { id: true },
        });

        if (!existing) {
          const assignorName = task.assignor?.name || "Manager";
          await sendNotification({
            userId: assignee.userId,
            type: "TASK_ASSIGNED",
            title: "Task Unlocked for Today",
            message: `${assignorName} scheduled task ${task.taskCode || `#${task.id}`}: "${task.title}" for today.`,
            taskId: task.id,
          });
        }
      }
    }

    // 3. Send a single Daily Briefing notification per user if they have tasks for today and haven't received briefing yet
    const todayDateFormatted = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    for (const [userId, tasks] of userTasksMap.entries()) {
      // Tasks strictly starting today
      const todayTasks = tasks.filter((t) => {
        if (!t.startDate) return true;
        const d = new Date(t.startDate);
        return d >= startOfToday && d <= endOfToday;
      });

      if (todayTasks.length === 0) continue;

      // Check if daily briefing already sent today
      const existingBriefing = await db.notification.findFirst({
        where: {
          userId,
          type: "SYSTEM",
          title: "Today's Daily Task Briefing",
          createdAt: { gte: startOfToday },
        },
        select: { id: true },
      });

      if (!existingBriefing) {
        const count = todayTasks.length;
        const sampleTitles = todayTasks.slice(0, 2).map((t) => `"${t.title}"`).join(", ");
        const moreSuffix = count > 2 ? ` and ${count - 2} more` : "";

        await sendNotification({
          userId,
          type: "SYSTEM",
          title: "Today's Daily Task Briefing",
          message: `You have ${count} task${count > 1 ? "s" : ""} scheduled for today (${todayDateFormatted}): ${sampleTitles}${moreSuffix}.`,
          taskId: todayTasks[0].id,
        });
      }
    }

    return { dispatched: unlockedTasks.length };
  } catch (error) {
    console.error("Error in dispatchDailyScheduledNotifications:", error);
    return { error };
  }
}
