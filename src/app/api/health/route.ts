import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      status: "ok",
      database: "unavailable",
      error: message,
    });
  }
}
