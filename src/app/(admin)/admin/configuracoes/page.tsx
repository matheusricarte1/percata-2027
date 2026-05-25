"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowsClockwise,
  Buildings,
  CalendarBlank,
  ChatCenteredDots,
  CheckCircle,
  Files,
  Flask,
  Gear,
  MegaphoneSimple,
  Package,
  Plus,
  ShieldCheck,
  UploadSimple,
  Users,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSafeUser, supabase } from "@/lib/supabase";
import { normalizeRole, type UserRole } from "@/lib/access";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { CategoryAvatar } from "@/components/user/CategoryAvatar";
import {
  sanitizeLongText,
  sanitizePlainText,
  sanitizeUiMessage,
  sanitizeUuid,
} from "@/lib/settings-sanitize";

const UsuariosModule = dynamic(() => import("@/app/(admin)/admin/usuarios/page"), {
  ssr: false,
  loading: () => <ModuleLoading label="usuários" />,
});
const ExportacaoModule = dynamic(() => import("@/app/(admin)/admin/exportacao/page"), {
  ssr: false,
  loading: () => <ModuleLoading label="exportação" />,
});
const KitsModule = dynamic(() => import("@/app/(admin)/admin/kits/page"), {
  ssr: false,
  loading: () => <ModuleLoading label="kits" />,
});
const CampanhasModule = dynamic(() => import("@/app/(admin)/admin/campanhas/page"), {
  ssr: false,
  loading: () => <ModuleLoading label="campanhas" />,
});

type Campus = {
  id: string;
  nome: string;
  sigla: string;
  ativo: boolean;
};

type Unidade = {
  id: string;
  nome: string;
  ativo: boolean;
  campus_id?: string | null;
  chefia?: {
    user_id: string;
    full_name: string | null;
    email: string | null;
  } | null;
};

type ChefiaOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  campus_id: string | null;
  avatar_url?: string | null;
};

type AdminTab =
  | "ajustes"
  | "acesso"
  | "estrutura"
  | "mensagens"
  | "usuarios"
  | "exportacao"
  | "kits"
  | "campanhas";

type TabItem = {
  key: AdminTab;
  label: string;
  icon: React.ComponentType<any>;
  superadminOnly?: boolean;
};

const TABS: TabItem[] = [
  { key: "ajustes", label: "Ajustes", icon: Gear },
  { key: "acesso", label: "Acesso", icon: ShieldCheck, superadminOnly: true },
  { key: "estrutura", label: "Estrutura", icon: Buildings, superadminOnly: true },
  { key: "mensagens", label: "Mensagens", icon: MegaphoneSimple, superadminOnly: true },
  { key: "usuarios", label: "Usuários", icon: Users },
  { key: "exportacao", label: "Exportação", icon: Files },
  { key: "kits", label: "Modelos DFD", icon: Package },
  { key: "campanhas", label: "Campanhas", icon: CalendarBlank },
];

