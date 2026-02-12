import { generateDocument } from "@/api/openapi";
import { jsonResponse } from "@/lib/api-response";

export function GET() {
  const doc = generateDocument();
  return jsonResponse(doc);
}
