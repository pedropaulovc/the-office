import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createClient() {
  try {
    return neon(process.env.DATABASE_URL_UNPOOLED ?? "");
  } catch {
    // neon("") throws immediately. Return a placeholder that defers the
    // error to query time so the app can build/start without DB credentials.
    return (() => {
      throw new Error("DATABASE_URL_UNPOOLED is not configured");
    }) as unknown as ReturnType<typeof neon>;
  }
}

const sql = createClient();
export const db = drizzle({ client: sql, schema });
