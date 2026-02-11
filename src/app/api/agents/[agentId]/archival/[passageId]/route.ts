import { NextResponse } from "next/server";
import { deleteArchivalPassage } from "@/db/queries";

interface RouteContext { params: Promise<{ agentId: string; passageId: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const { passageId } = await context.params;
  const passage = await deleteArchivalPassage(passageId);

  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  return NextResponse.json(passage);
}
