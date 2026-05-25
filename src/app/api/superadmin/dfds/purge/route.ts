import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { SUPERADMIN_DFD_DELETE_STEPS } from "@/lib/superadmin-dfd-delete";

const CONFIRM_PHRASE = "APAGAR BASE DFD";

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

type DfdRow = {
  id: string;
  numero_protocolo: string | null;
};

function isLegacyLikeProtocol(value: string | null | undefined) {
  const protocol = String(value || "").trim().toUpperCase();
  return protocol.startsWith("LEGACY-") || protocol.startsWith("HIST-");
}

async function fetchPurgeCandidates(admin: any) {
  const { data, error } = await admin
    .from("dfds")
    .select("id,numero_protocolo")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data || []) as DfdRow[];
  const legacy = rows.filter((row) => isLegacyLikeProtocol(row.numero_protocolo));
  const purge = rows.filter((row) => !isLegacyLikeProtocol(row.numero_protocolo));
  return { purge, legacy };
}

export const GET = withAuthorizedRole(
  ["superadmin"],
  async ({ supabaseAdmin }) => {
    const admin = supabaseAdmin!;
    const { purge, legacy } = await fetchPurgeCandidates(admin);
    return NextResponse.json({
      ok: true,
      preview: {
        purgeCount: purge.length,
        legacyCount: legacy.length,
        samplePurgeProtocols: purge
          .slice(-5)
          .map((row) => String(row.numero_protocolo || "").trim())
          .filter(Boolean),
        sampleLegacyProtocols: legacy
          .slice(-5)
          .map((row) => String(row.numero_protocolo || "").trim())
          .filter(Boolean),
      },
      confirmationPhrase: CONFIRM_PHRASE,
      note: "A limpeza remove apenas DFDs da base atual e mantém registros legados.",
    });
  },
  { requireAdminClient: true },
);

export const POST = withAuthorizedRole(
  ["superadmin"],
  async ({ supabaseAdmin, request }) => {
    const admin = supabaseAdmin!;
    const body = await request.json().catch(() => ({}));
    const confirm = String(body?.confirm || "").trim().toUpperCase();

    if (confirm !== CONFIRM_PHRASE) {
      return NextResponse.json(
        {
          error: `Confirme digitando exatamente: ${CONFIRM_PHRASE}`,
        },
        { status: 409 },
      );
    }

    const { purge } = await fetchPurgeCandidates(admin);
    const ids = purge.map((row) => row.id).filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        deletedCount: 0,
        message: "Nenhuma DFD não legada encontrada para limpeza.",
      });
    }

    const chunkSize = 400;
    const chunks: string[][] = [];
    for (let index = 0; index < ids.length; index += chunkSize) {
      chunks.push(ids.slice(index, index + chunkSize));
    }

    const executedSteps = new Set<string>();

    for (const chunk of chunks) {
      for (const step of SUPERADMIN_DFD_DELETE_STEPS) {
        let result: { error: any } = { error: null };

        if (step.action === "delete") {
          result = await admin.from(step.table).delete().in(step.column, chunk);
        } else {
          const payload =
            step.table === "kits"
              ? { source_dfd_id: null, source_protocol: null }
              : { [step.column]: null };
          result = await admin.from(step.table).update(payload).in(step.column, chunk);
        }

        if (result.error) {
          if (step.optional && isIgnorableOptionalError(result.error)) continue;
          throw result.error;
        }
        executedSteps.add(`${step.action}:${step.table}`);
      }
    }

    return NextResponse.json({
      ok: true,
      deletedCount: ids.length,
      executedSteps: Array.from(executedSteps),
      message:
        "Base de DFDs atual removida com sucesso. Registros legados não foram alterados.",
    });
  },
  { requireAdminClient: true },
);

