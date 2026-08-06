import type { NextApiRequest, NextApiResponse } from "next";
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getChatModel } from "@/lib/llmProvider";
import { createExerciseAiSdkTools } from "@/lib/mcp/exerciseAiSdkTools";
import { EXERCISE_SYSTEM_PROMPT } from "@/lib/chat/exerciseSystemPrompt";
import prisma from "@/lib/prisma";
import { requestLogger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const log = requestLogger(req, res);

  // Session resolved ONCE, here, server-side. profileId below is the only source of
  // truth for every tool call in this request — see the Security invariant in
  // monarch/.llm/architecture.md and src/lib/mcp/exerciseTools.ts. It is never read
  // from the request body.
  const session = await getStudioServerSession(req, res);
  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const profileId = session.user.id;

  const { messages } = req.body as { messages: UIMessage[] };
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "Missing messages" });
    return;
  }

  const tools = createExerciseAiSdkTools(prisma, profileId);
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: getChatModel(),
    system: EXERCISE_SYSTEM_PROMPT,
    messages: modelMessages,
    tools,
    // Cap the tool-call loop — model calls a tool, reads the result, replies. 5 steps
    // covers "call 2 tools then answer" with room to spare without risking a runaway
    // loop against a small local model.
    stopWhen: stepCountIs(5),
    onFinish: ({ usage, toolCalls }) => {
      log.info(
        { profileId, inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens, toolCalls: toolCalls?.length ?? 0 },
        "[chat/coach] turn finished",
      );
    },
    onError: ({ error }) => {
      log.error({ profileId, err: error }, "[chat/coach] streamText error");
    },
  });

  result.pipeUIMessageStreamToResponse(res);
}
