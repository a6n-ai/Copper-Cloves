import { Client } from "pg";
import fs from "fs";

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

function shouldEnablePgSsl(connectionString) {
  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    const ssl = parsed.searchParams.get("ssl")?.toLowerCase();

    if (sslMode === "disable" || ssl === "false" || ssl === "0") {
      return false;
    }

    if (
      sslMode === "require" ||
      sslMode === "verify-ca" ||
      sslMode === "verify-full" ||
      ssl === "true" ||
      ssl === "1"
    ) {
      return true;
    }

    const host = parsed.hostname.toLowerCase();
    return [
      "rds.amazonaws.com",
      "neon.tech",
      "supabase.co",
      "railway.app",
      "render.com",
      "aivencloud.com",
      "tembo.io",
    ].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function stripPgSslUrlOptions(connectionString) {
  const parsed = new URL(connectionString.trim());
  for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert", "sslpassword"]) {
    parsed.searchParams.delete(key);
  }

  return parsed.toString();
}

async function main() {
  const connectionString = resolveDatabaseUrl();
  const useSsl = shouldEnablePgSsl(connectionString);
  let sslConfig = false;
  
  if (useSsl) {
    const caPath = process.env.RDS_CA_PATH;
    if (caPath && fs.existsSync(caPath)) {
      try {
        const ca = fs.readFileSync(caPath, 'utf-8');
        sslConfig = { ca: ca, rejectUnauthorized: true };
      } catch (err) {
        console.warn('Failed to read CA certificate, falling back to rejectUnauthorized: false');
        sslConfig = { rejectUnauthorized: false };
      }
    } else {
      sslConfig = { rejectUnauthorized: false };
    }
  }
  
  const client = new Client({
    connectionString: stripPgSslUrlOptions(connectionString),
    ...(sslConfig ? { ssl: sslConfig } : {}),
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
