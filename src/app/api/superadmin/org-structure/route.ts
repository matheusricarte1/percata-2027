import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isSuperadminEmail, normalizeRole } from "@/lib/access";
import {
  buildChefiaAssignmentMap,
  normalizeUnitType,
  type UnitReference,
} from "@/lib/org-structure-chefias";
import {
  normalizeComparableText,
  sanitizePlainText,
  sanitizeUuid,
} from "@/lib/settings-sanitize";

type ActionPayload =
  | {
      action: "upsert_department";
      id?: string;
      nome: string;
      campus_id: string;
    }
  | {
      action: "upsert_lab";
      id?: string;
      nome: string;
      campus_id?: string;
    }
  | {
      action: "toggle_department";
      id: string;
      ativo: boolean;
    }
  | {
      action: "toggle_lab";
      id: string;
      ativo: boolean;
    }
  | {
      action: "set_unit_chefia";
      unit_type: "departamento" | "laboratorio";
      unit_id: string;
      user_id?: string | null;
    }
  | {
      action: "seed_petrolina";
    };

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Variáveis Supabase de service role não configuradas.");
  }
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hasServiceCredentials() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function requireSuperadmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  if (isSuperadminEmail(user.email)) return user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (normalizeRole(profile?.role, user.email) !== "superadmin") {
    return null;
  }

  return user;
}

const PETROLINA_DEPARTAMENTOS = [
  "Planejamento / Administração / Compras",
  "Almoxarifado",
  "Patrimônio",
  "Aplicação – Direção e Coordenação",
  "Aplicação – Secretaria",
  "Biblioteca",
  "Colegiado de Biologia",
  "Colegiado de Enfermagem",
  "Colegiado de Fisioterapia",
  "Colegiado de Geografia",
  "Colegiado de História",
  "Colegiado de Letras Português/Inglês",
  "Colegiado de Letras Português/Espanhol",
  "Colegiado de Matemática",
  "Colegiado de Nutrição",
  "Colegiado de Pedagogia",
  "Controle Acadêmico / NAP",
  "Coordenação de Graduação",
  "Coordenação de Planejamento e Financeiro / Contabilidade",
  "Coordenação de Pós-Graduação, Pesquisa e Inovação",
  "Coordenação de Extensão e Cultura",
  "Escolaridade",
  "Diretoria – Diretora",
  "Diretoria – Vice-Diretora",
  "Diretoria – Secretaria",
  "Programas de Pós-Graduação Stricto Sensu",
  "Núcleo de Estágio",
  "Recepção / Atendimento",
  "Recursos Humanos",
  "Apoio Técnico aos Laboratórios",
  "Secretaria dos Colegiados",
  "NCTI",
];

const PETROLINA_LABS = [
  "Laboratório de Bioquímica",
  "Laboratório de Micorrizas Arbusculares",
  "Laboratório de Pesquisa em Saúde e Desempenho Funcional (LABSED)",
  "Laboratório de Pesquisa em Exercício – LAPEX",
  "Laboratório de Fisioterapia Cardiopulmonar (LAFIC)",
  "Laboratório de Línguas e Multiletramentos",
  "Laboratório de Ensino, Pesquisa e Extensão em Educação Alimentar e Nutricional (LEPEEAN)",
  "Laboratório de Micologia",
  "Laboratório de Física e Energias Renováveis",
  "Laboratório de Culturas Agrícolas e Caatinga do Submédio São Francisco (LACACSSF)",
  "Laboratório de Saúde Coletiva",
  "Laboratório de Pesquisa e Extensão em Vigilância Sanitária dos Alimentos",
  "Laboratório de Pesquisa em Saúde da Mulher (LAPESM)",
  "Laboratório Fisioterapia I",
  "Laboratório Fisioterapia II",
  "Laboratório Fisioterapia III",
  "Laboratório de Ensino, Pesquisa e Extensão de Avaliação do Estado Nutricional (LEPEAEN)",
  "Laboratório de Ciências Biológicas (LaBio)",
  "Laboratório de Geoprocessamento e Monitoramento Ambiental",
  "Laboratório de Ensino, Pesquisa e Extensão em Tecnologia de Alimentos e Alimentação Coletiva (LEPETAAC)",
  "Laboratório de Ensino, Pesquisa e Extensão em Anatomia e Patologia (LABAP)",
  "Laboratório de Ecologia e Conservação da Flora (LECFlora)",
  "Laboratório de Educação Matemática e Inclusão (LEPEEMI)",
  "Laboratório de Ecologia e Geologia",
  "Laboratório de Tecnologia Micorrízica (LTM)",
  "Laboratório de Microscopia",
  "Laboratório de Pesquisa em Biologia Molecular",
  "Laboratório de Ensino de Matemática da Universidade de Pernambuco (LEMUPE)",
  "Laboratório Integrado de Estudos em Geografia e Meio Ambiente (LIEGMA)",
  "Laboratório de Bioprospecção de Moléculas Bioativas (LPMBio)",
  "Laboratório de Microbiologia",
  "Laboratório de Psicologia e Educação (LaPsiE)",
  "Laboratório de Pesquisas em Desempenho Humano (LAPEDH)",
  "Laboratório de Pesquisa do Sistema Nervoso e Metabolismo (LPSN)",
  "Laboratório de Informática",
  "Laboratório de Extensão, Ensino e Pesquisa em História (LEEPHI)",
  "Laboratório de Biomecânica e Atividade Funcional Humana (LABIAFH)",
  "Laboratório de Ensino e Pesquisa em Análise de Alimentos (LEPAA)",
  "Laboratório Interdisciplinar de Formação de Educadores (LIFE)",
  "Laboratório 1 de Enfermagem",
  "Laboratório 2 de Enfermagem",
  "Laboratório 3 de Enfermagem",
];

