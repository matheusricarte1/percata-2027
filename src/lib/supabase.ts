import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
let inFlightSafeUser: Promise<User | null> | null = null;

function isAuthLockRaceError(error: unknown): boolean {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return (
    message.includes("lock:sb-") &&
    message.includes("auth-token") &&
    (message.includes("stole it") || message.includes("released"))
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getSafeUser(
  retries = 2,
  baseDelayMs = 60,
): Promise<User | null> {
  if (inFlightSafeUser) {
    return inFlightSafeUser;
  }

  inFlightSafeUser = (async () => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await supabase.auth.getUser();
      if (!result.error) return result.data.user;
      if (!isAuthLockRaceError(result.error)) return result.data.user;
      lastError = result.error;
    } catch (error) {
      if (!isAuthLockRaceError(error)) throw error;
      lastError = error;
    }

    if (attempt < retries) {
      await sleep(baseDelayMs * (attempt + 1));
    }
  }

  try {
    const sessionResult = await supabase.auth.getSession();
    if (!sessionResult.error) return sessionResult.data.session?.user || null;
  } catch {}

  if (lastError) {
    console.warn("Supabase auth lock race detected; returning null user.", lastError);
  }
  return null;
  })();

  try {
    return await inFlightSafeUser;
  } finally {
    inFlightSafeUser = null;
  }
}
