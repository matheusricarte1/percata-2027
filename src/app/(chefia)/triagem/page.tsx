"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useDeferredValue,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Virtuoso } from "react-virtuoso";
import {
  CheckCircle,
  CircleNotch,
  Clock,
  ArrowRight,
  MagnifyingGlass,
  ArrowClockwise,
  Star,
  WarningCircle,
  ChatText,
  UserCircle,
  TrendUp,
  Buildings,
  Stack,
  X,
  SlidersHorizontal,
  Lightning,
} from "@phosphor-icons/react";
import { getSafeUser, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isSuperadminEmail } from "@/lib/access";
import { DFD_PROCESS_STEPS } from "@/lib/dfd-process-guide";
import { parseCollectiveDistributionText } from "@/lib/collective-dfd";
import { buildPcaGoalMetrics } from "@/lib/chefia-summary";

interface DfdRow {
  id: string;
  solicitante_id: string | null;
  numero_protocolo: string;
  objeto_contratacao: string;
  justificativa_contratacao: string | null;
  justificativa_quantidade?: string | null;
  status: string;
  valor_total_estimado: number | null;
  created_at: string | null;
  previsao_recebimento?: string | null;
  campus?: string | null;
  campus_id?: string | null;
  campus_nome?: string | null;
  unidade_id?: string | null;
  tipo_unidade?: "departamento" | "laboratorio" | null;
  unidade_nome?: string | null;
  analysis_unidade_id?: string | null;
  analysis_tipo_unidade?: "departamento" | "laboratorio" | null;
  analysis_unidade_nome?: string | null;
  analysis_routing_reason?: string | null;
  prioridade?: number | null;
  versao?: number | null;
  item_count?: number;
  profiles?: ProfileLite | null;
}

interface DfdItemRow {
  id: string;
  dfd_id?: string;
  codigo_tce: string;
  descricao: string;
  quantidade: number;
  valor_unitario_estimado: number;
  is_highlight_item: boolean;
  local_uso: string | null;
  link_referencia: string | null;
  gnd: string | null;
  justificativa_item?: string | null;
  justificativa_quantidade?: string | null;
  criticidade?: "critica" | "alta" | "media" | "baixa" | null;
  moscow_categoria?:
    | "deve_ter"
    | "deveria_ter"
    | "poderia_ter"
    | "nao_tera_agora"
    | null;
}

interface TriagemItemGlobal extends DfdItemRow {
  dfd_id: string;
  numero_protocolo: string;
  objeto_contratacao: string;
  solicitante_nome: string;
  solicitante_email: string;
  campus_nome: string | null;
  unidade_nome: string | null;
}

const DFD_TRIAGEM_SELECT =
  "id, solicitante_id, numero_protocolo, objeto_contratacao, justificativa_contratacao, justificativa_quantidade, status, valor_total_estimado, created_at, previsao_recebimento, campus, campus_id, unidade_id, tipo_unidade, analysis_unidade_id, analysis_tipo_unidade, analysis_routing_reason, prioridade, versao";

const DFD_TRIAGEM_SELECT_LEGACY =
  "id, solicitante_id, numero_protocolo, objeto_contratacao, justificativa_contratacao, justificativa_quantidade, status, valor_total_estimado, created_at, previsao_recebimento, campus, campus_id, unidade_id, tipo_unidade, prioridade, versao";

function isMissingAnalysisRoutingColumn(error: any) {
  return /analysis_unidade_id|analysis_tipo_unidade|analysis_routing_reason/i.test(
    String(error?.message || ""),
  );
}

const CRITICIDADE_OPTIONS: Array<{
  value: NonNullable<DfdItemRow["criticidade"]>;
  label: string;
  score: number;
}> = [
  { value: "critica", label: "Crítica", score: 40 },
  { value: "alta", label: "Alta", score: 30 },
  { value: "media", label: "Média", score: 20 },
  { value: "baixa", label: "Baixa", score: 10 },
];

const MOSCOW_OPTIONS: Array<{
  value: NonNullable<DfdItemRow["moscow_categoria"]>;
  label: string;
  score: number;
}> = [
  {
    value: "deve_ter",
    label: "Essencial",
    score: 40,
  },
  {
    value: "deveria_ter",
    label: "Relevante",
    score: 30,
  },
  {
    value: "poderia_ter",
    label: "Oportuno",
    score: 20,
  },
  {
    value: "nao_tera_agora",
    label: "Postergado",
    score: 10,
  },
];

const CRITICIDADE_LEVEL_SEQUENCE: Array<NonNullable<DfdItemRow["criticidade"]>> = [
  "baixa",
  "media",
  "alta",
  "critica",
];

const PRIORIZACAO_LEVEL_SEQUENCE: Array<
  NonNullable<DfdItemRow["moscow_categoria"]>
> = ["nao_tera_agora", "poderia_ter", "deveria_ter", "deve_ter"];

const HIERARQUIZACAO_INTRO_STORAGE_KEY =
  "percata:triagem:hierarquizacao:intro-hidden";

interface ProfileLite {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
}

interface CurrentUserLite {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

function resolveRequesterName(
  dfd: DfdRow,
  currentUser: CurrentUserLite | null,
): string {
  const profileName = String(dfd.profiles?.full_name || "").trim();
  if (profileName) return profileName;

  const profileEmail = String(dfd.profiles?.email || "").trim();
  if (profileEmail) return profileEmail;

  if (currentUser?.id && dfd.solicitante_id === currentUser.id) {
    const selfName = String(currentUser.full_name || "").trim();
    if (selfName) return selfName;
    const selfEmail = String(currentUser.email || "").trim();
    if (selfEmail) return selfEmail;
    return "Você";
  }

  if (dfd.solicitante_id) return `Usuário ${dfd.solicitante_id.slice(0, 8)}`;
  return "Solicitante não identificado";
}

function getRequesterInitials(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = String(fullName || "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
  }

  const emailPrefix = String(email || "").split("@")[0].trim();
  if (emailPrefix.length >= 2) return emailPrefix.slice(0, 2).toUpperCase();
  if (emailPrefix.length === 1) return `${emailPrefix[0].toUpperCase()}U`;
  return "US";
}

function getCriticidadeLevel(value: DfdItemRow["criticidade"]): number {
  if (!value) return 0;
  const idx = CRITICIDADE_LEVEL_SEQUENCE.indexOf(
    value as NonNullable<DfdItemRow["criticidade"]>,
  );
  return idx >= 0 ? idx + 1 : 0;
}

function getPriorizacaoLevel(value: DfdItemRow["moscow_categoria"]): number {
  if (!value) return 0;
  const idx = PRIORIZACAO_LEVEL_SEQUENCE.indexOf(
    value as NonNullable<DfdItemRow["moscow_categoria"]>,
  );
  return idx >= 0 ? idx + 1 : 0;
}

function levelToCriticidade(level: number): DfdItemRow["criticidade"] {
  if (!Number.isFinite(level) || level <= 0) return null;
  const clamped = Math.max(1, Math.min(4, Math.floor(level)));
  return CRITICIDADE_LEVEL_SEQUENCE[clamped - 1] || null;
}

function levelToPriorizacao(level: number): DfdItemRow["moscow_categoria"] {
  if (!Number.isFinite(level) || level <= 0) return null;
  const clamped = Math.max(1, Math.min(4, Math.floor(level)));
  return PRIORIZACAO_LEVEL_SEQUENCE[clamped - 1] || null;
}

function getCriticidadeLabel(value: DfdItemRow["criticidade"]): string {
  return (
    CRITICIDADE_OPTIONS.find((option) => option.value === value)?.label ||
    "Não definida"
  );
}

function getPriorizacaoLabel(value: DfdItemRow["moscow_categoria"]): string {
  return (
    MOSCOW_OPTIONS.find((option) => option.value === value)?.label || "Não definida"
  );
}

function getCriticidadeAccentColor(level: number): string {
  if (level >= 4) return "var(--upe-red-upe)";
  if (level === 3) return "var(--upe-warm-light-terracotta)";
  if (level === 2) return "var(--upe-accent-matte-gold)";
  if (level === 1) return "var(--upe-support-blue-medium-teal)";
  return "var(--upe-neutral-cool-steel-gray)";
}

function getPriorizacaoAccentColor(level: number): string {
  if (level >= 4) return "var(--upe-blue-upe)";
  if (level === 3) return "var(--upe-blue-medium)";
  if (level === 2) return "var(--upe-blue-closed-sky)";
  if (level === 1) return "var(--upe-support-blue-neutral-aqua)";
  return "var(--upe-neutral-cool-steel-gray)";
}

function getItemSubtotal(item: {
  quantidade: number;
  valor_unitario_estimado: number;
}): number {
  return Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0);
}

function getSmartRankScore(item: DfdItemRow): number {
  const criticidadeLevel = getCriticidadeLevel(item.criticidade);
  const priorizacaoLevel = getPriorizacaoLevel(item.moscow_categoria);
  const gutMatrix = criticidadeLevel * priorizacaoLevel;
  const monetarySignal = Math.log10(getItemSubtotal(item) + 1);

  return gutMatrix * 10 + criticidadeLevel * 6 + priorizacaoLevel * 6 + monetarySignal;
}

