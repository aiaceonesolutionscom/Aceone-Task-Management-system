import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Quick probe to verify database connectivity
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      app: "AceOne Solutions Platform",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        app: "AceOne Solutions Platform",
        timestamp: new Date().toISOString(),
        database: "disconnected",
      },
      { status: 503 }
    );
  }
}
