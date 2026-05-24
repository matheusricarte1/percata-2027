import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminCredentials,
} from "@/lib/supabase-admin";
import { getEmailProviderStatus } from "@/lib/email";

/**
 * Healthcheck público. Não retorna informação sensível — apenas:
 *   - status overall: ok | degraded
 *   - checks individuais: db, db_admin, email, audit_log, rate_limit_backend
 *   - build/commit (se VERCEL_GIT_COMMIT_SHA disponível)
 *
 * Uso:
 *   - Uptime monitors (StatusCake, BetterStack, etc.) batem GET /api/health.
 *   - `200 ok` = tudo funcionando. `200 degraded` = subset com falha mas
 *     sistema utilizável. `500` = falha total.
 *   - Vercel cron pode usar este endpoint como warmup.
 *
 * Por que não 503 quando degraded: queremos diferenciar "fora do ar"
 * (load balancer remove) de "parcialmente operante" (continua servindo).
 */

export const dynamic = "force-dynamic";

type Check = {
  ok: boolean;
  latency_ms?: number;
  reason?: string;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}

export async function GET() {
  const checks: Record<string, Check> = {};

  // ============ db (anon, RLS) ============
  try {
    const { value, ms } = await timed(async () => {
      const supabase = await createClient();
      // Query barata que apenas valida conectividade. SELECT 1 não passa
      // pelo PostgREST diretamente, então usamos uma tabela pública pequena.
      const { error } = await supabase
        .from("profiles")
        .select("id")
        .limit(1);
      if (error && !/permission denied|policy/i.test(error.message)) {
        throw error;
      }
      return true;
    });
    checks.db = { ok: value, latency_ms: ms };
  } catch (err: any) {
    checks.db = { ok: false, reason: String(err?.message || err).slice(0, 200) };
  }

  // ============ db_admin (service role) ============
  if (hasSupabaseAdminCredentials()) {
    try {
      const { ms } = await timed(async () => {
        const admin = createSupabaseAdminClient();
        const { error } = await admin
          .from("profiles")
          .select("id")
          .limit(1);
        if (error) throw error;
      });
      checks.db_admin = { ok: true, latency_ms: ms };
    } catch (err: any) {
      checks.db_admin = {
        ok: false,
        reason: String(err?.message || err).slice(0, 200),
      };
    }
  } else {
    checks.db_admin = {
      ok: false,
      reason: "SUPABASE_SERVICE_ROLE_KEY ausente",
    };
  }

  // ============ audit_log (existência da tabela; barato) ============
  if (hasSupabaseAdminCredentials()) {
    try {
      const admin = createSupabaseAdminClient();
      const { error } = await admin
        .from("audit_log")
        .select("id")
        .limit(1);
      checks.audit_log = error
        ? { ok: false, reason: error.message.slice(0, 200) }
        : { ok: true };
    } catch (err: any) {
      checks.audit_log = {
        ok: false,
        reason: String(err?.message || err).slice(0, 200),
      };
    }
  }

  // ============ email provider configurado ============
  const provider = getEmailProviderStatus();
  checks.email = {
    ok: provider.configured,
    reason: provider.configured ? undefined : provider.reason,
  };

  // ============ rate_limit_backend ============
  checks.rate_limit_backend = {
    ok: true,
    reason: process.env.UPSTASH_REDIS_REST_URL
      ? "upstash"
      : "in-memory (fallback; não compartilhado entre instâncias)",
  };

  // ============ overall ============
  // db e db_admin são críticos. Email/rate_limit podem estar degraded.
  const criticalOk = checks.db?.ok && checks.db_admin?.ok;
  const allOk = Object.values(checks).every((c) => c.ok);
  const status = criticalOk ? (allOk ? "ok" : "degraded") : "down";

  return NextResponse.json(
    {
      status,
      checks,
      build: {
        commit:
          process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
          process.env.GIT_SHA?.slice(0, 7) ||
          null,
        env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      },
      timestamp: new Date().toISOString(),
    },
    { status: status === "down" ? 503 : 200 },
  );
}