export default function ConfiguracoesAdminPage() {
  const [role, setRole] = useState<UserRole>("solicitante");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("ajustes");

  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  const [campi, setCampi] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>("");
  const [departamentos, setDepartamentos] = useState<Unidade[]>([]);
  const [laboratorios, setLaboratorios] = useState<Unidade[]>([]);
  const [chefiaOptions, setChefiaOptions] = useState<ChefiaOption[]>([]);
  const [supportsLabCampus, setSupportsLabCampus] = useState<boolean>(false);
  const [structureNotice, setStructureNotice] = useState<string | null>(null);

  const [newDepartamento, setNewDepartamento] = useState("");
  const [newLaboratorio, setNewLaboratorio] = useState("");
  const [draftDeptNames, setDraftDeptNames] = useState<Record<string, string>>({});
  const [draftLabNames, setDraftLabNames] = useState<Record<string, string>>({});

  const isSuperadmin = role === "superadmin";
  const isAdminOrSuperadmin = role === "admin" || role === "superadmin";

  async function resolveRole(): Promise<UserRole> {
    const user = await getSafeUser();
    if (!user) {
      setRole("solicitante");
      return "solicitante";
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const resolved = normalizeRole(profile?.role, user.email);
    setRole(resolved);
    return resolved;
  }

  async function loadStructure(campusId?: string) {
    const targetCampus = campusId || selectedCampusId;
    if (!targetCampus) return;

    setLoadingData(true);
    setStructureNotice(null);
    try {
      const response = await fetch(
        `/api/superadmin/org-structure?campusId=${targetCampus}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Falha ao carregar.");

      const campiData = (payload.campi || []) as Campus[];
      const deptData = (payload.departamentos || []) as Unidade[];
      const labsData = (payload.laboratorios || []) as Unidade[];
      const chefiaData = (payload.chefia_options || []) as ChefiaOption[];

      setCampi(campiData);
      setDepartamentos(deptData);
      setLaboratorios(labsData);
      setChefiaOptions(chefiaData);
      setSupportsLabCampus(Boolean(payload.supports_lab_campus));

      setDraftDeptNames(
        Object.fromEntries(deptData.map((item) => [item.id, item.nome])),
      );
      setDraftLabNames(
        Object.fromEntries(labsData.map((item) => [item.id, item.nome])),
      );
    } catch (error: any) {
      const message = sanitizeUiMessage(error?.message, 220) || "Erro ao carregar estrutura.";
      setStructureNotice(message);
      toast.error(message);
    } finally {
      setLoadingData(false);
    }
  }

  async function loadActiveCampiFallback() {
    const { data, error } = await supabase
      .from("campi")
      .select("id,nome,sigla,ativo")
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;
    return (data || []) as Campus[];
  }

  useEffect(() => {
    async function bootstrap() {
      setBootstrapping(true);
      const resolvedRole = await resolveRole();

      if (resolvedRole === "superadmin") {
        try {
          const response = await fetch("/api/superadmin/org-structure", {
            method: "GET",
            cache: "no-store",
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload?.error || "Falha ao carregar estrutura.");
          }
          const availableCampi = (payload.campi || []) as Campus[];
          if (availableCampi.length === 0) {
            throw new Error("Nenhum campus ativo retornado pela API administrativa.");
          }
          setCampi(availableCampi);
          const firstCampus = availableCampi[0]?.id || "";
          if (firstCampus) {
            setSelectedCampusId(firstCampus);
            await loadStructure(firstCampus);
          }
        } catch (error: any) {
          try {
            const fallbackCampi = await loadActiveCampiFallback();
            setCampi(fallbackCampi);
            const firstCampus = fallbackCampi[0]?.id || "";
            if (firstCampus) {
              setSelectedCampusId(firstCampus);
              await loadStructure(firstCampus);
            } else {
              setStructureNotice("Nenhum campus ativo encontrado.");
            }
          } catch {
            setStructureNotice(
              error?.message || "Não foi possível carregar os campi ativos.",
            );
          }
        }
      } else {
        setActiveTab("ajustes");
      }

      setBootstrapping(false);
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCampusId || !isSuperadmin) return;
    loadStructure(selectedCampusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampusId, isSuperadmin]);

  async function runAction(body: Record<string, any>, successMessage?: string) {
    if (!isSuperadmin) {
      toast.warning("Somente superadmin pode editar esta seção.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/superadmin/org-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Falha na operação.");
      if (successMessage) toast.success(successMessage);
      await loadStructure(selectedCampusId);
      return payload;
    } catch (error: any) {
      toast.error(sanitizeUiMessage(error?.message, 220) || "Erro na operação.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleAddDepartamento() {
    const nome = sanitizePlainText(newDepartamento, 160);
    if (!nome) return;
    if (!selectedCampusId) {
      toast.warning("Selecione um campus.");
      return;
    }
    const payload = await runAction(
      {
        action: "upsert_department",
        nome,
        campus_id: selectedCampusId,
      },
      "Setor salvo.",
    );
    if (payload) setNewDepartamento("");
  }

  async function handleAddLaboratorio() {
    const nome = sanitizePlainText(newLaboratorio, 180);
    if (!nome) return;
    const payload = await runAction(
      {
        action: "upsert_lab",
        nome,
        campus_id: selectedCampusId || null,
      },
      "Laboratório salvo.",
    );
    if (payload) setNewLaboratorio("");
  }

  const campusLabel = useMemo(() => {
    const campus = campi.find((item) => item.id === selectedCampusId);
    if (!campus) return "Campus não selecionado";
    return `${campus.nome} (${campus.sigla})`;
  }, [campi, selectedCampusId]);

  if (bootstrapping) {
    return (
      <div className="p-8">
        <div className="rounded-[22px] border border-[#D6E3F2] bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">
          Carregando configurações...
        </div>
      </div>
    );
  }

  if (!isAdminOrSuperadmin) {
    return (
      <div className="space-y-4">
        <SettingsPanel scope="Administração" />
        <div className="mx-8 mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold uppercase tracking-widest text-amber-700">
          Esta seção é exclusiva para perfis de administração.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 bg-[#F4F7FA] p-6 md:p-8">
      <section className="overflow-hidden rounded-[22px] border border-[#C7D7EA] bg-[#F7FBFF] p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#47739F]">
              Administração do sistema
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[#17233C] md:text-3xl">
              Configurações do Sistema
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-medium text-[#52627A]">
              Ajustes de conta e módulos de gestão centralizados em uma única seção.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-[#D6E3F2] bg-white/80 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#164073]">
            <ShieldCheck size={16} weight="fill" />
            {isSuperadmin ? "Modo Superadmin" : "Modo Admin"}
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-[#E1E8F0] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {TABS.filter((tab) => !tab.superadminOnly || isSuperadmin).map((tab) => (
            <button
              key={tab.key}
              type="button"
          onClick={() => setActiveTab(tab.key)}
          disabled={bootstrapping}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                activeTab === tab.key
                  ? "bg-[#164073] text-white shadow-sm"
                  : "border border-[#D9E0E8] bg-[#F7FBFF] text-[#3E4C5F] hover:bg-[#E8EDF2]"
              }`}
            >
              <tab.icon size={14} weight="fill" />
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "ajustes" && <SettingsPanel scope="Administração" />}

      {activeTab === "acesso" && isSuperadmin && (
        <div className="space-y-5">
          <SystemAccessLockPanel />
          <DfdDataGovernancePanel />
        </div>
      )}

      {activeTab === "estrutura" && isSuperadmin && (
        <StructureSettingsPanel
          loadingData={loadingData}
          saving={saving}
          campi={campi}
          structureNotice={structureNotice}
          selectedCampusId={selectedCampusId}
          setSelectedCampusId={setSelectedCampusId}
          campusLabel={campusLabel}
          supportsLabCampus={supportsLabCampus}
          newDepartamento={newDepartamento}
          setNewDepartamento={setNewDepartamento}
          newLaboratorio={newLaboratorio}
          setNewLaboratorio={setNewLaboratorio}
          departamentos={departamentos}
          laboratorios={laboratorios}
          chefiaOptions={chefiaOptions}
          draftDeptNames={draftDeptNames}
          setDraftDeptNames={setDraftDeptNames}
          draftLabNames={draftLabNames}
          setDraftLabNames={setDraftLabNames}
          loadStructure={loadStructure}
          runAction={runAction}
          handleAddDepartamento={handleAddDepartamento}
          handleAddLaboratorio={handleAddLaboratorio}
        />
      )}
      {activeTab === "mensagens" && isSuperadmin && (
        <BroadcastMessagesPanel campi={campi} />
      )}

      {activeTab === "usuarios" && <UsuariosModule />}
      {activeTab === "exportacao" && <ExportacaoModule />}
      {activeTab === "kits" && <KitsModule />}
      {activeTab === "campanhas" && <CampanhasModule />}
    </div>
  );
}

function ModuleLoading({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-[#D2D0CE] bg-white p-6 text-sm font-semibold text-slate-500">
      Carregando módulo de {label}...
    </div>
  );
}

function DfdDataGovernancePanel() {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [purging, setPurging] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [preview, setPreview] = useState<{
    purgeCount: number;
    legacyCount: number;
    samplePurgeProtocols: string[];
    sampleLegacyProtocols: string[];
  } | null>(null);
  const [confirmationPhrase, setConfirmationPhrase] = useState("APAGAR BASE DFD");

  async function loadPreview() {
    setLoadingPreview(true);
    try {
      const response = await fetch("/api/superadmin/dfds/purge", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Falha ao carregar prévia.");
      setPreview(payload?.preview || null);
      setConfirmationPhrase(String(payload?.confirmationPhrase || "APAGAR BASE DFD"));
    } catch (error: any) {
      toast.error(sanitizeUiMessage(error?.message, 220) || "Falha ao carregar prévia da limpeza.");
    } finally {
      setLoadingPreview(false);
    }
  }

  useEffect(() => {
    void loadPreview();
  }, []);

  async function purgeNonLegacyDfds() {
    if (confirm.trim().toUpperCase() !== confirmationPhrase.trim().toUpperCase()) {
      toast.warning(`Digite exatamente "${confirmationPhrase}" para confirmar.`);
      return;
    }
    setPurging(true);
    try {
      const response = await fetch("/api/superadmin/dfds/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Falha ao limpar base de DFDs.");
      toast.success(
        payload?.deletedCount > 0
          ? `${payload.deletedCount} DFD(s) removida(s) da base atual.`
          : "Nenhuma DFD não legada encontrada para limpeza.",
      );
      setConfirm("");
      await loadPreview();
    } catch (error: any) {
      toast.error(sanitizeUiMessage(error?.message, 220) || "Falha ao limpar base de DFDs.");
    } finally {
      setPurging(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-[#F4B7B7] bg-[#FFF8F8] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#A91520]">
            Governança de dados
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[#17233C]">
            Limpeza da base de DFDs
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#52627A]">
            Remove todas as DFDs da base atual (incluindo itens e logs vinculados).
            Os registros legados permanecem preservados.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPreview}
          disabled={loadingPreview || purging}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E6C0C0] bg-white px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#A91520] transition hover:bg-[#FFF1F1] disabled:opacity-60"
        >
          <ArrowsClockwise size={14} weight="bold" className={loadingPreview ? "animate-spin" : ""} />
          Atualizar prévia
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[#F0D1D1] bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7A8797]">
            DFDs para remover
          </p>
          <p className="mt-1 text-2xl font-bold text-[#A91520]">
            {loadingPreview ? "..." : String(preview?.purgeCount ?? 0)}
          </p>
          {preview?.samplePurgeProtocols?.length ? (
            <p className="mt-1 text-xs text-[#5B6675]">
              Exemplos: {preview.samplePurgeProtocols.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-[#D9E0E8] bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7A8797]">
            Registros legados preservados
          </p>
          <p className="mt-1 text-2xl font-bold text-[#164073]">
            {loadingPreview ? "..." : String(preview?.legacyCount ?? 0)}
          </p>
          {preview?.sampleLegacyProtocols?.length ? (
            <p className="mt-1 text-xs text-[#5B6675]">
              Exemplos: {preview.sampleLegacyProtocols.join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#F0D1D1] bg-white px-4 py-3">
        <p className="text-xs font-semibold text-[#A91520]">
          Ação destrutiva irreversível. Confirme digitando:
        </p>
        <p className="mt-1 font-mono text-sm font-bold text-[#17233C]">{confirmationPhrase}</p>
        <input
          value={confirm}
          onChange={(event) => setConfirm(sanitizePlainText(event.target.value, 64))}
          className="mt-3 h-11 w-full rounded-xl border border-[#E6C0C0] bg-[#FFFDFD] px-3 text-sm font-semibold text-[#2E3A4A] outline-none transition focus:border-[#A91520] focus:ring-2 focus:ring-[#F4B7B7]"
          placeholder={confirmationPhrase}
          disabled={purging}
        />
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            onClick={purgeNonLegacyDfds}
            disabled={purging || loadingPreview}
            className="h-10 rounded-lg bg-[#A91520] px-4 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-[#7F1018]"
          >
            {purging ? "Limpando base..." : "Apagar base de DFDs"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function BroadcastMessagesPanel({ campi }: { campi: Campus[] }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"info" | "success" | "warning" | "error">("info");
  const [scope, setScope] = useState<"all" | "campus" | "role" | "user">("all");
  const [targetCampusId, setTargetCampusId] = useState("");
  const [targetRole, setTargetRole] = useState("solicitante");
  const [targetUserId, setTargetUserId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [sending, setSending] = useState(false);

  async function sendBroadcast() {
    const safeTitle = sanitizePlainText(title, 120);
    const safeBody = sanitizeLongText(body, 1200);
    if (!safeTitle || !safeBody) {
      toast.warning("Preencha título e mensagem.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: safeTitle,
          body: safeBody,
          type,
          targetScope: scope,
          targetCampusId: scope === "campus" ? sanitizeUuid(targetCampusId) : null,
          targetRole: scope === "role" ? sanitizePlainText(targetRole, 32) : null,
          targetUserId: scope === "user" ? sanitizeUuid(targetUserId) : null,
          imageUrl: sanitizePlainText(imageUrl, 600) || null,
          ctaLabel: sanitizePlainText(ctaLabel, 60) || null,
          ctaUrl: sanitizePlainText(ctaUrl, 600) || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao enviar mensagem.");
      }
      toast.success(`Mensagem enviada para ${Number(payload?.recipients || 0)} usuário(s).`);
      setBody("");
      setImageUrl("");
      setCtaLabel("");
      setCtaUrl("");
      if (scope === "user") setTargetUserId("");
    } catch (error: any) {
      toast.error(sanitizeUiMessage(error?.message, 220) || "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-[#E1E8F0] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#47739F]">
            Comunicação administrativa
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[#17233C]">
            Mensagens com imagem
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
            Envie avisos para usuários do sistema e inclua foto (URL) e botão de ação opcional.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-[#D9E0E8] bg-[#F7FBFF] px-3 py-2 text-xs font-semibold text-[#164073]">
          <ChatCenteredDots size={16} weight="duotone" />
          Campainha + painel do usuário
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">Título</span>
          <input
            value={title}
            onChange={(event) => setTitle(sanitizePlainText(event.target.value, 120))}
            className="mt-2 h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 text-sm font-semibold text-[#164073] outline-none transition focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
            placeholder="Ex.: Janela de envio encerra hoje às 18h"
            maxLength={120}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">Tipo</span>
          <select
            value={type}
            onChange={(event) => setType((event.target.value as any) || "info")}
            className="mt-2 h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 text-sm font-semibold text-[#164073] outline-none transition focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
          >
            <option value="info">Informação</option>
            <option value="success">Sucesso</option>
            <option value="warning">Atenção</option>
            <option value="error">Crítico</option>
          </select>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">Mensagem</span>
        <textarea
          value={body}
          onChange={(event) => setBody(sanitizeLongText(event.target.value, 1200))}
          className="mt-2 min-h-[120px] w-full rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 py-3 text-sm text-[#2E3A4A] outline-none transition focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
          maxLength={1200}
          placeholder="Explique em linguagem direta o que muda e o que o usuário precisa fazer."
        />
      </label>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">Alvo</span>
          <select
            value={scope}
            onChange={(event) => setScope((event.target.value as any) || "all")}
            className="mt-2 h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 text-sm font-semibold text-[#164073] outline-none transition focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
          >
            <option value="all">Todos os usuários</option>
            <option value="campus">Campus específico</option>
            <option value="role">Papel específico</option>
            <option value="user">Usuário específico (ID)</option>
          </select>
        </label>

        {scope === "campus" ? (
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">Campus</span>
            <select
              value={targetCampusId}
              onChange={(event) => setTargetCampusId(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 text-sm font-semibold text-[#164073] outline-none transition focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
            >
              <option value="">Selecione o campus</option>
              {campi.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {(campus.sigla || "").trim() ? `${campus.sigla} - ${campus.nome}` : campus.nome}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {scope === "role" ? (
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">Papel</span>
            <select
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 text-sm font-semibold text-[#164073] outline-none transition focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
            >
              <option value="solicitante">Solicitante</option>
              <option value="chefia">Chefia</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </label>
        ) : null}

        {scope === "user" ? (
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">ID do usuário</span>
            <input
              value={targetUserId}
              onChange={(event) => setTargetUserId(sanitizePlainText(event.target.value, 80))}
              className="mt-2 h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 text-sm font-semibold text-[#164073] outline-none transition focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
              placeholder="UUID do perfil"
            />
          </label>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <label className="block lg:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">URL da imagem (opcional)</span>
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(sanitizePlainText(event.target.value, 600))}
            className="mt-2 h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 text-sm text-[#2E3A4A] outline-none transition focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
            placeholder="https://..."
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">Texto do botão</span>
          <input
            value={ctaLabel}
            onChange={(event) => setCtaLabel(sanitizePlainText(event.target.value, 60))}
            className="mt-2 h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 text-sm text-[#2E3A4A] outline-none transition focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
            placeholder="Abrir documento"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">URL do botão (opcional)</span>
        <input
          value={ctaUrl}
          onChange={(event) => setCtaUrl(sanitizePlainText(event.target.value, 600))}
          className="mt-2 h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 text-sm text-[#2E3A4A] outline-none transition focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
          placeholder="https://..."
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D9E0E8] bg-[#F7FBFF] p-4">
        <p className="text-xs font-medium text-[#52627A]">
          A mensagem aparece na campainha do usuário e pode incluir foto e botão.
        </p>
        <Button
          type="button"
          onClick={sendBroadcast}
          disabled={sending}
          className="h-10 rounded-lg bg-[#164073] px-4 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-[#0F2E57]"
        >
          {sending ? "Enviando..." : "Enviar mensagem"}
        </Button>
      </div>
    </section>
  );
}

function SystemAccessLockPanel() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState(
    "O sistema esta temporariamente bloqueado para manutenção. Aguarde a liberação pelo superadmin.",
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadLock() {
    setLoading(true);
    try {
      const response = await fetch("/api/superadmin/access-lock", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Falha ao carregar bloqueio.");
      setEnabled(Boolean(payload?.value?.enabled));
      setMessage(
        sanitizeLongText(payload?.value?.message, 240) ||
          "O sistema esta temporariamente bloqueado para manutenção. Aguarde a liberação pelo superadmin.",
      );
    } catch (error: any) {
      toast.error(sanitizeUiMessage(error?.message, 220) || "Erro ao carregar bloqueio global.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLock();
  }, []);

  async function saveLock(nextEnabled: boolean) {
    setSaving(true);
    try {
      const response = await fetch("/api/superadmin/access-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextEnabled,
          message: sanitizeLongText(message, 240),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Falha ao atualizar bloqueio.");
      setEnabled(Boolean(payload?.value?.enabled));
      setMessage(
        sanitizeLongText(payload?.value?.message, 240) ||
          "O sistema esta temporariamente bloqueado para manutenção. Aguarde a liberação pelo superadmin.",
      );
      toast.success(nextEnabled ? "Acesso bloqueado para todos, exceto superadmin." : "Acesso liberado.");
    } catch (error: any) {
      toast.error(sanitizeUiMessage(error?.message, 220) || "Erro ao atualizar bloqueio global.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-[#E1E8F0] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#47739F]">
            Controle global
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[#17233C]">
            Bloqueio de acesso
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
            Quando ativo, usuários solicitantes, chefias e admins são bloqueados
            nas rotas internas. O superadmin continua acessando o sistema para
            manutenção e liberação.
          </p>
        </div>
        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] ${
            enabled
              ? "border-[#F4B7B7] bg-[#FFF1F1] text-[#A91520]"
              : "border-[#CFE6DE] bg-[#F2FBF7] text-[#2E6B52]"
          }`}
        >
          {enabled ? "Bloqueado" : "Liberado"}
        </div>
      </div>

      <label className="mt-6 block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">
          Mensagem exibida
        </span>
        <textarea
          value={message}
          onChange={(event) => setMessage(sanitizeLongText(event.target.value, 240))}
          className="mt-2 min-h-[92px] w-full resize-none rounded-2xl border border-[#D9E0E8] bg-[#FAFBFC] px-4 py-3 text-sm font-medium text-[#2E3A4A] outline-none focus:border-[#164073] focus:ring-2 focus:ring-[#C7D7EA]"
          maxLength={240}
          disabled={loading || saving}
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D9E0E8] bg-[#F7FBFF] p-4">
        <div className="flex items-center gap-3">
          <WarningCircle
            size={24}
            weight="fill"
            className={enabled ? "text-[#A91520]" : "text-[#164073]"}
          />
          <p className="text-sm font-semibold text-[#17233C]">
            {enabled
              ? "O bloqueio global está ativo."
              : "O sistema está liberado para os usuários."}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => saveLock(!enabled)}
          disabled={loading || saving}
          className={
            enabled
              ? "bg-[#164073] text-white hover:bg-[#0F2E57]"
              : "bg-[#A91520] text-white hover:bg-[#7F1018]"
          }
        >
          {saving
            ? "Atualizando..."
            : enabled
              ? "Liberar acesso"
              : "Bloquear acesso geral"}
        </Button>
      </div>
    </section>
  );
}

function StructureSettingsPanel(props: {
  loadingData: boolean;
  saving: boolean;
  campi: Campus[];
  structureNotice: string | null;
  selectedCampusId: string;
  setSelectedCampusId: (value: string) => void;
  campusLabel: string;
  supportsLabCampus: boolean;
  newDepartamento: string;
  setNewDepartamento: (value: string) => void;
  newLaboratorio: string;
  setNewLaboratorio: (value: string) => void;
  departamentos: Unidade[];
  laboratorios: Unidade[];
  chefiaOptions: ChefiaOption[];
  draftDeptNames: Record<string, string>;
  setDraftDeptNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  draftLabNames: Record<string, string>;
  setDraftLabNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  loadStructure: (campusId?: string) => Promise<void>;
  runAction: (body: Record<string, any>, successMessage?: string) => Promise<any>;
  handleAddDepartamento: () => Promise<void>;
  handleAddLaboratorio: () => Promise<void>;
}) {
  const {
    loadingData,
    saving,
    campi,
    structureNotice,
    selectedCampusId,
    setSelectedCampusId,
    campusLabel,
    supportsLabCampus,
    newDepartamento,
    setNewDepartamento,
    newLaboratorio,
    setNewLaboratorio,
    departamentos,
    laboratorios,
    chefiaOptions,
    draftDeptNames,
    setDraftDeptNames,
    draftLabNames,
    setDraftLabNames,
    loadStructure,
    runAction,
    handleAddDepartamento,
    handleAddLaboratorio,
  } = props;

  return (
    <>
      <div className="rounded-[20px] border border-[#E1E8F0] bg-white p-5 shadow-sm">
        {structureNotice ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            {structureNotice}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Campus
            </label>
            <select
              value={selectedCampusId}
              onChange={(event) => setSelectedCampusId(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              disabled={saving || loadingData}
            >
              {campi.length === 0 ? (
                <option value="">Nenhum campus ativo carregado</option>
              ) : null}
              {campi.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.nome} ({campus.sigla})
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => loadStructure(selectedCampusId)}
            disabled={saving || loadingData || !selectedCampusId}
            className="h-11 rounded-xl text-xs uppercase"
          >
            <ArrowsClockwise size={16} className="mr-2" />
            Atualizar
          </Button>

          <Button
            type="button"
            onClick={async () => {
              const payload = await runAction(
                { action: "seed_petrolina" },
                "Lista de Petrolina aplicada.",
              );
              if (payload?.campus) {
                const campusPetrolina = campi.find((campus) =>
                  `${campus.nome} ${campus.sigla}`
                    .toLocaleLowerCase("pt-BR")
                    .includes("petrolina"),
                );
                if (campusPetrolina?.id) {
                  setSelectedCampusId(campusPetrolina.id);
                }
              }
            }}
            disabled={saving || loadingData}
            className="h-11 rounded-xl bg-[#164073] hover:bg-upe-blue-deep text-xs uppercase"
          >
            <UploadSimple size={16} className="mr-2" />
            Importar Lista Petrolina
          </Button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-[#F3F2F1] px-3 py-2 text-xs text-slate-600">
          Campus em edição: <strong>{campusLabel}</strong>
          {selectedCampusId && !loadingData && !supportsLabCampus && (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
              <WarningCircle size={14} weight="fill" />
              Laboratórios sem vínculo por campus no banco. Aplique a migration de roteamento das DFDs.
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-[20px] border border-[#E1E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Buildings size={20} className="text-[#164073]" weight="fill" />
            <h2 className="text-lg font-semibold uppercase tracking-tight text-[#164073]">
              Setores / Departamentos
            </h2>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={newDepartamento}
              onChange={(event) => setNewDepartamento(event.target.value)}
              placeholder="Novo setor"
              className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              disabled={saving || loadingData}
            />
            <Button
              type="button"
              onClick={handleAddDepartamento}
              disabled={saving || loadingData || !newDepartamento.trim()}
              className="h-10 rounded-xl bg-[#164073] hover:bg-upe-blue-deep text-xs uppercase"
            >
              <Plus size={14} className="mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {departamentos.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-[#F3F2F1] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={draftDeptNames[item.id] ?? item.nome}
                    onChange={(event) =>
                      setDraftDeptNames((prev) => ({
                        ...prev,
                        [item.id]: event.target.value,
                      }))
                    }
                    className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                    disabled={saving}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-lg text-[10px] uppercase"
                    disabled={saving}
                    onClick={() => {
                      const nome = sanitizePlainText(draftDeptNames[item.id] ?? item.nome, 160);
                      if (!nome) {
                        toast.warning("Informe um nome válido para o setor.");
                        return;
                      }
                      void runAction(
                        {
                          action: "upsert_department",
                          id: item.id,
                          nome,
                          campus_id: selectedCampusId,
                        },
                        "Setor atualizado.",
                      );
                    }}
                  >
                    Salvar
                  </Button>
                  <Button
                    type="button"
                    variant={item.ativo ? "outline" : "default"}
                    className={`h-9 rounded-lg text-[10px] uppercase ${
                      !item.ativo ? "bg-emerald-600 hover:bg-emerald-700" : ""
                    }`}
                    disabled={saving}
                    onClick={() =>
                      runAction(
                        {
                          action: "toggle_department",
                          id: item.id,
                          ativo: !item.ativo,
                        },
                        item.ativo ? "Setor desativado." : "Setor ativado.",
                      )
                    }
                  >
                    {item.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </div>
                <UnitChefiaSelector
                  unit={item}
                  unitType="departamento"
                  chefiaOptions={chefiaOptions}
                  disabled={saving}
                  runAction={runAction}
                />
              </div>
            ))}
            {!loadingData && departamentos.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                Nenhum setor cadastrado para este campus.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[20px] border border-[#E1E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Flask size={20} className="text-[#164073]" weight="fill" />
            <h2 className="text-lg font-semibold uppercase tracking-tight text-[#164073]">
              Laboratórios
            </h2>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={newLaboratorio}
              onChange={(event) => setNewLaboratorio(event.target.value)}
              placeholder="Novo laboratório"
              className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              disabled={saving || loadingData}
            />
            <Button
              type="button"
              onClick={handleAddLaboratorio}
              disabled={saving || loadingData || !newLaboratorio.trim()}
              className="h-10 rounded-xl bg-[#164073] hover:bg-upe-blue-deep text-xs uppercase"
            >
              <Plus size={14} className="mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {laboratorios.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-[#F3F2F1] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={draftLabNames[item.id] ?? item.nome}
                    onChange={(event) =>
                      setDraftLabNames((prev) => ({
                        ...prev,
                        [item.id]: event.target.value,
                      }))
                    }
                    className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                    disabled={saving}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-lg text-[10px] uppercase"
                    disabled={saving}
                    onClick={() => {
                      const nome = sanitizePlainText(draftLabNames[item.id] ?? item.nome, 180);
                      if (!nome) {
                        toast.warning("Informe um nome válido para o laboratório.");
                        return;
                      }
                      void runAction(
                        {
                          action: "upsert_lab",
                          id: item.id,
                          nome,
                          campus_id: selectedCampusId,
                        },
                        "Laboratório atualizado.",
                      );
                    }}
                  >
                    Salvar
                  </Button>
                  <Button
                    type="button"
                    variant={item.ativo ? "outline" : "default"}
                    className={`h-9 rounded-lg text-[10px] uppercase ${
                      !item.ativo ? "bg-emerald-600 hover:bg-emerald-700" : ""
                    }`}
                    disabled={saving}
                    onClick={() =>
                      runAction(
                        {
                          action: "toggle_lab",
                          id: item.id,
                          ativo: !item.ativo,
                        },
                        item.ativo
                          ? "Laboratório desativado."
                          : "Laboratório ativado.",
                      )
                    }
                  >
                    {item.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </div>
                <UnitChefiaSelector
                  unit={item}
                  unitType="laboratorio"
                  chefiaOptions={chefiaOptions}
                  disabled={saving}
                  runAction={runAction}
                />
              </div>
            ))}
            {!loadingData && laboratorios.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                Nenhum laboratório cadastrado para este campus.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-emerald-700">
        <CheckCircle size={14} className="mr-2 inline" weight="fill" />
        Alterações refletem no onboarding e no formulário de DFD automaticamente.
      </div>
    </>
  );
}

function UnitChefiaSelector({
  unit,
  unitType,
  chefiaOptions,
  disabled,
  runAction,
}: {
  unit: Unidade;
  unitType: "departamento" | "laboratorio";
  chefiaOptions: ChefiaOption[];
  disabled: boolean;
  runAction: (body: Record<string, any>, successMessage?: string) => Promise<any>;
}) {
  const currentChefiaId = unit.chefia?.user_id || "__none__";
  const currentOption = chefiaOptions.find((option) => option.id === currentChefiaId) || null;
  const currentChefiaName =
    unit.chefia?.full_name ||
    currentOption?.full_name ||
    unit.chefia?.email ||
    currentOption?.email ||
    "Sem chefia definida";
  const currentChefiaAvatar =
    currentOption?.avatar_url ||
    null;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 transition hover:border-[#C7D7EA] hover:bg-[#F8FBFF]">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <CategoryAvatar
            name={currentChefiaName}
            avatarUrl={currentChefiaAvatar}
            category="chefia"
            size="sm"
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Chefia do espaço
            </p>
            <p className="mt-0.5 text-xs font-semibold text-[#164073]">
              {currentChefiaName}
            </p>
          </div>
        </div>
        <select
          value={currentChefiaId}
          disabled={disabled}
          onChange={(event) =>
            runAction(
              {
                action: "set_unit_chefia",
                unit_type: unitType,
                unit_id: unit.id,
                user_id:
                  event.target.value === "__none__" ? null : event.target.value,
              },
              "Chefia do espaço atualizada.",
            )
          }
          className="h-10 min-w-[260px] rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs font-semibold text-[#164073] outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
        >
          <option value="__none__">Sem chefia definida</option>
          {chefiaOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {(option.full_name || option.email || "Usuário sem nome").trim()}
              {option.email ? ` - ${option.email}` : ""}
            </option>
          ))}
        </select>
      </div>
      {currentOption?.email ? (
        <p className="mt-1 text-[11px] text-slate-500">{currentOption.email}</p>
      ) : null}
      <p className="mt-2 text-[11px] leading-5 text-slate-500">
        Ao escolher alguém aqui, essa pessoa passa a receber/analisar as DFDs deste
        setor ou laboratório como chefia.
      </p>
    </div>
  );
}
