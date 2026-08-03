/**
 * In-process MCP server for the exercise chat agent (see monarch/.llm/architecture.md
 * "Why MCP specifically" — one Node process, no network hop, no separate deploy target).
 *
 * One server per request/session, built AFTER the caller has resolved a session via
 * getStudioServerSession. `profileId` is bound here, in server code, never accepted as
 * a tool argument from the model — see the Security invariant note in exerciseTools.ts.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PrismaClient } from "@/generated/prisma/client";
import { exerciseTools } from "./exerciseTools";

export function createExerciseMcpServer(prisma: PrismaClient, profileId: string): McpServer {
  const server = new McpServer({ name: "copper-cloves-exercise-agent", version: "0.1.0" });

  for (const tool of exerciseTools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args) => {
        const result = await tool.handler(args as never, { prisma, profileId });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      },
    );
  }

  return server;
}
