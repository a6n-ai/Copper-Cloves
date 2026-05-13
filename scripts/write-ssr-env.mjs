/**
 * Writes .env.production for Amplify SSR so Next.js API routes load DB + NextAuth vars.
 * Values are JSON-stringified per line so special characters (#, $, spaces) in secrets/URLs
 * are not mangled by dotenv (unlike raw `env | grep >> .env.production`).
 */
import fs from "node:fs";
import path from "node:path";

const KEYS = ["STUDIO_DATABASE_URL", "DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"];

const hasDb =
  Boolean(process.env.STUDIO_DATABASE_URL?.trim()) || Boolean(process.env.DATABASE_URL?.trim());
if (!hasDb) {
  console.error("ERROR: Set STUDIO_DATABASE_URL or DATABASE_URL in Amplify environment variables.");
  process.exit(1);
}

let out = "";

// Check if RDS CA certificate exists
const caPath = path.join(process.cwd(), ".next", "rds-ca.pem");
const hasRdsCert = fs.existsSync(caPath);

// Set NODE_EXTRA_CA_CERTS for all Node.js processes
if (hasRdsCert) {
  out += `NODE_EXTRA_CA_CERTS=${JSON.stringify(caPath)}\n`;
}

for (const k of KEYS) {
  let v = process.env[k];
  
  if (v != null && String(v).length > 0) {
    out += `${k}=${JSON.stringify(String(v))}\n`;
  }
}

fs.writeFileSync(".env.production", out);
console.log("Wrote .env.production for SSR (values not printed).");