export default function TriagemPage() {
  const [dfds, setDfds] = useState<DfdRow[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUserLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingDfd, setOpeningDfd] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDfd, setSelectedDfd] = useState<DfdRow | null>(null);
  const [items, setItems] = useState<DfdItemRow[]>([]);
  const [sheetView, setSheetView] = useState<"resumo" | "itens">("resumo");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [devolucaoComment, setDevolucaoComment] = useState("");
  const [devolvendo, setDevolvendo] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [batchSheetOpen, setBatchSheetOpen] = useState(false);
  const [hierarquizacaoIntroOpen, setHierarquizacaoIntroOpen] = useState(false);
  const [hierarquizacaoSkipNext, setHierarquizacaoSkipNext] = useState(false);
  const [hierarquizacaoIntroDisabled, setHierarquizacaoIntroDisabled] = useState(false);
  const [globalItems, setGlobalItems] = useState<TriagemItemGlobal[]>([]);
  const [globalItemsLoading, setGlobalItemsLoading] = useState(false);
  const [globalItemsSaving, setGlobalItemsSaving] = useState(false);
  const [globalApproving, setGlobalApproving] = useState(false);
  const [globalDirtyIds, setGlobalDirtyIds] = useState<Record<string, true>>({});
  const [globalLastSavedAt, setGlobalLastSavedAt] = useState<Date | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalControlsExpanded, setGlobalControlsExpanded] = useState(false);
  const [queueHasAnimated, setQueueHasAnimated] = useState(false);
  const deferredGlobalSearch = useDeferredValue(globalSearch);
  const currentUserRef = useRef<CurrentUserLite | null>(null);

  const syncCurrentUserProfile = useCallback(async (user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any>;
  }) => {
    const metadata = (user.user_metadata || {}) as Record<string, any>;
    const fullName = String(
      metadata.full_name ||
        metadata.name ||
        `${metadata.given_name || ""} ${metadata.family_name || ""}`.trim(),
    ).trim();
    const avatarUrl = String(metadata.avatar_url || metadata.picture || "").trim();

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ? String(user.email).toLowerCase() : null,
        full_name: fullName || null,
        avatar_url: avatarUrl || null,
      },
      { onConflict: "id" },
    );

    // Backward compatibility while migration is not applied
    if (error && /avatar_url/i.test(String(error.message || ""))) {
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ? String(user.email).toLowerCase() : null,
          full_name: fullName || null,
        },
        { onConflict: "id" },
      );
    }
  }, []);

  const hydrateProfiles = useCallback(async (records: DfdRow[]) => {
    const solicitanteIds = Array.from(
      new Set(
        (records || [])
          .map((d) => d.solicitante_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (solicitanteIds.length === 0) return records;

    let profilesData: ProfileLite[] | null = null;
    let profilesError: any = null;
    {
      const result = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", solicitanteIds);
      profilesData = (result.data as ProfileLite[] | null) || null;
      profilesError = result.error;
    }

    if (profilesError && /avatar_url/i.test(String(profilesError.message || ""))) {
      const fallback = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", solicitanteIds);
      profilesData = (fallback.data as ProfileLite[] | null) || null;
      profilesError = fallback.error;
    }

    if (profilesError) throw profilesError;

    const profileMap = new Map(
      (profilesData || []).map((profile: ProfileLite) => [profile.id, profile]),
    );

    return (records || []).map((record) => ({
      ...record,
      profiles: (record.solicitante_id && profileMap.get(record.solicitante_id)) || null,
    }));
  }, []);

  const attachItemCounts = useCallback(async (records: DfdRow[]) => {
    const ids = (records || []).map((record) => record.id).filter(Boolean);
    if (ids.length === 0) return records;

    const { data, error } = await supabase
      .from("dfd_items")
      .select("dfd_id")
      .in("dfd_id", ids);
    if (error) throw error;

    const countMap = new Map<string, number>();
    (data || []).forEach((row: { dfd_id: string }) => {
      countMap.set(row.dfd_id, (countMap.get(row.dfd_id) || 0) + 1);
    });

    return records.map((record) => ({
      ...record,
      item_count: countMap.get(record.id) || 0,
    }));
  }, []);

  const fetchItemsByDfdIds = useCallback(async (dfdIds: string[]) => {
    if (dfdIds.length === 0) return [] as DfdItemRow[];

    const fullSelect =
      "id, dfd_id, codigo_tce, descricao, quantidade, valor_unitario_estimado, is_highlight_item, local_uso, link_referencia, gnd, justificativa_item, justificativa_quantidade, criticidade, moscow_categoria";
    const fallbackSelect =
      "id, dfd_id, codigo_tce, descricao, quantidade, valor_unitario_estimado, is_highlight_item, local_uso, link_referencia, gnd, justificativa_item, justificativa_quantidade";

    let queryResult: any = await supabase
      .from("dfd_items")
      .select(fullSelect)
      .in("dfd_id", dfdIds);

    if (
      queryResult.error &&
      /criticidade|moscow_categoria/i.test(String(queryResult.error.message || ""))
    ) {
      queryResult = await supabase
        .from("dfd_items")
        .select(fallbackSelect)
        .in("dfd_id", dfdIds);
    }

    if (queryResult.error) throw queryResult.error;

    return ((queryResult.data || []) as any[]).map((item) => ({
      ...item,
      quantidade: Math.max(1, Math.floor(Number(item.quantidade || 1))),
      valor_unitario_estimado: Number(item.valor_unitario_estimado || 0),
      is_highlight_item: Boolean(item.is_highlight_item),
      criticidade: item.criticidade || null,
      moscow_categoria: item.moscow_categoria || null,
    })) as DfdItemRow[];
  }, []);

  const fetchGlobalItems = useCallback(
    async (records: DfdRow[], viewer: CurrentUserLite | null = null) => {
      const ids = records.map((record) => record.id).filter(Boolean);
      if (ids.length === 0) {
        setGlobalItems([]);
        return;
      }

      const activeViewer = viewer || currentUserRef.current;

      setGlobalItemsLoading(true);
      try {
        const itemRows = await fetchItemsByDfdIds(ids);
        const dfdMap = new Map(records.map((record) => [record.id, record]));

        const mapped: TriagemItemGlobal[] = itemRows
          .map((item) => {
            const owner = dfdMap.get(String(item.dfd_id || ""));
            if (!owner) return null;
            return {
              ...item,
              dfd_id: String(item.dfd_id || owner.id),
              numero_protocolo: owner.numero_protocolo,
              objeto_contratacao: owner.objeto_contratacao,
              solicitante_nome: resolveRequesterName(owner, activeViewer),
              solicitante_email:
                String(owner.profiles?.email || "").trim() ||
                (owner.solicitante_id === activeViewer?.id
                  ? String(activeViewer?.email || "").trim()
                  : ""),
              campus_nome: owner.campus_nome || owner.campus || null,
              unidade_nome: owner.unidade_nome || null,
            };
          })
          .filter((row): row is TriagemItemGlobal => Boolean(row));

        setGlobalItems(mapped);
        setGlobalDirtyIds({});
      } catch (error: any) {
        toast.error(
          "Erro ao carregar priorização em lote: " +
            (error?.message || "erro desconhecido"),
        );
        setGlobalItems([]);
      } finally {
        setGlobalItemsLoading(false);
      }
    },
    [fetchItemsByDfdIds],
  );

  const getGlobalRankingScore = (item: DfdItemRow) => getSmartRankScore(item);

  const resetDialogState = () => {
    setDialogOpen(false);
    setSelectedDfd(null);
    setItems([]);
    setSheetView("resumo");
    setDevolvendo(false);
    setDevolucaoComment("");
  };

  const getHighlightLimit = (totalItems: number) =>
    totalItems > 0 ? Math.max(1, Math.ceil(totalItems * 0.2)) : 0;

  const fetchDfds = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getSafeUser();
      if (!user) return;
      const metadata = (user.user_metadata || {}) as Record<string, any>;
      const authName = String(
        metadata.full_name ||
          metadata.name ||
          `${metadata.given_name || ""} ${metadata.family_name || ""}`.trim(),
      ).trim();
      const authAvatar = String(metadata.avatar_url || metadata.picture || "").trim();
      const nextCurrentUser: CurrentUserLite = {
        id: user.id,
        email: user.email || null,
        full_name: authName || null,
        avatar_url: authAvatar || null,
      };
      currentUserRef.current = nextCurrentUser;
      setCurrentUser((prev) => {
        if (
          prev &&
          prev.id === nextCurrentUser.id &&
          prev.email === nextCurrentUser.email &&
          prev.full_name === nextCurrentUser.full_name &&
          prev.avatar_url === nextCurrentUser.avatar_url
        ) {
          return prev;
        }
        return nextCurrentUser;
      });
      await syncCurrentUserProfile(user);

      if (isSuperadminEmail(user.email)) {
        let result: any = await supabase
          .from("dfds")
          .select(DFD_TRIAGEM_SELECT)
          .eq("status", "triagem")
          .order("created_at", { ascending: false });

        if (result.error && isMissingAnalysisRoutingColumn(result.error)) {
          result = await supabase
            .from("dfds")
            .select(DFD_TRIAGEM_SELECT_LEGACY)
            .eq("status", "triagem")
            .order("created_at", { ascending: false });
        }

        if (result.error) throw result.error;
        const hydrated = await hydrateProfiles(result.data || []);
        const withCounts = await attachItemCounts(hydrated || []);
        setDfds(withCounts || []);
        await fetchGlobalItems(withCounts || [], nextCurrentUser);
        return;
      }

      // Busca quais unidades o usuário chefia
      const { data: units } = await supabase
        .from("user_units")
        .select("unit_id")
        .eq("user_id", user.id)
        .eq("role_in_unit", "chefia");

      const unitIds = units?.map((u) => u.unit_id) || [];
      if (unitIds.length === 0) {
        setDfds([]);
        setGlobalItems([]);
        setGlobalDirtyIds({});
        return;
      }

      // Busca DFDs enviadas para essas unidades
      const unitList = unitIds.join(",");
      let result: any = await supabase
        .from("dfds")
        .select(DFD_TRIAGEM_SELECT)
        .or(`analysis_unidade_id.in.(${unitList}),unidade_id.in.(${unitList})`)
        .eq("status", "triagem")
        .order("created_at", { ascending: false });

      if (result.error && isMissingAnalysisRoutingColumn(result.error)) {
        result = await supabase
          .from("dfds")
          .select(DFD_TRIAGEM_SELECT_LEGACY)
          .in("unidade_id", unitIds)
          .eq("status", "triagem")
          .order("created_at", { ascending: false });
      }

      if (result.error) throw result.error;
      const scopedRows = ((result.data || []) as DfdRow[]).filter((dfd) => {
        const analysisUnit = dfd.analysis_unidade_id || dfd.unidade_id;
        return analysisUnit ? unitIds.includes(analysisUnit) : false;
      });
      const hydrated = await hydrateProfiles(scopedRows || []);
      const withCounts = await attachItemCounts(hydrated || []);
      setDfds(withCounts || []);
      await fetchGlobalItems(withCounts || [], nextCurrentUser);
    } catch (e: any) {
      toast.error("Erro ao carregar demandas: " + (e?.message || "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [attachItemCounts, fetchGlobalItems, hydrateProfiles, syncCurrentUserProfile]);

  useEffect(() => {
    fetchDfds();
  }, [fetchDfds]);

  useEffect(() => {
    try {
      const disabled =
        window.localStorage.getItem(HIERARQUIZACAO_INTRO_STORAGE_KEY) === "1";
      if (disabled) {
        setHierarquizacaoIntroDisabled(true);
        setHierarquizacaoSkipNext(true);
      }
    } catch {
      // noop: storage may be unavailable
    }
  }, []);

  useEffect(() => {
    if (!loading && !queueHasAnimated) {
      setQueueHasAnimated(true);
    }
  }, [loading, queueHasAnimated]);

  useEffect(() => {
    if (!dialogOpen) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") resetDialogState();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [dialogOpen]);

  useEffect(() => {
    if (!batchSheetOpen) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBatchSheetOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [batchSheetOpen]);

  useEffect(() => {
    if (!hierarquizacaoIntroOpen) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHierarquizacaoIntroOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [hierarquizacaoIntroOpen]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    const shouldLockScroll = batchSheetOpen || dialogOpen || hierarquizacaoIntroOpen;
    if (!shouldLockScroll) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [batchSheetOpen, dialogOpen, hierarquizacaoIntroOpen]);

  const openDfd = async (dfd: DfdRow) => {
    setSelectedDfd(dfd);
    setOpeningDfd(true);
    try {
      let detailsResult: any = await supabase
        .from("dfds")
        .select(DFD_TRIAGEM_SELECT)
        .eq("id", dfd.id)
        .maybeSingle();
      if (detailsResult.error && isMissingAnalysisRoutingColumn(detailsResult.error)) {
        detailsResult = await supabase
          .from("dfds")
          .select(DFD_TRIAGEM_SELECT_LEGACY)
          .eq("id", dfd.id)
          .maybeSingle();
      }
      if (detailsResult.error) throw detailsResult.error;
      const dfdDetails = detailsResult.data as DfdRow | null;

      let campusNome: string | null = null;
      if (dfdDetails?.campus_id) {
        const { data: campusData } = await supabase
          .from("campi")
          .select("nome, sigla")
          .eq("id", dfdDetails.campus_id)
          .maybeSingle();
        campusNome = String(campusData?.nome || campusData?.sigla || "").trim() || null;
      }

      let unidadeNome: string | null = null;
      if (dfdDetails?.unidade_id && dfdDetails?.tipo_unidade) {
        const sourceTable =
          dfdDetails.tipo_unidade === "departamento" ? "departamentos" : "laboratorios";
        const { data: unidadeData } = await supabase
          .from(sourceTable)
          .select("nome")
          .eq("id", dfdDetails.unidade_id)
          .maybeSingle();
        unidadeNome = String(unidadeData?.nome || "").trim() || null;
      }
      let analysisUnidadeNome: string | null = null;
      const analysisUnitId = dfdDetails?.analysis_unidade_id || dfdDetails?.unidade_id;
      const analysisType = dfdDetails?.analysis_tipo_unidade || dfdDetails?.tipo_unidade;
      if (analysisUnitId && analysisType) {
        const sourceTable = analysisType === "departamento" ? "departamentos" : "laboratorios";
        const { data: unidadeData } = await supabase
          .from(sourceTable)
          .select("nome")
          .eq("id", analysisUnitId)
          .maybeSingle();
        analysisUnidadeNome = String(unidadeData?.nome || "").trim() || null;
      }

      setSelectedDfd({
        ...dfd,
        ...(dfdDetails || {}),
        campus_nome: campusNome || dfd.campus || null,
        unidade_nome: unidadeNome || null,
        analysis_unidade_nome: analysisUnidadeNome || unidadeNome || null,
      });

      const dfdItems = await fetchItemsByDfdIds([dfd.id]);
      setItems(dfdItems);
      setDevolvendo(dfdItems.length === 0);
      if (dfdItems.length === 0) {
        setDevolucaoComment(
          "DFD devolvida automaticamente para correção: não há itens vinculados à demanda.",
        );
      }
      setSheetView("resumo");
      setDialogOpen(true);
    } catch (e: any) {
      toast.error("Erro ao abrir demanda: " + (e?.message || "erro desconhecido"));
    } finally {
      setOpeningDfd(false);
    }
  };

  const updateItemQty = (id: string, qty: number) => {
    const safeQty = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantidade: safeQty } : item)),
    );
  };

  const updateItemCriticidade = (
    id: string,
    criticidade: DfdItemRow["criticidade"],
  ) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, criticidade } : item)));
  };

  const updateItemMoscow = (
    id: string,
    moscow_categoria: DfdItemRow["moscow_categoria"],
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, moscow_categoria } : item,
      ),
    );
  };

  const toggleItemPareto = (id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;

      const currentHighlights = prev.filter((item) => item.is_highlight_item).length;
      const limit = getHighlightLimit(prev.length);
      if (!target.is_highlight_item && currentHighlights >= limit) {
        toast.warning(`Limite de Pareto atingido: máximo de ${limit} itens em destaque.`);
        return prev;
      }

      return prev.map((item) =>
        item.id === id ? { ...item, is_highlight_item: !item.is_highlight_item } : item,
      );
    });
  };

  const applyGlobalItemPatch = useCallback((
    id: string,
    patch: Partial<TriagemItemGlobal>,
  ) => {
    setGlobalItems((prev) => {
      const patched = prev.map((item) => {
        if (item.id !== id) return item;
        return { ...item, ...patch };
      });
      setGlobalDirtyIds((prevDirty) => {
        return { ...prevDirty, [id]: true };
      });
      setGlobalLastSavedAt(null);
      return patched;
    });
  }, []);

  const updateGlobalItem = useCallback(
    (id: string, patch: Partial<TriagemItemGlobal>) => {
      applyGlobalItemPatch(id, patch);
    },
    [applyGlobalItemPatch],
  );

  const toggleGlobalPareto = useCallback((id: string) => {
    setGlobalItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;

      const limit = getHighlightLimit(prev.length);
      const currentHighlights = prev.filter((item) => item.is_highlight_item).length;

      if (!target.is_highlight_item && currentHighlights >= limit) {
        toast.warning(`Limite de Pareto do lote atingido: máximo de ${limit} itens.`);
        return prev;
      }

      return prev.map((item) =>
        item.id === id ? { ...item, is_highlight_item: !item.is_highlight_item } : item,
      );
    });
    setGlobalDirtyIds((prev) => ({ ...prev, [id]: true }));
    setGlobalLastSavedAt(null);
  }, []);

  const persistHierarquizacaoIntroPreference = useCallback((skip: boolean) => {
    if (!skip) return;
    try {
      window.localStorage.setItem(HIERARQUIZACAO_INTRO_STORAGE_KEY, "1");
    } catch {
      // noop: storage may be unavailable
    }
    setHierarquizacaoIntroDisabled(true);
  }, []);

  const openHierarquizacaoSheet = useCallback(() => {
    if (hierarquizacaoIntroDisabled) {
      setBatchSheetOpen(true);
      return;
    }
    setHierarquizacaoSkipNext(false);
    setHierarquizacaoIntroOpen(true);
  }, [hierarquizacaoIntroDisabled]);

  const closeHierarquizacaoIntro = useCallback(() => {
    persistHierarquizacaoIntroPreference(hierarquizacaoSkipNext);
    setHierarquizacaoIntroOpen(false);
  }, [hierarquizacaoSkipNext, persistHierarquizacaoIntroPreference]);

  const continueHierarquizacaoIntro = useCallback(() => {
    persistHierarquizacaoIntroPreference(hierarquizacaoSkipNext);
    setHierarquizacaoIntroOpen(false);
    setBatchSheetOpen(true);
  }, [hierarquizacaoSkipNext, persistHierarquizacaoIntroPreference]);

  const saveGlobalPrioritization = async () => {
    const dirtyIds = Object.keys(globalDirtyIds);
    if (dirtyIds.length === 0) {
      toast.info("Nenhuma alteração pendente na priorização em lote.");
      return;
    }

    setGlobalItemsSaving(true);
    try {
      const dirtyItems = globalItems.filter((item) => dirtyIds.includes(item.id));
      await Promise.all(
        dirtyItems.map(async (item) => {
          const { error } = await supabase
            .from("dfd_items")
            .update({
              is_highlight_item: Boolean(item.is_highlight_item),
              criticidade: item.criticidade || null,
              moscow_categoria: item.moscow_categoria || null,
            })
            .eq("id", item.id);
          if (error) throw error;
        }),
      );
      toast.success("Priorização em lote salva com sucesso.");
      setGlobalDirtyIds({});
      setGlobalLastSavedAt(new Date());
    } catch (error: any) {
      toast.error("Erro ao salvar priorização em lote: " + (error?.message || ""));
    } finally {
      setGlobalItemsSaving(false);
    }
  };

  const approveGlobalBatch = async () => {
    if (Object.keys(globalDirtyIds).length > 0) {
      toast.warning(
        "Há alterações pendentes. Salve a priorização em lote antes de homologar geral.",
      );
      return;
    }

    if (globalItems.length === 0) {
      toast.info("Não há itens para homologação em lote.");
      return;
    }

    const emptyDfds = dfds.filter((dfd) => Number(dfd.item_count || 0) <= 0);
    if (emptyDfds.length > 0) {
      toast.error(
        `Existem ${emptyDfds.length} DFD(s) sem itens na fila. Devolva essas demandas antes da homologação geral.`,
      );
      return;
    }

    const missingCriticidade = globalItems.filter((item) => !item.criticidade).length;
    const missingPriorizacao = globalItems.filter((item) => !item.moscow_categoria).length;
    if (missingCriticidade > 0 || missingPriorizacao > 0) {
      toast.error(
        `Preencha a hierarquização antes de homologar geral: ${missingCriticidade} sem criticidade e ${missingPriorizacao} sem priorização.`,
      );
      return;
    }

    const groupedItems = new Map<string, TriagemItemGlobal[]>();
    for (const item of globalItems) {
      const dfdId = String(item.dfd_id || "").trim();
      if (!dfdId) continue;
      const list = groupedItems.get(dfdId) || [];
      list.push(item);
      groupedItems.set(dfdId, list);
    }

    const dfdOverPareto = Array.from(groupedItems.entries()).filter(([, group]) => {
      const limit = getHighlightLimit(group.length);
      const highlightedCount = group.filter((item) => item.is_highlight_item).length;
      return highlightedCount > limit;
    });
    if (dfdOverPareto.length > 0) {
      toast.error(
        `Existem ${dfdOverPareto.length} DFD(s) acima do limite Pareto (20%). Ajuste antes da homologação geral.`,
      );
      return;
    }

    const byDfd = new Map<
      string,
      { total: number; itemCount: number; highlights: number; protocolo: string }
    >();
    for (const item of globalItems) {
      const dfdId = String(item.dfd_id || "").trim();
      if (!dfdId) continue;
      const prev = byDfd.get(dfdId) || {
        total: 0,
        itemCount: 0,
        highlights: 0,
        protocolo: String(item.numero_protocolo || ""),
      };
      prev.total +=
        Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0);
      prev.itemCount += 1;
      if (item.is_highlight_item) prev.highlights += 1;
      if (!prev.protocolo) prev.protocolo = String(item.numero_protocolo || "");
      byDfd.set(dfdId, prev);
    }

    const dfdIds = Array.from(byDfd.keys());
    if (dfdIds.length === 0) {
      toast.error("Não foi possível mapear DFDs para homologação em lote.");
      return;
    }

    setGlobalApproving(true);
    try {
      const user = await getSafeUser();
      if (!user) return;

      await Promise.all(
        dfdIds.map(async (dfdId) => {
          const totals = byDfd.get(dfdId)!;
          const { error } = await supabase
            .from("dfds")
            .update({
              status: "aprovada",
              valor_total_estimado: totals.total,
            })
            .eq("id", dfdId)
            .eq("status", "triagem");
          if (error) throw error;
        }),
      );

      const logsPayload = dfdIds.map((dfdId) => {
        const totals = byDfd.get(dfdId)!;
        return {
          dfd_id: dfdId,
          user_id: user.id,
          action: "aprovada",
          details: `Demanda homologada em lote pela chefia. Total homologado: R$ ${totals.total.toLocaleString("pt-BR")}.`,
        };
      });
      const { error: logError } = await supabase.from("dfd_logs").insert(logsPayload);
      if (logError) throw logError;
      toast.success(
        `${dfdIds.length} DFD(s) homologadas em lote e enviadas para Consolidação.`,
      );
      setBatchSheetOpen(false);
      await fetchDfds();
    } catch (error: any) {
      toast.error("Erro ao homologar geral: " + (error?.message || ""));
    } finally {
      setGlobalApproving(false);
    }
  };

  const handleAprove = async () => {
    if (!selectedDfd) return;
    if (items.length === 0) {
      toast.error("Não há itens para homologar nesta demanda.");
      return;
    }

    setActionLoading(true);
    try {
      const user = await getSafeUser();
      if (!user) return;

      const sanitizedItems = items.map((item) => ({
        ...item,
        quantidade: Math.max(1, Math.floor(Number(item.quantidade || 1))),
        is_highlight_item: Boolean(item.is_highlight_item),
      }));

      const missingCriticidade = sanitizedItems.filter((item) => !item.criticidade).length;
      const missingMoscow = sanitizedItems.filter((item) => !item.moscow_categoria).length;
      if (missingCriticidade > 0 || missingMoscow > 0) {
        toast.error(
          `Preencha a hierarquização antes de homologar: ${missingCriticidade} sem criticidade e ${missingMoscow} sem priorização.`,
        );
        return;
      }

      await Promise.all(
        sanitizedItems.map(async (item) => {
          const { error } = await supabase
            .from("dfd_items")
            .update({
              quantidade: item.quantidade,
              is_highlight_item: item.is_highlight_item,
              criticidade: item.criticidade || null,
              moscow_categoria: item.moscow_categoria || null,
            })
            .eq("id", item.id);
          if (error) throw error;
        }),
      );

      const novoTotal = sanitizedItems.reduce(
        (acc, item) =>
          acc + Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
        0,
      );

      const { error: dfdError } = await supabase
        .from("dfds")
        .update({
          status: "aprovada",
          valor_total_estimado: novoTotal,
        })
        .eq("id", selectedDfd.id);

      if (dfdError) throw dfdError;

      const { error: logError } = await supabase.from("dfd_logs").insert({
        dfd_id: selectedDfd.id,
        user_id: user.id,
        action: "aprovada",
        details: `Demanda homologada pela chefia da unidade. Total homologado: R$ ${novoTotal.toLocaleString("pt-BR")}.`,
      });
      if (logError) throw logError;

      toast.success("Demanda aprovada e homologada!");
      resetDialogState();
      fetchDfds();
    } catch (e: any) {
      toast.error("Erro ao aprovar: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDevolve = async () => {
    if (!selectedDfd) return;
    if (!devolucaoComment.trim()) {
      toast.error("Por favor, insira o motivo da devolução.");
      setDevolvendo(true);
      return;
    }

    setActionLoading(true);
    try {
      const user = await getSafeUser();
      if (!user) return;

      const { error: dfdError } = await supabase
        .from("dfds")
        .update({ status: "devolvida" })
        .eq("id", selectedDfd.id);

      if (dfdError) throw dfdError;

      const { error: logError } = await supabase.from("dfd_logs").insert({
        dfd_id: selectedDfd.id,
        user_id: user.id,
        action: "devolvida",
        details: devolucaoComment.trim(),
      });
      if (logError) throw logError;

      toast.info("Demanda devolvida para correção.");
      resetDialogState();
      fetchDfds();
    } catch (e: any) {
      toast.error("Erro ao devolver: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const highlightsUsed = items.filter((i) => i.is_highlight_item).length;
  const highlightLimit = getHighlightLimit(items.length);
  const highlightRatio = highlightLimit > 0 ? (highlightsUsed / highlightLimit) * 100 : 0;
  const selectedRequesterName = selectedDfd
    ? resolveRequesterName(selectedDfd, currentUser)
    : "Solicitante";
  const selectedRequesterEmail = selectedDfd
    ? String(selectedDfd.profiles?.email || "").trim() ||
      (selectedDfd.solicitante_id === currentUser?.id
        ? String(currentUser?.email || "").trim()
        : "")
    : "";
  const selectedRequesterInitials = getRequesterInitials(
    selectedRequesterName,
    selectedRequesterEmail,
  );
  const selectedRequesterAvatar = selectedDfd
    ? String(
        selectedDfd.profiles?.avatar_url ||
          (selectedDfd.solicitante_id === currentUser?.id
            ? currentUser?.avatar_url
            : "") ||
          "",
      ).trim()
    : "";
  const totalItensValor = useMemo(
    () =>
      items.reduce(
        (acc, item) =>
          acc + Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
        0,
      ),
    [items],
  );
  const totalQuantidadeItens = useMemo(
    () => items.reduce((acc, item) => acc + Number(item.quantidade || 0), 0),
    [items],
  );
  const locaisResumo = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => String(item.local_uso || "").trim())
            .filter((value) => value.length > 0),
        ),
      ),
    [items],
  );
  const gndResumo = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item) => {
      const key = String(item.gnd || "Sem GND").trim() || "Sem GND";
      const subtotal =
        Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0);
      map.set(key, (map.get(key) || 0) + subtotal);
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([gnd, total]) => ({ gnd, total }));
  }, [items]);
  const decisionGaps = useMemo(() => {
    const missingDfdJustificativaQtd = !String(
      selectedDfd?.justificativa_quantidade || "",
    ).trim();
    const missingPrevisao = !String(selectedDfd?.previsao_recebimento || "").trim();
    const itemsSemReferencia = items.filter(
      (item) => !String(item.link_referencia || "").trim(),
    ).length;
    const itemsSemJustificativaItem = items.filter(
      (item) => !String(item.justificativa_item || "").trim(),
    ).length;
    const itemsSemJustificativaQtd = items.filter(
      (item) => !String(item.justificativa_quantidade || "").trim(),
    ).length;
    const itemsSemGnd = items.filter((item) => !String(item.gnd || "").trim()).length;
    const itemsSemCriticidade = items.filter((item) => !item.criticidade).length;
    const itemsSemMoscow = items.filter((item) => !item.moscow_categoria).length;

    const totalChecks = 8;
    const doneChecks =
      Number(!missingDfdJustificativaQtd) +
      Number(!missingPrevisao) +
      Number(itemsSemReferencia === 0) +
      Number(itemsSemJustificativaItem === 0) +
      Number(itemsSemJustificativaQtd === 0) +
      Number(itemsSemGnd === 0) +
      Number(itemsSemCriticidade === 0) +
      Number(itemsSemMoscow === 0);
    const readiness = Math.round((doneChecks / totalChecks) * 100);

    return {
      missingDfdJustificativaQtd,
      missingPrevisao,
      itemsSemReferencia,
      itemsSemJustificativaItem,
      itemsSemJustificativaQtd,
      itemsSemGnd,
      itemsSemCriticidade,
      itemsSemMoscow,
      readiness,
    };
  }, [items, selectedDfd]);
  const collectiveResumo = useMemo(() => {
    const collectiveItems = items
      .map((item) => {
        const contributors = parseCollectiveDistributionText(item.justificativa_item);
        if (contributors.length === 0) return null;

        return {
          id: item.id,
          descricao: String(item.descricao || "Item sem descrição").trim(),
          quantidade: Number(item.quantidade || 0),
          subtotal: getItemSubtotal(item),
          distribution: contributors
            .map((entry) => `${entry.name}: ${entry.quantidade}`)
            .join("; "),
          contributors,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const participantMap = new Map<
      string,
      { name: string; quantidade: number; itemCount: number }
    >();
    collectiveItems.forEach((item) => {
      item.contributors.forEach((entry) => {
        const current =
          participantMap.get(entry.name) ||
          ({
            name: entry.name,
            quantidade: 0,
            itemCount: 0,
          } satisfies { name: string; quantidade: number; itemCount: number });
        current.quantidade += entry.quantidade;
        current.itemCount += 1;
        participantMap.set(entry.name, current);
      });
    });

    return {
      items: collectiveItems,
      participants: Array.from(participantMap.values()).sort(
        (a, b) => b.quantidade - a.quantidade || a.name.localeCompare(b.name, "pt-BR"),
      ),
      participantCount: participantMap.size,
      totalQuantity: collectiveItems.reduce((acc, item) => acc + item.quantidade, 0),
      totalValue: collectiveItems.reduce((acc, item) => acc + item.subtotal, 0),
    };
  }, [items]);
  const filteredDfds = dfds.filter((dfd) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      dfd.objeto_contratacao?.toLowerCase().includes(q) ||
      dfd.numero_protocolo?.toLowerCase().includes(q) ||
      dfd.profiles?.full_name?.toLowerCase().includes(q) ||
      dfd.profiles?.email?.toLowerCase().includes(q)
    );
  });
  const globalFilteredItems = useMemo(() => {
    const q = deferredGlobalSearch.toLowerCase().trim();
    const filtered = globalItems.filter((item) => {
      if (!q) return true;
      return (
        item.descricao.toLowerCase().includes(q) ||
        String(item.codigo_tce || "").toLowerCase().includes(q) ||
        String(item.numero_protocolo || "").toLowerCase().includes(q) ||
        String(item.solicitante_nome || "").toLowerCase().includes(q)
      );
    });
    return filtered.sort((a, b) => {
      const aProto = String(a.numero_protocolo || "");
      const bProto = String(b.numero_protocolo || "");
      if (aProto !== bProto) return aProto.localeCompare(bProto, "pt-BR");

      const aCode = String(a.codigo_tce || "");
      const bCode = String(b.codigo_tce || "");
      if (aCode !== bCode) return aCode.localeCompare(bCode, "pt-BR");

      return String(a.id).localeCompare(String(b.id), "pt-BR");
    });
  }, [deferredGlobalSearch, globalItems]);
  const globalParetoExpected = useMemo(() => {
    return getHighlightLimit(globalItems.length);
  }, [globalItems]);
  const globalParetoCount = globalItems.filter((item) => item.is_highlight_item).length;
  const globalItemsComCriticidade = globalItems.filter((item) => item.criticidade).length;
  const globalItemsComMoscow = globalItems.filter((item) => item.moscow_categoria).length;
  const globalTotalEstimatedValue = useMemo(
    () =>
      globalItems.reduce(
        (acc, item) =>
          acc + Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
        0,
      ),
    [globalItems],
  );
  const globalParetoEstimatedValue = useMemo(
    () =>
      globalItems
        .filter((item) => item.is_highlight_item)
        .reduce(
          (acc, item) =>
            acc + Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
          0,
        ),
    [globalItems],
  );
  const globalParetoValueRatio = useMemo(() => {
    if (globalTotalEstimatedValue <= 0) return 0;
    return Math.round((globalParetoEstimatedValue / globalTotalEstimatedValue) * 100);
  }, [globalParetoEstimatedValue, globalTotalEstimatedValue]);
  const globalCriticidadeResumo = useMemo(() => {
    const levels: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    globalItems.forEach((item) => {
      const level = getCriticidadeLevel(item.criticidade);
      levels[level] = (levels[level] || 0) + 1;
    });
    return levels;
  }, [globalItems]);
  const globalPriorizacaoResumo = useMemo(() => {
    const levels: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    globalItems.forEach((item) => {
      const level = getPriorizacaoLevel(item.moscow_categoria);
      levels[level] = (levels[level] || 0) + 1;
    });
    return levels;
  }, [globalItems]);
  const globalExecutiveSummary = useMemo(() => {
    const criticidadeTop = Object.entries(globalCriticidadeResumo)
      .filter(([level, count]) => Number(level) > 0 && count > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    const priorizacaoTop = Object.entries(globalPriorizacaoResumo)
      .filter(([level, count]) => Number(level) > 0 && count > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    return {
      criticidadeTopLabel: criticidadeTop
        ? CRITICIDADE_OPTIONS.find((o) => getCriticidadeLevel(o.value) === Number(criticidadeTop[0]))
            ?.label || "Não definida"
        : "Não definida",
      criticidadeTopCount: criticidadeTop ? Number(criticidadeTop[1]) : 0,
      priorizacaoTopLabel: priorizacaoTop
        ? MOSCOW_OPTIONS.find((o) => getPriorizacaoLevel(o.value) === Number(priorizacaoTop[0]))
            ?.label || "Não definida"
        : "Não definida",
      priorizacaoTopCount: priorizacaoTop ? Number(priorizacaoTop[1]) : 0,
    };
  }, [globalCriticidadeResumo, globalPriorizacaoResumo]);
  const globalCompactItems = useMemo(() => globalFilteredItems, [globalFilteredItems]);
  const globalDfdCount = useMemo(
    () => new Set(globalItems.map((item) => item.dfd_id)).size,
    [globalItems],
  );
  const pcaGoalMetrics = useMemo(
    () =>
      buildPcaGoalMetrics({
        dfds,
        items: globalItems,
      }),
    [dfds, globalItems],
  );
  const globalPendingChanges = Object.keys(globalDirtyIds).length;
  const globalSaveTimeLabel = useMemo(() => {
    if (!globalLastSavedAt) return "";
    return globalLastSavedAt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [globalLastSavedAt]);

  return (
    <div className="space-y-6 bg-[#F3F2F1] px-4 py-6 pb-28 md:px-6">
      {/* Bento Header Chefia */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative flex min-h-[224px] flex-col justify-between overflow-hidden rounded-[20px] border border-[#C7D7EA] bg-[#F7FBFF] p-6 text-[#17233C] shadow-sm lg:col-span-2"
        >
          <div className="flex items-center gap-6 relative z-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D9E0E8] bg-white text-[#164073] shadow-sm">
              <CheckCircle weight="duotone" />
            </div>
            <div className="space-y-1">
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-[#17233C]">
                Triagem com contexto
              </h1>
              <p className="ml-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#47739F]">
                Chefia e análise institucional
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 relative z-10 items-end justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[#164073]" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#47739F]">
                  Trabalho do dia
                </span>
              </div>
              <p className="max-w-xl text-sm leading-6 text-[#52627A]">
                Abra uma DFD, confira coerência da demanda, leia as justificativas e só então devolva ou homologue.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={fetchDfds}
                  variant="ghost"
                  disabled={loading}
                  className="rounded-xl border border-[#C7D7EA] bg-white text-[#164073] hover:bg-[#EAF2FF]"
                >
                  <ArrowClockwise
                    className={loading ? "animate-spin" : ""}
                    weight="bold"
                  />{" "}
                  Atualizar
                </Button>
                <Button
                  onClick={openHierarquizacaoSheet}
                  variant="ghost"
                  disabled={globalItemsLoading}
                  className="rounded-xl border border-[#C7D7EA] bg-white text-[#164073] hover:bg-[#EAF2FF]"
                >
                  <SlidersHorizontal weight="bold" className="mr-2" />
                  Hierarquizar Itens
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-[#D9E0E8] bg-white px-8 py-4 text-right shadow-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[#47739F]">
                Aguardando decisão
              </span>
              <span className="text-3xl font-semibold tracking-tight text-[#164073]">
                {dfds.length}{" "}
                <span className="text-sm text-[#7D98B8]">na fila</span>
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col justify-between rounded-[20px] border border-[#D9E0E8] bg-white p-6 shadow-sm"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#7D98B8]">
                Status de Aprovação
              </span>
              <TrendUp size={20} className="text-[#164073]" />
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[#164073]">
              Metas PCA
            </h2>
          </div>

          <div className="space-y-4">
            <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pcaGoalMetrics.progressPercent}%` }}
                className="h-full bg-[#164073] shadow-[0_0_10px_rgba(22,64,115,0.2)]"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-[#7D98B8]">
              <span className="flex items-center gap-2">
                <Clock weight="bold" /> {pcaGoalMetrics.deadlineLabel}
              </span>
              <span>Progr. {pcaGoalMetrics.progressPercent}%</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold uppercase tracking-widest text-[#7D98B8]">
              <div className="rounded-xl border border-[#D9E0E8] bg-[#F7FBFF] px-3 py-2">
                <p className="text-[#164073]">
                  {pcaGoalMetrics.homologatedCount}/{pcaGoalMetrics.totalDfds}
                </p>
                <p>Homologadas</p>
              </div>
              <div className="rounded-xl border border-[#D9E0E8] bg-[#F7FBFF] px-3 py-2">
                <p className="text-[#164073]">{pcaGoalMetrics.classifiedPercent}%</p>
                <p>Matriz preenchida</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <section className="rounded-[20px] border border-[#D9E0E8] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#47739F]">
              Como decidir sem se perder
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#164073]">
              A fila fica melhor quando a chefia enxerga contexto, coerência e prioridade
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#52627A]">
              Abra uma DFD para ver o resumo consolidado do setor. Em DFDs coletivas,
              confira também a distribuição por usuário antes de homologar ou devolver.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-4 xl:min-w-[620px]">
            {DFD_PROCESS_STEPS.map((step, index) => (
              <div
                key={`chefia-guide-${step.id}`}
                className="rounded-2xl border border-[#E8EDF2] bg-[#FAFBFC] p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#164073] text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="text-xs font-semibold text-[#164073]">{step.label}</p>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#5B6675]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between px-4">
            <div>
              <h2 className="font-display font-semibold text-2xl text-upe-blue-upe uppercase tracking-tight ">
                Fila de triagem
              </h2>
              <p className="mt-1 text-sm text-[#52627A]">
                Priorize demandas com leitura clara e sinais suficientes para decisão.
              </p>
            </div>
            <div className="relative group">
              <MagnifyingGlass
                className="absolute left-4 top-1/2 -translate-y-1/2 text-upe-blue-upe/30 group-focus-within:text-upe-blue-upe transition-colors"
                size={18}
              />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-6 py-3.5 bg-white border border-emerald-50 rounded-2xl text-xs font-bold focus:ring-8 focus:ring-emerald-500/5 outline-none w-64 transition-all focus:w-80 shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-[20px]" />
              ))
            ) : filteredDfds.length === 0 ? (
              <div className="space-y-6 py-24 text-center">
                <img
                  src="/guidance/triage-empty-queue.png"
                  alt=""
                  className="mx-auto aspect-[16/9] w-full max-w-[380px] object-contain"
                />
                <div className="space-y-1">
                  <h3 className="font-display font-semibold text-2xl text-upe-blue-upe uppercase tracking-tighter">
                    Limpo e Finalizado
                  </h3>
                  <p className="text-sm font-bold uppercase tracking-widest ">
                    {searchTerm.trim()
                      ? "Nenhum resultado para a busca informada."
                      : "Nenhuma demanda aguardando triagem no momento."}
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredDfds.map((dfd, i) => (
                  <motion.div
                    initial={queueHasAnimated ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{
                      duration: 0.24,
                      ease: [0.16, 1, 0.3, 1],
                      delay: queueHasAnimated ? 0 : i * 0.045,
                    }}
                    key={dfd.id}
                    onClick={() => !openingDfd && openDfd(dfd)}
                    className={cn(
                      "relative flex cursor-pointer items-center justify-between rounded-[20px] border border-[#D9E0E8] bg-white p-5 shadow-sm transition-all hover:border-[#C7D7EA] hover:shadow-md group",
                      openingDfd && "pointer-events-none opacity-70",
                    )}
                  >
                    {(() => {
                      const requesterName = resolveRequesterName(dfd, currentUser);
                      const requesterEmail =
                        String(dfd.profiles?.email || "").trim() ||
                        (dfd.solicitante_id === currentUser?.id
                          ? String(currentUser?.email || "").trim()
                          : "");
                      const requesterInitials = getRequesterInitials(
                        requesterName,
                        requesterEmail,
                      );
                      const requesterAvatar = String(
                        dfd.profiles?.avatar_url ||
                          (dfd.solicitante_id === currentUser?.id
                            ? currentUser?.avatar_url
                            : "") ||
                          "",
                      ).trim();
                      return (
                        <>
                          <div className="flex items-center gap-6">
                            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-[#EAF2FF] text-[#164073] transition-all duration-300 group-hover:bg-[#164073] group-hover:text-white">
                              <span className="text-lg font-semibold tracking-tight">
                                {requesterInitials}
                              </span>
                              {requesterAvatar && (
                                <img
                                  src={requesterAvatar}
                                  alt={requesterName}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              )}
                              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-white/90 text-emerald-700 flex items-center justify-center border border-emerald-100">
                                <UserCircle size={14} weight="fill" />
                              </span>
                            </div>
                            <div className="space-y-1.5 text-left">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono font-semibold text-emerald-800/20 uppercase tracking-tighter bg-emerald-50 px-2 py-0.5 rounded">
                                  #{dfd.id.slice(0, 8)}
                                </span>
                                <span className="text-[10px] font-semibold text-emerald-600/50 uppercase tracking-widest">
                                  {dfd.created_at
                                    ? new Date(dfd.created_at).toLocaleDateString(
                                        "pt-BR",
                                      )
                                    : "Sem data"}
                                </span>
                              </div>
                              <h3 className="font-semibold text-upe-blue-upe text-lg uppercase tracking-tight leading-none group-hover:text-emerald-700 transition-colors">
                                {requesterName}
                              </h3>
                              <p className="text-xs text-slate-400 font-medium truncate max-w-[300px]">
                                {dfd.objeto_contratacao}
                              </p>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-semibold border",
                                    (dfd.item_count || 0) > 0
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                      : "bg-red-50 text-red-700 border-red-100",
                                  )}
                                >
                                  {(dfd.item_count || 0) > 0
                                    ? `${dfd.item_count} itens`
                                    : "Sem itens"}
                                </span>
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#47739F]">
                                  {Number(dfd.valor_total_estimado || 0) > 0
                                    ? "Pronta para leitura"
                                    : "Exige conferência"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-12">
                            <div className="text-right flex flex-col items-end">
                              <span className="text-2xl font-display font-semibold text-upe-blue-upe tracking-tighter">
                                R${" "}
                                {Number(
                                  dfd.valor_total_estimado || 0,
                                ).toLocaleString("pt-BR")}
                              </span>
                              <span className="text-[9px] font-semibold text-emerald-800/30 uppercase tracking-[0.2em]">
                                Estimativa Financeira
                              </span>
                            </div>
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#164073] transition-all duration-300 group-hover:translate-x-1 group-hover:bg-[#164073] group-hover:text-white">
                              <ArrowRight size={24} weight="bold" />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Sidebar de orientação */}
      <div className="space-y-8">
          <div className="space-y-6 rounded-[20px] border border-[#D9E0E8] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Stack size={24} weight="fill" className="text-[#164073]" />
              <h3 className="font-display font-semibold text-xl text-upe-blue-upe uppercase tracking-tight ">
                Leitura da fila
              </h3>
            </div>
            <div className="space-y-5">
              <div className="cursor-default space-y-2 rounded-2xl border border-[#D9E0E8] bg-[#F7FBFF] p-5 transition-all hover:bg-[#EAF2FF]">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle
                    size={20}
                    weight="fill"
                    className="text-emerald-700"
                  />
                  <p className="text-xs font-semibold text-emerald-900 uppercase">
                    Ordem de análise
                  </p>
                </div>
                <p className="text-[11px] text-emerald-800/60 font-medium leading-relaxed">
                  Comece por DFDs que já explicam bem o objeto, mostram local de uso e trazem item com justificativa técnica.
                </p>
              </div>
              <div className="cursor-default space-y-2 rounded-2xl border border-amber-100 bg-amber-50 p-5 transition-all hover:bg-amber-100/40">
                <div className="flex items-center gap-2 mb-1">
                  <WarningCircle
                    size={20}
                    weight="fill"
                    className="text-amber-600"
                  />
                  <p className="text-xs font-semibold text-amber-900 uppercase">
                    DFD coletiva
                  </p>
                </div>
                <p className="text-[11px] text-emerald-800/60 font-medium leading-relaxed">
                  Quando houver distribuição por usuário, confirme se a demanda é realmente comum ao mesmo setor ou laboratório.
                </p>
              </div>
              <div className="cursor-default space-y-2 rounded-2xl border border-[#D9E0E8] bg-white p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Lightning size={20} weight="fill" className="text-[#164073]" />
                  <p className="text-xs font-semibold text-[#164073] uppercase">
                    Regra prática
                  </p>
                </div>
                <p className="text-[11px] text-[#52627A] font-medium leading-relaxed">
                  Se a chefia ainda precisa adivinhar por que o item existe, a melhor decisão costuma ser devolver com orientação objetiva.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {hierarquizacaoIntroOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeHierarquizacaoIntro}
              className="fixed inset-0 z-[86] bg-black/45 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[89] flex items-center justify-center p-4"
            >
              <div className="w-full max-w-4xl rounded-3xl border border-black/10 bg-white shadow-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-black/35 font-semibold">
                      Guia de uso
                    </p>
                    <h3 className="font-display text-2xl font-semibold text-upe-blue-upe uppercase tracking-tight">
                      Como Funciona a Hierarquização
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={closeHierarquizacaoIntro}
                    className="w-10 h-10 rounded-xl bg-upe-accent-washed-blue text-upe-blue-medium flex items-center justify-center hover:bg-upe-blue-gray-blue"
                  >
                    <X size={18} weight="bold" />
                  </button>
                </div>

                <div className="p-6 space-y-4 bg-upe-neutral-cool-off-white">
                  <div className="rounded-2xl border border-upe-support-blue-bluish-mist bg-white p-4">
                    <p className="text-sm font-semibold text-upe-blue-upe">
                      Objetivo da tela
                    </p>
                    <p className="mt-1 text-sm text-black/70 leading-relaxed">
                      Esta etapa serve para apoiar a decisão institucional em alto volume.
                      Você classifica os itens por <strong>Criticidade</strong> e{" "}
                      <strong>Priorização</strong>, e marca manualmente quais entram no{" "}
                      <strong>Pareto (20%)</strong> do lote.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-upe-support-blue-bluish-mist bg-white p-4">
                      <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
                        1. Classifique
                      </p>
                      <p className="mt-2 text-sm text-black/70 leading-relaxed">
                        Use os sliders para definir criticidade e priorização de cada item.
                        Isso não marca Pareto automaticamente.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-upe-support-blue-bluish-mist bg-white p-4">
                      <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
                        2. Marque Pareto
                      </p>
                      <p className="mt-2 text-sm text-black/70 leading-relaxed">
                        Use a estrela para destacar os itens estratégicos. O sistema trava
                        no limite de 20% do lote para garantir priorização real.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-upe-support-blue-bluish-mist bg-white p-4">
                      <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
                        3. Salve alterações
                      </p>
                      <p className="mt-2 text-sm text-black/70 leading-relaxed">
                        Ao final, clique em <strong>Salvar Priorização em Lote</strong> para
                        registrar a decisão e liberar a próxima etapa de triagem.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-black/70 select-none">
                    <input
                      type="checkbox"
                      checked={hierarquizacaoSkipNext}
                      onChange={(event) => setHierarquizacaoSkipNext(event.target.checked)}
                      className="w-4 h-4 rounded border-black/30 accent-upe-blue-upe"
                    />
                    Não exibir novamente esta explicação
                  </label>
                </div>

                <div className="px-6 py-4 border-t border-black/5 bg-white flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeHierarquizacaoIntro}
                    className="h-10 rounded-xl border-black/10 text-upe-blue-upe text-xs uppercase tracking-widest"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={continueHierarquizacaoIntro}
                    className="h-10 rounded-xl bg-upe-blue-upe hover:bg-upe-blue-deep text-white text-xs uppercase tracking-widest"
                  >
                    Entendi e Continuar
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* PRIORIZAÇÃO GLOBAL DE ITENS */}
      <AnimatePresence>
        {batchSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBatchSheetOpen(false)}
              className="fixed inset-0 z-[85] bg-black/45 backdrop-blur-[2px]"
            />
            <motion.aside
              initial={{ x: 1200 }}
              animate={{ x: 0 }}
              exit={{ x: 1200 }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="fixed inset-0 z-[90] h-screen w-screen bg-white shadow-2xl flex flex-col"
            >
              <div className="h-[96px] px-6 border-b border-black/5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-black/35 font-semibold">
                    Triagem em lote
                  </p>
                  <h3 className="font-display text-2xl font-semibold text-upe-blue-upe uppercase tracking-tight">
                    Hierarquização Global
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setBatchSheetOpen(false)}
                  className="w-10 h-10 rounded-xl bg-upe-accent-washed-blue text-upe-blue-medium flex items-center justify-center hover:bg-upe-blue-gray-blue"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>

              <div className="px-6 py-3 border-b border-black/5 bg-white">
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_auto] gap-3 items-center">
                  <input
                    type="text"
                    value={globalSearch}
                    onChange={(event) => setGlobalSearch(event.target.value)}
                    placeholder="Pesquisar item, código e-fisco, protocolo ou solicitante..."
                    className="w-full h-11 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-upe-neutral-dark-soft-black outline-none focus:ring-2 focus:ring-upe-blue-medium/20"
                  />

                  <div className="rounded-xl border border-black/10 bg-upe-neutral-cool-ice px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-upe-blue-upe">
                    Itens: {globalFilteredItems.length} · Pareto: {globalParetoCount}/
                    {globalParetoExpected}
                  </div>

                  <button
                    type="button"
                    onClick={() => setGlobalControlsExpanded((prev) => !prev)}
                    className="h-11 px-3 rounded-xl border border-black/10 bg-white text-[10px] font-semibold uppercase tracking-widest text-upe-blue-upe hover:bg-upe-neutral-cool-ice"
                  >
                    {globalControlsExpanded ? "Ocultar Painel" : "Expandir Painel"}
                  </button>
                </div>
              </div>

              {globalControlsExpanded && (
              <div className="p-6 border-b border-black/5 bg-upe-neutral-cool-off-white grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-black/5 bg-white p-3">
                  <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                    Itens em triagem
                  </p>
                  <p className="text-2xl font-semibold text-upe-blue-upe">{globalItems.length}</p>
                </div>
                <div className="rounded-2xl border border-black/5 bg-white p-3">
                  <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                    Pareto (20%)
                  </p>
                  <p className="text-2xl font-semibold text-upe-blue-upe">
                    {globalParetoCount}/{globalParetoExpected}
                  </p>
                </div>
                <div className="rounded-2xl border border-black/5 bg-white p-3">
                  <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                    Com criticidade
                  </p>
                  <p className="text-2xl font-semibold text-upe-blue-upe">
                    {globalItemsComCriticidade}
                  </p>
                </div>
                <div className="rounded-2xl border border-black/5 bg-white p-3">
                  <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                    Com priorização
                  </p>
                  <p className="text-2xl font-semibold text-upe-blue-upe">
                    {globalItemsComMoscow}
                  </p>
                </div>
                <div className="col-span-full rounded-2xl border border-upe-support-blue-bluish-mist bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40 mb-2">
                    Priorização (matriz)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <span className="rounded-lg bg-upe-neutral-dark-night-blue/5 px-2 py-1 font-medium text-upe-neutral-dark-night-blue">
                      Essencial: microscópios para aula obrigatória
                    </span>
                    <span className="rounded-lg bg-upe-neutral-dark-night-blue/5 px-2 py-1 font-medium text-upe-neutral-dark-night-blue">
                      Relevante: equipamentos de apoio
                    </span>
                    <span className="rounded-lg bg-upe-neutral-dark-night-blue/5 px-2 py-1 font-medium text-upe-neutral-dark-night-blue">
                      Oportuno: upgrades tecnológicos
                    </span>
                    <span className="rounded-lg bg-upe-neutral-dark-night-blue/5 px-2 py-1 font-medium text-upe-neutral-dark-night-blue">
                      Postergado: itens experimentais não críticos
                    </span>
                  </div>
                </div>
                <div className="col-span-full rounded-2xl border border-upe-support-blue-bluish-mist bg-upe-neutral-cool-ice p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">
                      Resumo Executivo
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-upe-blue-upe">
                      Leitura rápida para decisão
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-black/10 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                        Impacto Pareto
                      </p>
                      <p className="text-lg font-semibold text-upe-blue-upe mt-1">
                        {globalParetoValueRatio}% do valor
                      </p>
                      <p className="text-[11px] text-black/50 mt-1">
                        {globalParetoEstimatedValue.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}{" "}
                        de{" "}
                        {globalTotalEstimatedValue.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </p>
                    </div>

                    <div className="rounded-xl border border-black/10 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                        Cobertura Técnica
                      </p>
                      <p className="text-lg font-semibold text-upe-blue-upe mt-1">
                        {globalItemsComCriticidade}/{globalItems.length}
                      </p>
                      <p className="text-[11px] text-black/50 mt-1">
                        Itens com criticidade definida
                      </p>
                    </div>

                    <div className="rounded-xl border border-black/10 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                        Cobertura Priorização
                      </p>
                      <p className="text-lg font-semibold text-upe-blue-upe mt-1">
                        {globalItemsComMoscow}/{globalItems.length}
                      </p>
                      <p className="text-[11px] text-black/50 mt-1">
                        Itens com priorização definida
                      </p>
                    </div>

                    <div className="rounded-xl border border-black/10 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                        Perfil Predominante
                      </p>
                      <p className="text-sm font-semibold text-upe-blue-upe mt-1">
                        {globalExecutiveSummary.criticidadeTopLabel} ·{" "}
                        {globalExecutiveSummary.priorizacaoTopLabel}
                      </p>
                      <p className="text-[11px] text-black/50 mt-1">
                        {globalExecutiveSummary.criticidadeTopCount} itens /{" "}
                        {globalExecutiveSummary.priorizacaoTopCount} itens
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              )}

              <div className="flex-1 min-h-0 p-6 space-y-3 overflow-hidden">
                {globalItemsLoading ? (
                  [...Array(6)].map((_, index) => (
                    <Skeleton key={index} className="h-40 w-full rounded-2xl" />
                  ))
                ) : globalFilteredItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    Nenhum item encontrado para o filtro informado.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-black/10 overflow-hidden bg-white flex h-full min-h-0 flex-col">
                    <div className="px-3 py-2 border-b border-black/5 bg-upe-neutral-cool-ice hidden lg:grid lg:grid-cols-[1fr_84px_220px_220px] gap-3 items-center">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-black/45">
                        Item consolidado
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-black/45">
                        Pareto
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-black/45">
                        Criticidade
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-black/45">
                        Priorização
                      </p>
                    </div>
                    <div className="flex-1 min-h-0">
                      <Virtuoso
                        className="h-full"
                        data={globalCompactItems}
                        overscan={360}
                        itemContent={(index, item) => {
                          const criticidadeLevel = getCriticidadeLevel(item.criticidade);
                          const priorizacaoLevel = getPriorizacaoLevel(item.moscow_categoria);
                          const criticidadeColor = getCriticidadeAccentColor(criticidadeLevel);
                          const priorizacaoColor = getPriorizacaoAccentColor(priorizacaoLevel);
                          return (
                            <div
                              className={cn(
                                "grid grid-cols-1 gap-3 px-3 py-3 border-b border-black/5",
                                "lg:grid-cols-[1fr_72px_180px_180px] xl:grid-cols-[1fr_84px_220px_220px]",
                                item.is_highlight_item && "bg-amber-50/50",
                              )}
                            >
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                                  #{index + 1} | Score {Math.round(getGlobalRankingScore(item))} |
                                  {" "}DFD {item.numero_protocolo}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-upe-neutral-dark-soft-black leading-tight line-clamp-2">
                                  {item.descricao}
                                </p>
                                <p className="mt-1 text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                                  Cód. e-Fisco: {item.codigo_tce} | Solicitante:{" "}
                                  {item.solicitante_nome}
                                </p>
                              </div>

                              <div className="rounded-xl border border-black/10 p-2 bg-upe-neutral-cool-off-white flex items-center justify-center lg:justify-center">
                                <button
                                  type="button"
                                  onClick={() => toggleGlobalPareto(item.id)}
                                  className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                    item.is_highlight_item
                                      ? "bg-amber-400 text-white"
                                      : "bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600",
                                  )}
                                  aria-label={`Marcar item ${item.codigo_tce} como destaque Pareto`}
                                title="Pareto (20% do lote)"
                                >
                                  <Star
                                    size={16}
                                    weight={item.is_highlight_item ? "fill" : "bold"}
                                  />
                                </button>
                              </div>

                              <div className="rounded-xl border border-black/10 p-2 bg-upe-neutral-cool-off-white">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[10px] font-semibold uppercase tracking-widest text-black/45">
                                    {getCriticidadeLabel(item.criticidade)}
                                  </span>
                                  <span
                                    className="inline-flex w-6 h-6 rounded-lg items-center justify-center"
                                    style={{ backgroundColor: `${criticidadeColor}1A` }}
                                  >
                                    <Star
                                      size={12}
                                      weight="fill"
                                      color={criticidadeColor}
                                    />
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={4}
                                  step={1}
                                  value={criticidadeLevel}
                                  onChange={(event) =>
                                    updateGlobalItem(item.id, {
                                      criticidade: levelToCriticidade(
                                        Number(event.target.value),
                                      ),
                                    })
                                  }
                                  onPointerUp={(event) =>
                                    applyGlobalItemPatch(item.id, {
                                      criticidade: levelToCriticidade(
                                        Number(event.currentTarget.value),
                                      ),
                                    })
                                  }
                                  onKeyUp={(event) =>
                                    applyGlobalItemPatch(item.id, {
                                      criticidade: levelToCriticidade(
                                        Number(event.currentTarget.value),
                                      ),
                                    })
                                  }
                                  className="w-full h-2 cursor-pointer rounded-lg slider-crit"
                                  style={{ accentColor: criticidadeColor }}
                                  aria-label={`Criticidade do item ${item.codigo_tce}`}
                                />
                              </div>

                              <div className="rounded-xl border border-black/10 p-2 bg-upe-neutral-cool-off-white">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[10px] font-semibold uppercase tracking-widest text-black/45">
                                    {getPriorizacaoLabel(item.moscow_categoria)}
                                  </span>
                                  <span
                                    className="inline-flex w-6 h-6 rounded-lg items-center justify-center"
                                    style={{ backgroundColor: `${priorizacaoColor}1A` }}
                                  >
                                    <Star
                                      size={12}
                                      weight={item.is_highlight_item ? "fill" : "bold"}
                                      color={priorizacaoColor}
                                    />
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={4}
                                  step={1}
                                  value={priorizacaoLevel}
                                  onChange={(event) =>
                                    updateGlobalItem(item.id, {
                                      moscow_categoria: levelToPriorizacao(
                                        Number(event.target.value),
                                      ),
                                    })
                                  }
                                  onPointerUp={(event) =>
                                    applyGlobalItemPatch(item.id, {
                                      moscow_categoria: levelToPriorizacao(
                                        Number(event.currentTarget.value),
                                      ),
                                    })
                                  }
                                  onKeyUp={(event) =>
                                    applyGlobalItemPatch(item.id, {
                                      moscow_categoria: levelToPriorizacao(
                                        Number(event.currentTarget.value),
                                      ),
                                    })
                                  }
                                  className="w-full h-2 cursor-pointer rounded-lg slider-prio"
                                  style={{ accentColor: priorizacaoColor }}
                                  aria-label={`Priorização do item ${item.codigo_tce}`}
                                />
                              </div>
                            </div>
                          );
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-black/5 bg-white flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    <Lightning size={14} className="inline mr-1" />
                    Alterações pendentes: {globalPendingChanges}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {globalPendingChanges > 0
                      ? "Passo 1 de 2: salve a priorização em lote."
                      : globalLastSavedAt
                        ? `Passo 2 de 2: salvo às ${globalSaveTimeLabel}. Clique em Homologar Geral para enviar à Consolidação.`
                        : "Defina criticidade, priorização e Pareto para liberar a homologação em lote."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={saveGlobalPrioritization}
                    disabled={globalItemsSaving || globalPendingChanges === 0}
                    className="h-11 rounded-xl bg-upe-blue-upe hover:bg-upe-blue-deep text-white text-xs uppercase tracking-widest"
                  >
                    {globalItemsSaving ? "Salvando..." : "Salvar Priorização em Lote"}
                  </Button>
                  <Button
                    type="button"
                    onClick={approveGlobalBatch}
                    disabled={
                      globalApproving ||
                      globalItemsSaving ||
                      globalDfdCount === 0 ||
                      globalPendingChanges > 0
                    }
                    className="h-11 rounded-xl bg-upe-support-blue-deep-teal hover:bg-upe-support-blue-petroleum text-white text-xs uppercase tracking-widest"
                  >
                    {globalApproving
                      ? "Homologando..."
                      : `Homologar Geral (${globalDfdCount})`}
                  </Button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openingDfd ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[65] flex items-center justify-center bg-[#0F2E57]/25 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 8, scale: 0.97 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 8, scale: 0.98 }}
              className="w-full max-w-sm rounded-3xl border border-white/50 bg-white p-5 text-center shadow-2xl"
            >
              <CircleNotch size={30} className="mx-auto animate-spin text-[#164073]" />
              <h3 className="mt-3 text-lg font-semibold text-[#164073]">
                Abrindo análise da DFD
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#52627A]">
                Carregando itens, vínculo organizacional, GND e resumo coletivo quando existir.
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* DFD DETAIL SIDEBAR LAYOUT */}
      <AnimatePresence>
        {dialogOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetDialogState}
              className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px]"
            />
            <motion.aside
              initial={{ x: 720 }}
              animate={{ x: 0 }}
              exit={{ x: 720 }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="fixed top-0 right-0 z-[80] h-screen w-screen bg-upe-neutral-cool-off-white shadow-2xl"
            >
              <div className="h-full w-full flex overflow-hidden">
            <aside
              className={cn(
                "shrink-0 bg-upe-blue-upe text-white p-6 md:p-8 overflow-y-auto border-r border-white/10",
                "xl:w-[420px] xl:block",
                sheetView === "resumo" ? "w-full block" : "hidden xl:block",
              )}
            >
              <div className="space-y-7">
                <div className="flex items-center justify-between">
                  <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest border border-white/10">
                    Leitura da DFD
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-upe-support-blue-bluish-mist">
                    Triagem
                  </span>
                </div>
                <div className="xl:hidden inline-flex rounded-xl border border-white/20 p-1 bg-white/10">
                  <button
                    type="button"
                    onClick={() => setSheetView("resumo")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-colors",
                      sheetView === "resumo"
                        ? "bg-white text-upe-blue-upe"
                        : "text-white/80 hover:text-white",
                    )}
                  >
                    Resumo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetView("itens")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-colors",
                      sheetView === "itens"
                        ? "bg-white text-upe-blue-upe"
                        : "text-white/80 hover:text-white",
                    )}
                  >
                    Itens
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-2xl bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center font-semibold">
                    {selectedRequesterInitials}
                    {selectedRequesterAvatar && (
                      <img
                        src={selectedRequesterAvatar}
                        alt={selectedRequesterName}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{selectedRequesterName}</p>
                    <p className="text-xs text-white/60 truncate">
                      {selectedRequesterEmail || "Sem e-mail no perfil"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 uppercase tracking-widest">Protocolo</span>
                    <span className="font-mono">{selectedDfd?.numero_protocolo || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 uppercase tracking-widest">Data</span>
                    <span>
                      {selectedDfd?.created_at
                        ? new Date(selectedDfd.created_at).toLocaleDateString("pt-BR")
                        : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 uppercase tracking-widest">Total</span>
                    <span className="font-semibold">
                      R$ {Number(selectedDfd?.valor_total_estimado || totalItensValor).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 uppercase tracking-widest">Itens</span>
                    <span>{items.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 uppercase tracking-widest">Qtd. Total</span>
                    <span>{totalQuantidadeItens}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 uppercase tracking-widest">Status</span>
                    <span className="uppercase">{selectedDfd?.status || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 uppercase tracking-widest">Versão</span>
                    <span>{selectedDfd?.versao ?? 1}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-upe-support-blue-bluish-mist">
                    Objeto
                  </p>
                  <p className="text-sm leading-relaxed">
                    {selectedDfd?.objeto_contratacao || "Não informado"}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-upe-support-blue-bluish-mist">
                    Justificativa da DFD
                  </p>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {selectedDfd?.justificativa_contratacao || "Não informada pelo solicitante."}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-upe-support-blue-bluish-mist">
                    Base de Cálculo (Quantidades)
                  </p>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {selectedDfd?.justificativa_quantidade || "Não informada pelo solicitante."}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-upe-support-blue-bluish-mist">
                      Painel de decisão
                    </p>
                    <p className="mt-1 text-xs text-white/65">
                        Vínculo, coerência da demanda, sinais de prontidão e pontos de atenção.
                    </p>
                  </div>
                    <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs font-semibold">
                      {decisionGaps.readiness}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["Campus", selectedDfd?.campus_nome || selectedDfd?.campus || "-"],
                      ["Unidade", selectedDfd?.tipo_unidade || "-"],
                      ["Local", selectedDfd?.unidade_nome || "-"],
                      [
                        "Previsão",
                        selectedDfd?.previsao_recebimento
                          ? new Date(selectedDfd.previsao_recebimento).toLocaleDateString("pt-BR")
                          : "-",
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-white/45">
                          {label}
                        </p>
                        <p className="mt-1 truncate font-semibold text-white" title={String(value)}>
                          {String(value)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-white/75">Cota Pareto</span>
                        <span className="font-semibold">
                          {highlightsUsed}/{highlightLimit}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(0, Math.min(100, highlightRatio))}%` }}
                          className={cn(
                            "h-full",
                            highlightsUsed < highlightLimit
                              ? "bg-upe-support-blue-neutral-aqua"
                              : "bg-amber-400",
                          )}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-white/60">Limite de destaques institucionais.</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-white/75">Prontidão</span>
                        <span className="font-semibold">{decisionGaps.readiness}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.max(0, Math.min(100, decisionGaps.readiness))}%`,
                          }}
                          className={cn(
                            "h-full",
                            decisionGaps.readiness >= 80
                              ? "bg-upe-support-blue-neutral-aqua"
                              : "bg-amber-400",
                          )}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-white/60">Campos essenciais para decisão.</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                      Distribuição por GND
                    </p>
                    {gndResumo.length > 0 ? (
                      <div className="space-y-2">
                        {gndResumo.map((row) => (
                          <div key={row.gnd} className="flex items-start justify-between gap-3">
                            <span className="font-mono text-white/70">{row.gnd}</span>
                            <span className="font-semibold">
                              R$ {row.total.toLocaleString("pt-BR")}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-white/70">Sem itens para calcular GND.</p>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                      Locais de Uso dos Itens
                    </p>
                    {locaisResumo.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {locaisResumo.map((local) => (
                          <span
                            key={local}
                            className="rounded-lg border border-white/10 bg-white/10 px-2 py-1"
                          >
                            {local}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-white/70">Não informado.</p>
                    )}
                  </div>

                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Base de cálculo da DFD</span>
                      <span
                        className={cn(
                          "font-semibold",
                          decisionGaps.missingDfdJustificativaQtd
                            ? "text-amber-300"
                            : "text-upe-support-blue-bluish-mist",
                        )}
                      >
                        {decisionGaps.missingDfdJustificativaQtd ? "Pendente" : "OK"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Previsão de recebimento</span>
                      <span
                        className={cn(
                          "font-semibold",
                          decisionGaps.missingPrevisao ? "text-amber-300" : "text-upe-support-blue-bluish-mist",
                        )}
                      >
                        {decisionGaps.missingPrevisao ? "Pendente" : "OK"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Itens sem referência</span>
                      <span
                        className={cn(
                          "font-semibold",
                          decisionGaps.itemsSemReferencia > 0
                            ? "text-amber-300"
                            : "text-upe-support-blue-bluish-mist",
                        )}
                      >
                        {decisionGaps.itemsSemReferencia}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Itens sem justificativa técnica</span>
                      <span
                        className={cn(
                          "font-semibold",
                          decisionGaps.itemsSemJustificativaItem > 0
                            ? "text-amber-300"
                            : "text-upe-support-blue-bluish-mist",
                        )}
                      >
                        {decisionGaps.itemsSemJustificativaItem}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Itens sem justificativa de quantidade</span>
                      <span
                        className={cn(
                          "font-semibold",
                          decisionGaps.itemsSemJustificativaQtd > 0
                            ? "text-amber-300"
                            : "text-upe-support-blue-bluish-mist",
                        )}
                      >
                        {decisionGaps.itemsSemJustificativaQtd}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Itens sem GND</span>
                      <span
                        className={cn(
                          "font-semibold",
                          decisionGaps.itemsSemGnd > 0 ? "text-amber-300" : "text-upe-support-blue-bluish-mist",
                        )}
                      >
                        {decisionGaps.itemsSemGnd}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Itens sem criticidade</span>
                      <span
                        className={cn(
                          "font-semibold",
                          decisionGaps.itemsSemCriticidade > 0
                            ? "text-amber-300"
                            : "text-upe-support-blue-bluish-mist",
                        )}
                      >
                        {decisionGaps.itemsSemCriticidade}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Itens sem priorização</span>
                      <span
                        className={cn(
                          "font-semibold",
                          decisionGaps.itemsSemMoscow > 0
                            ? "text-amber-300"
                            : "text-upe-support-blue-bluish-mist",
                        )}
                      >
                        {decisionGaps.itemsSemMoscow}
                      </span>
                    </div>
                  </div>
                </div>

                {collectiveResumo.items.length > 0 && (
                  <div className="rounded-2xl border border-upe-support-blue-neutral-aqua/30 bg-upe-blue-medium/20 p-4 space-y-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-upe-support-blue-bluish-mist">
                        Resumo do Setor - DFD Coletiva
                      </p>
                      <p className="mt-1 text-xs text-white/65">
                        Leitura da demanda comum, com quantidades preservadas por usuário.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <p className="text-lg font-semibold">{collectiveResumo.participantCount}</p>
                        <p className="text-[9px] uppercase tracking-widest text-white/45">Pessoas</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <p className="text-lg font-semibold">{collectiveResumo.items.length}</p>
                        <p className="text-[9px] uppercase tracking-widest text-white/45">Itens</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <p className="text-lg font-semibold">{collectiveResumo.totalQuantity}</p>
                        <p className="text-[9px] uppercase tracking-widest text-white/45">Qtd.</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <p className="text-lg font-semibold">
                          R$ {collectiveResumo.totalValue.toLocaleString("pt-BR")}
                        </p>
                        <p className="text-[9px] uppercase tracking-widest text-white/45">Valor</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                        Quem compõe a demanda
                      </p>
                      <div className="mt-3 space-y-2">
                        {collectiveResumo.participants.slice(0, 6).map((participant) => (
                          <div
                            key={participant.name}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="truncate font-semibold text-white" title={participant.name}>
                              {participant.name}
                            </span>
                            <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-2 py-1">
                              {participant.quantidade} un. / {participant.itemCount} item(ns)
                            </span>
                          </div>
                        ))}
                        {collectiveResumo.participants.length > 6 && (
                          <p className="text-white/60">
                            +{collectiveResumo.participants.length - 6} participante(s) no detalhamento dos itens.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      {collectiveResumo.items.slice(0, 4).map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 font-semibold text-white">{item.descricao}</p>
                            <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 font-semibold">
                              {item.quantidade}
                            </span>
                          </div>
                          <p className="mt-2 text-white/65">{item.distribution}</p>
                        </div>
                      ))}
                      {collectiveResumo.items.length > 4 && (
                        <p className="text-white/60">
                          +{collectiveResumo.items.length - 4} item(ns) coletivo(s) no detalhamento.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2 text-xs">
                      {[
                        "Confirmar se a demanda é comum ao setor/laboratório, e não apenas soma de pedidos sem vínculo.",
                        "Verificar se as quantidades por pessoa justificam o total consolidado.",
                        "Se houver participante ou item fora do escopo, devolver para ajuste pelo criador da DFD coletiva.",
                      ].map((instruction) => (
                        <div key={instruction} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                          <CheckCircle size={15} weight="fill" className="mt-0.5 shrink-0 text-upe-support-blue-bluish-mist" />
                          <p className="text-white/70">{instruction}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            <section
              className={cn(
                "flex-1 min-w-0 h-full flex-col",
                sheetView === "itens" ? "flex" : "hidden xl:flex",
              )}
            >
              <div className="px-6 md:px-8 py-5 border-b border-emerald-100 bg-white">
                <div className="xl:hidden inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50 mb-2">
                  <button
                    type="button"
                    onClick={() => setSheetView("resumo")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-colors",
                      sheetView === "resumo"
                        ? "bg-upe-blue-upe text-white"
                        : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    Resumo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetView("itens")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-colors",
                      sheetView === "itens"
                        ? "bg-upe-blue-upe text-white"
                        : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    Itens
                  </button>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold text-upe-blue-upe uppercase tracking-tight">
                      Itens para decisão ({items.length})
                    </h3>
                    <p className="mt-1 text-sm text-[#52627A]">
                      Ajuste quantidades, classifique prioridade e marque apenas os destaques realmente estratégicos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetDialogState}
                    className="w-10 h-10 rounded-xl bg-upe-accent-washed-blue text-upe-blue-medium flex items-center justify-center hover:bg-upe-blue-gray-blue"
                  >
                    <X size={18} weight="bold" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {items.length === 0 && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-6 space-y-3">
                    <p className="text-sm font-semibold text-red-700 uppercase tracking-widest">
                      DFD sem itens
                    </p>
                    <p className="text-sm text-red-700/80 leading-relaxed">
                      Esta demanda foi enviada para triagem sem itens vinculados.
                      Não há base técnica para homologação.
                    </p>
                    <p className="text-xs text-red-700/70">
                      Recomendação: devolver para ajuste com orientação de reenvio.
                    </p>
                  </div>
                )}
                {items.map((item, idx) => (
                  <motion.div
                    key={`${item.id ?? item.codigo_tce ?? "item"}-${idx}`}
                    layout
                    className={cn(
                      "p-6 rounded-[28px] border transition-all flex flex-col md:flex-row gap-8 items-center",
                      item.is_highlight_item
                        ? "bg-amber-50/50 border-amber-200 shadow-xl shadow-amber-900/5 ring-2 ring-amber-100/50"
                        : "bg-white border-emerald-50 hover:border-emerald-100 shadow-sm",
                    )}
                  >
                    <div className="flex-1 space-y-3 w-full">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[10px] font-semibold text-slate-300 font-mono tracking-tighter uppercase p-2 bg-slate-50 rounded-xl border border-black/[0.03]">
                          #{item.codigo_tce}
                        </span>
                        <span className="text-[10px] font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full uppercase tracking-widest border border-emerald-100/50">
                          Item {idx + 1}
                        </span>
                        <span className="text-[10px] font-semibold px-3 py-1 bg-slate-900 text-white rounded-full font-mono">
                          GND {item.gnd || "-"}
                        </span>
                      </div>
                      <h5 className="font-bold text-slate-800 text-lg leading-tight tracking-tight">
                        {item.descricao}
                      </h5>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
                          Unitário: R$ {Number(item.valor_unitario_estimado || 0).toLocaleString("pt-BR")}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold">
                          Subtotal: R$ {(
                            Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0)
                          ).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-2 pr-5 border-r border-slate-100">
                          <Buildings size={16} weight="bold" className="text-emerald-600/40" />
                          Local: {item.local_uso || "Não informado"}
                        </span>
                        {item.link_referencia ? (
                          <a
                            href={item.link_referencia}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-upe-blue-upe hover:text-upe-blue-deep transition-all font-semibold decoration-upe-blue-upe underline underline-offset-4"
                          >
                            <ChatText size={16} /> Ver Referência Técnica
                          </a>
                        ) : (
                          <span className="flex items-center gap-2 text-slate-400">
                            <ChatText size={16} /> Sem referência técnica
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                            Justificativa do Item
                          </p>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {item.justificativa_item || "Não informada."}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                            Justificativa de Quantidade
                          </p>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {item.justificativa_quantidade || "Não informada."}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {(() => {
                          const criticidadeLevel = getCriticidadeLevel(item.criticidade);
                          const priorizacaoLevel = getPriorizacaoLevel(item.moscow_categoria);
                          const criticidadeColor = getCriticidadeAccentColor(criticidadeLevel);
                          const priorizacaoColor = getPriorizacaoAccentColor(priorizacaoLevel);

                          return (
                            <>
                              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                    Criticidade
                                  </p>
                                  <span
                                    className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                                    style={{
                                      color: criticidadeColor,
                                      backgroundColor: `${criticidadeColor}1A`,
                                    }}
                                  >
                                    {getCriticidadeLabel(item.criticidade)}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={4}
                                  step={1}
                                  value={criticidadeLevel}
                                  onChange={(event) =>
                                    updateItemCriticidade(
                                      item.id,
                                      levelToCriticidade(Number(event.target.value)),
                                    )
                                  }
                                  className="w-full h-2 cursor-pointer rounded-lg slider-crit accent-upe-red-upe"
                                  style={{ accentColor: criticidadeColor }}
                                />
                                <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400 font-semibold uppercase tracking-widest">
                                  <span>N/D</span>
                                  <span>B</span>
                                  <span>M</span>
                                  <span>A</span>
                                  <span>C</span>
                                </div>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                    Priorização
                                  </p>
                                  <span
                                    className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                                    style={{
                                      color: priorizacaoColor,
                                      backgroundColor: `${priorizacaoColor}1A`,
                                    }}
                                  >
                                    {getPriorizacaoLabel(item.moscow_categoria)}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={4}
                                  step={1}
                                  value={priorizacaoLevel}
                                  onChange={(event) =>
                                    updateItemMoscow(
                                      item.id,
                                      levelToPriorizacao(Number(event.target.value)),
                                    )
                                  }
                                  className="w-full h-2 cursor-pointer rounded-lg slider-prio accent-upe-blue-upe"
                                  style={{ accentColor: priorizacaoColor }}
                                />
                                <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400 font-semibold uppercase tracking-widest">
                                  <span>N/D</span>
                                  <span>P</span>
                                  <span>O</span>
                                  <span>R</span>
                                  <span>E</span>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-8 w-full md:w-auto shrink-0">
                      <div className="flex flex-col gap-2 w-28">
                        <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest text-center">
                          Quantidade
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantidade}
                          onChange={(e) => updateItemQty(item.id, Number(e.target.value))}
                          className="bg-upe-neutral-cool-off-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-center font-semibold text-xl text-upe-blue-upe shadow-inner focus:ring-8 focus:ring-upe-blue-upe/10 focus:border-upe-blue-upe/30 outline-none transition-all"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleItemPareto(item.id)}
                        className={cn(
                          "w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative border",
                          item.is_highlight_item
                            ? "bg-amber-400 text-white shadow-xl shadow-amber-400/40 border-amber-300"
                            : "bg-slate-50 text-slate-300 border-slate-200 hover:bg-amber-50 hover:text-amber-600",
                        )}
                        title="Pareto manual (20% por DFD)"
                      >
                        <Star size={24} weight={item.is_highlight_item ? "fill" : "bold"} />
                        {item.is_highlight_item && (
                          <motion.div
                            layoutId="star-aura"
                            className="absolute inset-0 rounded-2xl bg-amber-400 blur-xl opacity-20 pointer-events-none"
                          />
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="border-t border-emerald-100 bg-white p-6 md:p-8 space-y-5">
                <AnimatePresence>
                  {devolvendo && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3"
                    >
                      <label className="text-xs font-semibold text-red-600 uppercase tracking-widest flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                        Parecer técnico para correção
                      </label>
                      <textarea
                        value={devolucaoComment}
                        onChange={(e) => setDevolucaoComment(e.target.value)}
                        placeholder="Explique ao solicitante as inconsistências detectadas..."
                        className="w-full bg-red-50 border-2 border-red-100 rounded-2xl p-5 text-red-950 font-medium outline-none focus:ring-8 focus:ring-red-500/5 placeholder:text-red-300 resize-none shadow-inner"
                        rows={4}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-wrap justify-end items-center gap-4">
                  {!devolvendo ? (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => setDevolvendo(true)}
                        disabled={actionLoading}
                        className="h-12 px-6 rounded-2xl text-red-600 font-semibold uppercase tracking-widest hover:bg-red-50"
                      >
                        <WarningCircle size={20} className="mr-2" weight="bold" />
                        Devolver
                      </Button>
                      <Button
                        onClick={handleAprove}
                        disabled={actionLoading || items.length === 0}
                        className="h-12 px-8 rounded-2xl bg-upe-blue-upe hover:bg-upe-blue-deep text-white font-semibold uppercase tracking-widest shadow-xl shadow-slate-900/20"
                      >
                        <CheckCircle size={20} className="mr-2" weight="fill" />
                        Homologar Demanda
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDevolvendo(false);
                          setDevolucaoComment("");
                        }}
                        disabled={actionLoading}
                        className="h-11 px-6 rounded-2xl border-slate-200 font-semibold uppercase tracking-widest text-slate-500"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleDevolve}
                        disabled={actionLoading}
                        className="h-11 px-8 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold uppercase tracking-widest shadow-xl shadow-red-500/20"
                      >
                        Confirmar Rejeição
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </section>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}




