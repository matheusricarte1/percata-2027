import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";

function sanitizeText(value: string | null, max = 80) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function parseLimit(value: string | null, fallback = 60, max = 120) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

export const GET = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin }) => {
    const admin = supabaseAdmin!;
    const searchParams = request.nextUrl.searchParams;
    const codigoClasse = sanitizeText(searchParams.get("codigo_classe"));
    const tipoObjeto = sanitizeText(searchParams.get("tipo_objeto"));
    const limit = parseLimit(searchParams.get("limit"));

    if (!codigoClasse || !tipoObjeto) {
      return NextResponse.json(
        { error: "codigo_classe e tipo_objeto são obrigatórios." },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from("catalogo_efisco_v2")
      .select(
        "id,codigo_efisco,descricao,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,codigo_natureza_preferencial,gnd_preferencial,natureza_count,has_missing_natureza,has_mixed_expense_classes",
      )
      .eq("codigo_classe", codigoClasse)
      .eq("tipo_objeto", tipoObjeto)
      .order("id", { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      items: data || [],
      hasMore: (data || []).length === limit,
    });
  },
  { requireAdminClient: true },
);
