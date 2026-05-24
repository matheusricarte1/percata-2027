import { NextResponse } from "next/server";
import {
  isDfdDeleteConfirmationValid,
  SUPERADMIN_DFD_DELETE_STEPS,
} from "@/lib/superadmin-dfd-delete";
import { withAuthorizedRole } from "@/lib/api-auth";

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

export const DELETE = withAuthorizedRole(
  ["superadmin"],
  async ({ request, supabaseAdmin }) => {
    const admin = supabaseAdmin!;
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    const confirmProtocol = String(body?.confirmProtocol || "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "Informe o id da DFD." },
        { status: 400 },
      );
    }

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

    // A trilha de exclusão é capturada pela migration 0039 (audit_log)
    // via trigger AFTER DELETE em dfds/dfd_items/dfd_logs etc.
    return NextResponse.json({
      ok: true,
      deleted: {
        id: dfd.id,
        numero_protocolo: dfd.numero_protocolo,
        objeto_contratacao: dfd.objeto_contratacao,
      },
      executed,
    });
  },
  { requireAdminClient: true },
);
