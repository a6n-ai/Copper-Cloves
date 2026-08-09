/**
 * One-off, local-only smoke test for the exercise MCP tool layer (monarch/.llm/phases.md
 * Phase 1.2). NOT committed. Spins up a real MCP client/server pair over the SDK's
 * in-memory transport (true protocol round-trip, not calling handlers directly) and:
 *   1. lists tools
 *   2. calls all 6 tools for test1 (has booking/streak/badge history)
 *   3. calls all 6 tools for test2 (fresh account, no history — the empty-state path)
 *   4. asserts test1's data never leaks into test2's server instance and vice versa
 *
 * Point DATABASE_URL/STUDIO_DATABASE_URL at the monarch docker-compose Postgres first:
 *   DATABASE_URL="postgresql://copper:copper_dev@127.0.0.1:5433/copperandcloves?schema=public" \
 *   STUDIO_DATABASE_URL="postgresql://copper:copper_dev@127.0.0.1:5433/copperandcloves?schema=public" \
 *   npx tsx scripts/smoke-test-mcp-tools.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function callAllTools(client: import("@modelcontextprotocol/sdk/client/index.js").Client) {
  const toolNames = [
    "get_upcoming_bookings",
    "get_class_schedule",
    "get_progress_summary",
    "get_active_packages",
    "get_badges",
    "get_recent_activity",
  ];
  const out: Record<string, unknown> = {};
  for (const name of toolNames) {
    const res = await client.callTool({ name, arguments: {} });
    const content = (res as { content: { type: string; text: string }[] }).content;
    const text = content?.[0]?.text ?? "null";
    out[name] = JSON.parse(text);
  }

  
  return out;
}

async function main() {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
  const { createExerciseMcpServer } = await import("../src/lib/mcp/exerciseServer");
  const prisma = (await import("../src/lib/prisma")).default;

  const test1 = await prisma.profile.findFirstOrThrow({ where: { email: "chat.agent.test1@example.com" } });
  const test2 = await prisma.profile.findFirstOrThrow({ where: { email: "chat.agent.test2@example.com" } });

  async function runFor(profileId: string, label: string) {
    const server = createExerciseMcpServer(prisma, profileId);
    const client = new Client({ name: "smoke-test-client", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const tools = await client.listTools();
    console.log(`\n=== ${label} (${profileId}) — tools/list: ${tools.tools.map((t) => t.name).join(", ")} ===`);

    const results = await callAllTools(client);
    console.log(JSON.stringify(results, null, 2));

    await client.close();
    return results;
  }

  const r1 = await runFor(test1.id, "test1 (has history)");
  const r2 = await runFor(test2.id, "test2 (fresh account)");

  // Cross-tenant isolation check — the whole point of this smoke test, not a formality.
  const r1Bookings = JSON.stringify(r1.get_upcoming_bookings);
  const r2Bookings = JSON.stringify(r2.get_upcoming_bookings);
  console.log("\n=== isolation check ===");
  if (r1Bookings === r2Bookings && r1Bookings !== "[]") {
    throw new Error("FAIL: test1 and test2 got identical non-empty booking data — profile scoping is broken.");
  }
  if ((r1.get_progress_summary as { total_classes_attended: number }).total_classes_attended === 0) {
    throw new Error("FAIL: test1 expected attendance history, got zero — seed data or query is wrong.");
  }
  if ((r2.get_progress_summary as { total_classes_attended: number }).total_classes_attended !== 0) {
    throw new Error("FAIL: test2 (fresh account) unexpectedly has attendance history — cross-tenant leak.");
  }
  console.log("PASS: test1/test2 data distinct, no cross-tenant leak, empty-state path returns zeros not errors.");

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
