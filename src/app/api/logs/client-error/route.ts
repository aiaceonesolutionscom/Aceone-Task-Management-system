import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser().catch(() => null);
    const body = await req.json();

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    await logger.error(
      body.message || "Client-side unhandled exception",
      {
        userId: user?.id,
        module: "CLIENT_ERROR",
        action: "client.unhandled_error",
        ip: clientIp,
        error: {
          message: body.message,
          stack: body.stack,
          digest: body.digest,
        },
        metadata: {
          url: body.url,
          userAgent: req.headers.get("user-agent"),
        },
      },
      true // Save to DB
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to record log" }, { status: 500 });
  }
}
