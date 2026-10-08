import { requireUser } from "@/lib/auth";
import { getEffectiveUser, getAllowedDepartmentIds } from "@/lib/scopes";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { ChatHubView } from "@/components/chat/chat-hub-view";
import { redirect } from "next/navigation";
import {
  getCommentReads,
  getCommentDeliveries,
  markCommentsAsDelivered,
  markCommentsAsRead,
} from "@/lib/chat-reads";

export default async function ChatPage() {
  const user = await requireUser();
  const effectiveUser = await getEffectiveUser(user.id);
  if (!effectiveUser) redirect("/login");

  const isEmployee = user.role.code === "employee";
  const isSuperAdmin = Boolean(
    effectiveUser.role.isSystem ||
    effectiveUser.role.code === "super_admin" ||
    effectiveUser.role.code === "admin"
  );

  const allowedDeptIds = isSuperAdmin ? null : getAllowedDepartmentIds(effectiveUser);

  // 1. Find all accessible departments for this user
  const allActiveDepts = await db.department.findMany({
    where: { status: "ACTIVE" },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, designation: true, role: true, status: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const accessibleDepts = allowedDeptIds !== null
    ? allActiveDepts.filter((d) => allowedDeptIds.includes(d.id))
    : allActiveDepts;

  // 2. Ensure each department has an "Everyone" Team Channel Task
  const teamChannelsRaw: any[] = [];
  for (const dept of accessibleDepts) {
    const generalCode = `${dept.code || "TEAM"}-GENERAL`;
    let generalTask = await db.task.findFirst({
      where: {
        departmentId: dept.id,
        taskCode: generalCode,
      },
      include: {
        department: true,
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                designation: true,
                role: { select: { name: true, code: true } },
              },
            },
          },
        },
      },
    });

    if (!generalTask) {
      generalTask = await db.task.create({
        data: {
          taskCode: generalCode,
          title: `${dept.name} Team Channel (Everyone)`,
          instructions: `Official group discussion channel for all members in the ${dept.name} department.`,
          departmentId: dept.id,
          createdBy: user.id,
          assignedBy: user.id,
          priority: "LOW",
          status: "IN_PROGRESS",
        },
        include: {
          department: true,
          comments: {
            orderBy: { createdAt: "asc" },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  designation: true,
                  role: { select: { name: true, code: true } },
                },
              },
            },
          },
        },
      });
    }

    if (generalTask) {
      teamChannelsRaw.push({
        id: generalTask.id,
        taskCode: generalTask.taskCode || `#${generalTask.id}`,
        title: generalTask.title,
        isTeamChannel: true,
        department: { id: dept.id, name: dept.name },
        members: dept.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          designation: m.user.designation,
          role: m.user.role.name,
          status: m.user.status,
        })),
        assignees: dept.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          designation: m.user.designation,
        })),
        rawComments: generalTask.comments,
        updatedAt: generalTask.updatedAt.toISOString(),
      });
    }
  }

  // 3. Load Manager Only / Task-specific review discussions
  const taskWhere: any = {
    taskCode: { not: { contains: "-GENERAL" } },
  };

  if (isEmployee) {
    taskWhere.assignees = {
      some: { userId: user.id },
    };
  } else if (allowedDeptIds !== null) {
    taskWhere.departmentId = { in: allowedDeptIds.length > 0 ? allowedDeptIds : [-1] };
  }

  const reviewTasks = await db.task.findMany({
    where: taskWhere,
    include: {
      department: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  designation: true,
                  role: { select: { name: true, code: true } },
                },
              },
            },
          },
        },
      },
      creator: { select: { id: true, name: true, designation: true } },
      assignor: { select: { id: true, name: true, designation: true } },
      reviewers: {
        include: {
          user: { select: { id: true, name: true, designation: true } },
        },
      },
      assignees: {
        include: {
          user: { select: { id: true, name: true, designation: true } },
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              designation: true,
              role: { select: { name: true, code: true } },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  // 4. Fetch all reads for comments across both channel types safely from PostgreSQL
  const allCommentIds: number[] = [];
  teamChannelsRaw.forEach((tc) => {
    tc.rawComments.forEach((c: any) => allCommentIds.push(c.id));
  });
  reviewTasks.forEach((rt) => {
    rt.comments.forEach((c: any) => allCommentIds.push(c.id));
  });

  // Mark all incoming visible comments as delivered (since user opened chat page)
  const incomingCommentIds = allCommentIds.filter((id) => true);
  if (allCommentIds.length > 0) {
    await markCommentsAsDelivered(allCommentIds, user.id);
  }

  // Determine initial active channel and mark its comments as read
  const activeFirstTask = isEmployee ? (teamChannelsRaw[0] || reviewTasks[0]) : (reviewTasks[0] || teamChannelsRaw[0]);
  if (activeFirstTask) {
    const firstTaskCommentIds = (activeFirstTask.rawComments || activeFirstTask.comments || [])
      .filter((c: any) => c.userId !== user.id)
      .map((c: any) => c.id);
    if (firstTaskCommentIds.length > 0) {
      await markCommentsAsRead(firstTaskCommentIds, user.id);
    }
  }

  const [readsMap, deliveriesMap] = await Promise.all([
    getCommentReads(allCommentIds),
    getCommentDeliveries(allCommentIds),
  ]);

  const teamChannels = teamChannelsRaw.map((tc) => ({
    id: tc.id,
    taskCode: tc.taskCode,
    title: tc.title,
    isTeamChannel: tc.isTeamChannel,
    department: tc.department,
    members: tc.members,
    assignees: tc.assignees,
    comments: tc.rawComments.map((c: any) => ({
      id: c.id,
      userId: c.userId,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
      reads: readsMap[c.id] || [],
      deliveries: deliveriesMap[c.id] || [],
    })),
    updatedAt: tc.updatedAt,
  }));

  const formattedReviewTasks = reviewTasks.map((t) => ({
    id: t.id,
    taskCode: t.taskCode || `#${t.id}`,
    title: t.title,
    isTeamChannel: false,
    status: t.status,
    department: { id: t.department.id, name: t.department.name },
    creator: t.creator ? { id: t.creator.id, name: t.creator.name, designation: t.creator.designation } : null,
    assignor: t.assignor ? { id: t.assignor.id, name: t.assignor.name, designation: t.assignor.designation } : null,
    reviewers: (t.reviewers || []).map((r) => ({
      id: r.user.id,
      name: r.user.name,
      designation: r.user.designation,
    })),
    assignees: t.assignees.map((a) => ({
      id: a.user.id,
      name: a.user.name,
      designation: a.user.designation,
    })),
    departmentManagers: (t.department?.members || [])
      .filter((m) => ["manager", "admin", "super_admin"].includes(m.user?.role?.code || ""))
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        designation: m.user.designation,
      })),
    comments: t.comments.map((c) => ({
      id: c.id,
      userId: c.userId,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
      reads: readsMap[c.id] || [],
      deliveries: deliveriesMap[c.id] || [],
    })),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <AppShell user={user}>
      <ChatHubView
        teamChannels={teamChannels}
        taskChannels={formattedReviewTasks}
        currentUserId={user.id}
        isEmployee={isEmployee}
      />
    </AppShell>
  );
}
