"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  WarningCircle,
  ChatText,
  Clock,
  PaperPlaneTilt,
  PencilCircle,
  Buildings,
} from "@phosphor-icons/react";

const ICONS: Record<
  string,
  { icon: any; color: string; bg: string; label: string; border: string }
> = {
  rascunho: {
    icon: PencilCircle,
    color: "text-[#5B6675]",
    bg: "bg-[#F4F7FA]",
    label: "Rascunho criado",
    border: "border-[#E8EDF2]",
  },
  triagem: {
    icon: PaperPlaneTilt,
    color: "text-[#1C5A6B]",
    bg: "bg-[#DCEAF0]",
    label: "Enviada para análise",
    border: "border-[#C7D7EA]",
  },
  aprovada: {
    icon: CheckCircle,
    color: "text-[#5F735C]",
    bg: "bg-[#E7F0EA]",
    label: "Homologada",
    border: "border-[#CFE6DE]",
  },
  devolvida: {
    icon: WarningCircle,
    color: "text-[#B9895A]",
    bg: "bg-[#FFF3E6]",
    label: "Devolvida para ajuste",
    border: "border-[#F3D0BE]",
  },
  pactuando: {
    icon: Buildings,
    color: "text-[#2D5D94]",
    bg: "bg-[#E8EDF2]",
    label: "Em pactuação",
    border: "border-[#C7D7EA]",
  },
  concluida: {
    icon: CheckCircle,
    color: "text-[#5F735C]",
    bg: "bg-[#E7F0EA]",
    label: "Concluída",
    border: "border-[#CFE6DE]",
  },
};

function normalizeLogText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getUniqueTimelineLogs(logs: any[]) {
  const seen = new Set<string>();
  return (logs || []).filter((log) => {
    const key = [
      normalizeLogText(log.action),
      normalizeLogText(log.details),
      normalizeLogText(log.created_at).slice(0, 16),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function DfdTimeline({ logs }: { logs: any[] }) {
  const timelineLogs = React.useMemo(() => getUniqueTimelineLogs(logs), [logs]);

  if (!timelineLogs || timelineLogs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#D9E0E8] bg-[#FAFBFC] px-3 py-8 text-center">
        <Clock size={30} className="mx-auto text-[#A7B1BD]" />
        <p className="mt-2 text-xs font-medium text-[#5B6675]">
          Ainda não há movimentações registradas.
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-3 overflow-hidden">
      <motion.div
        className="absolute bottom-5 left-[14px] top-5 w-px origin-top bg-gradient-to-b from-[#164073] via-[#C7D7EA] to-transparent"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      <AnimatePresence mode="popLayout">
        {timelineLogs.map((log, index) => {
          const config = ICONS[log.action] || ICONS.rascunho;
          const Icon = config.icon;
          const latest = index === 0;

          return (
            <motion.div
              layout
              key={log.id || `${log.action}-${log.created_at}-${index}`}
              initial={{ opacity: 0, x: 10, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.985 }}
              transition={{ duration: 0.2, delay: index * 0.035, ease: "easeOut" }}
              className="relative flex gap-2.5"
            >
              <motion.div
                className={`z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${config.bg} ${config.color} ${config.border}`}
                animate={latest ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={latest ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
              >
                <Icon size={14} weight="fill" />
              </motion.div>

              <motion.article
                whileHover={{ y: -1 }}
                className={`flex-1 rounded-xl border px-2.5 py-2.5 transition-colors ${
                  latest
                    ? "border-[#C7D7EA] bg-[#F7FBFF] shadow-sm"
                    : "border-[#E8EDF2] bg-[#FAFBFC]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-semibold text-[#164073]">{config.label}</p>
                    {latest ? (
                      <span className="rounded-full bg-[#E8EDF2] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#2D5D94]">
                        atual
                      </span>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#5B6675]">
                    <Clock size={11} />
                    {new Date(log.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="mt-1.5 text-xs leading-relaxed text-[#5B6675]">
                  {log.details || "Movimentação registrada automaticamente pelo sistema."}
                </p>

                {log.action === "devolvida" ? (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[#F3D0BE] bg-[#FFF3E6] px-2 py-1 text-[10px] font-semibold text-[#B9895A]">
                    <ChatText size={12} />
                    Ajuste solicitado
                  </div>
                ) : null}
              </motion.article>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
