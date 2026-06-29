/**
 * General prod refresh: overwrite the message_body + variables of EVERY system
 * CRM template from its .html source. The normal seed (seed-crm-system-templates)
 * PRESERVES an existing message_body, so any drift in prod (old camelCase bodies,
 * missing {{Refund_Roster}}, etc.) stays until forced. This is the explicit
 * "adopt the .html" step.
 *
 * For each `*.html` under src/lib/notifications/system-templates/:
 *   - template_key = filename (without .html)
 *   - only `is_system` rows are overwritten (never a custom/admin template)
 *   - `variables` is recomputed from the distinct Snake_Case {{Tokens}} in the body
 *   - a body still carrying camelCase tokens ({{className}} etc.) is REFUSED —
 *     those render blank and re-break the email.
 *
 * Idempotent. WILL overwrite admin edits to system template bodies — that is the
 * intent (Snake_Case is code-owned; admins edit copy, then this re-adopts source).
 *
 *   npm run db:refresh:templates
 */
import prisma from "../src/lib/prisma";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const TEMPLATES_DIR = join(__dirname, "../src/lib/notifications/system-templates");

// camelCase token like {{className}} / {{startTime}} — starts lowercase, has no
// underscore, contains an uppercase letter. Snake_Case tokens never match.
const CAMEL_TOKEN = /\{\{\s*[a-z][A-Za-z0-9]*\s*\}\}/;
const ANY_TOKEN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

function extractVariables(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(ANY_TOKEN)) {
    const token = m[1].trim();
    if (!seen.has(token)) {
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

async function main() {
  const files = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".html"));
  if (files.length === 0) {
    console.warn("No .html templates found — nothing to refresh.");
    return;
  }

  let refreshed = 0;
  let skipped = 0;

  for (const file of files.sort()) {
    const key = file.replace(/\.html$/, "");
    const body = readFileSync(join(TEMPLATES_DIR, file), "utf8");

    const camel = body.match(CAMEL_TOKEN);
    if (camel) {
      throw new Error(
        `${file} still contains a camelCase placeholder (${camel[0]}) — aborting (would render blank). Convert it to Snake_Case.`,
      );
    }

    const existing = await prisma.crmTemplate.findUnique({
      where: { template_key: key },
      select: { id: true, is_system: true },
    });
    if (!existing) {
      console.warn(`Skipped ${key}: template not found. Run db:seed:crm-system first.`);
      skipped += 1;
      continue;
    }
    if (!existing.is_system) {
      console.warn(`Skipped ${key}: not a system template (won't overwrite a custom one).`);
      skipped += 1;
      continue;
    }

    const variables = extractVariables(body);
    await prisma.crmTemplate.update({
      where: { template_key: key },
      data: { message_body: body, variables },
    });
    console.log(`Refreshed body + variables (${variables.length} vars): ${key}`);
    refreshed += 1;
  }

  console.log(`Done. Refreshed ${refreshed}, skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
