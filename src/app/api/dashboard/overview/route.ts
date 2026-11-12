import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import {
  buildDashboardBi,
  type DashboardDfdRow,
  type DashboardItemRow,
  type DashboardLogRow,
} from "@/lib/dashboard-bi";

const ALL_ROLES = ["solicitante", "chefia", "admin", "superadmin"] as const;

function parseWindowMonths(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 12;
  return Math.max(3, Math.min(36, Math.trunc(parsed)));
}

function shiftMonths(date: Date, months: number) {
  const shifted = new Date(date);
  shifted.setUTCMonth(shifted.getUTCMonth() + months);
  return shifted;
}

async function fetchByDfdIds<T>({
  ids,
  fetchChunk,
}: {
  ids: string[];
  fetchChunk: (chunk: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>;
}) {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += 120) {
    const result = await fetchChunk(ids.slice(index, index + 120));
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data || []));
  }
  return rows;
}

export const GET = withAuthorizedRole(ALL_ROLES, async ({ request, role, supabase, user }) => {
  const windowMonths = parseWindowMonths(request.nextUrl.searchParams.get("window_months"));
  const since = shiftMonths(new Date(), -windowMonths).toISOString();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("campus_id,full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile?.campus_id) {
    return NextResponse.json(
      { error: "Seu perfil ainda não possui um campus definido." },
      { status: 422 },
    );
  }

  const campusId = String(profile.campus_id);
  const [
    campusResult,
    departmentsResult,
    laboratoriesResult,
    roomsResult,
    profilesResult,
  ] = await Promise.all([
    supabase.from("campi").select("id,nome,sigla").eq("id", campusId).maybeSingle(),
    supabase.from("departamentos").select("id,nome").eq("campus_id", campusId).eq("ativo", true),
    supabase.from("laboratorios").select("id,nome").eq("campus_id", campusId).eq("ativo", true),
    supabase
      .from("dfd_collective_rooms")
      .select("id,status,created_by,created_at,converted_at")
      .eq("campus_id", campusId)
      .gte("created_at", since),
    supabase.from("profiles").select("id", { count: "exact" }).eq("campus_id", campusId),
  ]);

  if (campusResult.error) throw campusResult.error;

  let dfdQuery = supabase
    .from("dfds")
    .select(
      "id,status,created_at,valor_total_estimado,unidade_id,analysis_unidade_id,tipo_unidade,analysis_tipo_unidade,origin_type,numero_protocolo,objeto_contratacao,prioridade",
    )
    .eq("campus_id", campusId)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (role === "solicitante") {
    dfdQuery = dfdQuery.eq("solicitante_id", user.id);
  }

  const { data: dfdRows, error: dfdError } = await dfdQuery;
  if (dfdError) throw dfdError;

  const dfds = (dfdRows || []) as DashboardDfdRow[];
  const dfdIds = dfds.map((row) => row.id);
  const [items, logs] = await Promise.all([
    fetchByDfdIds<DashboardItemRow>({
      ids: dfdIds,
      fetchChunk: async (chunk) => {
        const result = await supabase
          .from("dfd_items")
          .select(
            "dfd_id,quantidade,valor_unitario_estimado,codigo_item_efisco,codigo_tce,gnd,gnd_derivado,nome_grupo,nome_classe,requires_natureza_review",
          )
          .in("dfd_id", chunk);
        return result as typeof result & { data: DashboardItemRow[] | null };
      },
    }),
    fetchByDfdIds<DashboardLogRow>({
      ids: dfdIds,
      fetchChunk: async (chunk) => {
        const result = await supabase
          .from("dfd_logs")
          .select("dfd_id,action,created_at")
          .in("dfd_id", chunk)
          .order("created_at", { ascending: true });
        return result as typeof result & { data: DashboardLogRow[] | null };
      },
    }),
  ]);

  const unitNames = new Map<string, string>();
  for (const row of departmentsResult.data || []) unitNames.set(String(row.id), String(row.nome));
  for (const row of laboratoriesResult.data || []) unitNames.set(String(row.id), String(row.nome));

  const analytics = buildDashboardBi({ dfds, items, logs, unitNames });
  const rooms = roomsResult.data || [];
  const uniqueCreators = new Set(rooms.map((room) => String(room.created_by || "")).filter(Boolean));

  return NextResponse.json({
    scope: {
      campus_id: campusId,
      campus_name: campusResult.data?.nome || campusResult.data?.sigla || "Campus",
      campus_sigla: campusResult.data?.sigla || "",
      role,
      window_months: windowMonths,
      generated_at: new Date().toISOString(),
    },
    ...analytics,
    collaboration: {
      rooms: rooms.length,
      active_rooms: rooms.filter((room) => room.status === "aberta" || room.status === "em_revisao").length,
      converted_rooms: rooms.filter((room) => room.status === "convertida").length,
      unique_creators: uniqueCreators.size,
    },
    people: {
      campus_profiles: profilesResult.count || 0,
    },
  });
});
