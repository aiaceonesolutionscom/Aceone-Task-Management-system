import { requireUser } from "@/lib/auth";
import { getEffectiveUser, getAllowedDepartmentIds } from "@/lib/scopes";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import { Calendar as CalendarIcon, Clock, ChevronRight, AlertCircle } from "lucide-react";

export default async function CalendarPage() {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  const isEmployee = user.role.code === "employee";
  const allowedDepartmentIds = effectiveUser ? getAllowedDepartmentIds(effectiveUser) : null;

  const where: any = {
    taskCode: { not: { contains: "-GENERAL" } },
    deadline: { not: null },
    status: {
      notIn: ["APPROVED", "COMPLETED", "CANCELLED", "ARCHIVED"],
    },
  };

  if (isEmployee) {
    // Employees ONLY see tasks they are assigned to
    where.assignees = {
      some: { userId: user.id },
    };
  } else if (allowedDepartmentIds !== null) {
    // Department-scoped managers see their department's tasks
    where.departmentId = { in: allowedDepartmentIds };
  }

  // Load scoped tasks with deadlines
  const tasks = await db.task.findMany({
    where,
    include: {
      department: true,
      assignees: { include: { user: true } },
    },
    orderBy: { deadline: "asc" },
  });

  // Group tasks by date string
  const groupedTasks: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    if (t.deadline) {
      const dateKey = new Date(t.deadline).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      if (!groupedTasks[dateKey]) groupedTasks[dateKey] = [];
      groupedTasks[dateKey].push(t);
    }
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">Task Schedule & Deadlines</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Chronological schedule of task deadlines and deliverables across AceOne departments.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-neutral-100 rounded text-neutral-700">
            {tasks.length} Scheduled Deadlines
          </span>
        </div>

        {Object.keys(groupedTasks).length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center shadow-2xs space-y-2">
            <CalendarIcon className="w-10 h-10 text-neutral-300 mx-auto" />
            <h3 className="text-sm font-bold text-neutral-900">No scheduled task deadlines</h3>
            <p className="text-xs text-neutral-500">
              When tasks are created with due dates, they will automatically appear on the schedule here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTasks).map(([dateLabel, dayTasks]) => {
              const isToday =
                new Date(dayTasks[0].deadline!).toDateString() === new Date().toDateString();

              return (
                <div key={dateLabel} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                        isToday ? "bg-blue-600 text-white" : "bg-neutral-200 text-neutral-800"
                      }`}
                    >
                      {isToday ? "Today" : dateLabel}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      ({dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"})
                    </span>
                  </div>

                  <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs divide-y divide-neutral-100 overflow-hidden">
                    {dayTasks.map((t) => {
                      const isOverdue =
                        new Date(t.deadline!).getTime() < Date.now() &&
                        !["APPROVED", "COMPLETED"].includes(t.status);

                      return (
                        <Link
                          key={t.id}
                          href={`/tasks/${t.id}`}
                          className="p-3.5 flex items-center justify-between hover:bg-neutral-50/70 transition-colors block"
                        >
                          <div className="min-w-0 flex-1 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-neutral-100 rounded text-neutral-700">
                                {t.taskCode || `#${t.id}`}
                              </span>
                              <span className="text-[10px] font-semibold text-neutral-500">
                                {t.department.name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  t.priority === "URGENT"
                                    ? "bg-red-100 text-red-800"
                                    : t.priority === "HIGH"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-neutral-100 text-neutral-600"
                                }`}
                              >
                                {t.priority}
                              </span>
                            </div>
                            <h3 className="text-xs font-bold text-neutral-900 truncate">{t.title}</h3>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                              Assigned to: {t.assignees.map((a) => a.user.name).join(", ") || "None"}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            {t.dueTime && (
                              <p className="text-xs font-semibold text-neutral-700 mb-1 flex items-center justify-end gap-1">
                                <Clock className="w-3 h-3 text-neutral-400" /> {t.dueTime}
                              </p>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isOverdue
                                  ? "bg-red-100 text-red-800"
                                  : t.status === "APPROVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {isOverdue ? "OVERDUE" : t.status.replace("_", " ")}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