async function fetchLaboratorios(service: ReturnType<typeof getServiceClient>) {
  const withCampus = await service
    .from("laboratorios")
    .select("id, nome, ativo, campus_id")
    .order("nome", { ascending: true });
  if (!withCampus.error) {
    return { data: withCampus.data || [], hasCampusId: true };
  }

  const withoutCampus = await service
    .from("laboratorios")
    .select("id, nome, ativo")
    .order("nome", { ascending: true });

  if (withoutCampus.error) {
    throw withoutCampus.error;
  }

  return {
    data: (withoutCampus.data || []).map((row: any) => ({
      ...row,
      campus_id: null,
    })),
    hasCampusId: false,
  };
}

async function fetchChefiaAssignments(
  service: ReturnType<typeof getServiceClient>,
  units: UnitReference[],
) {
  if (units.length === 0) return new Map<string, any>();

  const ids = units.map((unit) => unit.id);
  const { data, error } = await service
    .from("user_units")
    .select("unit_type, unit_id, user_id")
    .eq("role_in_unit", "chefia")
    .in("unit_id", ids);

  if (error) throw error;

  const userIds = Array.from(
    new Set((data || []).map((row: any) => row.user_id).filter(Boolean)),
  );
  if (userIds.length === 0) {
    return buildChefiaAssignmentMap(units, data || [], []);
  }

  const { data: profiles, error: profilesError } = await service
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  if (profilesError) throw profilesError;

  return buildChefiaAssignmentMap(units, data || [], profiles || []);
}

