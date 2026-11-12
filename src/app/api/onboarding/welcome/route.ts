import { NextRequest, NextResponse } from "next/server";
import { buildOnboardingWelcomeNotification } from "@/lib/email";
import { createSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase-admin";
import { toPublicSiteUrl } from "@/lib/site-url";
import { createClient } from "@/utils/supabase/server";

/**
 * Persiste a primeira comunicação após o usuário concluir campus e vínculos.
 * O endpoint pode ser chamado novamente após uma recarga sem repetir o e-mail.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  }
  if (!hasSupabaseAdminCredentials()) {
    return NextResponse.json(
      { error: "Serviço de notificações institucionais indisponível." },
      { status: 503 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name, campus_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.campus_id) {
    return NextResponse.json(
      { error: "Conclua a seleção de campus antes de ativar o acesso." },
      { status: 409 },
    );
  }

  const { data: membership, error: membershipError } = await admin
    .from("user_units")
    .select("user_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) {
    return NextResponse.json(
      { error: "Conclua a seleção de unidade antes de ativar o acesso." },
      { status: 409 },
    );
  }

  const { data: previous, error: previousError } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", user.id)
    .eq("title", "Seu acesso institucional está pronto")
    .limit(1)
    .maybeSingle();
  if (previousError) throw previousError;
  if (previous) {
    return NextResponse.json({ ok: true, alreadySent: true });
  }

  const { data: campus, error: campusError } = await admin
    .from("campi")
    .select("nome")
    .eq("id", profile.campus_id)
    .maybeSingle();
  if (campusError) throw campusError;

  const notification = buildOnboardingWelcomeNotification({
    userId: user.id,
    fullName: profile.full_name || user.user_metadata?.full_name || user.email,
    campusName: campus?.nome || null,
    actionUrl: toPublicSiteUrl("/dashboard", request.nextUrl.origin).toString(),
  });
  const { error: insertError } = await admin.from("notifications").insert(notification);
  if (insertError) throw insertError;

  return NextResponse.json({ ok: true, alreadySent: false }, { status: 201 });
}
