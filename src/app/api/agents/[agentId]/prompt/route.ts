import { getAgent, listMemoryBlocks, getChannelMessages } from "@/db/queries";
import { buildSystemPrompt } from "@/agents/prompt-builder";
import { jsonResponse } from "@/lib/api-response";

interface RouteContext { params: Promise<{ agentId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");

  const agent = await getAgent(agentId);
  if (!agent) {
    return jsonResponse({ error: "Agent not found" }, { status: 404 });
  }

  const memoryBlocks = await listMemoryBlocks(agentId);

  let recentMessages: { userId: string; text: string; createdAt: Date }[] = [];
  if (channelId) {
    const channelMessages = await getChannelMessages(channelId);
    recentMessages = channelMessages.map((m) => ({
      userId: m.userId,
      text: m.text,
      createdAt: new Date(m.timestamp),
    }));
  }

  const prompt = buildSystemPrompt({ agent, memoryBlocks, recentMessages });

  return jsonResponse({
    agentId,
    channelId: channelId ?? null,
    sections: {
      persona: agent.systemPrompt,
      memoryBlocks: memoryBlocks.map((b) => ({
        label: b.label,
        content: b.content,
      })),
      recentMessageCount: recentMessages.length,
    },
    prompt,
  });
}
