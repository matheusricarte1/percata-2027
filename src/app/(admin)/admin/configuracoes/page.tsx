"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowsClockwise } from "@/components/icons/phosphor/exports/ArrowsClockwise";
import { Buildings } from "@/components/icons/phosphor/exports/Buildings";
import { CalendarBlank } from "@/components/icons/phosphor/exports/CalendarBlank";
import { ChatCenteredDots } from "@/components/icons/phosphor/exports/ChatCenteredDots";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { Files } from "@/components/icons/phosphor/exports/Files";
import { Flask } from "@/components/icons/phosphor/exports/Flask";
import { Gear } from "@/components/icons/phosphor/exports/Gear";
import { MegaphoneSimple } from "@/components/icons/phosphor/exports/MegaphoneSimple";
import { Package } from "@/components/icons/phosphor/exports/Package";
import { Plus } from "@/components/icons/phosphor/exports/Plus";
import { ShieldCheck } from "@/components/icons/phosphor/exports/ShieldCheck";
import { UploadSimple } from "@/components/icons/phosphor/exports/UploadSimple";
import { Users } from "@/components/icons/phosphor/exports/Users";
import { WarningCircle } from "@/components/icons/phosphor/exports/WarningCircle";
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

type ChefiaAssignment = {
  user_id: string;
  full_name: string | null;
  email: string | null;
};