async function fetchChefiaOptions(
  service: ReturnType<typeof getServiceClient>,
  campusId: string | null,
) {
  let query = service
    .from("profiles")
    .select("id, full_name, email, role, campus_id")
    .order("full_name", { ascending: true });

  if (campusId) {
    query = query.or(
      `campus_id.eq.${campusId},role.eq.chefia,role.eq.admin,role.eq.superadmin`,
    );
  } else {
    query = query.in("role", ["chefia", "admin", "superadmin"]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireSuperadmin();
    if (!user) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const campusId = sanitizeUuid(request.nextUrl.searchParams.get("campusId"));
    const service = hasServiceCredentials() ? getServiceClient() : await createServerClient();

    const [campiResult, deptResult, labResult, chefiaOptions] = await Promise.all([
      service
        .from("campi")
        .select("id, nome, sigla, ativo")
        .eq("ativo", true)
        .order("nome", { ascending: true }),
      (async () => {
        let query = service
          .from("departamentos")
          .select("id, nome, campus_id, ativo")
          .order("nome", { ascending: true });
        if (campusId) query = query.eq("campus_id", campusId);
        const result = await query;
        if (result.error) throw result.error;
        return result.data || [];
      })(),
      fetchLaboratorios(service),
      fetchChefiaOptions(service, campusId),
    ]);

    if (campiResult.error) throw campiResult.error;

    const labs =
      campusId && labResult.hasCampusId
        ? labResult.data.filter((row: any) => row.campus_id === campusId)
        : labResult.data;
    const unitRows = [
      ...deptResult.map((row: any) => ({
        id: String(row.id),
        type: "departamento" as const,
      })),
      ...labs.map((row: any) => ({
        id: String(row.id),
        type: "laboratorio" as const,
      })),
    ];
    const chefias = await fetchChefiaAssignments(service, unitRows);
    const departamentos = deptResult.map((row: any) => ({
      ...row,
      chefia: chefias.get(`departamento:${row.id}`) || null,
    }));
    const laboratorios = labs.map((row: any) => ({
      ...row,
      chefia: chefias.get(`laboratorio:${row.id}`) || null,
    }));

    return NextResponse.json({
      campi: campiResult.data || [],
      departamentos,
      laboratorios,
      chefia_options: chefiaOptions,
      supports_lab_campus: labResult.hasCampusId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar estrutura." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSuperadmin();
    if (!user) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const payload = (await request.json()) as ActionPayload;
    if (!hasServiceCredentials()) {
      return NextResponse.json(
        { error: "Credenciais administrativas do Supabase não configuradas neste ambiente." },
        { status: 503 },
      );
    }
    const service = getServiceClient();

    if (payload.action === "upsert_department") {
      const nome = sanitizePlainText(payload.nome, 160);
      const campusId = sanitizeUuid(payload.campus_id);
      const id = sanitizeUuid(payload.id);
      if (!nome || !campusId) {
        return NextResponse.json(
          { error: "Nome e campus são obrigatórios para setor." },
          { status: 400 },
        );
      }

      if (payload.id && !id) {
        return NextResponse.json({ error: "ID do setor inválido." }, { status: 400 });
      }

      if (id) {
        const { error } = await service
          .from("departamentos")
          .update({ nome, campus_id: campusId, ativo: true })
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      const { data: existing, error: existingError } = await service
        .from("departamentos")
        .select("id, nome")
        .eq("campus_id", campusId);
      if (existingError) throw existingError;

      const alreadyExists = (existing || []).some(
        (row: any) => normalizeComparableText(row.nome) === normalizeComparableText(nome),
      );
      if (alreadyExists) {
        return NextResponse.json(
          { error: "Já existe um setor com este nome no campus selecionado." },
          { status: 409 },
        );
      }

      const { error } = await service.from("departamentos").insert({
        nome,
        campus_id: campusId,
        ativo: true,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (payload.action === "upsert_lab") {
      const nome = sanitizePlainText(payload.nome, 180);
      const id = sanitizeUuid(payload.id);
      const campusId = payload.campus_id ? sanitizeUuid(payload.campus_id) : "";
      if (!nome) {
        return NextResponse.json(
          { error: "Nome é obrigatório para laboratório." },
          { status: 400 },
        );
      }
      if (payload.id && !id) {
        return NextResponse.json({ error: "ID do laboratório inválido." }, { status: 400 });
      }
      if (payload.campus_id && !campusId) {
        return NextResponse.json({ error: "Campus do laboratório inválido." }, { status: 400 });
      }

      const labsMeta = await fetchLaboratorios(service);
      const hasCampus = labsMeta.hasCampusId;

      if (id) {
        const basePatch: Record<string, any> = { nome, ativo: true };
        if (hasCampus) {
          basePatch.campus_id = campusId || null;
        }
        const { error } = await service
          .from("laboratorios")
          .update(basePatch)
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      const existingRows = labsMeta.data.filter((row: any) => {
        if (!hasCampus) return true;
        return (row.campus_id || null) === (campusId || null);
      });
      const alreadyExists = existingRows.some(
        (row: any) => normalizeComparableText(row.nome) === normalizeComparableText(nome),
      );
      if (alreadyExists) {
        return NextResponse.json(
          { error: "Já existe um laboratório com este nome no escopo selecionado." },
          { status: 409 },
        );
      }

      const insertPayload: Record<string, any> = { nome, ativo: true };
      if (hasCampus) {
        insertPayload.campus_id = campusId || null;
      }
      const { error } = await service.from("laboratorios").insert(insertPayload);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (payload.action === "toggle_department") {
      const id = sanitizeUuid(payload.id);
      if (!id) return NextResponse.json({ error: "ID do setor inválido." }, { status: 400 });
      const { error } = await service
        .from("departamentos")
        .update({ ativo: Boolean(payload.ativo) })
        .eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (payload.action === "toggle_lab") {
      const id = sanitizeUuid(payload.id);
      if (!id) return NextResponse.json({ error: "ID do laboratório inválido." }, { status: 400 });
      const { error } = await service
        .from("laboratorios")
        .update({ ativo: Boolean(payload.ativo) })
        .eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (payload.action === "set_unit_chefia") {
      const unitType = normalizeUnitType(payload.unit_type);
      const unitId = sanitizeUuid(payload.unit_id);
      const userId = payload.user_id ? sanitizeUuid(payload.user_id) : null;

      if (!unitId) {
        return NextResponse.json(
          { error: "Unidade é obrigatória para definir chefia." },
          { status: 400 },
        );
      }
      if (payload.user_id && !userId) {
        return NextResponse.json(
          { error: "Usuário informado para chefia é inválido." },
          { status: 400 },
        );
      }

      if (userId) {
        const { data: profile, error: profileError } = await service
          .from("profiles")
          .select("id, role")
          .eq("id", userId)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.id) {
          return NextResponse.json(
            { error: "Usuário selecionado não encontrado." },
            { status: 404 },
          );
        }

        if (!["chefia", "admin", "superadmin"].includes(String(profile.role))) {
          const { error } = await service
            .from("profiles")
            .update({ role: "chefia" })
            .eq("id", userId);
          if (error) throw error;
        }
      }

      const { error: deleteError } = await service
        .from("user_units")
        .delete()
        .eq("unit_type", unitType)
        .eq("unit_id", unitId)
        .eq("role_in_unit", "chefia");
      if (deleteError) throw deleteError;

      if (userId) {
        const { error: insertError } = await service
          .from("user_units")
          .upsert(
            {
              user_id: userId,
              unit_type: unitType,
              unit_id: unitId,
              role_in_unit: "chefia",
            },
            { onConflict: "user_id,unit_type,unit_id" },
          );
        if (insertError) throw insertError;
      }

      return NextResponse.json({ ok: true });
    }

    if (payload.action === "seed_petrolina") {
      const { data: campi, error: campiError } = await service
        .from("campi")
        .select("id, nome, sigla");
      if (campiError) throw campiError;

      const petrolina = (campi || []).find((campus: any) => {
        const nome = String(campus.nome || "").toLocaleLowerCase("pt-BR");
        const sigla = String(campus.sigla || "").toLocaleLowerCase("pt-BR");
        return nome.includes("petrolina") || sigla.includes("petrolina");
      });

      if (!petrolina?.id) {
        return NextResponse.json(
          { error: "Campus Petrolina não encontrado na tabela campi." },
          { status: 400 },
        );
      }

      const [deptResult, labsMeta] = await Promise.all([
        service
          .from("departamentos")
          .select("id, nome, campus_id")
          .eq("campus_id", petrolina.id),
        fetchLaboratorios(service),
      ]);
      if (deptResult.error) throw deptResult.error;

      const deptExisting = new Set(
        (deptResult.data || []).map((row: any) => normalizeComparableText(row.nome)),
      );
      const labsExisting = new Set(
        labsMeta.data
          .filter((row: any) =>
            labsMeta.hasCampusId ? row.campus_id === petrolina.id : true,
          )
          .map((row: any) => normalizeComparableText(row.nome)),
      );

      const deptToInsert = PETROLINA_DEPARTAMENTOS.filter(
        (name) => !deptExisting.has(normalizeComparableText(name)),
      ).map((name) => ({
        nome: name,
        campus_id: petrolina.id,
        ativo: true,
      }));

      const labsToInsert = PETROLINA_LABS.filter(
        (name) => !labsExisting.has(normalizeComparableText(name)),
      ).map((name) => {
        const row: Record<string, any> = { nome: name, ativo: true };
        if (labsMeta.hasCampusId) {
          row.campus_id = petrolina.id;
        }
        return row;
      });

      if (deptToInsert.length > 0) {
        const { error } = await service.from("departamentos").insert(deptToInsert);
        if (error) throw error;
      }

      if (labsToInsert.length > 0) {
        const { error } = await service.from("laboratorios").insert(labsToInsert);
        if (error) throw error;
      }

      return NextResponse.json({
        ok: true,
        campus: petrolina.nome,
        departamentos_inseridos: deptToInsert.length,
        laboratorios_inseridos: labsToInsert.length,
      });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao persistir estrutura." },
      { status: 500 },
    );
  }
}
