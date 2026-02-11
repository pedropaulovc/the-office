import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    console.error("DATABASE_URL_UNPOOLED is not set");
    process.exit(1);
  }

  const sql = neon(url);
  const result = await sql`SELECT 1 AS ok`;
  console.log("Connection OK:", result);
}

main().catch((err: unknown) => {
  console.error("Connection failed:", err);
  process.exit(1);
});
