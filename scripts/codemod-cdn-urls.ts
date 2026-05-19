import { readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

// Public asset extensions to rewrite.
const ASSET_RE = /(['"])(\/[A-Za-z0-9_./-]+\.(?:jpg|jpeg|png|svg|webp|gif|mp4|webm|ico))(['"])/g;

// Skip rewriting paths starting with these — they are framework / API / nextauth, not /public assets.
const SKIP_PREFIXES = ["/api/", "/_next/", "/portal/", "/admin/", "/uploads/"];

function shouldSkipPath(p: string): boolean {
  return SKIP_PREFIXES.some((pref) => p.startsWith(pref));
}

async function listSourceFiles(): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string) {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "generated" || e.name === "node_modules") continue;
        await walk(p);
      } else if (e.isFile() && (e.name.endsWith(".tsx") || e.name.endsWith(".ts"))) {
        out.push(p);
      }
    }
  }
  await walk("src");
  return out;
}

function ensureImport(src: string): string {
  if (src.includes('from "@/lib/cdnUrl"')) return src;
  // Find the index AFTER the last `import …;` statement (multi-line imports
  // counted as one statement). Use regex to match `import` blocks ending with `;`.
  const importRe = /^import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm;
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(src)) !== null) {
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd === 0) {
    return `import { cdnUrl } from "@/lib/cdnUrl";\n${src}`;
  }
  return src.slice(0, lastEnd) + `\nimport { cdnUrl } from "@/lib/cdnUrl";` + src.slice(lastEnd);
}

function rewriteFile(path: string): boolean {
  const original = readFileSync(path, "utf8");
  let changed = false;

  const next = original.replace(ASSET_RE, (full, q1, p, q2) => {
    if (shouldSkipPath(p)) return full;
    changed = true;
    // Note: this produces `cdnUrl("/foo.jpg")` — works in both JSX expressions
    // and plain string contexts. The caller may need to wrap in braces if it was
    // a JSX attribute previously like src="/foo.jpg".
    return `cdnUrl(${q1}${p}${q2})`;
  });

  if (!changed) return false;

  // After the above, JSX attributes look like  src=cdnUrl("/foo.jpg")  which is invalid.
  // Wrap any  attr=cdnUrl(...)  into  attr={cdnUrl(...)}.
  const withBraces = next.replace(/=cdnUrl\(/g, "={cdnUrl(");
  // The opening paren above unbalances; close it by replacing `cdnUrl("…")`  in an attr context
  // — we instead use a smarter pattern: find `={cdnUrl("…")}` already balanced? No, the regex above
  // only inserts an opening `{`, leaving the `)` unmatched. Fix by adding closing `}` after the
  // call. Simpler: replace the full attr pattern in one pass.
  const finalSrc = next.replace(/(\s)([a-zA-Z_][a-zA-Z0-9_-]*)=cdnUrl\(("[^"]+"|'[^']+')\)/g,
    (_m, ws, attr, arg) => `${ws}${attr}={cdnUrl(${arg})}`
  );

  writeFileSync(path, ensureImport(finalSrc));
  return true;
}

async function main() {
  const files = await listSourceFiles();
  console.log(`Scanning ${files.length} files…`);
  let touched = 0;
  for (const f of files) {
    if (rewriteFile(f)) {
      console.log(`  ✎ ${f}`);
      touched++;
    }
  }
  console.log(`\nRewrote ${touched} files. Run \`npx tsc --noEmit\` to verify.`);
}

main();
