import { NextResponse } from "next/server";
import { sanitizePlainText } from "@/lib/settings-sanitize";
import {
  ACCESS_LOCK_KEY,
  normalizeAccessLock,
} from "@/lib/system-access";
import { withAuthorizedRole } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const GET = withAuthorizedRole(
  ["superadmin"],
  async ({ supabaseAdmin }) => {
    const admin = supabaseAdmin!;
    const { data, error } = await admin
      .from("app_system_settings")
      .select("value,updated_at")
      .eq("key", ACCESS_LOCK_KEY)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      key: ACCESS_LOCK_KEY,
      value: normalizeAccessLock(data?.value),
      updated_at: data?.updated_at || null,
    });
  },
  { requireAdminClient: true },
);

export const POST = withAuthorizedRole(
  ["superadmin"],
  async ({ request, supabaseAdmin, user }) => {
    // Bloqueio global é evento de alto impacto — 6/min é mais que suficiente
    // para reverter um lock acidental, e barra script malicioso fechando
    // o sistema em loop.
    const limited = await enforceRateLimit(
      request,
      { bucket: "access-lock", limit: 6, windowSec: 60 },
      user.id,
    );
    if (limited) return limited;

    const admin = supabaseAdmin!;
    const payload = await request.json().catch(() => ({}));
    const lock = normalizeAccessLock({
      enabled: payload?.enabled === true,
      message: sanitizePlainText(payload?.message, 240),
    });

    const { error } = await admin.from("app_system_settings").upsert(
      {
        key: ACCESS_LOCK_KEY,
        value: lock,
        updated_by: user.id,
      },
      { onConflict: "key" },
    );

    if (error) throw error;

    return NextResponse.json({ key: ACCESS_LOCK_KEY, value: lock });
  },
  { requireAdminClient: true },
);
