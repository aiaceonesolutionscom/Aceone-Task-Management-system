import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { endpoint, p256dh, auth } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Incomplete push subscription payload" }, { status: 400 });
    }

    // Save or update subscription
    await db.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
      },
      update: {
        userId: user.id,
        p256dh,
        auth,
      },
    });

    return NextResponse.json({ success: true, message: "Push subscription saved" });
  } catch (err: any) {
    console.error("Failed to save push subscription:", err);
    return NextResponse.json({ error: err.message || "Failed to save subscription" }, { status: 500 });
  }
}
