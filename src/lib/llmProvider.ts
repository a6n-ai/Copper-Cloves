/**
 * LLM provider switch for the exercise chat agent (see monarch/.llm/architecture.md
 * "LLM provider" — dev builds against local Ollama, Bedrock wired in only before prod
 * cutover). Both sides implement AI SDK's `LanguageModel` interface, so this is the
 * only place that branches — callers (the chat route) never see which one is active.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import type { LanguageModel } from "ai";

const OLLAMA_MODEL_ID = process.env.OLLAMA_MODEL_ID || "llama3.1:8b";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";

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
    default:
      throw new Error(`Unknown LLM_PROVIDER: "${provider}". Expected "ollama" or "bedrock".`);
  }
}
