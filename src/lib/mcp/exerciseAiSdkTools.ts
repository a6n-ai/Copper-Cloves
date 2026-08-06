/**
 * AI SDK-native shell around the same exerciseTools handlers used by the MCP server
 * (exerciseServer.ts). Same tool logic, different consumer: streamText's `tools` wants
 * `ai`'s `tool()` shape, not MCP's `registerTool` shape. No business logic lives here —
 * this only adapts. The in-process MCP round-trip (server ↔ in-memory transport) is
 * skipped for the live chat route since both ends run in the same request; the MCP
 * server in exerciseServer.ts stays as the shell for an external MCP consumer, per
 * monarch/.llm/architecture.md "Why MCP specifically".
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { exerciseTools, type ExerciseToolContext } from "./exerciseTools";

export function createExerciseAiSdkTools(prisma: PrismaClient, profileId: string): ToolSet {
  const ctx: ExerciseToolContext = { prisma, profileId };
  const tools: ToolSet = {};

  for (const def of exerciseTools) {
    tools[def.name] = tool({
      description: def.description,
      inputSchema: z.object(def.inputSchema),
      execute: async (args) => def.handler(args as never, ctx),
    });
  }

  return tools;
}
