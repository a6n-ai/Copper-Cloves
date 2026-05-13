import { Client } from "pg";

function resolveDatabaseUrl(env = process.env) {
  const studioUrl = env.STUDIO_DATABASE_URL?.trim();
  const databaseUrl = env.DATABASE_URL?.trim();
  const selectedUrl = studioUrl || databaseUrl;

  if (!selectedUrl) {
    throw new Error("Missing database URL: set STUDIO_DATABASE_URL (recommended) or DATABASE_URL.");
  }

  const parsed = new URL(selectedUrl);
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "postgresql:" && protocol !== "postgres:") {
    throw new Error("Invalid database URL protocol. Use postgresql:// or postgres://.");
  }

  if (parsed.hostname.toLowerCase() === "localhost") {
    parsed.hostname = "127.0.0.1";
  }

  return parsed.toString();
}

function isLocalPostgresHost(connectionString) {
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/** Match `src/lib/prisma.ts` — RDS / managed hosts need TLS; locals stay plain. */
function normalizePostgresUrl(url) {
  const trimmed = url.trim();
  const isRds =
    trimmed.includes("rds.amazonaws.com") || trimmed.includes("rds.amazonaws.com.cn");
  let next = trimmed;
  if (isRds) {
    if (!/[?&]sslmode=/i.test(next) && !/[?&]ssl=true/i.test(next)) {
      next = `${next}${next.includes("?") ? "&" : "?"}sslmode=require`;
    }
  }
  if (isLocalPostgresHost(next)) return next;
  try {
    const parsed = new URL(next);
    const mode = parsed.searchParams.get("sslmode")?.toLowerCase();
    const libpqAliases = new Set(["require", "prefer", "verify-ca"]);
    if (mode && libpqAliases.has(mode) && !parsed.searchParams.has("uselibpqcompat")) {
      parsed.searchParams.set("uselibpqcompat", "true");
    }
    return parsed.toString();
  } catch {
    return next;
  }
}

function shouldEnableSsl(connectionString) {
  if (isLocalPostgresHost(connectionString)) return false;
  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    if (sslMode === "disable") return false;
    if (
      sslMode === "require" ||
      sslMode === "verify-ca" ||
      sslMode === "verify-full" ||
      sslMode === "prefer" ||
      sslMode === "allow"
    ) {
      return true;
    }
    if (parsed.searchParams.get("ssl") === "true") return true;

    const host = parsed.hostname.toLowerCase();
    return (
      host.includes("rds.amazonaws.com") ||
      host.includes("neon.tech") ||
      host.includes("supabase.co")
    );
  } catch {
    return false;
  }
}

/** Drop URL ssl flags so `pg` does not force verify-full; TLS via `ssl` option (same as prisma pool). */
function poolConnectionString(fullUrl, useSsl) {
  if (!useSsl || isLocalPostgresHost(fullUrl)) return fullUrl;
  try {
    const parsed = new URL(fullUrl);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("uselibpqcompat");
    parsed.searchParams.delete("ssl");
    return parsed.toString();
  } catch {
    return fullUrl;
  }
}

async function main() {
  const raw = resolveDatabaseUrl();
  const connectionString = normalizePostgresUrl(raw);
  const useSsl = shouldEnableSsl(connectionString);
  const connectUrl = poolConnectionString(connectionString, useSsl);

  const client = new Client({
    connectionString: connectUrl,
    connectionTimeoutMillis: 15_000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  await client.connect();
  await client.end();
  console.log("Database connectivity check passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Database connectivity check failed", message);
  process.exit(1);
});
