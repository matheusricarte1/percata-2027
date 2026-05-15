import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { normalizeRole } from "@/lib/access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sanitizePlainText } from "@/lib/settings-sanitize";
import {
  ACCESS_LOCK_KEY,
  normalizeAccessLock,
} from "@/lib/system-access";

async function requireSuperadmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = normalizeRole(profile?.role, user.email);
  if (role !== "superadmin") return null;
  return user;
}

export async function GET() {
  try {
    const actor = await requireSuperadmin();
    if (!actor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao carregar bloqueio global." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperadmin();
    if (!actor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const lock = normalizeAccessLock({
      enabled: payload?.enabled === true,
      message: sanitizePlainText(payload?.message, 240),
    });

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("app_system_settings").upsert(
      {
        key: ACCESS_LOCK_KEY,
        value: lock,
        updated_by: actor.id,
      },
      { onConflict: "key" },
    );

    if (error) throw error;

    return NextResponse.json({ key: ACCESS_LOCK_KEY, value: lock });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao atualizar bloqueio global." },
      { status: 500 },
    );
  }
}
