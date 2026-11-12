import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvFile(path) {
  try {
    const content = readFileSync(path, "utf8");
    const env = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      let value = rest.join("=").trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key.trim()] = value;
    }
    return env;
  } catch {
    return {};
  }
}

export function loadDatabaseConfig() {
  const envFile = parseEnvFile(resolve(process.cwd(), ".env.local"));
  const env = { ...envFile, ...process.env };

  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const password = env.SUPABASE_DB_PASSWORD;
  if (!supabaseUrl || !password) {
    throw new Error(
      "Defina DATABASE_URL ou NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD.",
    );
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const passwordEncoded = encodeURIComponent(password);
  return {
    connectionString: `postgresql://postgres:${passwordEncoded}@db.${projectRef}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  };
}
