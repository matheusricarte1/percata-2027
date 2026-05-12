import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase-admin";
import { isSuperadminEmail, normalizeRole } from "@/lib/access";
import {
  isDfdDeleteConfirmationValid,
  SUPERADMIN_DFD_DELETE_STEPS,
} from "@/lib/superadmin-dfd-delete";

async function requireSuperadmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return null;

  if (isSuperadminEmail(user.email)) return user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (normalizeRole(profile?.role, user.email) !== "superadmin") return null;
  return user;
}

function isIgnorableOptionalError(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("column") ||
    message.includes("relationship")
  );
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await requireSuperadmin();
    if (!actor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    if (!hasSupabaseAdminCredentials()) {
      return NextResponse.json(
        { error: "Credenciais administrativas do Supabase não configuradas." },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    const confirmProtocol = String(body?.confirmProtocol || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Informe o id da DFD." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: dfd, error: dfdError } = await admin
      .from("dfds")
      .select("id,numero_protocolo,objeto_contratacao")
      .eq("id", id)
      .maybeSingle();

    if (dfdError) throw dfdError;
    if (!dfd) {
      return NextResponse.json({ error: "DFD não encontrada." }, { status: 404 });
    }

    if (!isDfdDeleteConfirmationValid(confirmProtocol, dfd.numero_protocolo)) {
      return NextResponse.json(
        { error: "Confirme digitando exatamente o protocolo da DFD." },
        { status: 409 },
      );
    }

    const executed: string[] = [];

    for (const step of SUPERADMIN_DFD_DELETE_STEPS) {
      let result: { error: any } = { error: null };

      if (step.action === "delete") {
        result = await admin.from(step.table).delete().eq(step.column, id);
      } else {
        const payload =
          step.table === "kits"
            ? { source_dfd_id: null, source_protocol: null }
            : { [step.column]: null };
        result = await admin.from(step.table).update(payload).eq(step.column, id);
      }

      if (result.error) {
        if (step.optional && isIgnorableOptionalError(result.error)) continue;
        throw result.error;
      }

      executed.push(`${step.action}:${step.table}`);
    }

    return NextResponse.json({
      ok: true,
      deleted: {
        id: dfd.id,
        numero_protocolo: dfd.numero_protocolo,
        objeto_contratacao: dfd.objeto_contratacao,
      },
      executed,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao excluir DFD." },
      { status: 500 },
    );
  }
}
