"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { getSafeUser, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Buildings,
  CheckCircle,
  Flask,
  GraduationCap,
  MagnifyingGlass,
  Swap,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { getHomeForRole, normalizeRole, type UserRole } from "@/lib/access";
import { cn } from "@/lib/utils";

interface Campus {
  id: string;
  nome: string;
  sigla: string;
}

interface Item {
  id: string;
  nome: string;
}

type CampusSelections = {
  depts: string[];
  labs: string[];
};

const ROLE_LABELS: Record<UserRole, string> = {
  solicitante: "Solicitante",
  chefia: "Chefia",
  admin: "Administrador",
  superadmin: "Superadmin",
};

const ONBOARDING_VISUALS: Record<
  number,
  { src: string; alt: string; title: string; caption: string }
> = {
  1: {
    src: "/onboarding/onboarding-00.png",
    alt: "Ilustração de perfil institucional configurado",
    title: "Comece pelo campus base",
    caption: "Essa escolha orienta os departamentos, laboratórios e fluxos que aparecem para você.",
  },
  2: {
    src: "/onboarding/onboarding-01.png",
    alt: "Ilustração de seleção de setor institucional",
    title: "Vincule seu setor principal",
    caption: "O departamento selecionado ajuda o sistema a encaminhar DFDs para a chefia correta.",
  },
  3: {
    src: "/onboarding/onboarding-02.png",
    alt: "Ilustração de seleção de espaços acadêmicos",
    title: "Inclua os laboratórios usados",
    caption: "Laboratórios podem orientar demandas de ensino, pesquisa, extensão e gestão.",
  },
};

function extractFullName(metadata: Record<string, any> | undefined): string | null {
  const fullName = String(metadata?.full_name || metadata?.name || "").trim();
  if (fullName) return fullName;
  const given = String(metadata?.given_name || "").trim();
  const family = String(metadata?.family_name || "").trim();
  const joined = `${given} ${family}`.trim();
  return joined || null;
}

function extractAvatarUrl(metadata: Record<string, any> | undefined): string | null {
  const avatar = String(metadata?.avatar_url || metadata?.picture || "").trim();
  return avatar || null;
}

async function upsertProfileIdentity(user: any, campusId: string) {
  const metadata = (user?.user_metadata || {}) as Record<string, any>;
  const payload = {
    id: user.id,
    campus_id: campusId,
    email: user.email ? String(user.email).toLowerCase() : null,
    full_name: extractFullName(metadata),
    avatar_url: extractAvatarUrl(metadata),
  };

  const { error } = await supabase.from("profiles").upsert(payload, {
    onConflict: "id",
  });

  if (error && /avatar_url/i.test(String(error.message || ""))) {
    const { error: fallbackError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          campus_id: campusId,
          email: user.email ? String(user.email).toLowerCase() : null,
          full_name: extractFullName(metadata),
        },
        { onConflict: "id" },
      );
    if (fallbackError) throw fallbackError;
    return;
  }

  if (error) throw error;
}

