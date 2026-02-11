import { db } from "@/db/client";
import { jsonResponse } from "@/lib/api-response";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return jsonResponse({ status: "ok", database: "connected" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({
      status: "ok",
      database: "unavailable",
      error: message,
    });
  }
}
