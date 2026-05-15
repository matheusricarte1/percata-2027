"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Gear,
  PaintBrush,
  Bell,
  ShieldCheck,
  FloppyDiskBack,
  Lightning,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { getSafeUser, supabase } from "@/lib/supabase";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_USER_SETTINGS,
  mapUserSettingsRow,
  normalizeUserSettings,
  toUserSettingsUpsert,
  type AccentColor,
  type UserSettings,
} from "@/lib/user-settings";

type EmailStatus = {
  provider: "resend" | "smtp" | "none";
  configured: boolean;
  fromAddress: string;
  redirectTo?: string | null;
  reason: string | null;
  queueAvailable: boolean;
  queue: {
    pending: number;
    processing: number;
    failed: number;
    sent: number;
  } | null;
};

const STORAGE_PREFIX = "percata:user-settings:v1";

const COLOR_OPTIONS: Array<{
  value: AccentColor;
  label: string;
  desc: string;
  swatches: string[];
}> = [
  {
    value: "upe",
    label: "UPE",
    desc: "Azul institucional com apoio vermelho.",
    swatches: ["#164073", "#2D5D94", "#EC2029"],
  },
  {
    value: "teal",
    label: "Verde-azulado",
    desc: "Mais calmo para uso prolongado.",
    swatches: ["#116466", "#2C7873", "#D7B740"],
  },
  {
    value: "gold",
    label: "Dourado",
    desc: "Contraste quente para painéis administrativos.",
    swatches: ["#6B4E16", "#A9791A", "#1F5C63"],
  },
  {
    value: "slate",
    label: "Grafite",
    desc: "Neutro, discreto e focado em leitura.",
    swatches: ["#243447", "#4D6175", "#C14953"],
  },
];

function isMissingSettingsTableError(error: any): boolean {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("user_settings") &&
    (message.includes("schema cache") ||
      message.includes("could not find the table") ||
      message.includes("does not exist") ||
      message.includes("42p01"))
  );
}

function toStorageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function loadLocalSettings(userId: string): UserSettings {
  try {
    const raw = window.localStorage.getItem(toStorageKey(userId));
    if (!raw) return DEFAULT_USER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return normalizeUserSettings(parsed);
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

function saveLocalSettings(userId: string, settings: UserSettings) {
  try {
    window.localStorage.setItem(toStorageKey(userId), JSON.stringify(settings));
    window.localStorage.setItem(STORAGE_PREFIX, JSON.stringify(settings));
    window.dispatchEvent(
      new CustomEvent("percata:user-settings-changed", { detail: settings }),
    );
  } catch {
    // noop
  }
}

export function SettingsPanel({ scope }: { scope: string }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [syncMode, setSyncMode] = useState<"supabase" | "local">("supabase");
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [emailStatusLoading, setEmailStatusLoading] = useState(false);
  const [sendingEmailTest, setSendingEmailTest] = useState(false);

  const loadEmailStatus = async ({ silent = false }: { silent?: boolean } = {}) => {
    setEmailStatusLoading(true);
    try {
      const response = await fetch("/api/notifications/status", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao carregar status de e-mail.");
      }
      setEmailStatus(payload as EmailStatus);
    } catch (error: any) {
      setEmailStatus({
        provider: "none",
        configured: false,
        fromAddress: "não configurado",
        redirectTo: null,
        reason: error?.message || "Canal de e-mail indisponível.",
        queueAvailable: false,
        queue: null,
      });
      if (!silent) {
        toast.error("Falha ao carregar canal de e-mail: " + (error?.message || "erro desconhecido"));
      }
    } finally {
      setEmailStatusLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      setLoading(true);
      try {
        const user = await getSafeUser();
        if (!user || !alive) {
          setLoading(false);
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email || null);
        void loadEmailStatus({ silent: true });

        const { data, error } = await supabase
          .from("user_settings")
          .select(
            "theme_mode,density_mode,accent_color,reduced_motion,show_animations,notify_aprovacao,notify_devolucao,notify_homologacao,notify_email,profile_visibility,show_email,show_avatar",
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          if (isMissingSettingsTableError(error)) {
            if (!alive) return;
            setSyncMode("local");
            const local = loadLocalSettings(user.id);
            setSettings(local);
            return;
          }
          throw error;
        }

        if (!alive) return;

        if (data) {
          const local = loadLocalSettings(user.id);
          const mapped = mapUserSettingsRow(data, local);
          setSettings(mapped);
          saveLocalSettings(user.id, mapped);
        } else {
          const local = loadLocalSettings(user.id);
          setSettings(local);
        }
      } catch (error: any) {
        if (alive) {
          toast.error("Falha ao carregar configurações: " + (error?.message || "erro desconhecido"));
          const fallbackUser = await getSafeUser();
          if (fallbackUser?.id) {
            setSettings(loadLocalSettings(fallbackUser.id));
            setSyncMode("local");
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.themeMode = settings.themeMode;
    root.dataset.densityMode = settings.densityMode;
    root.dataset.accentColor = settings.accentColor;
    root.dataset.reducedMotion = settings.reducedMotion ? "1" : "0";
  }, [settings.themeMode, settings.densityMode, settings.accentColor, settings.reducedMotion]);

  const syncLabel = useMemo(
    () =>
      syncMode === "supabase"
        ? "Preferências salvas na sua conta."
        : "Preferências salvas neste navegador.",
    [syncMode],
  );

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => {
      const next = normalizeUserSettings({ ...prev, [key]: value });
      if (key === "reducedMotion" && value === true) {
        next.showAnimations = false;
      }
      if (userId) saveLocalSettings(userId, next);
      return next;
    });
  };

  const sendEmailTest = async () => {
    setSendingEmailTest(true);
    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: userEmail || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || payload?.reason || "Falha ao enviar e-mail de teste.");
      }
      toast.success(`E-mail de teste enviado para ${payload?.to || userEmail || "sua caixa de entrada"}.`);
      await loadEmailStatus();
    } catch (error: any) {
      toast.error("Erro no teste de e-mail: " + (error?.message || "erro desconhecido"));
    } finally {
      setSendingEmailTest(false);
    }
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);

    try {
      const sanitized = normalizeUserSettings(settings);
      saveLocalSettings(userId, sanitized);
      if (syncMode === "supabase") {
        const { error } = await supabase.from("user_settings").upsert(
          toUserSettingsUpsert(userId, sanitized),
          { onConflict: "user_id" },
        );

        if (error) {
          if (isMissingSettingsTableError(error)) {
            setSyncMode("local");
            toast.success("Preferências salvas neste navegador.");
            return;
          }
          throw error;
        }
      }

      setSettings(sanitized);
      toast.success("Configurações salvas com sucesso.");
    } catch (error: any) {
      toast.error("Erro ao salvar configurações: " + (error?.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    setSettings(DEFAULT_USER_SETTINGS);
    if (userId) saveLocalSettings(userId, DEFAULT_USER_SETTINGS);
    toast.success("Preferências restauradas. Clique em salvar para sincronizar.");
  };

  return (
    <div className="space-y-5 p-0">
      <div className="overflow-hidden rounded-[22px] border border-[var(--upe-accent-washed-blue)] bg-[var(--md-surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--upe-blue-upe)] text-white shadow-sm">
            <Gear size={28} weight="fill" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--upe-blue-medium)]">
              Experiência do usuário
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[#17233C]">
              Configurações
            </h1>
            <p className="text-sm font-medium text-[#52627A]">
              Ajuste sua experiência no sistema ({scope}).
            </p>
          </div>
          </div>
          <div className="rounded-2xl border border-[var(--upe-accent-washed-blue)] bg-white/75 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--upe-blue-medium)]">
            {syncLabel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <SettingCard
          icon={<PaintBrush size={24} weight="duotone" />}
          title="Cores do sistema"
          desc="Escolha uma paleta visual sem alterar o conteúdo das DFDs."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {COLOR_OPTIONS.map((option) => (
              <ColorOptionButton
                key={option.value}
                option={option}
                active={settings.accentColor === option.value}
                onClick={() => update("accentColor", option.value)}
              />
            ))}
          </div>
        </SettingCard>

        <SettingCard
          icon={<Bell size={24} weight="duotone" />}
          title="Notificações"
          desc="Avisos de aprovação, devolução e andamento das solicitações."
        >
          <div className="grid gap-3 md:grid-cols-2">
              <ToggleRow
                label="Aprovação"
                desc="Quando sua solicitação for aprovada."
                checked={settings.notifyAprovacao}
                onCheckedChange={(checked) => update("notifyAprovacao", checked)}
              />
              <ToggleRow
                label="Devolução"
                desc="Quando a chefia devolver sua solicitação para ajustes."
                checked={settings.notifyDevolucao}
                onCheckedChange={(checked) => update("notifyDevolucao", checked)}
              />
              <ToggleRow
                label="Etapa concluída"
                desc="Quando sua solicitação avançar para a próxima etapa."
                checked={settings.notifyHomologacao}
                onCheckedChange={(checked) => update("notifyHomologacao", checked)}
              />
              <ToggleRow
                label="Receber por e-mail"
                desc="Envia os avisos também para o seu e-mail."
                checked={settings.notifyEmail}
                onCheckedChange={(checked) => update("notifyEmail", checked)}
              />
          </div>
          <div className="mt-4 rounded-xl border border-[#D9E0E8] bg-[#F4F7FA] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3E4C5F]">
                Canal de e-mail
              </p>
              <button
                type="button"
                onClick={() => loadEmailStatus()}
                className="inline-flex h-8 items-center rounded-lg border border-[#D9E0E8] bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--upe-blue-upe)] hover:bg-[var(--upe-accent-washed-blue)]"
              >
                Atualizar
              </button>
            </div>

            <div className="mt-2 text-xs text-[#3E4C5F]">
              {emailStatusLoading && "Validando configuração de e-mail..."}
              {!emailStatusLoading && emailStatus && (
                <div className="space-y-1.5">
                  <p>
                    Status:{" "}
                    <span className={emailStatus.configured ? "text-[var(--upe-blue-upe)] font-semibold" : "text-[#A91520] font-semibold"}>
                      {emailStatus.configured
                        ? `Ativo via ${emailStatus.provider.toUpperCase()}`
                        : "Não configurado"}
                    </span>
                  </p>
                  <p>Remetente: <span className="font-semibold">{emailStatus.fromAddress}</span></p>
                  {emailStatus.redirectTo ? (
                    <p>
                      Redirecionamento:{" "}
                      <span className="font-semibold text-[var(--upe-blue-upe)]">{emailStatus.redirectTo}</span>
                    </p>
                  ) : null}
                  {emailStatus.reason ? <p className="text-[#A91520]">{emailStatus.reason}</p> : null}
                  {emailStatus.queueAvailable && emailStatus.queue ? (
                    <p className="text-[11px] uppercase tracking-[0.08em] text-[#5B6675]">
                      fila: {emailStatus.queue.pending} pendente • {emailStatus.queue.processing} processando • {emailStatus.queue.failed} falha • {emailStatus.queue.sent} enviado
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#5B6675]">
                      Fila de e-mail indisponível no banco.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={sendEmailTest}
                disabled={sendingEmailTest || !userEmail || !emailStatus?.configured}
                className="inline-flex h-9 items-center rounded-lg bg-[var(--upe-blue-upe)] px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-[var(--upe-blue-deep)] disabled:opacity-60"
              >
                {sendingEmailTest ? "Enviando..." : "Enviar teste para meu e-mail"}
              </button>
              {userEmail ? (
                <span className="text-[11px] text-[#5B6675]">{userEmail}</span>
              ) : null}
            </div>
          </div>
        </SettingCard>

        <SettingCard
          icon={<ShieldCheck size={24} weight="duotone" />}
          title="Segurança"
          desc="Controle de privacidade, visibilidade e proteção da conta."
        >
          <div className="grid gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">
                Visibilidade do perfil
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <SegmentButton
                  active={settings.profileVisibility === "campus"}
                  onClick={() => update("profileVisibility", "campus")}
                  label="Campus"
                />
                <SegmentButton
                  active={settings.profileVisibility === "papel"}
                  onClick={() => update("profileVisibility", "papel")}
                  label="Por papel"
                />
                <SegmentButton
                  active={settings.profileVisibility === "privado"}
                  onClick={() => update("profileVisibility", "privado")}
                  label="Privado"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <ToggleRow
                label="Exibir e-mail"
                desc="Permite mostrar seu e-mail nas telas internas do sistema."
                checked={settings.showEmail}
                onCheckedChange={(checked) => update("showEmail", checked)}
              />
              <ToggleRow
                label="Exibir avatar"
                desc="Mostra sua foto de perfil no sistema."
                checked={settings.showAvatar}
                onCheckedChange={(checked) => update("showAvatar", checked)}
              />
              <ToggleRow
                label="Movimento reduzido"
                desc="Reduz animações para facilitar a leitura e navegação."
                checked={settings.reducedMotion}
                onCheckedChange={(checked) => update("reducedMotion", checked)}
              />
              <ToggleRow
                label="Layout compacto"
                desc="Mostra mais informações na tela com menos espaço."
                checked={settings.densityMode === "compact"}
                onCheckedChange={(checked) =>
                  update("densityMode", checked ? "compact" : "comfortable")
                }
              />
              <ToggleRow
                label="Animações de interface"
                desc="Ativa movimentos suaves entre telas e cartões."
                checked={settings.showAnimations && !settings.reducedMotion}
                onCheckedChange={(checked) => update("showAnimations", checked)}
                disabled={settings.reducedMotion}
              />
            </div>
          </div>
        </SettingCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#D9E0E8] bg-white px-4 py-3 shadow-sm">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3E4C5F]">
          <Lightning size={14} weight="fill" className="text-[var(--upe-blue-upe)]" />
          {loading ? "Carregando suas preferências..." : "Tudo pronto para salvar."}
        </p>
        <button
          type="button"
          onClick={resetSettings}
          disabled={loading || saving || !userId}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9E0E8] bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--upe-blue-upe)] shadow-sm hover:bg-[#F4F7FA] disabled:opacity-60"
        >
          <ArrowCounterClockwise size={16} weight="fill" />
          Restaurar padrão
        </button>
        <button
          type="button"
          onClick={save}
          disabled={loading || saving || !userId}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--upe-blue-upe)] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm hover:bg-[var(--upe-blue-deep)] disabled:opacity-60"
        >
          <FloppyDiskBack size={16} weight="fill" />
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}

function SettingCard({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[20px] border border-[#E1E8F0] bg-white p-5 shadow-sm"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--upe-accent-washed-blue)] text-[var(--upe-blue-upe)]">
        {icon}
      </div>
      <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-[#17233C]">
        {title}
      </h2>
      <p className="mt-1 text-sm font-medium text-[#52627A]">{desc}</p>
      <div className="mt-5">{children}</div>
    </motion.div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <motion.div
      layout
      whileHover={disabled ? undefined : { y: -1 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-[#E8EDF2] bg-[#FAFBFC] px-3 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--upe-blue-upe)]">{label}</p>
          <p className="mt-0.5 text-xs text-[#5B6675]">{desc}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </div>
    </motion.div>
  );
}

function SegmentButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.16 }}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition ${
        active
          ? "border-[var(--upe-blue-upe)] bg-[var(--upe-blue-upe)] text-white"
          : "border-[#D9E0E8] bg-white text-[#3E4C5F] hover:bg-[#F4F7FA]"
      }`}
    >
      {icon}
      {label}
    </motion.button>
  );
}

function ColorOptionButton({
  option,
  active,
  onClick,
}: {
  option: (typeof COLOR_OPTIONS)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      layout
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-[var(--upe-blue-upe)] bg-[var(--md-surface)] shadow-sm ring-2 ring-[var(--upe-accent-washed-blue)]"
          : "border-[#E1E8F0] bg-white hover:bg-[#FAFBFC]"
      }`}
    >
      <div className="flex items-center gap-2">
        {option.swatches.map((color) => (
          <span
            key={color}
            className="h-7 w-7 rounded-full border border-black/10"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--upe-blue-upe)]">{option.label}</p>
      <p className="mt-1 text-xs leading-5 text-[#52627A]">{option.desc}</p>
      <span
        className={`mt-4 inline-flex h-7 items-center rounded-full px-3 text-[10px] font-semibold uppercase tracking-[0.12em] ${
          active ? "bg-[var(--upe-blue-upe)] text-white" : "bg-[var(--upe-accent-washed-blue)] text-[var(--upe-blue-medium)]"
        }`}
      >
        {active ? "Em uso" : "Aplicar"}
      </span>
    </motion.button>
  );
}
