/**
 * LLM provider switch for the exercise chat agent (see monarch/.llm/architecture.md
 * "LLM provider" — dev builds against local Ollama, Bedrock wired in only before prod
 * cutover). All three sides implement AI SDK's `LanguageModel` interface, so this is
 * the only place that branches — callers (the chat route) never see which one is active.
 * OpenRouter isn't part of the documented dev/prod plan — added as a third option for
 * quick model comparisons (many hosted models, one API key) alongside Ollama/Bedrock.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

const OLLAMA_MODEL_ID = process.env.OLLAMA_MODEL_ID || "llama3.1:8b";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";

// Free-tier by default so casual testing can't rack up a bill by accident. Confirmed
// LIVE end-to-end (2026-08-08) — real tool calls, correct data back. Not just "listed
// as supporting tools": openai/gpt-oss-20b:free is also listed as tool-capable but 400s
// ("auto tool schema uses unsupported assertions or reserved metadata") — OpenRouter's
// free tier rotates and per-backend JSON-schema strictness varies, so if this stops
// working, re-verify against a live request, not just /api/v1/models' supported_parameters.
// Override via OPENROUTER_MODEL_ID — see https://openrouter.ai/models for the catalog.
const OPENROUTER_MODEL_ID = process.env.OPENROUTER_MODEL_ID || "nvidia/nemotron-nano-9b-v2:free";

// Cross-region inference profile id, confirmed live against ap-south-1 (Phase 0.1 spike,
// monarch/.llm/phases.md): the bare on-demand id 400s ("on-demand throughput isn't
// supported"), and the "us." profile 400s from this region too — it has to be the
// geography-matched "apac." profile. Override via BEDROCK_MODEL_ID for a different
// region/model.
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || "apac.anthropic.claude-3-5-sonnet-20241022-v2:0";

function ollamaModel(): LanguageModel {
  const ollama = createOpenAICompatible({ name: "ollama", baseURL: OLLAMA_BASE_URL });
  return ollama(OLLAMA_MODEL_ID) as unknown as LanguageModel;
}

function openrouterModel(): LanguageModel {
  // apiKey intentionally omitted: @openrouter/ai-sdk-provider reads OPENROUTER_API_KEY
  // from the environment itself when apiKey isn't passed — same pattern as Bedrock's
  // bearer-token pickup below.
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set — required when LLM_PROVIDER=openrouter.");
  }
  const openrouter = createOpenRouter({ appName: "copper-cloves-exercise-agent" });
  return openrouter(OPENROUTER_MODEL_ID) as unknown as LanguageModel;
}

function bedrockModel(): LanguageModel {
  // Region is NOT inferred from AWS_REGION here on purpose — Bedrock model
  // availability is region-scoped and getting it wrong should fail loud, not
  // silently fall back to a region that doesn't have the model enabled.
  const region = process.env.BEDROCK_REGION;
  if (!region) {
    throw new Error("BEDROCK_REGION is not set — required when LLM_PROVIDER=bedrock.");
  }
  // apiKey intentionally omitted: @ai-sdk/amazon-bedrock reads AWS_BEARER_TOKEN_BEDROCK
  // from the environment itself when apiKey isn't passed (Bedrock API key / bearer-token
  // auth, not full SigV4). Prod (IAM role) cutover swaps this for accessKeyId/
  // secretAccessKey/credentialProvider — same function signature, callers unaffected.
  const bedrock = createAmazonBedrock({ region });
  return bedrock(BEDROCK_MODEL_ID) as unknown as LanguageModel;
}

export function getChatModel(): LanguageModel {
  const provider = process.env.LLM_PROVIDER || "ollama";
  switch (provider) {
    case "ollama":
      return ollamaModel();
    case "bedrock":
      return bedrockModel();
    case "openrouter":
      return openrouterModel();
    default:
      throw new Error(`Unknown LLM_PROVIDER: "${provider}". Expected "ollama", "bedrock", or "openrouter".`);
  }
}
