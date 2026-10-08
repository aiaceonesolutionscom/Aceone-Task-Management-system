import { db } from "@/lib/db";

export type ChatReadRecord = {
  id: number;
  commentId: number;
  userId: number;
  readAt: string;
  user: {
    id: number;
    name: string;
    designation?: string | null;
  };
};

export type ChatDeliveryRecord = {
  id: number;
  commentId: number;
  userId: number;
  deliveredAt: string;
  user: {
    id: number;
    name: string;
    designation?: string | null;
  };
};

/**
 * Retrieves read receipts for a batch of comment IDs.
 */
export async function getCommentReads(commentIds: number[]): Promise<Record<number, ChatReadRecord[]>> {
  if (!commentIds || commentIds.length === 0) return {};

  try {
    const rows = await db.$queryRawUnsafe<any[]>(
      `
      SELECT 
        r.id, 
        r."commentId", 
        r."userId", 
        r."readAt", 
        u.name as "userName", 
        u.designation
      FROM "ChatMessageRead" r
      JOIN "User" u ON u.id = r."userId"
      WHERE r."commentId" = ANY($1::int[])
      ORDER BY r."readAt" ASC
      `,
      commentIds
    );

    const map: Record<number, ChatReadRecord[]> = {};
    for (const row of rows) {
      const cId = Number(row.commentId);
      if (!map[cId]) {
        map[cId] = [];
      }
      map[cId].push({
        id: Number(row.id),
        commentId: cId,
        userId: Number(row.userId),
        readAt: new Date(row.readAt).toISOString(),
        user: {
          id: Number(row.userId),
          name: row.userName,
          designation: row.designation,
        },
      });
    }
    return map;
  } catch (error) {
    console.error("Error fetching chat reads:", error);
    return {};
  }
}

/**
 * Retrieves delivery receipts for a batch of comment IDs.
 */
export async function getCommentDeliveries(commentIds: number[]): Promise<Record<number, ChatDeliveryRecord[]>> {
  if (!commentIds || commentIds.length === 0) return {};

  try {
    const rows = await db.$queryRawUnsafe<any[]>(
      `
      SELECT 
        d.id, 
        d."commentId", 
        d."userId", 
        d."deliveredAt", 
        u.name as "userName", 
        u.designation
      FROM "ChatMessageDelivery" d
      JOIN "User" u ON u.id = d."userId"
      WHERE d."commentId" = ANY($1::int[])
      ORDER BY d."deliveredAt" ASC
      `,
      commentIds
    );

    const map: Record<number, ChatDeliveryRecord[]> = {};
    for (const row of rows) {
      const cId = Number(row.commentId);
      if (!map[cId]) {
        map[cId] = [];
      }
      map[cId].push({
        id: Number(row.id),
        commentId: cId,
        userId: Number(row.userId),
        deliveredAt: new Date(row.deliveredAt).toISOString(),
        user: {
          id: Number(row.userId),
          name: row.userName,
          designation: row.designation,
        },
      });
    }
    return map;
  } catch (error) {
    console.error("Error fetching chat deliveries:", error);
    return {};
  }
}

/**
 * Marks a batch of comment IDs as read by the specified user.
 */
export async function markCommentsAsRead(commentIds: number[], userId: number): Promise<void> {
  if (!commentIds || commentIds.length === 0) return;

  try {
    await db.$executeRawUnsafe(
      `
      INSERT INTO "ChatMessageRead" ("commentId", "userId", "readAt")
      SELECT unnest($1::int[]), $2::int, CURRENT_TIMESTAMP
      ON CONFLICT ("commentId", "userId") DO NOTHING
      `,
      commentIds,
      userId
    );
  } catch (error) {
    console.error("Error marking comments as read:", error);
  }
}

/**
 * Marks a batch of comment IDs as delivered to the specified user.
 */
export async function markCommentsAsDelivered(commentIds: number[], userId: number): Promise<void> {
  if (!commentIds || commentIds.length === 0) return;

  try {
    await db.$executeRawUnsafe(
      `
      INSERT INTO "ChatMessageDelivery" ("commentId", "userId", "deliveredAt")
      SELECT unnest($1::int[]), $2::int, CURRENT_TIMESTAMP
      ON CONFLICT ("commentId", "userId") DO NOTHING
      `,
      commentIds,
      userId
    );
  } catch (error) {
    console.error("Error marking comments as delivered:", error);
  }
}