function buildGhostCards() {
  return Array.from({ length: 18 }).map((_, index) => ({
    id: index,
    width: 180 + ((index * 37) % 140),
    delay: (index % 6) * 0.07,
    top: 60 + ((index * 83) % 540),
    left: 40 + ((index * 149) % 1360),
  }));
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const [campi, setCampi] = useState<Campus[]>([]);
  const [depts, setDepts] = useState<Item[]>([]);
  const [labs, setLabs] = useState<Item[]>([]);

  const [activeCampus, setActiveCampus] = useState<string | null>(null);
  const [selectedByCampus, setSelectedByCampus] = useState<
    Record<string, CampusSelections>
  >({});
  const [deptQuery, setDeptQuery] = useState("");
  const [labQuery, setLabQuery] = useState("");
  const [detectedRole, setDetectedRole] = useState<UserRole>("solicitante");

  const ghostCards = useMemo(() => buildGhostCards(), []);
  const isSuperadmin = detectedRole === "superadmin";

  const selectedDepts = useMemo(
    () => (activeCampus ? selectedByCampus[activeCampus]?.depts || [] : []),
    [activeCampus, selectedByCampus],
  );
  const selectedLabs = useMemo(
    () => (activeCampus ? selectedByCampus[activeCampus]?.labs || [] : []),
    [activeCampus, selectedByCampus],
  );

  const totalSelectedDepts = useMemo(
    () =>
      Object.values(selectedByCampus).reduce(
        (acc, selections) => acc + selections.depts.length,
        0,
      ),
    [selectedByCampus],
  );

  const totalSelectedLabs = useMemo(
    () =>
      Object.values(selectedByCampus).reduce(
        (acc, selections) => acc + selections.labs.length,
        0,
      ),
    [selectedByCampus],
  );

  const filteredDepts = useMemo(() => {
    const query = deptQuery.trim().toLowerCase();
    if (!query) return depts;
    return depts.filter((item) => item.nome.toLowerCase().includes(query));
  }, [depts, deptQuery]);

  const filteredLabs = useMemo(() => {
    const query = labQuery.trim().toLowerCase();
    if (!query) return labs;
    return labs.filter((item) => item.nome.toLowerCase().includes(query));
  }, [labs, labQuery]);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      setBootstrapping(true);
      const user = await getSafeUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const [campiRes, profileRes, unitsRes] = await Promise.all([
        supabase
          .from("campi")
          .select("id, nome, sigla")
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("profiles")
          .select("role, campus_id")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_units")
          .select("unit_type, unit_id")
          .eq("user_id", user.id),
      ]);

      if (!active) return;

      const campuses = campiRes.data || [];
      setCampi(campuses);

      const role = normalizeRole(profileRes.data?.role, user.email);
      setDetectedRole(role);

      const initialCampus =
        profileRes.data?.campus_id || campuses[0]?.id || null;
      setActiveCampus(initialCampus);

      const groupedSelections: Record<string, CampusSelections> = {};

      if (unitsRes.data && unitsRes.data.length > 0) {
        const deptIds = unitsRes.data
          .filter((unit) => unit.unit_type === "departamento")
          .map((unit) => unit.unit_id);
        const labIds = unitsRes.data
          .filter((unit) => unit.unit_type === "laboratorio")
          .map((unit) => unit.unit_id);

        const [deptsRes, labsRes] = await Promise.all([
          deptIds.length
            ? supabase
                .from("departamentos")
                .select("id, campus_id")
                .in("id", deptIds)
            : Promise.resolve({ data: [] as any[] }),
          labIds.length
            ? supabase
                .from("laboratorios")
                .select("id, campus_id")
                .in("id", labIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        (deptsRes.data || []).forEach((dept) => {
          if (!dept.campus_id) return;
          if (!groupedSelections[dept.campus_id]) {
            groupedSelections[dept.campus_id] = { depts: [], labs: [] };
          }
          if (groupedSelections[dept.campus_id].depts.length === 0) {
            groupedSelections[dept.campus_id].depts.push(dept.id);
          }
        });

        (labsRes.data || []).forEach((lab) => {
          if (!lab.campus_id) return;
          if (!groupedSelections[lab.campus_id]) {
            groupedSelections[lab.campus_id] = { depts: [], labs: [] };
          }
          groupedSelections[lab.campus_id].labs.push(lab.id);
        });
      }

      setSelectedByCampus(groupedSelections);
      setBootstrapping(false);
    }

    loadInitialData();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    async function loadUnitsByCampus() {
      if (!activeCampus) {
        setDepts([]);
        setLabs([]);
        return;
      }

      const [deptRes, labsRes] = await Promise.all([
        supabase
          .from("departamentos")
          .select("id, nome")
          .eq("campus_id", activeCampus)
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("laboratorios")
          .select("id, nome")
          .eq("campus_id", activeCampus)
          .eq("ativo", true)
          .order("nome"),
      ]);

      if (deptRes.data) setDepts(deptRes.data);
      if (labsRes.data) setLabs(labsRes.data);
    }

    loadUnitsByCampus();
  }, [activeCampus]);

  useEffect(() => {
    setDeptQuery("");
    setLabQuery("");
  }, [activeCampus, step]);

  const progress = useMemo(() => Math.round((step / 3) * 100), [step]);

  const toggleSelection = (type: "depts" | "labs", id: string) => {
    if (!activeCampus) return;

    setSelectedByCampus((prev) => {
      const current = prev[activeCampus] || { depts: [], labs: [] };
      if (type === "depts") {
        return {
          ...prev,
          [activeCampus]: {
            ...current,
            depts: [id],
          },
        };
      }
      const currentList = current[type];
      const hasItem = currentList.includes(id);

      return {
        ...prev,
        [activeCampus]: {
          ...current,
          [type]: hasItem
            ? currentList.filter((itemId) => itemId !== id)
            : [...currentList, id],
        },
      };
    });
  };

  const selectAllFilteredLabs = () => {
    if (!activeCampus) return;
    setSelectedByCampus((prev) => {
      const current = prev[activeCampus] || { depts: [], labs: [] };
      const merged = Array.from(new Set([...current.labs, ...filteredLabs.map((l) => l.id)]));
      return {
        ...prev,
        [activeCampus]: {
          ...current,
          labs: merged,
        },
      };
    });
  };

  const clearLabsForActiveCampus = () => {
    if (!activeCampus) return;
    setSelectedByCampus((prev) => {
      const current = prev[activeCampus] || { depts: [], labs: [] };
      return {
        ...prev,
        [activeCampus]: {
          ...current,
          labs: [],
        },
      };
    });
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const user = await getSafeUser();
      if (!user) throw new Error("Usuário não encontrado");
      if (!activeCampus) throw new Error("Selecione um campus para continuar");

      if (isSuperadmin) {
        if (totalSelectedDepts === 0) {
          throw new Error(
            "Selecione ao menos um departamento em Petrolina ou Ouricuri.",
          );
        }
      } else if (selectedDepts.length === 0) {
        throw new Error("Selecione ao menos um departamento");
      }

      await upsertProfileIdentity(user, activeCampus);

      const unitInserts = Object.entries(selectedByCampus).flatMap(
        ([, campusSelections]) => [
          ...campusSelections.depts.map((id) => ({
            user_id: user.id,
            unit_type: "departamento",
            unit_id: id,
            role_in_unit: "membro",
          })),
          ...campusSelections.labs.map((id) => ({
            user_id: user.id,
            unit_type: "laboratorio",
            unit_id: id,
            role_in_unit: "membro",
          })),
        ],
      );

      const uniqueUnitInserts = Array.from(
        new Map(
          unitInserts.map((item) => [`${item.unit_type}:${item.unit_id}`, item]),
        ).values(),
      );

      const { error: deleteUnitsError } = await supabase
        .from("user_units")
        .delete()
        .eq("user_id", user.id);
      if (deleteUnitsError) throw deleteUnitsError;

      if (uniqueUnitInserts.length > 0) {
        const { error: unitsError } = await supabase
          .from("user_units")
          .insert(uniqueUnitInserts);
        if (unitsError) throw unitsError;
      }

      toast.success("Perfil configurado com sucesso.");
      router.replace(getHomeForRole(detectedRole));
    } catch (error: any) {
      toast.error(`Erro ao configurar perfil: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const currentCampusLabel =
    campi.find((campus) => campus.id === activeCampus)?.nome || "Campus";
  const currentVisual = ONBOARDING_VISUALS[step];
  // Respeita preferência: ghost cards eram o pior ofensor (loop infinito
  // ignorando todas as 3 fontes de reduced-motion). Quando reduzido, viram
  // cards estáticos com opacidade fixa.
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#EEF3F9]"
      data-animate-page
      data-animate-auto
    >
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#DCEAF0] via-[#E8EDF2] to-[#F4F7FA]" />
        <div className="absolute inset-0">
          {ghostCards.map((card) => (
            <motion.div
              key={card.id}
              className="absolute h-20 rounded-2xl border border-white/40 bg-white/55 shadow-sm"
              style={{
                top: card.top,
                left: card.left,
                width: card.width,
                opacity: reduceMotion ? 0.55 : undefined,
              }}
              animate={
                reduceMotion
                  ? undefined
                  : { y: [0, -4, 0], opacity: [0.55, 0.75, 0.55] }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 3.4,
                      repeat: Infinity,
                      repeatType: "mirror",
                      delay: card.delay,
                    }
              }
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      <div className="absolute inset-0 bg-white/42 backdrop-blur-[10px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="w-full max-w-4xl rounded-[30px] border border-white/60 bg-white/92 shadow-[0_20px_70px_-30px_rgba(15,46,87,0.45)]"
        >
          <div className="border-b border-[#E8EDF2] px-6 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7D98B8]">
                  Configuração Inicial
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#164073]">
                  Complete seu onboarding
                </h1>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#D9E0E8] bg-[#F4F7FA] px-3 py-1 text-xs font-semibold text-[#3E4C5F]">
                  <CheckCircle size={15} weight="fill" />
                  Nível detectado: {ROLE_LABELS[detectedRole]}
                </div>
              </div>

              {isSuperadmin && campi.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">
                    Campus ativo
                  </p>
                  <div className="inline-flex items-center gap-1 rounded-full border border-[#D9E0E8] bg-[#F4F7FA] p-1">
                    {campi
                      .filter((campus) =>
                        ["PTR", "OUR"].includes(String(campus.sigla || "").toUpperCase()),
                      )
                      .map((campus) => {
                        const selected = campus.id === activeCampus;
                        return (
                          <button
                            key={campus.id}
                            type="button"
                            onClick={() => setActiveCampus(campus.id)}
                            className={cn(
                              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                              selected
                                ? "bg-[#164073] text-white shadow-sm"
                                : "text-[#3E4C5F] hover:bg-white",
                            )}
                          >
                            {campus.sigla}
                          </button>
                        );
                      })}
                    <span className="ml-1 mr-2 text-[#7D98B8]">
                      <Swap size={14} />
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 h-2 w-full rounded-full bg-[#E8EDF2]">
              <div
                className="h-2 rounded-full bg-[#164073] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              {bootstrapping ? (
                <div className="space-y-3">
                  <div className="h-4 w-48 animate-pulse rounded-full bg-[#D9E0E8]" />
                  <div className="h-10 w-full animate-pulse rounded-xl bg-[#E8EDF2]" />
                  <p className="text-sm text-[#5B6675]">Carregando configurações...</p>
                </div>
              ) : (
                <>
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[#164073]">
                      <GraduationCap size={20} weight="duotone" />
                      <h2 className="text-lg font-semibold">Selecione seu campus base</h2>
                    </div>
                    <p className="text-sm text-[#5B6675]">
                      {isSuperadmin
                        ? "Como superadmin, você pode alternar o campus ativo no topo e configurar os locais de ambos."
                        : "Escolha o campus principal para vincular departamentos e laboratórios."}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-animate-stagger>
                      {campi.map((campus) => {
                        const selected = activeCampus === campus.id;
                        return (
                          <motion.button
                            key={campus.id}
                            data-animate-item
                            type="button"
                            onClick={() => setActiveCampus(campus.id)}
                            whileHover={{ y: -2, scale: 1.01 }}
                            whileTap={{ y: 1, scale: 0.97, rotate: -0.4 }}
                            transition={{ duration: 0.14 }}
                            className={cn(
                              "rounded-xl border px-4 py-3 text-left shadow-sm transition",
                              selected
                                ? "border-[#164073] bg-[#E8EDF2] text-[#164073]"
                                : "border-[#D9E0E8] bg-white text-[#2E3A4A]",
                            )}
                          >
                            <p className="text-sm font-semibold">{campus.nome}</p>
                            <p className="text-[11px] uppercase tracking-wider text-[#7D98B8]">
                              {campus.sigla}
                            </p>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[#164073]">
                      <Buildings size={20} weight="duotone" />
                      <h2 className="text-lg font-semibold">
                        Departamentos de {currentCampusLabel}
                      </h2>
                    </div>
                    <p className="text-sm text-[#5B6675]">
                      Escolha um único departamento responsável.
                    </p>
                    <div className="relative">
                      <MagnifyingGlass
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7D98B8]"
                      />
                      <input
                        type="text"
                        value={deptQuery}
                        onChange={(event) => setDeptQuery(event.target.value)}
                        placeholder="Buscar departamento..."
                        className="h-10 w-full rounded-xl border border-[#D9E0E8] bg-white pl-9 pr-3 text-sm text-[#2E3A4A] outline-none focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#5B6675]">
                      <span>{filteredDepts.length} departamento(s) encontrado(s)</span>
                      {selectedDepts[0] && (
                        <span className="font-semibold text-[#164073]">
                          Selecionado: {depts.find((d) => d.id === selectedDepts[0])?.nome}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2" data-animate-stagger>
                      {filteredDepts.map((dept) => {
                        const selected = selectedDepts.includes(dept.id);
                        return (
                          <motion.button
                            key={dept.id}
                            data-animate-item
                            type="button"
                            onClick={() => toggleSelection("depts", dept.id)}
                            whileHover={{ y: -2, scale: 1.005 }}
                            whileTap={{ y: 1, scale: 0.985 }}
                            className={cn(
                              "w-full rounded-xl border px-3 py-3 text-left text-sm font-medium transition",
                              selected
                                ? "border-[#164073] bg-[#E8EDF2] text-[#164073] shadow-sm"
                                : "border-[#D9E0E8] bg-white text-[#2E3A4A]",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={cn(
                                  "h-4 w-4 rounded-full border-2 transition",
                                  selected ? "border-[#164073]" : "border-[#A7B1BD]",
                                )}
                              >
                                {selected && (
                                  <span className="m-[3px] block h-1.5 w-1.5 rounded-full bg-[#164073]" />
                                )}
                              </span>
                              <span className="text-sm">{dept.nome}</span>
                            </div>
                          </motion.button>
                        );
                      })}
                      {filteredDepts.length === 0 && (
                        <div className="rounded-xl border border-dashed border-[#D9E0E8] bg-[#FAFBFC] px-4 py-6 text-center text-sm text-[#5B6675]">
                          Nenhum departamento encontrado para este filtro.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[#164073]">
                      <Flask size={20} weight="duotone" />
                      <h2 className="text-lg font-semibold">
                        Laboratórios de {currentCampusLabel}
                      </h2>
                    </div>
                    <p className="text-sm text-[#5B6675]">
                      Selecione os laboratórios aos quais você se vincula.
                    </p>
                    <div className="relative">
                      <MagnifyingGlass
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7D98B8]"
                      />
                      <input
                        type="text"
                        value={labQuery}
                        onChange={(event) => setLabQuery(event.target.value)}
                        placeholder="Buscar laboratório..."
                        className="h-10 w-full rounded-xl border border-[#D9E0E8] bg-white pl-9 pr-3 text-sm text-[#2E3A4A] outline-none focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5B6675]">
                      <span>{filteredLabs.length} laboratório(s) encontrado(s)</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllFilteredLabs}
                          className="rounded-full border border-[#D9E0E8] bg-white px-3 py-1 font-semibold text-[#164073] hover:border-[#164073]"
                        >
                          Selecionar filtrados
                        </button>
                        <button
                          type="button"
                          onClick={clearLabsForActiveCampus}
                          className="rounded-full border border-[#D9E0E8] bg-white px-3 py-1 font-semibold text-[#5B6675] hover:border-[#A7B1BD]"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    {selectedLabs.length > 0 && (
                      <div className="rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] p-3">
                        <p className="mb-2 text-xs font-semibold text-[#7D98B8]">
                          Laboratórios selecionados
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedLabs.map((labId) => {
                            const label = labs.find((lab) => lab.id === labId)?.nome || labId;
                            return (
                              <button
                                key={labId}
                                type="button"
                                onClick={() => toggleSelection("labs", labId)}
                                className="inline-flex items-center gap-1 rounded-full border border-[#C7D7EA] bg-white px-3 py-1 text-xs font-semibold text-[#164073]"
                              >
                                <span>{label}</span>
                                <X size={12} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2" data-animate-stagger>
                      {filteredLabs.map((lab) => {
                        const selected = selectedLabs.includes(lab.id);
                        return (
                          <motion.button
                            key={lab.id}
                            data-animate-item
                            type="button"
                            onClick={() => toggleSelection("labs", lab.id)}
                            whileHover={{ y: -2, scale: 1.005 }}
                            whileTap={{ y: 1, scale: 0.985 }}
                            className={cn(
                              "w-full rounded-xl border px-3 py-3 text-left text-sm font-medium transition",
                              selected
                                ? "border-[#164073] bg-[#E8EDF2] text-[#164073] shadow-sm"
                                : "border-[#D9E0E8] bg-white text-[#2E3A4A]",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={cn(
                                  "flex h-4 w-4 items-center justify-center rounded border-2 transition",
                                  selected ? "border-[#164073] bg-[#164073]" : "border-[#A7B1BD]",
                                )}
                              >
                                {selected && <span className="h-1.5 w-1.5 rounded-[2px] bg-white" />}
                              </span>
                              <span className="text-sm">{lab.nome}</span>
                            </div>
                          </motion.button>
                        );
                      })}
                      {filteredLabs.length === 0 && (
                        <div className="rounded-xl border border-dashed border-[#D9E0E8] bg-[#FAFBFC] px-4 py-6 text-center text-sm text-[#5B6675]">
                          Nenhum laboratório encontrado para este filtro.
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-4 py-3 text-sm text-[#3E4C5F]">
                      {totalSelectedDepts} departamento(s) e {totalSelectedLabs} laboratório(s) selecionado(s).
                    </div>
                  </div>
                )}
                </>
              )}
            </div>

            <motion.aside
              key={currentVisual.src}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="order-first rounded-2xl border border-[#D9E0E8] bg-[#F7FBFF] p-4 shadow-sm lg:order-none"
            >
              <div className="overflow-hidden rounded-xl bg-white">
                <Image
                  src={currentVisual.src}
                  alt={currentVisual.alt}
                  width={1680}
                  height={936}
                  className="h-auto w-full object-cover"
                  priority
                />
              </div>
              <div className="mt-4 space-y-1.5">
                <p className="text-sm font-semibold text-[#164073]">{currentVisual.title}</p>
                <p className="text-xs leading-5 text-[#5B6675]">{currentVisual.caption}</p>
              </div>
            </motion.aside>
          </div>

          <div className="flex items-center justify-between border-t border-[#E8EDF2] px-6 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={step === 1 || bootstrapping || loading}
              onClick={() => setStep((prev) => prev - 1)}
            >
              Voltar
            </Button>

            {step < 3 ? (
              <Button
                type="button"
                disabled={
                  bootstrapping ||
                  (step === 1 && !activeCampus) ||
                  (step === 2 && selectedDepts.length === 0)
                }
                onClick={() => setStep((prev) => prev + 1)}
                className="bg-[#164073] hover:bg-[#0F2E57]"
              >
                Próximo
              </Button>
            ) : (
              <Button
                type="button"
                disabled={bootstrapping || loading || !activeCampus}
                onClick={handleComplete}
                className="bg-[#164073] hover:bg-[#0F2E57]"
              >
                {loading ? "Salvando..." : "Finalizar"}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
