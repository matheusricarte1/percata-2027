import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizeRole } from "@/lib/access";

type DfdRow = {
  id: string;
  numero_protocolo: string | null;
  status: string | null;
};

function sanitizeUuid(value: unknown) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text,
  )
    ? text
    : "";
}

function canFinalize(status: string) {
  return status === "triagem" || status === "aprovada" || status === "pactuando";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const role = normalizeRole(profile?.role, user.email);
    if (role !== "superadmin") {
      return NextResponse.json(
        { error: "Apenas superadmin pode finalizar PCA." },
        { status: 403 },
      );
    }

    const limited = await enforceRateLimit(
      request,
      { bucket: "dfd-finalize-pca", limit: 20, windowSec: 60 },
      user.id,
    );
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const dfdId = sanitizeUuid(body?.id);
    if (!dfdId) {
      return NextResponse.json({ error: "ID da DFD inválido." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: dfd, error: dfdError } = await admin
      .from("dfds")
      .select("id,numero_protocolo,status")
      .eq("id", dfdId)
      .maybeSingle();
    if (dfdError) throw dfdError;
    if (!dfd) {
      return NextResponse.json({ error: "DFD não encontrada." }, { status: 404 });
    }

    const record = dfd as DfdRow;
    const currentStatus = String(record.status || "").toLowerCase();
    if (currentStatus === "concluida") {
      return NextResponse.json({
        ok: true,
        id: record.id,
        status: "concluida",
        alreadyFinalized: true,
      });
    }

    if (!canFinalize(currentStatus)) {
      return NextResponse.json(
        {
          error:
            "Esta DFD ainda não pode ser finalizada no PCA. Envie para análise/homologação antes de concluir.",
        },
        { status: 409 },
      );
    }

    const { error: updateError } = await admin
      .from("dfds")
      .update({ status: "concluida" })
      .eq("id", record.id);
    if (updateError) throw updateError;

    const protocol =
      record.numero_protocolo || `DFD-${record.id.slice(0, 8).toUpperCase()}`;
    const { error: logError } = await admin.from("dfd_logs").insert({
      dfd_id: record.id,
      user_id: user.id,
      action: "pca_finalizada",
      details: `DFD ${protocol} finalizada no PCA por superadmin.`,
    });
    if (logError) throw logError;

    return NextResponse.json({
      ok: true,
      id: record.id,
      status: "concluida",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao finalizar PCA." },
      { status: 500 },
    );
  }
}
