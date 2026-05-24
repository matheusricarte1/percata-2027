import "server-only";

import { NextRequest, NextResponse } from "next/server";

/**
 * Rate limiting com janela deslizante (fixed window por simplicidade).
 *
 * Estratégia em camadas:
 *   1. Se UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN estão setados,
 *      usa Upstash Redis via REST API (free tier: 10k commands/dia).
 *      Funciona corretamente em Vercel multi-region serverless.
 *   2. Caso contrário, fallback in-memory por instância do processo.
 *      Em ambiente serverless, isso significa: cada cold start zera o
 *      contador. É um best-effort, não impede um atacante motivado, mas
 *      protege contra loops acidentais e bursts comuns.
 *
 * Sem dependência nova: usa fetch nativo.
 */

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  limit: number;
  resetMs: number; // epoch ms em que a janela atual reseta
};

type RateLimitOptions = {
  /** Identificador único da rota/operação (compõe a chave). */
  bucket: string;
  /** Máximo de chamadas permitidas na janela. */
  limit: number;
  /** Duração da janela em segundos. */
  windowSec: number;
  /**
   * Chave do solicitante. Default: userId (se autenticado) || IP.
   * Pode ser sobrescrito para limites por recurso (ex.: por DFD).
   */
  identifier?: string;
};

// =======================
// Fallback in-memory
// =======================
type MemoryBucket = { count: number; resetMs: number };
const memoryStore = new Map<string, MemoryBucket>();
// Limpa entradas vencidas a cada chamada (amortizado O(1) por inserção).
function pruneMemory(now: number) {
  if (memoryStore.size < 1024) return;
  for (const [k, v] of memoryStore) {
    if (v.resetMs <= now) memoryStore.delete(k);
  }
}

function memoryCheck(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  pruneMemory(now);
  const entry = memoryStore.get(key);
  if (!entry || entry.resetMs <= now) {
    const resetMs = now + windowMs;
    memoryStore.set(key, { count: 1, resetMs });
    return { ok: true, remaining: limit - 1, limit, resetMs };
  }
  entry.count += 1;
  const ok = entry.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - entry.count),
    limit,
    resetMs: entry.resetMs,
  };
}

// =======================
// Upstash REST
// =======================
function upstashConfigured(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function upstashCheck(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const cfg = upstashConfigured();
  if (!cfg) {
    // Não deveria chamar aqui se não configurado.
    return memoryCheck(key, limit, windowSec * 1000);
  }

  // Pipeline: INCR + EXPIRE (NX) — atômico no Redis.
  // Documentação Upstash REST: https://upstash.com/docs/redis/features/restapi
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(windowSec), "NX"],
        ["PTTL", key],
      ]),
      // Importante em Vercel Edge / Node serverless.
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(
        "rate-limit: Upstash respondeu",
        res.status,
        await res.text().catch(() => ""),
      );
      return memoryCheck(key, limit, windowSec * 1000);
    }

    const body = (await res.json()) as Array<{ result?: any; error?: string }>;
    const count = Number(body?.[0]?.result || 0);
    const pttl = Number(body?.[2]?.result || windowSec * 1000);
    const resetMs = Date.now() + (pttl > 0 ? pttl : windowSec * 1000);

    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      resetMs,
    };
  } catch (err) {
    console.warn("rate-limit: falha no Upstash, fallback memory.", err);
    return memoryCheck(key, limit, windowSec * 1000);
  }
}

// =======================
// API pública
// =======================

export function getRequestIdentifier(
  request: NextRequest,
  userId?: string | null,
): string {
  if (userId) return `u:${userId}`;
  const fwd = request.headers.get("x-forwarded-for") || "";
  const ip =
    fwd.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "anon";
  return `ip:${ip}`;
}

export async function checkRateLimit(
  request: NextRequest,
  opts: RateLimitOptions,
  userId?: string | null,
): Promise<RateLimitResult> {
  const id = opts.identifier || getRequestIdentifier(request, userId);
  const key = `rl:${opts.bucket}:${id}`;

  if (upstashConfigured()) {
    return upstashCheck(key, opts.limit, opts.windowSec);
  }
  return memoryCheck(key, opts.limit, opts.windowSec * 1000);
}

/**
 * Aplica headers padrão de rate limit a uma response (RFC 6585 / draft IETF).
 */
export function withRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(result.resetMs / 1000)),
  );
  if (!result.ok) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((result.resetMs - Date.now()) / 1000),
    );
    response.headers.set("Retry-After", String(retryAfterSec));
  }
  return response;
}

/**
 * Helper para curto-circuitar: se exceder, retorna 429 já formatada.
 * Use no início do handler:
 *
 *   const limited = await enforceRateLimit(request, { bucket: "invite", limit: 10, windowSec: 60 }, user.id);
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  request: NextRequest,
  opts: RateLimitOptions,
  userId?: string | null,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(request, opts, userId);
  if (result.ok) return null;
  const response = NextResponse.json(
    {
      error: "Muitas requisições. Tente novamente em instantes.",
      retryAfterSec: Math.max(
        1,
        Math.ceil((result.resetMs - Date.now()) / 1000),
      ),
    },
    { status: 429 },
  );
  return withRateLimitHeaders(response, result);
}
