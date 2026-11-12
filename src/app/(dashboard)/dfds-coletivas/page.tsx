"use client";

import Link from "next/link";
import { CollectiveRoomDeleteButton } from "@/components/collective/CollectiveRoomDeleteButton";
import { useSearchParams } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight } from "@/components/icons/phosphor/exports/ArrowRight";
import { Buildings } from "@/components/icons/phosphor/exports/Buildings";
import { CalendarBlank } from "@/components/icons/phosphor/exports/CalendarBlank";
import { CaretLeft } from "@/components/icons/phosphor/exports/CaretLeft";
import { CaretRight } from "@/components/icons/phosphor/exports/CaretRight";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { Circle } from "@/components/icons/phosphor/exports/Circle";
import { CircleNotch } from "@/components/icons/phosphor/exports/CircleNotch";
import { ClipboardText } from "@/components/icons/phosphor/exports/ClipboardText";
import { DownloadSimple } from "@/components/icons/phosphor/exports/DownloadSimple";
import { Eye } from "@/components/icons/phosphor/exports/Eye";
import { Funnel } from "@/components/icons/phosphor/exports/Funnel";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
import { Package } from "@/components/icons/phosphor/exports/Package";
import { PaperPlaneTilt } from "@/components/icons/phosphor/exports/PaperPlaneTilt";
import { Plus } from "@/components/icons/phosphor/exports/Plus";
import { Sparkle } from "@/components/icons/phosphor/exports/Sparkle";
import { Target } from "@/components/icons/phosphor/exports/Target";
import { UploadSimple } from "@/components/icons/phosphor/exports/UploadSimple";
import { UsersThree } from "@/components/icons/phosphor/exports/UsersThree";
import { WarningCircle } from "@/components/icons/phosphor/exports/WarningCircle";
import { X } from "@/components/icons/phosphor/exports/X";
import { getSafeUser, supabase } from "@/lib/supabase";
import { fetchActiveCycleYear } from "@/lib/cycle";
import { cn } from "@/lib/utils";
import {
  getFriendlyErrorMessage,
  UX_SUCCESS,
  UX_WARNING,
} from "@/lib/ux-feedback";
import {
  OperationalAccordion,
  OperationalChip,
  OperationalEmptyState,
  OperationalKpiCard,
  OperationalStepper,
  OperationalTimeline,
  type OperationalTone,
} from "@/components/ui/operational";
import { MechanicalValue } from "@/components/ui/MechanicalValue";
import {
  sanitizePlanningSubsidies,
  type DfdPlanningSubsidies,
} from "@/lib/dfd-planning";
import { AvatarStack, type AvatarStackMember } from "@/components/user/AvatarStack";

type UnitOption = {
  unit_id: string;
  unit_type: "departamento" | "laboratorio";
  nome: string;
  role_in_unit: string | null;
};

type RoomListItem = {
  id: string;
  title: string;
  description: string | null;
  scope: string | null;
  status:
    | "proposta"
    | "aberta"
    | "em_consolidacao_chefia"
    | "pronta_para_conversao"
    | "convertida"
    | "arquivada";
  unit_id: string;
  unit_type: "departamento" | "laboratorio";
  unit_name: string;
  actor_role?: "membro" | "chefia" | "admin" | "superadmin";
  updated_at: string;
  summary?: {
    participantCount: number;
    itemCount: number;
    totalQuantity: number;
    totalValue: number;
    userHasContributed: boolean;
  };
  planning_subsidies?: DfdPlanningSubsidies | null;
};

type AttachmentRef = {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: string;
  addedBy: string;
  url: string;
};

type AuthUserSummary = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string | null;
  unitLabel: string;
};

type CollectiveFormOptions = {
  categories: string[];
  supportMarkers: string[];
  beneficiaries: string[];
  requirements: string[];
  alternatives: string[];
};

type CollectiveRoomDraft = {
  title: string;
  status:
    | "rascunho"
    | "aguardando_validacao_chefia"
    | "publicada_para_contribuicoes"
    | "em_contribuicao"
    | "contribuicoes_encerradas"
    | "consolidada"
    | "dfd_gerada"
    | "arquivada"
    | "cancelada";
  selectedUnitKeys: string[];
  category: string;
  responsibleUserId: string;
  responsibleName: string;
  briefDescription: string;
  plannedDate: string;
  description: string;
  supportMarkers: string[];
  beneficiaries: string[];
  impactExpected: string;
  entryCriteria: string[];
  exclusionCriteria: string[];
  contributionGuidance: string;
  planningProblem: string;
  planningBeneficiaries: string[];
  planningExpectedResult: string;
  planningRequirements: string[];
  planningRestrictions: string;
  planningAlternatives: string[];
  planningAlternativesReason: string;
  planningNotes: string;
  planningReferences: AttachmentRef[];
};

type ResponsibleOption = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  unitLabel: string;
};

const STATUS_LABELS: Record<RoomListItem["status"], string> = {
  proposta: "Proposta",
  aberta: "Aberta",
  em_consolidacao_chefia: "Consolidação da chefia",
  pronta_para_conversao: "Pronta para conversão",
  convertida: "Convertida",
  arquivada: "Arquivada",
};

const CREATION_STATUS_LABELS: Record<CollectiveRoomDraft["status"], string> = {
  rascunho: "Rascunho",
  aguardando_validacao_chefia: "Aguardando validação da chefia",
  publicada_para_contribuicoes: "Publicada para contribuições",
  em_contribuicao: "Em contribuição",
  contribuicoes_encerradas: "Contribuições encerradas",
  consolidada: "Consolidada",
  dfd_gerada: "DFD gerada",
  arquivada: "Arquivada",
  cancelada: "Cancelada",
};

const PAGE_SIZE = 6;
const REQUIRE_SCOPE_GUIDANCE = true;

const WIZARD_STEPS = [
  { id: "identity", label: "Identidade", icon: ClipboardText },
  { id: "justification", label: "Justificativa", icon: Target },
  { id: "scope", label: "Escopo", icon: Funnel },
  { id: "planning", label: "Diagnóstico da demanda", icon: Sparkle },
  { id: "review", label: "Revisão", icon: CheckCircle },
] as const;

const EMPTY_FORM_OPTIONS: CollectiveFormOptions = {
  categories: [],
  supportMarkers: [],
  beneficiaries: [],
  requirements: [],
  alternatives: [],
};

const CONTEXTUAL_MODEL_OPTIONS: CollectiveFormOptions = {
  categories: [
    "Laboratórios de ensino",
    "Salas de aula e multimídia",
    "Infraestrutura acadêmica",
    "Tecnologia educacional",
    "Apoio estudantil",
  ],
  supportMarkers: [
    "Reposição de itens essenciais para aulas",
    "Equipamento obsoleto em laboratório",
    "Demanda recorrente entre cursos",
    "Ampliação de atendimento em Petrolina",
    "Ampliação de atendimento em Ouricuri",
    "Adequação normativa de segurança",
    "Risco de interrupção de atividade acadêmica",
    "Melhoria operacional do setor",
  ],
  beneficiaries: [
    "Docentes de Petrolina",
    "Docentes de Ouricuri",
    "Discentes (graduação)",
    "Discentes (técnico integrado)",
    "Laboratórios de Química",
    "Laboratórios de Informática",
    "Setores administrativos",
    "Turmas práticas",
  ],
  requirements: [
    "Compatível com infraestrutura existente",
    "Garantia e assistência técnica local",
    "Instalação incluída",
    "Durabilidade para uso intensivo",
    "Treinamento de uso para equipe",
  ],
  alternatives: [
    "Reaproveitamento interno",
    "Consulta ao almoxarifado",
    "Manutenção corretiva",
    "Remanejamento entre campi",
    "Solução temporária",
    "Outra alternativa",
  ],
};

type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];
type StepVisualState = "current" | "completed" | "pending" | "error" | "optional" | "recommended";

function makeEmptyDraft(params?: {
  unitKey?: string;
  responsibleUserId?: string;
  responsibleName?: string;
}): CollectiveRoomDraft {
  return {
    title: "",
    status: "rascunho",
    selectedUnitKeys: params?.unitKey ? [params.unitKey] : [],
    category: "",
    responsibleUserId: params?.responsibleUserId || "",
    responsibleName: params?.responsibleName || "",
    briefDescription: "",
    plannedDate: "",
    description: "",
    supportMarkers: [],
    beneficiaries: [],
    impactExpected: "",
    entryCriteria: [],
    exclusionCriteria: [],
    contributionGuidance: "",
    planningProblem: "",
    planningBeneficiaries: [],
    planningExpectedResult: "",
    planningRequirements: [],
    planningRestrictions: "",
    planningAlternatives: [],
    planningAlternativesReason: "",
    planningNotes: "",
    planningReferences: [],
  };
}

function mergeOptions(configured: string[], fallback: string[]) {
  return Array.from(new Set([...(configured || []), ...(fallback || [])]));
}

