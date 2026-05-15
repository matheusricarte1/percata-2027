"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowsClockwise,
  Buildings,
  CalendarBlank,
  CheckCircle,
  Files,
  Flask,
  Gear,
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
import { sanitizePlainText } from "@/lib/settings-sanitize";

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
};

type AdminTab =
  | "ajustes"
  | "acesso"
  | "estrutura"
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
      const message = error?.message || "Erro ao carregar estrutura.";
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
      toast.error(error?.message || "Erro na operação.");
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

      {activeTab === "acesso" && isSuperadmin && <SystemAccessLockPanel />}

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
      setMessage(String(payload?.value?.message || "").trim() || message);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar bloqueio global.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveLock(nextEnabled: boolean) {
    setSaving(true);
    try {
      const response = await fetch("/api/superadmin/access-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, message }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Falha ao atualizar bloqueio.");
      setEnabled(Boolean(payload?.value?.enabled));
      setMessage(String(payload?.value?.message || "").trim() || message);
      toast.success(nextEnabled ? "Acesso bloqueado para todos, exceto superadmin." : "Acesso liberado.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao atualizar bloqueio global.");
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
          onChange={(event) => setMessage(event.target.value)}
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

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Chefia do espaço
          </p>
          <p className="mt-0.5 text-xs font-semibold text-[#164073]">
            {unit.chefia?.full_name || unit.chefia?.email || "Sem chefia definida"}
          </p>
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
      <p className="mt-2 text-[11px] leading-5 text-slate-500">
        Ao escolher alguém aqui, essa pessoa passa a receber/analisar as DFDs deste
        setor ou laboratório como chefia.
      </p>
    </div>
  );
}
