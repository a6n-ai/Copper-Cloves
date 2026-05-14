const SSL_HOST_SUFFIXES = [
  "rds.amazonaws.com",
  "neon.tech",
  "supabase.co",
  "railway.app",
  "render.com",
  "aivencloud.com",
  "tembo.io",
];

type DatabaseEnv = Record<string, string | undefined>;

function parseDatabaseUrl(connectionString: string): URL {
  try {
    return new URL(connectionString);
  } catch {
    throw new Error(
      "Invalid database URL. Use a postgresql:// or postgres:// URL and URL-encode special characters in the username or password."
    );
  }
}

export function normalizeDatabaseUrl(connectionString: string): string {
  const trimmed = connectionString.trim();
  if (!trimmed) {
    throw new Error(
      "Missing database URL: set STUDIO_DATABASE_URL (recommended) or DATABASE_URL."
    );
  }

  const parsed = parseDatabaseUrl(trimmed);
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "postgresql:" && protocol !== "postgres:") {
    throw new Error(
      "Invalid database URL protocol. Use postgresql:// or postgres://."
    );
  }

  if (parsed.hostname.toLowerCase() === "localhost") {
    parsed.hostname = "127.0.0.1";
  }

  return parsed.toString();
}

export function resolveDatabaseUrl(env: DatabaseEnv = process.env): string {
  const studioUrl = env.STUDIO_DATABASE_URL?.trim();
  const databaseUrl = env.DATABASE_URL?.trim();
  const selectedUrl = studioUrl || databaseUrl;

  if (!selectedUrl) {
    throw new Error(
      "Missing database URL: set STUDIO_DATABASE_URL (recommended) or DATABASE_URL."
    );
  }

  return normalizeDatabaseUrl(selectedUrl);
}

/**
 * Strip ssl-related query params for raw `pg` Client when TLS is negotiated via the `ssl` option.
 */
export function stripPgSslUrlOptions(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("uselibpqcompat");
    parsed.searchParams.delete("ssl");
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

export function shouldEnablePgSsl(connectionString: string): boolean {
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
    return SSL_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}