export default function DfdsColetivasPage() {
  const searchParams = useSearchParams();
  const routeRequestsRooms = searchParams.get("view") === "rooms";
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [viewer, setViewer] = useState<AuthUserSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("operacionais");
  const [search, setSearch] = useState("");
  const [cycleYear, setCycleYear] = useState(new Date().getFullYear());
  const [page, setPage] = useState(1);
  const [creationMode, setCreationMode] = useState<"rooms" | "quick" | "wizard">(routeRequestsRooms ? "rooms" : "wizard");
  const [wizardStep, setWizardStep] = useState<WizardStepId>("identity");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [formOptions, setFormOptions] = useState<CollectiveFormOptions>(EMPTY_FORM_OPTIONS);
  const [responsibleOptions, setResponsibleOptions] = useState<ResponsibleOption[]>([]);
  const [draft, setDraft] = useState<CollectiveRoomDraft>(makeEmptyDraft());

  const loadViewer = useCallback(async () => {
    const user = await getSafeUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,full_name,email,avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    setViewer({
      id: user.id,
      fullName: String(profile?.full_name || user.user_metadata?.full_name || user.email || "Usuário"),
      avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || null,
      email: profile?.email || user.email || null,
      unitLabel: "",
    });
    setDraft((current) => ({
      ...current,
      responsibleUserId: current.responsibleUserId || user.id,
      responsibleName:
        current.responsibleName ||
        String(profile?.full_name || user.user_metadata?.full_name || user.email || "Usuário"),
    }));
  }, []);

  const loadUnits = useCallback(async () => {
    const user = await getSafeUser();
    if (!user) return;
    const { data: links, error } = await supabase
      .from("user_units")
      .select("unit_id,unit_type,role_in_unit")
      .eq("user_id", user.id);
    if (error) throw error;

    const rows = (links || []) as Array<{
      unit_id: string;
      unit_type: "departamento" | "laboratorio";
      role_in_unit: string | null;
    }>;

    const deptIds = rows
      .filter((row) => row.unit_type === "departamento")
      .map((row) => row.unit_id);
    const labIds = rows
      .filter((row) => row.unit_type === "laboratorio")
      .map((row) => row.unit_id);

    const [deptResult, labResult] = await Promise.all([
      deptIds.length
        ? supabase.from("departamentos").select("id,nome").in("id", deptIds)
        : Promise.resolve({ data: [], error: null }),
      labIds.length
        ? supabase.from("laboratorios").select("id,nome").in("id", labIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (deptResult.error) throw deptResult.error;
    if (labResult.error) throw labResult.error;

    const names = new Map<string, string>();
    (deptResult.data || []).forEach((row: any) =>
      names.set(`departamento:${row.id}`, String(row.nome || "")),
    );
    (labResult.data || []).forEach((row: any) =>
      names.set(`laboratorio:${row.id}`, String(row.nome || "")),
    );

    const nextUnits = rows.map((row) => ({
      ...row,
      nome: names.get(`${row.unit_type}:${row.unit_id}`) || "Unidade vinculada",
    }));

    setUnits(nextUnits);
    const firstUnitKey = unitKey(nextUnits[0]);
    setDraft((current) => ({
      ...current,
      selectedUnitKeys: current.selectedUnitKeys.length ? current.selectedUnitKeys : firstUnitKey ? [firstUnitKey] : [],
    }));
    setViewer((current) =>
      current
        ? {
            ...current,
            unitLabel: nextUnits[0]?.nome || current.unitLabel,
          }
        : current,
    );
  }, []);

  const loadFormOptions = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("app_system_settings")
        .select("value")
        .eq("key", "collective_room_form_options")
        .maybeSingle();
      const value = data?.value && typeof data.value === "object" ? (data.value as Record<string, unknown>) : {};
      const normalizeList = (raw: unknown) =>
        Array.isArray(raw)
          ? raw.map((item) => String(item || "").trim()).filter(Boolean)
          : [];
      const configured = {
        categories: normalizeList(value.categories),
        supportMarkers: normalizeList(value.support_markers),
        beneficiaries: normalizeList(value.beneficiaries),
        requirements: normalizeList(value.requirements),
        alternatives: normalizeList(value.alternatives),
      };
      setFormOptions({
        categories: mergeOptions(configured.categories, CONTEXTUAL_MODEL_OPTIONS.categories),
        supportMarkers: mergeOptions(configured.supportMarkers, CONTEXTUAL_MODEL_OPTIONS.supportMarkers),
        beneficiaries: mergeOptions(configured.beneficiaries, CONTEXTUAL_MODEL_OPTIONS.beneficiaries),
        requirements: mergeOptions(configured.requirements, CONTEXTUAL_MODEL_OPTIONS.requirements),
        alternatives: mergeOptions(configured.alternatives, CONTEXTUAL_MODEL_OPTIONS.alternatives),
      });
    } catch {
      setFormOptions(CONTEXTUAL_MODEL_OPTIONS);
    }
  }, []);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/collective-rooms?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao carregar DFDs coletivas.");
      setRooms((payload.rooms || []) as RoomListItem[]);
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos carregar as salas coletivas agora. Tente novamente em instantes.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadViewer().catch(() => {});
    loadUnits().catch((error) => {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos carregar seus setores agora. Tente atualizar a página.",
        ),
      );
    });
    loadFormOptions().catch(() => {});
    fetchActiveCycleYear().then(setCycleYear).catch(() => {});
  }, [loadFormOptions, loadViewer, loadUnits]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadRooms();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadRooms]);

  useEffect(() => {
    return () => {
      draft.planningReferences.forEach((file) => URL.revokeObjectURL(file.url));
    };
  }, [draft.planningReferences]);

  const selectedUnit = useMemo(() => {
    const firstKey = draft.selectedUnitKeys[0] || "";
    return units.find((unit) => unitKey(unit) === firstKey) || null;
  }, [draft.selectedUnitKeys, units]);

  const loadResponsibleOptions = useCallback(async () => {
    const selectedKeys = draft.selectedUnitKeys
      .map((key) => parseUnitKey(key))
      .filter(Boolean) as Array<{ unit_id: string; unit_type: "departamento" | "laboratorio" }>;
    if (!selectedKeys.length) {
      setResponsibleOptions([]);
      return;
    }

    const userRows = await Promise.all(
      selectedKeys.map(async (unit) => {
        const { data } = await supabase
          .from("user_units")
          .select("user_id,unit_id,unit_type")
          .eq("unit_id", unit.unit_id)
          .eq("unit_type", unit.unit_type);
        return (data || []) as Array<{ user_id: string; unit_id: string; unit_type: "departamento" | "laboratorio" }>;
      }),
    );
    const flatUserRows = userRows.flat();
    const userIds = Array.from(new Set(flatUserRows.map((row) => row.user_id).filter(Boolean)));
    if (!userIds.length) {
      setResponsibleOptions([]);
      return;
    }

    let profiles: Array<{ id: string; full_name: string | null; email: string | null; avatar_url: string | null; is_active?: boolean | null }> = [];
    const withStatus = await supabase
      .from("profiles")
      .select("id,full_name,email,avatar_url,is_active")
      .in("id", userIds);
    if (!withStatus.error) {
      profiles = (withStatus.data || []) as any[];
    } else {
      const fallback = await supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url")
        .in("id", userIds);
      profiles = (fallback.data || []) as any[];
    }

    const unitNameByKey = new Map(units.map((unit) => [unitKey(unit), unit.nome]));
    const options = profiles
      .filter((profile) => profile.is_active !== false)
      .map((profile) => {
        const userUnitRow = flatUserRows.find((row) => row.user_id === profile.id);
        const userUnitLabel = userUnitRow ? unitNameByKey.get(`${userUnitRow.unit_type}:${userUnitRow.unit_id}`) || "Unidade" : "Unidade";
        return {
          userId: profile.id,
          fullName: String(profile.full_name || profile.email || "Usuário ativo"),
          avatarUrl: profile.avatar_url || null,
          unitLabel: userUnitLabel,
        } satisfies ResponsibleOption;
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));

    setResponsibleOptions(options);
    setDraft((current) => {
      if (options.length === 0) return current;
      if (current.responsibleUserId && options.some((item) => item.userId === current.responsibleUserId)) return current;
      return {
        ...current,
        responsibleUserId: options[0].userId,
        responsibleName: options[0].fullName,
      };
    });
  }, [draft.selectedUnitKeys, units]);

  const selectedUnitIsChefia = selectedUnit?.role_in_unit === "chefia";
  const proposalScope = useMemo(() => buildCollectiveScope(draft), [draft]);
  const planningSubsidies = useMemo(() => buildPlanningSubsidies(draft), [draft]);

  const requiredChecks = useMemo(
    () => ({
      title: Boolean(draft.title.trim()),
      unit: Boolean(selectedUnit),
      description: Boolean(draft.description.trim()),
      entryCriteria: draft.entryCriteria.filter((item) => item.trim()).length > 0,
      contributionGuidance: REQUIRE_SCOPE_GUIDANCE
        ? Boolean(draft.contributionGuidance.trim())
        : true,
    }),
    [draft, selectedUnit],
  );

  const recommendedChecks = useMemo(
    () => ({
      beneficiaries: draft.beneficiaries.length > 0,
      impactExpected: Boolean(draft.impactExpected.trim()),
      planningRequirements: draft.planningRequirements.length > 0,
      planningAlternatives: draft.planningAlternatives.length > 0,
      planningNotes: Boolean(draft.planningNotes.trim()),
      planningReferences: draft.planningReferences.length > 0,
    }),
    [draft],
  );

  const hasAnyPlanningData = useMemo(
    () => Object.keys(planningSubsidies).length > 0,
    [planningSubsidies],
  );

  const requiredPendingLabels = useMemo(() => {
    const map: Record<keyof typeof requiredChecks, string> = {
      title: "Nome da sala",
      unit: "Unidade / setor responsável",
      description: "Por que esta sala existe",
      entryCriteria: "Pelo menos um critério em 'Entra na sala'",
      contributionGuidance: "Como as pessoas devem contribuir",
    };
    return (Object.keys(requiredChecks) as Array<keyof typeof requiredChecks>)
      .filter((key) => !requiredChecks[key])
      .map((key) => map[key]);
  }, [requiredChecks]);

  const recommendedPendingLabels = useMemo(() => {
    const map: Record<keyof typeof recommendedChecks, string> = {
      beneficiaries: "Quem será atendido",
      impactExpected: "Impacto esperado",
      planningRequirements: "O que não pode faltar",
      planningAlternatives: "O que já foi tentado",
      planningNotes: "Observações para análise técnica",
      planningReferences: "Documentos de apoio",
    };
    return (Object.keys(recommendedChecks) as Array<keyof typeof recommendedChecks>)
      .filter((key) => !recommendedChecks[key])
      .map((key) => map[key]);
  }, [recommendedChecks]);

  const requiredCompletion = useMemo(() => {
    const values = Object.values(requiredChecks);
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [requiredChecks]);

  const totalCompletion = useMemo(() => {
    const values = [...Object.values(requiredChecks), ...Object.values(recommendedChecks)];
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [requiredChecks, recommendedChecks]);

  const quickCanContinue = requiredChecks.title && requiredChecks.unit && requiredChecks.description;
  const wizardCanSubmit = Object.values(requiredChecks).every(Boolean);

  useEffect(() => {
    loadResponsibleOptions().catch(() => {
      setResponsibleOptions([]);
    });
  }, [loadResponsibleOptions]);

  const stepVisuals = useMemo(() => {
    const visuals: Record<WizardStepId, StepVisualState> = {
      identity: "pending",
      justification: "pending",
      scope: "pending",
      planning: "recommended",
      review: "pending",
    };
    const identityOk = requiredChecks.title && requiredChecks.unit;
    const justificationOk = requiredChecks.description;
    const scopeOk = requiredChecks.entryCriteria && requiredChecks.contributionGuidance;

    visuals.identity = identityOk ? "completed" : "pending";
    visuals.justification = justificationOk ? "completed" : "pending";
    visuals.scope = scopeOk ? "completed" : "pending";
    visuals.planning = hasAnyPlanningData ? "completed" : "recommended";
    visuals.review = wizardCanSubmit ? "completed" : "pending";

    if (attemptedSubmit) {
      if (!identityOk) visuals.identity = "error";
      if (!justificationOk) visuals.justification = "error";
      if (!scopeOk) visuals.scope = "error";
      if (!wizardCanSubmit) visuals.review = "error";
    }
    visuals[wizardStep] = "current";
    return visuals;
  }, [attemptedSubmit, hasAnyPlanningData, requiredChecks, wizardCanSubmit, wizardStep]);

  const visibleRooms = useMemo(() => {
    if (statusFilter === "todas") return rooms;
    if (statusFilter === "propostas") {
      return rooms.filter((room) => room.status === "proposta");
    }
    if (statusFilter === "abertas") {
      return rooms.filter((room) => room.status === "aberta");
    }
    if (statusFilter === "consolidacao") {
      return rooms.filter(
        (room) =>
          room.status === "em_consolidacao_chefia" ||
          room.status === "pronta_para_conversao",
      );
    }
    if (statusFilter === "finalizadas") {
      return rooms.filter(
        (room) => room.status === "convertida" || room.status === "arquivada",
      );
    }
    return rooms.filter(
      (room) =>
        room.status === "aberta" ||
        room.status === "em_consolidacao_chefia" ||
        room.status === "pronta_para_conversao",
    );
  }, [rooms, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleRooms.length / PAGE_SIZE));
  const paginatedRooms = useMemo(
    () => visibleRooms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, visibleRooms],
  );

  const filterTabs = useMemo(
    () => [
      { value: "todas", label: "Todas", count: rooms.length },
      {
        value: "operacionais",
        label: "Operacionais",
        count: rooms.filter(
          (room) =>
            room.status === "aberta" ||
            room.status === "em_consolidacao_chefia" ||
            room.status === "pronta_para_conversao",
        ).length,
      },
      {
        value: "propostas",
        label: "Propostas",
        count: rooms.filter((room) => room.status === "proposta").length,
      },
      {
        value: "abertas",
        label: "Abertas",
        count: rooms.filter((room) => room.status === "aberta").length,
      },
      {
        value: "consolidacao",
        label: "Sob consolidação",
        count: rooms.filter(
          (room) =>
            room.status === "em_consolidacao_chefia" ||
            room.status === "pronta_para_conversao",
        ).length,
      },
      {
        value: "finalizadas",
        label: "Finalizadas",
        count: rooms.filter((room) => room.status === "convertida" || room.status === "arquivada").length,
      },
    ],
    [rooms],
  );

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  useEffect(() => {
    if (routeRequestsRooms) {
      setCreationMode("rooms");
    }
  }, [routeRequestsRooms]);

  function handleSaveDraft() {
    toast.success(UX_SUCCESS.draftKept);
  }

  function handleContinueFromQuick() {
    if (!quickCanContinue) {
      toast.warning("Preencha nome, unidade e motivo da sala para avançar.");
      return;
    }
    setCreationMode("wizard");
    setWizardStep("scope");
  }

  function goToNextStep() {
    const order = WIZARD_STEPS.map((item) => item.id);
    const index = order.indexOf(wizardStep);
    if (index < 0 || index >= order.length - 1) return;
    setWizardStep(order[index + 1]);
  }

  function goToPreviousStep() {
    const order = WIZARD_STEPS.map((item) => item.id);
    const index = order.indexOf(wizardStep);
    if (index <= 0) return;
    setWizardStep(order[index - 1]);
  }

  async function createRoom() {
    setAttemptedSubmit(true);
    if (!selectedUnit) {
      toast.warning(UX_WARNING.chooseUnit);
      setWizardStep("identity");
      return false;
    }
    if (!wizardCanSubmit) {
      toast.warning(UX_WARNING.completeRequiredFields);
      if (!requiredChecks.title || !requiredChecks.unit) {
        setWizardStep("identity");
      } else if (!requiredChecks.description) {
        setWizardStep("justification");
      } else {
        setWizardStep("scope");
      }
      return false;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/collective-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          scope: proposalScope,
          planning_subsidies: hasAnyPlanningData ? planningSubsidies : null,
          unit_id: selectedUnit.unit_id,
          unit_type: selectedUnit.unit_type,
          cycle_year: cycleYear,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao criar sala.");
      toast.success(
        UX_SUCCESS.collectiveRoomCreated,
      );

      const firstUnit = unitKey(units[0]);
      const responsibleName = viewer?.fullName || "";
      const responsibleUserId = viewer?.id || "";
      setDraft(makeEmptyDraft({ unitKey: firstUnit, responsibleName, responsibleUserId }));
      setAttemptedSubmit(false);
      setWizardStep("identity");
      setCreationMode("rooms");
      await loadRooms();
      return true;
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos criar a sala coletiva agora. Revise os dados e tente novamente.",
        ),
      );
      return false;
    } finally {
      setCreating(false);
    }
  }

  const totals = useMemo(
    () => ({
      rooms: rooms.filter((room) => room.status !== "convertida" && room.status !== "arquivada").length,
      participants: rooms.reduce(
        (acc, room) => acc + Number(room.summary?.participantCount || 0),
        0,
      ),
      items: rooms.reduce((acc, room) => acc + Number(room.summary?.itemCount || 0), 0),
    }),
    [rooms],
  );
  const heroAvatarMembers = useMemo(() => {
    const members = new Map<string, AvatarStackMember>();
    if (viewer) {
      members.set(viewer.id, {
        id: viewer.id,
        name: viewer.fullName,
        avatarUrl: viewer.avatarUrl,
      });
    }
    responsibleOptions.forEach((option) => {
      members.set(option.userId, {
        id: option.userId,
        name: option.fullName,
        avatarUrl: option.avatarUrl,
      });
    });
    return Array.from(members.values()).slice(0, 6);
  }, [responsibleOptions, viewer]);

  return (
    <main className="min-h-screen bg-[var(--semantic-neutral-soft)] px-5 py-7 text-[var(--p-color-fg-strong)]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-7">
        <section className="ux-panel relative overflow-hidden rounded-[24px] p-7">
          <div className="ux-accent-rule absolute inset-x-0 top-0 h-1" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] lg:items-center">
            <div className="min-w-0">
              <p className="ux-kicker">Coautoria do setor</p>
              <h1 className="ux-title mt-1 text-3xl font-semibold">
                Demandas do setor, construídas em conjunto
              </h1>
              <p className="ux-muted mt-3 max-w-3xl text-base leading-7">
                Cada pessoa registra o que precisa. A chefia revisa, consolida e gera as DFDs oficiais com autoria preservada.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <OperationalChip tone="collab" className="text-sm">Servidor contribui</OperationalChip>
                <OperationalChip tone="warning" className="text-sm">Chefia revisa e consolida</OperationalChip>
                <OperationalChip tone="success" className="text-sm">Autoria preservada</OperationalChip>
              </div>
              <AvatarStack
                members={heroAvatarMembers}
                total={Math.max(heroAvatarMembers.length, totals.participants)}
                label="coautores e responsáveis disponíveis"
                className="mt-5"
              />
            </div>
            <div className="grid min-w-0 gap-4">
              <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                <OperationalKpiCard
                  label="DFDs"
                  value={totals.rooms}
                  icon={<Buildings size={18} weight="duotone" />}
                  tone="collab"
                  className="min-w-0"
                />
                <OperationalKpiCard
                  label="Participantes"
                  value={totals.participants}
                  icon={<UsersThree size={18} weight="duotone" />}
                  tone="success"
                  className="min-w-0"
                />
                <OperationalKpiCard
                  label="Itens"
                  value={totals.items}
                  icon={<Package size={18} weight="duotone" />}
                  tone="warning"
                  className="min-w-0"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <OperationalKpiCard label="Propostas" value={rooms.filter((room) => room.status === "proposta").length} tone="insight" helper="Ideias iniciais" />
          <OperationalKpiCard label="Abertas" value={rooms.filter((room) => room.status === "aberta").length} tone="collab" helper="Recebendo itens" />
          <OperationalKpiCard label="Consolidando" value={rooms.filter((room) => room.status === "em_consolidacao_chefia" || room.status === "pronta_para_conversao").length} tone="warning" helper="Com chefia" />
        </section>

        <section className={cn("grid gap-6", creationMode === "wizard" || creationMode === "rooms" ? "xl:grid-cols-[minmax(0,1fr)]" : "xl:grid-cols-[460px_minmax(0,1fr)]")}>
          {creationMode === "quick" ? (
            <QuickCollectiveProposal
              draft={draft}
              units={units}
              quickCanContinue={quickCanContinue}
              onDraftChange={setDraft}
              onContinue={handleContinueFromQuick}
            />
          ) : creationMode === "wizard" ? (
            <CollectiveRoomWizard
              cycleYear={cycleYear}
              creating={creating}
              draft={draft}
              formOptions={formOptions}
              hasAnyPlanningData={hasAnyPlanningData}
              responsibleOptions={responsibleOptions}
              requiredChecks={requiredChecks}
              requiredCompletion={requiredCompletion}
              recommendedPendingLabels={recommendedPendingLabels}
              selectedUnit={selectedUnit}
              step={wizardStep}
              stepVisuals={stepVisuals}
              totalCompletion={totalCompletion}
              units={units}
              viewer={viewer}
              wizardCanSubmit={wizardCanSubmit}
              onBackStep={goToPreviousStep}
              onDraftChange={setDraft}
              onNextStep={goToNextStep}
              onSaveDraft={handleSaveDraft}
              onStepChange={setWizardStep}
              onSubmit={createRoom}
              onReturnToRooms={() => setCreationMode("rooms")}
            />
          ) : null}

          <section className={cn("ux-panel rounded-[22px] p-6", creationMode === "wizard" && "xl:hidden")}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-[var(--p-color-brand-700)]">Salas por etapa</p>
                  <p className="mt-1 text-sm text-[var(--p-color-fg-muted)]">
                    Operacionais primeiro; finalizadas ficam em aba própria.
                  </p>
                </div>
                {creationMode === "rooms" ? (
                  <button
                    type="button"
                    onClick={() => setCreationMode("quick")}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--p-color-action)] bg-[var(--p-color-action)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                  >
                    Montar nova sala
                    <ArrowRight size={16} weight="bold" />
                  </button>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="relative mt-4">
                  <MagnifyingGlass
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--p-color-fg-muted)]"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-md border border-[var(--p-color-border-strong)] py-3 pl-12 pr-4 text-sm outline-none focus:border-[var(--semantic-collab)]"
                    placeholder="Buscar por tema, descrição ou escopo"
                    aria-label="Buscar salas coletivas por tema, descrição ou escopo"
                  />
                </div>
              </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar DFDs coletivas por etapa">
                {filterTabs.map((tab) => {
                  const active = statusFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatusFilter(tab.value)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                        active
                          ? "border-[var(--semantic-action)] bg-[var(--semantic-action)] text-white shadow-sm"
                          : "border-[var(--semantic-neutral-border)] bg-white text-[var(--p-color-fg-muted)] hover:border-[var(--semantic-collab)] hover:text-[var(--semantic-action)]",
                      )}
                    >
                      {tab.label}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          active ? "bg-white/20 text-white" : "bg-[var(--p-color-surface-muted)] text-[var(--p-color-fg-muted)]",
                        )}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
              {creationMode === "wizard" ? (
                <OperationalStepper
                  currentStep={Math.max(1, WIZARD_STEPS.findIndex((step) => step.id === wizardStep) + 1)}
                  steps={WIZARD_STEPS.map((step) => ({
                    label: step.label,
                  }))}
                />
              ) : null}
            </div>

            <div className="mt-5 grid gap-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-28 animate-pulse rounded-lg border border-[var(--p-color-border-muted)] bg-[var(--p-color-surface-muted)]"
                  />
                ))
              ) : visibleRooms.length === 0 ? (
                <OperationalEmptyState
                  icon={
                    <img
                      src="/guidance/collective-empty-room.png"
                      alt=""
                      className="aspect-[16/9] w-36 object-contain"
                    />
                  }
                  title="Nenhuma DFD coletiva encontrada"
                  description="Abra uma nova sala coletiva ou ajuste a busca para localizar uma sala já criada."
                  action={<button type="button" onClick={() => { setSearch(""); setStatusFilter("todas"); setPage(1); }} className="min-h-10 rounded-xl border border-[var(--p-color-border)] px-4 text-sm font-semibold text-[var(--p-color-brand-500)]">Limpar busca e ver todas as etapas</button>}
                  className="min-h-[420px]"
                />
              ) : (
                paginatedRooms.map((room) => <div key={room.id}><RoomCard room={room} />{room.actor_role === "superadmin" && <CollectiveRoomDeleteButton room={room} onDeleted={(id) => { setRooms((current) => current.filter((entry) => entry.id !== id)); setPage(1); }} />}</div>)
              )}
            </div>
            {!loading && visibleRooms.length > 0 ? (
              <RoomsPagination
                page={page}
                totalPages={totalPages}
                count={visibleRooms.length}
                onPageChange={setPage}
              />
            ) : null}
          </section>
        </section>

        {creationMode === "wizard" ? (
          <section className="ux-panel rounded-[22px] border border-[var(--p-color-border)] bg-white p-5">
            <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">Pendências para envio</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--p-color-danger)]">Obrigatórias</p>
                {requiredPendingLabels.length === 0 ? (
                  <p className="mt-1 text-sm text-[var(--p-color-success)]">Tudo certo para envio.</p>
                ) : (
                  <ul className="mt-1 list-disc pl-5 text-sm text-[var(--p-color-danger)]">
                    {requiredPendingLabels.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-surface-soft)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--p-color-fg-muted)]">Recomendadas</p>
                {recommendedPendingLabels.length === 0 ? (
                  <p className="mt-1 text-sm text-[var(--p-color-success)]">Ótimo: os campos recomendados já estão completos.</p>
                ) : (
                  <ul className="mt-1 list-disc pl-5 text-sm text-[var(--p-color-fg-muted)]">
                    {recommendedPendingLabels.slice(0, 6).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function unitKey(unit?: UnitOption | null) {
  if (!unit) return "";
  return `${unit.unit_type}:${unit.unit_id}`;
}

function parseUnitKey(key: string) {
  const [unit_type, unit_id] = String(key || "").split(":");
  if (!unit_id) return null;
  if (unit_type !== "departamento" && unit_type !== "laboratorio") return null;
  return { unit_type, unit_id };
}

function buildCollectiveScope(draft: CollectiveRoomDraft) {
  const entry = draft.entryCriteria.filter((item) => item.trim()).map((item) => `- ${item.trim()}`);
  const exclusion = draft.exclusionCriteria.filter((item) => item.trim()).map((item) => `- ${item.trim()}`);
  const guidance = draft.contributionGuidance.trim();

  return [
    entry.length ? `Entra na sala:\n${entry.join("\n")}` : "",
    exclusion.length ? `Fica fora da sala:\n${exclusion.join("\n")}` : "",
    guidance ? `Como contribuir:\n${guidance}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildPlanningSubsidies(draft: CollectiveRoomDraft) {
  const references = draft.planningReferences
    .map((file) => `${file.name} (${formatBytes(file.size)})`)
    .join("; ");
  return sanitizePlanningSubsidies({
    problem: draft.planningProblem,
    beneficiaries: draft.planningBeneficiaries.join(", "),
    expectedResult: draft.planningExpectedResult || draft.impactExpected,
    essentialRequirements: draft.planningRequirements.join("; "),
    constraints: draft.planningRestrictions,
    consideredAlternatives: [
      draft.planningAlternatives.join("; "),
      draft.planningAlternativesReason,
    ]
      .filter(Boolean)
      .join(" | "),
    etpTrNotes: [draft.planningNotes, references ? `Referências: ${references}` : ""]
      .filter(Boolean)
      .join(" | "),
  });
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function toggleTextList(values: string[], value: string) {
  const normalized = value.trim();
  if (!normalized) return values;
  if (values.includes(normalized)) return values.filter((item) => item !== normalized);
  return [...values, normalized];
}

function QuickCollectiveProposal({
  draft,
  units,
  quickCanContinue,
  onDraftChange,
  onContinue,
}: {
  draft: CollectiveRoomDraft;
  units: UnitOption[];
  quickCanContinue: boolean;
  onDraftChange: React.Dispatch<React.SetStateAction<CollectiveRoomDraft>>;
  onContinue: () => void;
}) {
  return (
    <section className="ux-panel rounded-[22px] p-6">
      <div className="flex items-center gap-3">
        <div className="ux-icon-collab flex h-12 w-12 items-center justify-center rounded-full border border-[var(--semantic-collab-border)]">
          <Plus size={24} weight="bold" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--p-color-brand-700)]">Abra uma sala para uma demanda coletiva</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--p-color-fg-muted)]">
            Você inicia a proposta e a chefia valida a abertura antes de chamar o restante do setor para contribuir.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] p-4">
          <p className="text-sm font-semibold text-[var(--p-color-warning)]">Antes de abrir</p>
          <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-default)]">
            Defina o problema, quem será atendido e o que realmente deve entrar na sala. Isso evita contribuições soltas e reduz retrabalho na consolidação.
          </p>
        </div>

        <label className="block text-sm font-semibold text-[var(--p-color-fg-default)]">
          Nome da sala
          <input
            value={draft.title}
            onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-[var(--p-color-border-strong)] px-4 py-3 text-base outline-none focus:border-[var(--p-color-brand-500)]"
            placeholder="Ex.: Equipamentos para salas de aula"
          />
        </label>

        <div>
          <p className="text-sm font-semibold text-[var(--p-color-fg-default)]">Unidade / setor responsável</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {units.map((unit) => {
              const key = unitKey(unit);
              const active = draft.selectedUnitKeys.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    onDraftChange((current) => {
                      const next = toggleTextList(current.selectedUnitKeys, key);
                      return {
                        ...current,
                        selectedUnitKeys: next.length ? next : [key],
                      };
                    })
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "border-[var(--p-color-action)] bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]"
                      : "border-[var(--p-color-border-strong)] bg-white text-[var(--p-color-fg-muted)] hover:border-[var(--p-color-brand-500)]",
                  )}
                >
                  {unit.nome}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block text-sm font-semibold text-[var(--p-color-fg-default)]">
          Por que esta sala existe?
          <p className="mt-1 text-xs font-normal text-[var(--p-color-fg-muted)]">
            Explique o problema, o contexto e quem será atendido.
          </p>
          <textarea
            value={draft.description}
            onChange={(event) => onDraftChange((current) => ({ ...current, description: event.target.value }))}
            rows={5}
            maxLength={1400}
            className="mt-2 w-full resize-y rounded-xl border border-[var(--p-color-border-strong)] px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-[var(--p-color-brand-500)]"
            placeholder="Descreva a necessidade que motivou a abertura desta sala coletiva."
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!quickCanContinue || units.length === 0}
        className="ux-btn-collab mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <PaperPlaneTilt size={17} weight="bold" />
        Montar sala guiada
      </button>
    </section>
  );
}

function CollectiveRoomWizard({
  cycleYear,
  creating,
  draft,
  formOptions,
  hasAnyPlanningData,
  responsibleOptions,
  requiredChecks,
  requiredCompletion,
  recommendedPendingLabels,
  selectedUnit,
  step,
  stepVisuals,
  totalCompletion,
  units,
  viewer,
  wizardCanSubmit,
  onBackStep,
  onDraftChange,
  onNextStep,
  onSaveDraft,
  onStepChange,
  onSubmit,
  onReturnToRooms,
}: {
  cycleYear: number;
  creating: boolean;
  draft: CollectiveRoomDraft;
  formOptions: CollectiveFormOptions;
  hasAnyPlanningData: boolean;
  responsibleOptions: ResponsibleOption[];
  requiredChecks: Record<string, boolean>;
  requiredCompletion: number;
  recommendedPendingLabels: string[];
  selectedUnit: UnitOption | null;
  step: WizardStepId;
  stepVisuals: Record<WizardStepId, StepVisualState>;
  totalCompletion: number;
  units: UnitOption[];
  viewer: AuthUserSummary | null;
  wizardCanSubmit: boolean;
  onBackStep: () => void;
  onDraftChange: React.Dispatch<React.SetStateAction<CollectiveRoomDraft>>;
  onNextStep: () => void;
  onSaveDraft: () => void;
  onStepChange: (step: WizardStepId) => void;
  onSubmit: () => Promise<boolean>;
  onReturnToRooms: () => void;
}) {
  const stepIndex = WIZARD_STEPS.findIndex((item) => item.id === step);
  const isLastStep = step === "review";
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const normalizedTitle = draft.title.trim().toLowerCase();
  const titleTooGeneric =
    normalizedTitle.length > 0 &&
    ["sala", "demanda", "dfd", "sala coletiva"].includes(normalizedTitle);

  function onAttachmentInput(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    onDraftChange((current) => ({
      ...current,
      planningReferences: [
        ...current.planningReferences,
        ...files.map((file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          addedAt: new Date().toISOString(),
          addedBy: current.responsibleName || viewer?.fullName || "Usuário",
          url: URL.createObjectURL(file),
        })),
      ],
    }));
    event.target.value = "";
  }

  function removeAttachment(fileId: string) {
    onDraftChange((current) => {
      const target = current.planningReferences.find((file) => file.id === fileId);
      if (target?.url) URL.revokeObjectURL(target.url);
      return {
        ...current,
        planningReferences: current.planningReferences.filter((file) => file.id !== fileId),
      };
    });
  }

  async function handleConfirmProposal() {
    const sent = await onSubmit();
    if (sent) {
      setProposalModalOpen(false);
    }
  }

  return (
    <form onSubmit={(event) => event.preventDefault()} className="ux-panel overflow-hidden rounded-[24px] border border-[var(--p-color-border)] bg-white">
      <div className="border-b border-[var(--p-color-border-muted)] bg-gradient-to-r from-[var(--p-color-info-bg)] via-white to-[var(--p-color-collab-bg)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--p-color-brand-700)]">Abrir sala coletiva guiada</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--p-color-fg-muted)]">
              Organize a sala em etapas curtas para a unidade começar a construir a demanda coletiva com clareza.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <OperationalChip tone="collab">{CREATION_STATUS_LABELS[draft.status]}</OperationalChip>
              <OperationalChip tone="success">A sala abre para contribuição ao finalizar</OperationalChip>
              <OperationalChip tone="success">Preenchimento guiado em 5 etapas</OperationalChip>
            </div>
          </div>
          <button
            type="button"
            onClick={onReturnToRooms}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--p-color-border-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--p-color-fg-muted)] shadow-sm transition hover:border-[var(--p-color-action)] hover:text-[var(--p-color-action)]"
          >
            <CaretLeft size={16} weight="bold" />
            Ver salas por etapa
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] px-5 py-4">
        <div className="overflow-x-auto">
          <div className="flex min-w-max items-center gap-2">
            {WIZARD_STEPS.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onStepChange(item.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition",
                    step === item.id
                      ? "border-[var(--p-color-action)] bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]"
                      : "border-[var(--p-color-border)] bg-white text-[var(--p-color-fg-muted)] hover:border-[var(--p-color-action)]",
                  )}
                >
                  <StepStateIcon state={stepVisuals[item.id]} />
                  {item.label}
                </button>
                {index < WIZARD_STEPS.length - 1 ? (
                  <div className="h-px w-6 bg-[var(--p-color-border)]" aria-hidden="true" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-h-[620px] p-5">
          {step === "identity" ? (
            <WizardCard
              title="Identidade da sala"
              helper="Defina os dados principais desta sala coletiva. Você pode ajustar depois enquanto estiver em rascunho."
            >
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-[var(--p-color-fg-default)]">
                  Nome da sala *
                  <input
                    value={draft.title}
                    onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-[var(--p-color-border-strong)] px-4 py-3 text-base outline-none focus:border-[var(--p-color-brand-500)]"
                    placeholder="Informe um nome claro para a sala coletiva"
                  />
                  {!draft.title.trim() ? (
                    <span className="mt-1 block text-xs font-normal text-[var(--p-color-warning)]">
                      Informe um nome que permita identificar rapidamente o objetivo da sala.
                    </span>
                  ) : null}
                  {titleTooGeneric ? (
                    <span className="mt-1 block text-xs font-normal text-[var(--p-color-warning)]">
                      O nome está muito genérico. Tente incluir o tipo de necessidade ou público atendido.
                    </span>
                  ) : null}
                </label>

                <div>
                  <p className="text-sm font-semibold text-[var(--p-color-fg-default)]">Unidade / setor responsável *</p>
                  <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">Você pode selecionar mais de uma unidade. A primeira será a unidade responsável.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {units.map((unit) => {
                      const key = unitKey(unit);
                      const active = draft.selectedUnitKeys.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            onDraftChange((current) => {
                              const next = toggleTextList(current.selectedUnitKeys, key);
                              return {
                                ...current,
                                selectedUnitKeys: next.length ? next : [key],
                              };
                            })
                          }
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                            active
                              ? "border-[var(--p-color-action)] bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]"
                              : "border-[var(--p-color-border-strong)] bg-white text-[var(--p-color-fg-muted)] hover:border-[var(--p-color-brand-500)]",
                          )}
                        >
                          {unit.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-[var(--p-color-fg-default)]">
                    Categoria da demanda
                    <p className="mt-1 text-xs font-normal text-[var(--p-color-fg-muted)]">
                      Exemplos: {formOptions.categories.slice(0, 3).join(", ") || "laboratórios, tecnologia educacional, infraestrutura acadêmica"}.
                    </p>
                    <input
                      value={draft.category}
                      onChange={(event) => onDraftChange((current) => ({ ...current, category: event.target.value }))}
                      list="collective-category-options"
                      className="mt-2 w-full rounded-xl border border-[var(--p-color-border-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--p-color-brand-500)]"
                      placeholder="Selecione ou digite uma categoria"
                    />
                    <datalist id="collective-category-options">
                      {formOptions.categories.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </label>
                  <div className="block text-sm font-semibold text-[var(--p-color-fg-default)]">
                    Responsável pela sala
                    <p className="mt-1 text-xs font-normal text-[var(--p-color-fg-muted)]">
                      Selecione entre usuários ativos da(s) unidade(s) escolhida(s).
                    </p>
                    {responsibleOptions.length === 0 ? (
                      <div className="mt-2 rounded-xl border border-dashed border-[var(--p-color-border-strong)] bg-[var(--p-color-surface-soft)] p-3 text-sm font-normal text-[var(--p-color-fg-muted)]">
                        Nenhum responsável ativo encontrado para as unidades selecionadas.
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {responsibleOptions.map((option) => {
                          const active = option.userId === draft.responsibleUserId;
                          return (
                            <button
                              key={option.userId}
                              type="button"
                              onClick={() =>
                                onDraftChange((current) => ({
                                  ...current,
                                  responsibleUserId: option.userId,
                                  responsibleName: option.fullName,
                                }))
                              }
                              className={cn(
                                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-left text-xs font-semibold transition",
                                active
                                  ? "border-[var(--p-color-action)] bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]"
                                  : "border-[var(--p-color-border-strong)] bg-white text-[var(--p-color-fg-muted)] hover:border-[var(--p-color-brand-500)]",
                              )}
                            >
                              {option.avatarUrl ? (
                                <img src={option.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                              ) : (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--p-color-border-muted)] type-kicker font-bold text-[var(--p-color-fg-default)]">
                                  {option.fullName.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              <span className="max-w-[180px] truncate">{option.fullName}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-[var(--p-color-fg-default)]">
                    Data prevista (opcional)
                    <div className="relative mt-2">
                      <CalendarBlank size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--p-color-fg-muted)]" />
                      <input
                        type="date"
                        value={draft.plannedDate}
                        min={`${cycleYear}-01-01`}
                        onChange={(event) => onDraftChange((current) => ({ ...current, plannedDate: event.target.value }))}
                        className="w-full rounded-xl border border-[var(--p-color-border-strong)] py-3 pl-10 pr-3 text-sm outline-none focus:border-[var(--p-color-brand-500)]"
                      />
                    </div>
                  </label>
                  <label className="block text-sm font-semibold text-[var(--p-color-fg-default)]">
                    Descrição breve
                    <input
                      value={draft.briefDescription}
                      onChange={(event) => onDraftChange((current) => ({ ...current, briefDescription: event.target.value }))}
                      className="mt-2 w-full rounded-xl border border-[var(--p-color-border-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--p-color-brand-500)]"
                      placeholder="Resumo curto sobre o propósito da sala"
                    />
                  </label>
                </div>
              </div>
            </WizardCard>
          ) : null}

          {step === "justification" ? (
            <WizardCard
              title="Por que esta sala existe?"
              helper="Explique em linguagem simples o problema, o contexto e quem será atendido."
            >
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-[var(--p-color-fg-default)]">
                  Justificativa da sala *
                  <textarea
                    value={draft.description}
                    onChange={(event) => onDraftChange((current) => ({ ...current, description: event.target.value }))}
                    rows={7}
                    maxLength={1600}
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--p-color-border-strong)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--p-color-brand-500)]"
                    placeholder="Descreva a necessidade que motivou a abertura desta sala coletiva."
                  />
                  <span className="mt-1 block text-xs font-normal text-[var(--p-color-fg-muted)]">
                    {Math.max(0, 1600 - draft.description.length)} caracteres restantes
                  </span>
                  {!draft.description.trim() ? (
                    <span className="mt-1 block text-xs font-normal text-[var(--p-color-warning)]">
                      A justificativa deve explicar o problema ou necessidade que motivou a abertura da sala.
                    </span>
                  ) : null}
                </label>

                <ChipEditor
                  label="Marcadores de apoio"
                  helper="Use marcadores para classificar a demanda sem substituir o texto da justificativa."
                  value={draft.supportMarkers}
                  suggestions={formOptions.supportMarkers}
                  onChange={(next) => onDraftChange((current) => ({ ...current, supportMarkers: next }))}
                />

                <ChipEditor
                  label="Quem será atendido?"
                  helper="Selecione perfis e grupos impactados por esta demanda."
                  value={draft.beneficiaries}
                  suggestions={formOptions.beneficiaries}
                  onChange={(next) => onDraftChange((current) => ({ ...current, beneficiaries: next }))}
                />

                <label className="block text-sm font-semibold text-[var(--p-color-fg-default)]">
                  Impacto esperado
                  <textarea
                    value={draft.impactExpected}
                    onChange={(event) => onDraftChange((current) => ({ ...current, impactExpected: event.target.value }))}
                    rows={4}
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--p-color-border-strong)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--p-color-brand-500)]"
                    placeholder="Explique o que deve melhorar após atender esta demanda."
                  />
                </label>
              </div>
            </WizardCard>
          ) : null}

          {step === "scope" ? (
            <WizardCard
              title="Escopo da sala"
              helper="Defina claramente o que entra e o que fica fora para evitar contribuições fora do objetivo."
            >
              <div className="space-y-4">
                <EditableCriteriaList
                  label="Entra na sala *"
                  emptyText="Nenhum critério de entrada adicionado."
                  placeholder="Ex.: equipamentos didáticos para salas de aula"
                  tone="in"
                  values={draft.entryCriteria}
                  onChange={(next) => onDraftChange((current) => ({ ...current, entryCriteria: next }))}
                />
                <EditableCriteriaList
                  label="Fica fora da sala"
                  emptyText="Nenhuma exclusão adicionada."
                  placeholder="Ex.: obras estruturais e demandas de uso pessoal"
                  tone="out"
                  values={draft.exclusionCriteria}
                  onChange={(next) => onDraftChange((current) => ({ ...current, exclusionCriteria: next }))}
                />
                <label className="block text-sm font-semibold text-[var(--p-color-fg-default)]">
                  Como as pessoas devem contribuir? {REQUIRE_SCOPE_GUIDANCE ? "*" : ""}
                  <p className="mt-1 text-xs font-normal text-[var(--p-color-fg-muted)]">
                    Oriente os participantes sobre quais informações devem enviar.
                  </p>
                  <textarea
                    value={draft.contributionGuidance}
                    onChange={(event) => onDraftChange((current) => ({ ...current, contributionGuidance: event.target.value }))}
                    rows={4}
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--p-color-border-strong)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--p-color-brand-500)]"
                    placeholder="Ex.: informe item, quantidade estimada, justificativa, local de uso e características técnicas."
                  />
                </label>
                <OperationalAccordion
                  items={[
                    {
                      title: "Exemplo de boa contribuição",
                      badge: <OperationalChip tone="collab">Modelo</OperationalChip>,
                      content:
                        "Uma boa contribuição informa o que é necessário, para qual finalidade, quantidade aproximada e justificativa de uso.",
                    },
                  ]}
                />
              </div>
            </WizardCard>
          ) : null}

          {step === "planning" ? (
            <WizardCard
              title="Diagnóstico para análise da compra"
              helper="Esses campos ajudam a chefia, compras e área técnica. Preencha em linguagem simples."
            >
              <div className="space-y-4">
                <section className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-surface-soft)] p-4 transition-all duration-200 hover:shadow-sm">
                  <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">Diagnóstico rápido</p>
                  <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                    Use este quadro para verificar se há informação suficiente para análise de compras.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <PreviewCheck label="Requisitos mínimos definidos" ok={draft.planningRequirements.length > 0} />
                    <PreviewCheck label="Alternativas registradas" ok={draft.planningAlternatives.length > 0} />
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] p-4 transition-all duration-200 hover:shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">1. Critérios mínimos da solução</p>
                    <OperationalChip tone="warning">Não pode faltar</OperationalChip>
                  </div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <CheckListEditor
                      label="O que não pode faltar"
                      options={formOptions.requirements}
                      values={draft.planningRequirements}
                      onChange={(next) => onDraftChange((current) => ({ ...current, planningRequirements: next }))}
                    />
                    <label className="block text-sm font-semibold text-[var(--p-color-fg-default)]">
                      Cuidados e restrições
                      <textarea
                        value={draft.planningRestrictions}
                        onChange={(event) => onDraftChange((current) => ({ ...current, planningRestrictions: event.target.value }))}
                        rows={6}
                        className="mt-2 w-full resize-y rounded-xl border border-[var(--p-color-border-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--p-color-brand-500)]"
                        placeholder="Informe restrições técnicas, físicas, operacionais, normativas ou de segurança."
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)] p-4 transition-all duration-200 hover:shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">2. O que já tentamos antes de comprar?</p>
                    <OperationalChip tone="insight">Diagnóstico</OperationalChip>
                  </div>
                  <CheckListEditor
                    label="O que já foi tentado"
                    options={formOptions.alternatives}
                    values={draft.planningAlternatives}
                    onChange={(next) => onDraftChange((current) => ({ ...current, planningAlternatives: next }))}
                  />
                  <label className="mt-3 block text-sm font-semibold text-[var(--p-color-fg-default)]">
                    O que ainda falta mesmo após essas tentativas?
                    <textarea
                      value={draft.planningAlternativesReason}
                      onChange={(event) => onDraftChange((current) => ({ ...current, planningAlternativesReason: event.target.value }))}
                      rows={3}
                      className="mt-2 w-full resize-y rounded-xl border border-[var(--p-color-border-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--p-color-brand-500)]"
                      placeholder="Explique, em linguagem simples, por que a necessidade continua."
                    />
                  </label>
                </section>

                <section className="rounded-xl border border-[var(--p-color-border-muted)] bg-white p-4 transition-all duration-200 hover:shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">3. Notas e referências</p>
                    <OperationalChip>Complementar</OperationalChip>
                  </div>
                  <label className="mt-3 block text-sm font-semibold text-[var(--p-color-fg-default)]">
                    Observações para análise técnica
                    <textarea
                      value={draft.planningNotes}
                      onChange={(event) => onDraftChange((current) => ({ ...current, planningNotes: event.target.value }))}
                      rows={4}
                      className="mt-2 w-full resize-y rounded-xl border border-[var(--p-color-border-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--p-color-brand-500)]"
                      placeholder="Registre orientações para chefia, compras e área técnica."
                    />
                  </label>

                  <div className="mt-4 rounded-xl border border-dashed border-[var(--p-color-border-strong)] bg-[var(--p-color-surface-soft)] p-4">
                    <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">Documentos e referências de apoio</p>
                    <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                      Anexe arquivos que ajudem na análise futura. Esses anexos ficam vinculados ao rascunho local desta tela.
                    </p>
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--p-color-action)] px-3 py-2 text-sm font-semibold text-[var(--p-color-action)]">
                      <UploadSimple size={16} weight="bold" />
                      Anexar arquivo
                      <input type="file" multiple className="hidden" onChange={onAttachmentInput} />
                    </label>

                    {draft.planningReferences.length === 0 ? (
                      <p className="mt-3 text-sm text-[var(--p-color-fg-muted)]">Nenhum documento anexado.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {draft.planningReferences.map((file) => (
                          <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--p-color-border-muted)] bg-white px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--p-color-brand-700)]">{file.name}</p>
                              <p className="text-xs text-[var(--p-color-fg-muted)]">
                                {formatBytes(file.size)} · {file.type || "arquivo"} · {file.addedBy} · {new Date(file.addedAt).toLocaleString("pt-BR")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <a href={file.url} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--p-color-border-strong)] p-2 text-[var(--p-color-fg-muted)]" title="Visualizar">
                                <Eye size={15} />
                              </a>
                              <a href={file.url} download={file.name} className="rounded-md border border-[var(--p-color-border-strong)] p-2 text-[var(--p-color-fg-muted)]" title="Baixar">
                                <DownloadSimple size={15} />
                              </a>
                              <button type="button" onClick={() => removeAttachment(file.id)} className="rounded-md border border-[var(--p-color-danger-border)] p-2 text-[var(--p-color-danger)]" title="Remover">
                                <X size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </WizardCard>
          ) : null}

          {step === "review" ? (
            <WizardCard
              title="Revisão e envio"
              helper="Confira os dados antes de enviar para validação da chefia."
            >
              <div className="space-y-4">
                <ReviewSection title="Identidade" onEdit={() => onStepChange("identity")}>
                  <ReviewRow label="Nome da sala" value={draft.title || "Não informado"} ok={requiredChecks.title} />
                  <ReviewRow label="Unidade / setor" value={selectedUnit?.nome || "Não informado"} ok={requiredChecks.unit} />
                  <ReviewRow label="Categoria" value={draft.category || "Não informado"} ok={Boolean(draft.category.trim())} optional />
                  <ReviewRow label="Responsável" value={draft.responsibleName || viewer?.fullName || "Não informado"} ok={Boolean((draft.responsibleName || viewer?.fullName || "").trim())} optional />
                  <ReviewRow label="Descrição breve" value={draft.briefDescription || "Não informado"} ok={Boolean(draft.briefDescription.trim())} optional />
                </ReviewSection>

                <ReviewSection title="Justificativa" onEdit={() => onStepChange("justification")}>
                  <ReviewRow label="Por que esta sala existe" value={draft.description || "Não informado"} ok={requiredChecks.description} />
                  <ReviewRow label="Marcadores" value={draft.supportMarkers.join(", ") || "Não informado"} ok={draft.supportMarkers.length > 0} optional />
                  <ReviewRow label="Quem será atendido" value={draft.beneficiaries.join(", ") || "Não informado"} ok={draft.beneficiaries.length > 0} optional />
                </ReviewSection>

                <ReviewSection title="Escopo" onEdit={() => onStepChange("scope")}>
                  <ReviewRow label="Entra na sala" value={draft.entryCriteria.join("; ") || "Não informado"} ok={requiredChecks.entryCriteria} />
                  <ReviewRow label="Fica fora da sala" value={draft.exclusionCriteria.join("; ") || "Não informado"} ok={draft.exclusionCriteria.length > 0} optional />
                  <ReviewRow label="Como contribuir" value={draft.contributionGuidance || "Não informado"} ok={requiredChecks.contributionGuidance} />
                </ReviewSection>

                <ReviewSection title="Diagnóstico da demanda" onEdit={() => onStepChange("planning")}>
                  <ReviewRow label="O que não pode faltar" value={draft.planningRequirements.join(", ") || "Não informado"} ok={draft.planningRequirements.length > 0} optional />
                  <ReviewRow label="O que já foi tentado" value={draft.planningAlternatives.join(", ") || "Não informado"} ok={draft.planningAlternatives.length > 0} optional />
                  <ReviewRow label="Observações" value={draft.planningNotes || "Não informado"} ok={Boolean(draft.planningNotes.trim())} optional />
                </ReviewSection>

                <div className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-surface-soft)] p-4">
                  <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">Checklist final</p>
                  <div className="mt-2 space-y-2">
                    <PreviewCheck label="Nome da sala preenchido" ok={requiredChecks.title} />
                    <PreviewCheck label="Unidade/setor preenchido" ok={requiredChecks.unit} />
                    <PreviewCheck label="Justificativa preenchida" ok={requiredChecks.description} />
                    <PreviewCheck label="Pelo menos um critério de entrada definido" ok={requiredChecks.entryCriteria} />
                    <PreviewCheck label="Escopo orientado para contribuição" ok={requiredChecks.contributionGuidance} />
                  </div>
                </div>
              </div>
            </WizardCard>
          ) : null}
        </section>

        <aside className="border-t border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-5 xl:border-l xl:border-t-0">
          <LivePreview
            draft={draft}
            hasAnyPlanningData={hasAnyPlanningData}
            requiredCompletion={requiredCompletion}
            requiredChecks={requiredChecks}
            recommendedPendingLabels={recommendedPendingLabels}
            selectedUnit={selectedUnit}
            step={step}
            totalCompletion={totalCompletion}
            onGoToFirstPending={() => {
              if (!requiredChecks.title || !requiredChecks.unit) {
                onStepChange("identity");
                return;
              }
              if (!requiredChecks.description) {
                onStepChange("justification");
                return;
              }
              if (!requiredChecks.entryCriteria || !requiredChecks.contributionGuidance) {
                onStepChange("scope");
                return;
              }
              if (!hasAnyPlanningData) {
                onStepChange("planning");
                return;
              }
              onStepChange("review");
            }}
          />
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-[var(--p-color-border)] bg-white/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-[var(--p-color-fg-muted)]">
          Etapa {stepIndex + 1} de {WIZARD_STEPS.length} · Rascunho salvo nesta tela
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onBackStep} disabled={stepIndex === 0} className="ux-btn-secondary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            Voltar
          </button>
          <button type="button" onClick={onSaveDraft} className="ux-btn-secondary rounded-xl px-4 py-2 text-sm font-semibold">
            Salvar rascunho
          </button>
          {!isLastStep ? (
            <button type="button" onClick={onNextStep} className="ux-btn-collab rounded-xl px-4 py-2 text-sm font-semibold">
              Próximo
            </button>
          ) : (
            <>
              <button type="button" onClick={() => onStepChange("identity")} className="ux-btn-secondary rounded-xl px-4 py-2 text-sm font-semibold">
                Revisar novamente
              </button>
              <button
                type="button"
                onClick={() => setProposalModalOpen(true)}
                disabled={creating || !wizardCanSubmit}
                className="ux-btn-collab inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PaperPlaneTilt size={17} weight="bold" />
                Enviar proposta para validação
              </button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {proposalModalOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--p-color-scrim-strong)] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-[640px] rounded-2xl border border-[var(--p-color-border)] bg-white shadow-2xl"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="border-b border-[var(--p-color-border-muted)] bg-gradient-to-r from-[var(--p-color-info-bg)] via-white to-[var(--p-color-collab-bg)] p-5">
                <h3 className="text-lg font-semibold text-[var(--p-color-brand-700)]">Enviar proposta para validação coletiva?</h3>
                <p className="mt-1 text-sm text-[var(--p-color-fg-muted)]">
                  Ao enviar, a chefia recebe a proposta para validação de escopo e abertura da contribuição setorial.
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-[var(--skeuo-border)] bg-[var(--skeuo-paper-soft)] p-4 shadow-[var(--skeuo-inset)]">
                  <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">O que acontece a seguir</p>
                  <OperationalTimeline
                    className="mt-3"
                    items={[
                      {
                        title: "Validação da chefia",
                        description: "A chefia analisa a proposta e valida o escopo da sala.",
                        tone: "action",
                      },
                      {
                        title: "Contribuição setorial",
                        description: "Após validação, os servidores do setor são convidados a contribuir.",
                        tone: "collab",
                      },
                      {
                        title: "Diagnóstico para compras",
                        description: "Compras e área técnica usam o diagnóstico para reduzir retrabalho.",
                        tone: "warning",
                      },
                      {
                        title: "Acompanhamento",
                        description: "Você acompanha contribuições, ajustes e consolidação da sala.",
                        tone: "success",
                      },
                    ]}
                  />
                </div>

                <div className="ux-panel-success rounded-xl p-4">
                  <p className="text-sm font-semibold text-[var(--p-color-success)]">Orientação coletiva</p>
                  <p className="mt-1 text-sm text-[var(--p-color-success)]">
                    Antes do envio, converse com os servidores do setor para alinhar necessidades comuns e evitar propostas fragmentadas.
                  </p>
                </div>

                {creating ? (
                  <motion.div
                    className="rounded-xl border border-[var(--p-color-border-muted)] bg-white p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--p-color-action)]">
                      <CircleNotch size={16} className="animate-spin" />
                      Enviando proposta...
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--p-color-border-muted)]">
                      <motion.div
                        className="h-full rounded-full bg-[var(--p-color-action)]"
                        initial={{ width: "0%" }}
                        animate={{ width: "85%" }}
                        transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                      />
                    </div>
                  </motion.div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--p-color-border-muted)] p-4">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setProposalModalOpen(false)}
                  className="ux-btn-secondary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  Voltar para revisar
                </button>
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleConfirmProposal}
                  className="ux-btn-collab inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {creating ? <CircleNotch size={16} className="animate-spin" /> : <PaperPlaneTilt size={16} weight="bold" />}
                  {creating ? "Enviando..." : "Confirmar e enviar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </form>
  );
}

function StepStateIcon({ state }: { state: StepVisualState }) {
  if (state === "completed") return <CheckCircle size={18} weight="fill" className="text-[var(--p-color-action)]" />;
  if (state === "current") return <Circle size={18} weight="fill" className="text-[var(--p-color-action)]" />;
  if (state === "error") return <WarningCircle size={18} weight="fill" className="text-[var(--p-color-warning)]" />;
  if (state === "recommended") return <WarningCircle size={18} weight="fill" className="animate-pulse text-[var(--p-color-warning)]" />;
  if (state === "optional") return <Circle size={18} className="text-[var(--p-color-fg-subtle)]" />;
  return <Circle size={18} className="text-[var(--p-color-fg-subtle)]" />;
}

function WizardCard({ title, helper, children }: { title: string; helper: string; children: ReactNode }) {
  return (
    <section className="skeuo-card p-5">
      <div className="skeuo-card-tab" />
      <h3 className="text-lg font-semibold text-[var(--p-color-brand-700)]">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--p-color-fg-muted)]">{helper}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ChipEditor({
  helper,
  label,
  onChange,
  suggestions,
  value,
}: {
  helper?: string;
  label: string;
  onChange: (next: string[]) => void;
  suggestions: string[];
  value: string[];
}) {
  const [customValue, setCustomValue] = useState("");
  return (
    <div>
      <p className="text-sm font-semibold text-[var(--p-color-fg-default)]">{label}</p>
      {helper ? <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">{helper}</p> : null}
      {suggestions.length === 0 ? (
        <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
          Nenhuma opção configurada no sistema. Você pode adicionar itens manualmente.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {suggestions.map((item) => {
          const active = value.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(toggleTextList(value, item))}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                active
                  ? "border-[var(--semantic-action)] bg-[var(--semantic-action-soft)] text-[var(--semantic-action)] shadow-sm"
                  : "border-[var(--skeuo-border)] bg-white text-[var(--p-color-fg-muted)] hover:border-[var(--semantic-action)]",
              )}
            >
              {item}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          className="w-full rounded-xl border border-[var(--p-color-border-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--p-color-brand-500)]"
          placeholder="Adicionar item personalizado"
        />
        <button
          type="button"
          onClick={() => {
            const normalized = customValue.trim();
            if (!normalized) return;
            onChange(toggleTextList(value, normalized));
            setCustomValue("");
          }}
          className="rounded-xl border border-[var(--p-color-border-strong)] px-3 text-sm font-semibold text-[var(--p-color-fg-default)]"
        >
          <Plus size={14} weight="bold" />
        </button>
      </div>
      {value.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange(value.filter((entry) => entry !== item))}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--skeuo-border-soft)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--p-color-fg-default)] shadow-[var(--skeuo-inset)]"
            >
              {item}
              <X size={12} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EditableCriteriaList({
  emptyText,
  label,
  onChange,
  placeholder,
  tone,
  values,
}: {
  emptyText: string;
  label: string;
  onChange: (next: string[]) => void;
  placeholder: string;
  tone: "in" | "out";
  values: string[];
}) {
  const [inputValue, setInputValue] = useState("");
  const toneClass =
    tone === "in"
      ? "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)]"
      : "border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)]";

  const cleanValues = values.filter((item) => item.trim());
  return (
    <section className={cn("rounded-xl border p-4 shadow-[var(--skeuo-inset)]", toneClass)}>
      <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">{label}</p>
      {cleanValues.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--p-color-fg-muted)]">{emptyText}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {cleanValues.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange(cleanValues.filter((entry) => entry !== item))}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--skeuo-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--p-color-fg-default)] shadow-[var(--skeuo-inset)]"
            >
              {item}
              <X size={12} />
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          className="w-full rounded-xl border border-[var(--p-color-border-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--p-color-brand-500)]"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => {
            const normalized = inputValue.trim();
            if (!normalized) return;
            onChange([...cleanValues, normalized]);
            setInputValue("");
          }}
          className="rounded-xl border border-[var(--p-color-border-strong)] bg-white px-3 text-sm font-semibold text-[var(--p-color-fg-default)]"
        >
          <Plus size={14} weight="bold" />
        </button>
      </div>
    </section>
  );
}

function CheckListEditor({
  label,
  onChange,
  options,
  values,
}: {
  label: string;
  onChange: (next: string[]) => void;
  options: string[];
  values: string[];
}) {
  const [customValue, setCustomValue] = useState("");
  return (
    <section>
      <p className="text-sm font-semibold text-[var(--p-color-fg-default)]">{label}</p>
      {options.length === 0 ? (
        <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
          Nenhuma opção configurada no sistema. Adicione itens manualmente.
        </p>
      ) : null}
      <div className="mt-2 space-y-2">
        {options.map((option) => {
          const checked = values.includes(option);
          return (
            <label key={option} className="flex items-center gap-2 text-sm text-[var(--p-color-fg-default)]">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(toggleTextList(values, option))}
                className="h-4 w-4 rounded border-[var(--p-color-border-strong)]"
              />
              {option}
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          className="w-full rounded-xl border border-[var(--p-color-border-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--p-color-brand-500)]"
          placeholder="Adicionar item personalizado"
        />
        <button
          type="button"
          onClick={() => {
            const normalized = customValue.trim();
            if (!normalized) return;
            onChange(toggleTextList(values, normalized));
            setCustomValue("");
          }}
          className="rounded-xl border border-[var(--p-color-border-strong)] px-3 text-sm font-semibold text-[var(--p-color-fg-default)]"
        >
          <Plus size={14} weight="bold" />
        </button>
      </div>
    </section>
  );
}

function ReviewSection({
  children,
  onEdit,
  title,
}: {
  children: ReactNode;
  onEdit?: () => void;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--skeuo-border)] bg-[var(--skeuo-paper-soft)] p-4 shadow-[var(--skeuo-inset)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">{title}</p>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-[var(--skeuo-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--p-color-fg-default)] shadow-[var(--skeuo-inset)] transition hover:border-[var(--semantic-action)] hover:text-[var(--semantic-action)]"
          >
            Editar
          </button>
        ) : null}
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function ReviewRow({
  label,
  ok,
  optional,
  value,
}: {
  label: string;
  ok: boolean;
  optional?: boolean;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-[var(--skeuo-border-soft)] bg-white p-3 shadow-[var(--skeuo-inset)]">
      {ok ? (
        <CheckCircle size={18} weight="fill" className="mt-0.5 text-[var(--p-color-success)]" />
      ) : optional ? (
        <Circle size={18} className="mt-0.5 text-[var(--p-color-fg-subtle)]" />
      ) : (
        <WarningCircle size={18} weight="fill" className="mt-0.5 text-[var(--p-color-warning)]" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--p-color-fg-muted)]">
          {label} {optional ? "(opcional)" : ""}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--p-color-fg-default)]">{value}</p>
      </div>
    </div>
  );
}

function LivePreview({
  draft,
  hasAnyPlanningData,
  requiredCompletion,
  requiredChecks,
  recommendedPendingLabels,
  selectedUnit,
  step,
  totalCompletion,
  onGoToFirstPending,
}: {
  draft: CollectiveRoomDraft;
  hasAnyPlanningData: boolean;
  requiredCompletion: number;
  requiredChecks: Record<string, boolean>;
  recommendedPendingLabels: string[];
  selectedUnit: UnitOption | null;
  step: WizardStepId;
  totalCompletion: number;
  onGoToFirstPending: () => void;
}) {
  const hasPreviewData = Boolean(draft.title.trim() || selectedUnit);
  const requiredPending = Object.values(requiredChecks).filter((ok) => !ok).length;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">Prévia da sala</p>
        <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-[var(--p-color-brand-500)]">
          {draft.title || "Nome da sala"}
        </h3>
        <p className="mt-1 text-sm text-[var(--p-color-fg-muted)]">
          Unidade: {selectedUnit?.nome || "pendente"}
        </p>
        <p className="text-sm text-[var(--p-color-fg-muted)]">Status: {CREATION_STATUS_LABELS[draft.status]}</p>
        <p className="text-sm text-[var(--p-color-fg-muted)]">Etapa atual: {WIZARD_STEPS.find((item) => item.id === step)?.label}</p>
      </div>
      {!hasPreviewData ? (
        <div className="rounded-xl border border-dashed border-[var(--p-color-border-strong)] bg-white p-3 text-sm text-[var(--p-color-fg-muted)]">
          A sala ainda não possui informações suficientes para prévia. Preencha os campos principais para visualizar o resumo.
        </div>
      ) : null}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--p-color-fg-muted)]">
          <span>Pronto para propor</span>
          <span>{requiredCompletion}%</span>
        </div>
        <div className="skeuo-rail mt-2 h-2 overflow-hidden rounded-full">
          <div className="skeuo-rail-fill h-full rounded-full bg-[var(--p-color-brand-500)] transition-all duration-500" style={{ width: `${requiredCompletion}%` }} />
        </div>
        <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
          {requiredPending === 0
            ? "Campos obrigatórios completos."
            : `Faltam ${requiredPending} campo(s) obrigatório(s).`}
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--p-color-fg-muted)]">
          <span>Preenchimento geral</span>
          <span>{totalCompletion}%</span>
        </div>
        <div className="skeuo-rail mt-2 h-2 overflow-hidden rounded-full">
          <div className="skeuo-rail-fill h-full rounded-full bg-[var(--p-color-success)] transition-all duration-500" style={{ width: `${totalCompletion}%` }} />
        </div>
      </div>
      <div className="space-y-2 rounded-xl border border-[var(--skeuo-border-soft)] bg-white p-3 shadow-[var(--skeuo-inset)]">
        <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">Clareza da proposta</p>
        <PreviewCheck label="Nome da sala" ok={requiredChecks.title} />
        <PreviewCheck label="Unidade / setor" ok={requiredChecks.unit} />
        <PreviewCheck label="Justificativa" ok={requiredChecks.description} />
        <PreviewCheck label="Critério de entrada" ok={requiredChecks.entryCriteria} />
        <PreviewCheck label="Orientação de contribuição" ok={requiredChecks.contributionGuidance} />
        <PreviewCheck label="Diagnóstico de apoio" ok={hasAnyPlanningData} optional />
      </div>
      <div className="rounded-xl border border-[var(--skeuo-border-soft)] bg-white p-3 shadow-[var(--skeuo-inset)]">
        <p className="text-sm font-semibold text-[var(--p-color-brand-700)]">Próximo melhor passo</p>
        <p className="mt-1 text-sm text-[var(--p-color-fg-muted)]">
          {recommendedPendingLabels.length > 0
            ? `Complete ${recommendedPendingLabels[0]} para aumentar a qualidade da análise.`
            : "A proposta está pronta para seguir para validação."}
        </p>
        <button
          type="button"
          onClick={onGoToFirstPending}
          className="mt-3 w-full rounded-lg border border-[var(--p-color-action)] px-3 py-2 text-sm font-semibold text-[var(--p-color-action)]"
        >
          Ir para próximo ponto
        </button>
      </div>
    </div>
  );
}

function PreviewCheck({
  label,
  ok,
  optional,
}: {
  label: string;
  ok: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--p-color-fg-muted)]">
      {ok ? (
        <CheckCircle size={16} weight="fill" className="text-[var(--p-color-success)]" />
      ) : optional ? (
        <Circle size={16} className="text-[var(--p-color-fg-subtle)]" />
      ) : (
        <WarningCircle size={16} weight="fill" className="text-[var(--p-color-warning)]" />
      )}
      <span>{label}</span>
    </div>
  );
}

function roomStatusTone(status: RoomListItem["status"]): OperationalTone {
  if (status === "proposta") return "insight";
  if (status === "aberta") return "collab";
  if (status === "em_consolidacao_chefia" || status === "pronta_para_conversao") return "warning";
  if (status === "convertida") return "success";
  return "neutral";
}

function RoomCard({ room }: { room: RoomListItem }) {
  const summary = room.summary;
  const stageHint =
    room.status === "proposta"
      ? "Rascunho visível apenas ao proponente e à chefia."
      : room.status === "aberta"
      ? "Recebendo contribuições do setor."
      : room.status === "em_consolidacao_chefia"
      ? "A chefia assumiu a consolidação e pode reescrever contribuições."
      : room.status === "pronta_para_conversao"
      ? "Prévia pronta para gerar uma ou mais DFDs oficiais."
      : room.status === "convertida"
      ? "Já gerou DFD oficial."
      : "Sala encerrada para novas contribuições.";
  return (
    <Link
      href={`/dfds-coletivas/${room.id}`}
      className="skeuo-card group block rounded-[18px] p-5 no-underline transition hover:-translate-y-0.5 hover:border-[var(--semantic-collab)] hover:bg-[var(--p-color-bg-elevated)]"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <OperationalChip tone={roomStatusTone(room.status)}>
              {STATUS_LABELS[room.status]}
            </OperationalChip>
            {summary?.userHasContributed && (
              <OperationalChip tone="success">Você contribuiu</OperationalChip>
            )}
          </div>
          <h3 className="mt-2 break-words text-base font-semibold text-[var(--semantic-text)]">
            {room.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--p-color-fg-muted)]">
            {room.description || room.scope || "DFD coletiva sem descrição."}
          </p>
          <p className="mt-2 text-xs font-semibold text-[var(--semantic-collab)]">{stageHint}</p>
          <p className="mt-2 text-xs font-medium text-[var(--p-color-fg-muted)]">
            {room.unit_name} · Atualizada em{" "}
            {new Date(room.updated_at).toLocaleDateString("pt-BR")}
          </p>
          <AvatarStack
            members={buildRoomAvatarMembers(room)}
            total={summary?.participantCount || 0}
            label={
              summary?.participantCount
                ? `${summary.participantCount} participante(s) na sala`
                : "Aguardando primeira contribuição"
            }
            size="sm"
            className="mt-3"
          />
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:min-w-[280px] sm:grid-cols-4">
          <MiniMetric label="Pessoas" value={summary?.participantCount || 0} />
          <MiniMetric label="Itens" value={summary?.itemCount || 0} />
          <MiniMetric label="Qtd." value={summary?.totalQuantity || 0} />
          <MiniMetric
            label="Valor"
            value={(summary?.totalValue || 0).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
              maximumFractionDigits: 0,
            })}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end text-xs font-semibold uppercase tracking-wider text-[var(--semantic-collab)]">
        Entrar na sala <ArrowRight size={14} className="ml-1" weight="bold" />
      </div>
    </Link>
  );
}

function buildRoomAvatarMembers(room: RoomListItem): AvatarStackMember[] {
  const participantCount = Math.min(4, Number(room.summary?.participantCount || 0));
  if (participantCount <= 0) return [];
  return Array.from({ length: participantCount }, (_, index) => ({
    id: `${room.id}-participant-${index}`,
    name: index === 0 ? room.unit_name : `Participante ${index + 1}`,
    avatarUrl: null,
  }));
}

function RoomsPagination({
  page,
  totalPages,
  count,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  count: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--skeuo-border)] bg-white px-4 py-3 shadow-[var(--skeuo-inset)] sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-[var(--p-color-fg-muted)]">
        {count} salas · página {page} de {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="ux-btn-secondary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CaretLeft size={14} weight="bold" />
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="ux-btn-secondary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Próxima
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[var(--skeuo-border-soft)] bg-[var(--semantic-neutral-soft)] px-2 py-2 text-center shadow-[var(--skeuo-inset)]">
      <p className="type-micro font-semibold uppercase tracking-wider text-[var(--p-color-fg-muted)]">
        {label}
      </p>
      <p className="min-w-0 overflow-visible text-xs font-semibold text-[var(--semantic-text)]">
        <MechanicalValue value={value} />
      </p>
    </div>
  );
}
