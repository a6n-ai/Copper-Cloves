import { Client } from "pg";
import {
  resolveDatabaseUrl,
  shouldEnablePgSsl,
  stripPgSslUrlOptions,
} from "../src/lib/database-url";

async function main() {
  const connectionString = resolveDatabaseUrl();
  const useSsl = shouldEnablePgSsl(connectionString);
  const client = new Client({
    connectionString: stripPgSslUrlOptions(connectionString),
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  await client.connect();
  await client.end();
  console.log("Database connectivity check passed");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Database connectivity check failed", message);
  process.exit(1);
});
