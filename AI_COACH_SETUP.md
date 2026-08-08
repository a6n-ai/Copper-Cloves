# AI Coach — local setup & reproduction steps

Exercise chat agent (Coach) local dev setup. Architecture + phase plan live in the
`monarch` repo (`.llm/architecture.md`, `.llm/phases.md`); this file is just the
practical "how do I run it" checklist for this repo.

Feature branch: `feat/exercise-chat-mcp-tools`.

## 0. Prerequisites

- Docker Desktop running.
- Node deps installed (`npm install`).

## 1. Bring up Postgres + Ollama

```bash
docker compose up -d
```

This starts both `postgres` (port 5433, same as the app's normal local DB) and `ollama`
(port 11434) — they're in the same `docker-compose.yml` now.

Pull the model once (not automatic, and not cached across a fresh volume):

```bash
docker compose exec ollama ollama pull llama3.1:8b
```

> Apple Silicon note: containerized Ollama has no Metal GPU access, so replies take
> **1–4 minutes**. That's expected — not a bug. For faster iteration, run Ollama
> natively instead (`brew install ollama`) and point `OLLAMA_BASE_URL` at
> `http://localhost:11434/v1`.

## 2. Push the schema + seed data

```bash
export DATABASE_URL="postgresql://copper:copper_dev@127.0.0.1:5433/copperandcloves?schema=public"
export STUDIO_DATABASE_URL="$DATABASE_URL"
export BETTER_AUTH_SECRET="local-dev-only-secret-not-for-prod-0000000000000000"
export BETTER_AUTH_URL="http://localhost:3000"

npx prisma db push
npx tsx scripts/ensure-admin.ts
npx tsx scripts/seed-system-profile.ts
npx tsx scripts/seed-instructors.ts
npx tsx scripts/seed-chat-agent-dummy.ts
```

`seed-chat-agent-dummy.ts` is **not committed** (one-off/local script per this repo's
convention — see `AGENTS.md`) but should already be on disk on this branch. It creates:

- `chat.agent.test1@example.com` / `ChatAgentTest@123` — has booking/streak/badge
  history (streak of 4, one upcoming class, one earned badge).
- `chat.agent.test2@example.com` / `ChatAgentTest@123` — fresh account, no history
  (tests the empty-state path).

All the seed scripts above are idempotent — safe to re-run.

## 3. Start the app

```bash
export LLM_PROVIDER="ollama"
export OLLAMA_BASE_URL="http://127.0.0.1:11434/v1"
export OLLAMA_MODEL_ID="llama3.1:8b"
npm run dev:next
```

Use `dev:next` (not `dev`) here since `docker compose up -d` from step 1 already covers
what `dev`'s own `docker compose up -d && next dev` would try to do.

> `next dev` may rewrite `tsconfig.json`'s `jsx` field to `"react-jsx"` on first run in
> some environments — if you see that diff, revert it (`git checkout -- tsconfig.json`),
> it's an unrelated Next quirk, not part of this feature.

## 4. Test it

1. `http://localhost:3000/login` → log in as `chat.agent.test1@example.com` /
   `ChatAgentTest@123`.
2. Sidebar → **Coach** section → **AI Coach** (or go straight to
   `http://localhost:3000/portal/coach`).
3. Ask things like:
   - "What's my current streak?"
   - "What classes do I have coming up?"
   - "Suggest something for me."
4. Try `chat.agent.test2@example.com` too — fresh account, exercises the
   zero-history/empty-state path.

Expect a tool-call indicator ("Checked get progress summary" etc.) before the reply —
that's the MCP tool layer (`src/lib/mcp/`) actually hitting Postgres, not the model
guessing.

## Switching to Bedrock instead of Ollama

Same app, same command, different env vars:

```bash
export LLM_PROVIDER="bedrock"
export BEDROCK_REGION="ap-south-1"           # region your Bedrock model access is in
# AWS_BEARER_TOKEN_BEDROCK is read from .env.local (gitignored) — don't export it inline
```

Quick standalone check without starting the whole app (see
`monarch/scripts/check_bedrock.py`):

```bash
AWS_BEARER_TOKEN_BEDROCK=<your token> python3 ../monarch/scripts/check_bedrock.py
```

As of 2026-08-06 this account is blocked on `INVALID_PAYMENT_INSTRUMENT` (AWS
Marketplace subscription for the Anthropic model needs a valid payment method) — fix in
AWS Console → Billing, then retry. Not a code issue.

## Switching to OpenRouter instead of Ollama

A third option, not part of the documented dev/prod plan — for quick model comparisons
(many hosted models behind one API key) without a local GPU or AWS billing setup:

```bash
export LLM_PROVIDER="openrouter"
export OPENROUTER_API_KEY="<your key from openrouter.ai/keys>"
# optional — defaults to nvidia/nemotron-nano-9b-v2:free, confirmed working live
# (tool calls + correct data back). Free-tier model availability/tool-schema support
# rotates on OpenRouter — if you swap this, verify with a real request, not just
# checking /api/v1/models' supported_parameters (openai/gpt-oss-20b:free lists "tools"
# there but actually 400s on our tool schemas).
export OPENROUTER_MODEL_ID="nvidia/nemotron-nano-9b-v2:free"
```

Browse model IDs (and pricing) at [openrouter.ai/models](https://openrouter.ai/models) —
pass any of them as `OPENROUTER_MODEL_ID`, including paid ones like
`anthropic/claude-3.5-sonnet`, if you want closer-to-Bedrock output quality without
waiting on the AWS billing fix above.

## Cleaning up

```bash
docker compose down        # stop postgres + ollama
docker compose down -v     # also wipe the DB/model volumes (full reset)
```