type Unidade = {
  id: string;
  nome: string;
  ativo: boolean;
  campus_id?: string | null;
  chefias?: ChefiaAssignment[];
  chefia?: ChefiaAssignment | null;
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
  { key: "ajustes", label: "Minhas preferências", icon: Gear },
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

  const visibleTabs = TABS.filter((tab) => !tab.superadminOnly || role === "superadmin");

  useEffect(() => {
    if (bootstrapping) return;
    const syncTab = () => {
      const requested = new URLSearchParams(window.location.search).get("aba");
      const tab = TABS.find((entry) => entry.key === requested && (!entry.superadminOnly || role === "superadmin"));
      setActiveTab(tab?.key || "ajustes");
    };
    syncTab();
    window.addEventListener("popstate", syncTab);
    return () => window.removeEventListener("popstate", syncTab);
  }, [bootstrapping, role]);

  const selectTab = (key: AdminTab) => {
    setActiveTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set("aba", key);
    window.history.replaceState(null, "", url);
  };

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
          }
        } catch (error: any) {
          try {
            const fallbackCampi = await loadActiveCampiFallback();
            setCampi(fallbackCampi);
            const firstCampus = fallbackCampi[0]?.id || "";
            if (firstCampus) {
              setSelectedCampusId(firstCampus);
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
    if (!selectedCampusId) {
      toast.warning("Selecione um campus antes de adicionar o laboratório.");
      return;
    }
    const payload = await runAction(
      {
        action: "upsert_lab",
        nome,
        campus_id: selectedCampusId,
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
        <div className="rounded-[22px] border border-[var(--p-color-info-border)] bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">
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
    <div className="min-h-screen space-y-5 bg-[var(--p-color-surface-muted)] p-6 md:p-8">
      <section className="overflow-hidden rounded-[22px] border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-4 md:p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-brand-400)]">
              Administração do sistema
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--p-color-fg)] md:text-3xl">
              Configurações do Sistema
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-medium text-[var(--p-color-fg-muted)]">
              Preferências da sua conta e administração de usuários, acesso e estrutura.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--p-color-info-border)] bg-white/80 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--p-color-brand-500)]">
            <ShieldCheck size={16} weight="fill" />
            {isSuperadmin ? "Modo Superadmin" : "Modo Admin"}
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-[var(--p-color-border-muted)] bg-white p-3 shadow-sm">
        <p className="mb-2 px-1 text-xs text-[var(--p-color-fg-muted)]">Minhas preferências afeta sua conta. As demais abas são ferramentas de administração.</p>
        <div role="tablist" aria-label="Seções de Configurações" className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`settings-tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`settings-panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              onClick={() => selectTab(tab.key)}
              onKeyDown={(event) => {
                const index = visibleTabs.findIndex((entry) => entry.key === tab.key);
                const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? visibleTabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % visibleTabs.length : event.key === "ArrowLeft" ? (index - 1 + visibleTabs.length) % visibleTabs.length : -1;
                if (nextIndex < 0) return;
                event.preventDefault();
                const next = visibleTabs[nextIndex];
                selectTab(next.key);
                document.getElementById(`settings-tab-${next.key}`)?.focus();
              }}
          disabled={bootstrapping}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                activeTab === tab.key
                  ? "bg-[var(--p-color-brand-500)] text-white shadow-sm"
                  : "border border-[var(--p-color-border)] bg-[var(--p-color-info-bg)] text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-subtle)]"
              }`}
            >
              <tab.icon size={14} weight="fill" />
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <div role="tabpanel" id={`settings-panel-${activeTab}`} aria-labelledby={`settings-tab-${activeTab}`} tabIndex={0} className="space-y-5 focus-visible:outline-2 focus-visible:outline-offset-2">
      {activeTab === "ajustes" && <SettingsPanel scope="Administração" embedded />}

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
    </div>
  );
}

function ModuleLoading({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--p-color-border)] bg-white p-6 text-sm font-semibold text-slate-500">
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
    <section className="rounded-[22px] border border-[var(--p-color-danger-border)] bg-[#FFF8F8] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-danger)]">
            Governança de dados
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[var(--p-color-fg)]">
            Limpeza da base de DFDs
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--p-color-fg-muted)]">
            Remove todas as DFDs da base atual (incluindo itens e logs vinculados).
            Os registros legados permanecem preservados.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPreview}
          disabled={loadingPreview || purging}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E6C0C0] bg-white px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--p-color-danger)] transition hover:bg-[#FFF1F1] disabled:opacity-60"
        >
          <ArrowsClockwise size={14} weight="bold" className={loadingPreview ? "animate-spin" : ""} />
          Atualizar prévia
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[#F0D1D1] bg-white px-4 py-3">
          <p className="type-caption font-semibold uppercase tracking-[0.1em] text-[#7A8797]">
            DFDs para remover
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--p-color-danger)]">
            {loadingPreview ? "..." : String(preview?.purgeCount ?? 0)}
          </p>
          {preview?.samplePurgeProtocols?.length ? (
            <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
              Exemplos: {preview.samplePurgeProtocols.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-[var(--p-color-border)] bg-white px-4 py-3">
          <p className="type-caption font-semibold uppercase tracking-[0.1em] text-[#7A8797]">
            Registros legados preservados
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--p-color-brand-500)]">
            {loadingPreview ? "..." : String(preview?.legacyCount ?? 0)}
          </p>
          {preview?.sampleLegacyProtocols?.length ? (
            <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
              Exemplos: {preview.sampleLegacyProtocols.join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#F0D1D1] bg-white px-4 py-3">
        <p className="text-xs font-semibold text-[var(--p-color-danger)]">
          Ação destrutiva irreversível. Confirme digitando:
        </p>
        <p className="mt-1 font-mono text-sm font-bold text-[var(--p-color-fg)]">{confirmationPhrase}</p>
        <input
          value={confirm}
          onChange={(event) => setConfirm(sanitizePlainText(event.target.value, 64))}
          className="mt-3 h-11 w-full rounded-xl border border-[#E6C0C0] bg-[#FFFDFD] px-3 text-sm font-semibold text-[var(--p-color-fg-default)] outline-none transition focus:border-[var(--p-color-danger)] focus:ring-2 focus:ring-[var(--p-color-danger-border)]"
          placeholder={confirmationPhrase}
          disabled={purging}
        />
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            onClick={purgeNonLegacyDfds}
            disabled={purging || loadingPreview}
            className="h-10 rounded-lg bg-[var(--p-color-danger)] px-4 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-[#7F1018]"
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
    <section className="rounded-[22px] border border-[var(--p-color-border-muted)] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-brand-400)]">
            Comunicação administrativa
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[var(--p-color-fg)]">
            Mensagens com imagem
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--p-color-fg-muted)]">
            Envie avisos para usuários do sistema e inclua foto (URL) e botão de ação opcional.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-info-bg)] px-3 py-2 text-xs font-semibold text-[var(--p-color-brand-500)]">
          <ChatCenteredDots size={16} weight="duotone" />
          Campainha + painel do usuário
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">Título</span>
          <input
            value={title}
            onChange={(event) => setTitle(sanitizePlainText(event.target.value, 120))}
            className="mt-2 h-11 w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 text-sm font-semibold text-[var(--p-color-brand-500)] outline-none transition focus:border-[var(--p-color-brand-500)] focus:ring-2 focus:ring-[var(--p-color-info-border)]"
            placeholder="Ex.: Janela de envio encerra hoje às 18h"
            maxLength={120}
          />
        </label>
        <label className="block">
          <span className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">Tipo</span>
          <select
            value={type}
            onChange={(event) => setType((event.target.value as any) || "info")}
            className="mt-2 h-11 w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 text-sm font-semibold text-[var(--p-color-brand-500)] outline-none transition focus:border-[var(--p-color-brand-500)] focus:ring-2 focus:ring-[var(--p-color-info-border)]"
          >
            <option value="info">Informação</option>
            <option value="success">Sucesso</option>
            <option value="warning">Atenção</option>
            <option value="error">Crítico</option>
          </select>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">Mensagem</span>
        <textarea
          value={body}
          onChange={(event) => setBody(sanitizeLongText(event.target.value, 1200))}
          className="mt-2 min-h-[120px] w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 py-3 text-sm text-[var(--p-color-fg-default)] outline-none transition focus:border-[var(--p-color-brand-500)] focus:ring-2 focus:ring-[var(--p-color-info-border)]"
          maxLength={1200}
          placeholder="Explique em linguagem direta o que muda e o que o usuário precisa fazer."
        />
      </label>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">Alvo</span>
          <select
            value={scope}
            onChange={(event) => setScope((event.target.value as any) || "all")}
            className="mt-2 h-11 w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 text-sm font-semibold text-[var(--p-color-brand-500)] outline-none transition focus:border-[var(--p-color-brand-500)] focus:ring-2 focus:ring-[var(--p-color-info-border)]"
          >
            <option value="all">Todos os usuários</option>
            <option value="campus">Campus específico</option>
            <option value="role">Papel específico</option>
            <option value="user">Usuário específico (ID)</option>
          </select>
        </label>

        {scope === "campus" ? (
          <label className="block">
            <span className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">Campus</span>
            <select
              value={targetCampusId}
              onChange={(event) => setTargetCampusId(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 text-sm font-semibold text-[var(--p-color-brand-500)] outline-none transition focus:border-[var(--p-color-brand-500)] focus:ring-2 focus:ring-[var(--p-color-info-border)]"
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
            <span className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">Papel</span>
            <select
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 text-sm font-semibold text-[var(--p-color-brand-500)] outline-none transition focus:border-[var(--p-color-brand-500)] focus:ring-2 focus:ring-[var(--p-color-info-border)]"
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
            <span className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">ID do usuário</span>
            <input
              value={targetUserId}
              onChange={(event) => setTargetUserId(sanitizePlainText(event.target.value, 80))}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 text-sm font-semibold text-[var(--p-color-brand-500)] outline-none transition focus:border-[var(--p-color-brand-500)] focus:ring-2 focus:ring-[var(--p-color-info-border)]"
              placeholder="UUID do perfil"
            />
          </label>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <label className="block lg:col-span-2">
          <span className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">URL da imagem (opcional)</span>
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(sanitizePlainText(event.target.value, 600))}
            className="mt-2 h-11 w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 text-sm text-[var(--p-color-fg-default)] outline-none transition focus:border-[var(--p-color-brand-500)] focus:ring-2 focus:ring-[var(--p-color-info-border)]"
            placeholder="https://..."
          />
        </label>
        <label className="block">
          <span className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">Texto do botão</span>
          <input
            value={ctaLabel}
            onChange={(event) => setCtaLabel(sanitizePlainText(event.target.value, 60))}
            className="mt-2 h-11 w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 text-sm text-[var(--p-color-fg-default)] outline-none transition focus:border-[var(--p-color-brand-500)] focus:ring-2 focus:ring-[var(--p-color-info-border)]"
            placeholder="Abrir documento"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">URL do botão (opcional)</span>
        <input
          value={ctaUrl}
          onChange={(event) => setCtaUrl(sanitizePlainText(event.target.value, 600))}
          className="mt-2 h-11 w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 text-sm text-[var(--p-color-fg-default)] outline-none transition focus:border-[var(--p-color-brand-500)] focus:ring-2 focus:ring-[var(--p-color-info-border)]"
          placeholder="https://..."
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-info-bg)] p-4">
        <p className="text-xs font-medium text-[var(--p-color-fg-muted)]">
          A mensagem aparece na campainha do usuário e pode incluir foto e botão.
        </p>
        <Button
          type="button"
          onClick={sendBroadcast}
          disabled={sending}
          className="h-10 rounded-lg bg-[var(--p-color-brand-500)] px-4 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-[var(--p-color-brand-600)]"
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
    if (nextEnabled && !window.confirm("Bloquear o sistema para todos os usuários, exceto superadmins?")) {
      return;
    }
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
    <section className="rounded-[22px] border border-[var(--p-color-border-muted)] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-brand-400)]">
            Controle global
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[var(--p-color-fg)]">
            Bloqueio de acesso
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--p-color-fg-muted)]">
            Quando ativo, usuários solicitantes, chefias e admins são bloqueados
            nas rotas internas. O superadmin continua acessando o sistema para
            manutenção e liberação.
          </p>
        </div>
        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] ${
            enabled
              ? "border-[var(--p-color-danger-border)] bg-[#FFF1F1] text-[var(--p-color-danger)]"
              : "border-[var(--p-color-success-border)] bg-[#F2FBF7] text-[#2E6B52]"
          }`}
        >
          {enabled ? "Bloqueado" : "Liberado"}
        </div>
      </div>

      <label className="mt-6 block">
        <span className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">
          Mensagem exibida
        </span>
        <textarea
          value={message}
          onChange={(event) => setMessage(sanitizeLongText(event.target.value, 240))}
          className="mt-2 min-h-[92px] w-full resize-none rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-4 py-3 text-sm font-medium text-[var(--p-color-fg-default)] outline-none focus:border-[var(--p-color-brand-500)] focus:ring-2 focus:ring-[var(--p-color-info-border)]"
          maxLength={240}
          disabled={loading || saving}
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-info-bg)] p-4">
        <div className="flex items-center gap-3">
          <WarningCircle
            size={24}
            weight="fill"
            className={enabled ? "text-[var(--p-color-danger)]" : "text-[var(--p-color-brand-500)]"}
          />
          <p className="text-sm font-semibold text-[var(--p-color-fg)]">
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
              ? "bg-[var(--p-color-brand-500)] text-white hover:bg-[var(--p-color-brand-600)]"
              : "bg-[var(--p-color-danger)] text-white hover:bg-[#7F1018]"
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
      <div className="rounded-[20px] border border-[var(--p-color-border-muted)] bg-white p-5 shadow-sm">
        {structureNotice ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            {structureNotice}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div className="space-y-1">
            <label className="type-kicker font-semibold uppercase tracking-widest text-slate-400">
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
            className="h-11 rounded-xl bg-[var(--p-color-brand-500)] hover:bg-upe-blue-deep text-xs uppercase"
          >
            <UploadSimple size={16} className="mr-2" />
            Importar Lista Petrolina
          </Button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-[var(--p-color-bg-muted)] px-3 py-2 text-xs text-slate-600">
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
        <div className="rounded-[20px] border border-[var(--p-color-border-muted)] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Buildings size={20} className="text-[var(--p-color-brand-500)]" weight="fill" />
            <h2 className="text-lg font-semibold uppercase tracking-tight text-[var(--p-color-brand-500)]">
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
              className="h-10 rounded-xl bg-[var(--p-color-brand-500)] hover:bg-upe-blue-deep text-xs uppercase"
            >
              <Plus size={14} className="mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {departamentos.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-[var(--p-color-bg-muted)] p-3"
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
                    className="h-9 rounded-lg type-kicker uppercase"
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
                    className={`h-9 rounded-lg type-kicker uppercase ${
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

        <div className="rounded-[20px] border border-[var(--p-color-border-muted)] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Flask size={20} className="text-[var(--p-color-brand-500)]" weight="fill" />
            <h2 className="text-lg font-semibold uppercase tracking-tight text-[var(--p-color-brand-500)]">
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
              className="h-10 rounded-xl bg-[var(--p-color-brand-500)] hover:bg-upe-blue-deep text-xs uppercase"
            >
              <Plus size={14} className="mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {laboratorios.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-[var(--p-color-bg-muted)] p-3"
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
                    className="h-9 rounded-lg type-kicker uppercase"
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
                    className={`h-9 rounded-lg type-kicker uppercase ${
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
  const [selectedUserId, setSelectedUserId] = useState("");
  const assignments = unit.chefias || (unit.chefia ? [unit.chefia] : []);
  const assignedIds = new Set(assignments.map((person) => person.user_id));
  const availableOptions = chefiaOptions.filter((person) =>
    person.campus_id === unit.campus_id && !assignedIds.has(person.id),
  );

  async function addChefia() {
    if (!selectedUserId) return;
    const result = await runAction({
      action: "set_unit_chefia", unit_type: unitType, unit_id: unit.id, user_id: selectedUserId,
    }, "Chefia adicionada.");
    if (result) setSelectedUserId("");
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="type-kicker font-semibold uppercase tracking-widest text-slate-400">
        Chefias do espaço ({assignments.length})
      </p>
      <div className="mt-2 space-y-2">
        {assignments.map((person) => {
          const option = chefiaOptions.find((entry) => entry.id === person.user_id);
          const name = person.full_name || person.email || "Usuário sem nome";
          return (
            <div key={person.user_id} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <CategoryAvatar name={name} avatarUrl={option?.avatar_url || null} category="chefia" size="sm" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--p-color-brand-500)]">{name}</p>
                  {person.email && <p className="break-all type-caption text-slate-500">{person.email}</p>}
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={disabled}
                aria-label={`Remover chefia de ${name}`}
                onClick={() => runAction({
                  action: "remove_unit_chefia", unit_type: unitType, unit_id: unit.id, user_id: person.user_id,
                }, "Papel de chefia removido; vínculo como membro preservado.")}
              >Remover chefia</Button>
            </div>
          );
        })}
        {assignments.length === 0 && <p className="text-xs text-slate-500">Sem chefia definida</p>}
      </div>
      <div className="mt-3 flex flex-col gap-2 md:flex-row">
        <select value={selectedUserId} disabled={disabled || !unit.ativo}
          aria-label={`Adicionar chefia em ${unit.nome}`}
          onChange={(event) => setSelectedUserId(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-[var(--p-color-surface-soft)] px-3 text-xs font-semibold text-[var(--p-color-brand-500)] outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
        >
          <option value="">Selecione uma pessoa para adicionar</option>
          {availableOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.full_name || option.email || "Usuário sem nome"}{option.email ? ` - ${option.email}` : ""}
            </option>
          ))}
        </select>
        <Button type="button" disabled={disabled || !unit.ativo || !selectedUserId} onClick={addChefia}>
          Adicionar chefia
        </Button>
      </div>
      <p className="mt-2 type-caption leading-5 text-slate-500">
        Todas as chefias vinculadas podem analisar as DFDs deste setor ou laboratório.
        Ao adicionar uma pessoa, o acesso de chefia é habilitado automaticamente.
      </p>
    </div>
  );
}
