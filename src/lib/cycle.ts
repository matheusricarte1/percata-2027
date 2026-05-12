import { supabase } from "@/lib/supabase";

type CycleLite = {
  nome?: string | null;
  janela_inicio?: string | null;
  janela_fim?: string | null;
  created_at?: string | null;
};

function yearFromDateString(value?: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  return Number.isFinite(year) ? year : null;
}

function yearFromName(value?: string | null): number | null {
  const text = String(value || "");
  const match = text.match(/(20\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return null;
  if (year < 2000 || year > 2100) return null;
  return year;
}

export function resolveCycleYear(
  cycle?: CycleLite | null,
  fallbackDate = new Date(),
): number {
  return (
    yearFromName(cycle?.nome) ||
    yearFromDateString(cycle?.janela_inicio) ||
    yearFromDateString(cycle?.janela_fim) ||
    yearFromDateString(cycle?.created_at) ||
    fallbackDate.getFullYear()
  );
}

export async function fetchActiveCycleYear(): Promise<number> {
  const fallback = new Date().getFullYear();

  const activeRes = await supabase
    .from("governanca_ciclos")
    .select("nome,janela_inicio,janela_fim,created_at")
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (!activeRes.error && activeRes.data) {
    return resolveCycleYear(activeRes.data, new Date(fallback, 0, 1));
  }

  const latestRes = await supabase
    .from("governanca_ciclos")
    .select("nome,janela_inicio,janela_fim,created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRes.error && latestRes.data) {
    return resolveCycleYear(latestRes.data, new Date(fallback, 0, 1));
  }

  return fallback;
}

