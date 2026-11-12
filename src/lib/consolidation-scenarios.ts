import { calculateCapitalPriorities } from "./capital-priority";
import { institutionalScore, type InstitutionalGroup } from "./institutional-priority";
import { computeWeightedPriority } from "./weighted-priority";

export const SCENARIO_VERSION = "consolidation-scenarios-v1";
export type ScenarioItem = {
  id: string; campusId: string; unitId: string; unitName: string; dfdId: string;
  code: string; description: string; gnd: string; quantity: number; price: number;
  impact: number; timing: number; highlight: boolean; group: InstitutionalGroup;
  eligible: boolean; fixed10: boolean;
};
export type ConfirmedNeed = {
  id: string; title: string; purpose: string; itemIds: string[];
  confirmed: boolean; impact: number; timing: number; highlight: boolean;
};
export type ScoredNeed = {
  id: string; title: string; itemIds: string[]; campusId: string; unitId: string;
  unitName: string; group: InstitutionalGroup; value: number; technical: number | null;
  score: number | null; impact: number; timing: number; protected: boolean;
};
const validLevel = (v: number) => Number.isInteger(v) && v >= 1 && v <= 4;
export const itemValue = (item: ScenarioItem) => item.quantity * item.price;
function validatePortfolio(items: ScenarioItem[]) {
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error("Itens repetidos no cenário.");
  if (new Set(items.map(i => i.campusId)).size > 1) throw new Error("O cenário deve conter apenas um campus.");
  if (items.some(i => !i.campusId || !i.eligible || !Number.isFinite(itemValue(i)) || i.price < 0 || i.quantity < 0))
    throw new Error("Carteira inválida ou fora dos estados elegíveis.");
}

export function scoreScenario(items: ScenarioItem[], needs: ConfirmedNeed[], method: "official" | "additive" = "official", protectedIds: string[] = []): ScoredNeed[] {
  validatePortfolio(items);
  const lookup = new Map(items.map(i => [i.id, i]));
  if (new Set([...items.map(i => i.id), ...needs.map(n => n.id)]).size !== items.length + needs.length)
    throw new Error("Identificadores de necessidades e itens devem ser distintos.");
  const assigned = new Set<string>();
  const rows: Array<{ row: ScoredNeed; source: ScenarioItem; fixed: boolean; highlight: boolean }> = [];
  const add = (source: ScenarioItem, members: ScenarioItem[], id: string, title: string, impact: number, timing: number, highlight: boolean) => {
    rows.push({ source, fixed: members.every(i => i.fixed10), highlight, row: {
      id, title, itemIds: members.map(i => i.id), campusId: source.campusId,
      unitId: source.unitId, unitName: source.unitName, group: source.group,
      value: members.reduce((sum,i) => sum + itemValue(i), 0), technical: null, score: null,
      impact, timing, protected: members.some(i => protectedIds.includes(i.id)),
    } });
  };
  for (const need of needs) {
    if (!need.confirmed || !need.title.trim() || need.purpose.trim().length < 10 || need.itemIds.length < 2 || new Set(need.itemIds).size !== need.itemIds.length)
      throw new Error("Confirme a finalidade compartilhada e selecione ao menos dois itens distintos.");
    if (!validLevel(need.impact) || !validLevel(need.timing)) throw new Error("Avalie criticidade e prioridade da necessidade conjunta.");
    const members = need.itemIds.map(id => lookup.get(id));
    if (members.some(i => !i)) throw new Error("A necessidade contém item fora da carteira.");
    const selected = members as ScenarioItem[];
    const first = selected[0];
    if (selected.some(i => assigned.has(i.id) || !i.gnd.trim().startsWith("4") || i.fixed10 || !i.unitId || i.unitId !== first.unitId || i.group !== first.group))
      throw new Error("Agrupe apenas capital da mesma unidade e nível, sem nota administrativa ou sobreposição.");
    selected.forEach(i => assigned.add(i.id));
    add(first, selected, need.id, need.title, need.impact, need.timing, need.highlight);
  }
  for (const item of items) if (!assigned.has(item.id)) add(item, [item], item.id, item.description, item.impact, item.timing, item.highlight);
  const capital = calculateCapitalPriorities(rows.filter(r => r.source.gnd.trim().startsWith("4")).map(({ row, highlight }) => ({
    key: row.id, campusId: row.campusId, unitKey: row.unitId || null, value: row.value,
    criticidadeLevel: row.impact, prioridadeLevel: row.timing, chefiaPareto: highlight, eligible: true,
  })));
  return rows.map(({ row, source, fixed }) => {
    let technical: number | null = null;
    if (fixed) technical = 10;
    else if (validLevel(row.impact) && validLevel(row.timing)) {
      if (method === "additive") technical = ((row.impact + row.timing - 2) / 6) * 280;
      else if (source.gnd.trim().startsWith("4")) technical = capital.get(row.id)?.finalScore ?? null;
      else technical = computeWeightedPriority(row.impact, row.timing, row.value);
    }
    return { ...row, technical, score: technical == null ? null : institutionalScore(row.group, technical) };
  });
}

/** Greedy, whole-need cut: explicit heuristic, not an optimal allocation or an execution. */
export function budgetScenario(rows: ScoredNeed[], cutPercent: number) {
  if (!Number.isFinite(cutPercent) || cutPercent < 0 || cutPercent > 100) throw new Error("Corte deve estar entre 0 e 100%.");
  const total = rows.reduce((s,r) => s+r.value, 0), target = total*cutPercent/100;
  const candidates = rows.filter(r => !r.protected && r.score != null && r.value > 0)
    .sort((a,b) => a.score! - b.score! || b.value-a.value || a.id.localeCompare(b.id));
  const removed = new Set<string>(); let cut = 0;
  for (const row of candidates) { if (cut >= target) break; removed.add(row.id); cut += row.value; }
  const units = new Map<string, { id: string; unit: string; requested: number; retained: number }>();
  for (const row of rows) {
    const key = row.unitId || "unidentified";
    const unit = units.get(key) || { id: key, unit: row.unitName || "Unidade não identificada", requested: 0, retained: 0 };
    unit.requested += row.value; if (!removed.has(row.id)) unit.retained += row.value; units.set(key,unit);
  }
  const retention = [...units.values()].map(u => ({ ...u, retention: u.requested > 0 ? u.retained/u.requested : null }));
  const ratios = retention.flatMap(u => u.retention == null ? [] : [u.retention]);
  const denominator = ratios.length * ratios.reduce((s,v) => s+v*v,0);
  return { total, target, cut, retained: total-cut, deviation: cut-target, shortfall: Math.max(0,target-cut),
    removedIds: [...removed], retention, jain: denominator > 0 ? ratios.reduce((s,v)=>s+v,0)**2/denominator : null,
    criticalRemoved: rows.filter(r => removed.has(r.id) && r.impact === 4).length };
}

function rng(seed: number) { let state=seed>>>0; return () => { state=(Math.imul(1664525,state)+1013904223)>>>0; return (state+.5)/4294967296; }; }
function normal(random: () => number) { return Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random()); }
const quantile = (sorted: number[], p: number) => { const pos=(sorted.length-1)*p, a=Math.floor(pos), b=Math.ceil(pos); return sorted[a]+(sorted[b]-sorted[a])*(pos-a); };
export function monteCarlo(items: ScenarioItem[], options: { sigma: number; rho: number; scenarios: number; seed: number }) {
  validatePortfolio(items);
  const {sigma,rho,scenarios,seed}=options;
  if (!Number.isFinite(sigma) || sigma<0 || sigma>1 || !Number.isFinite(rho) || rho<0 || rho>1 || !Number.isInteger(scenarios) || scenarios<100 || scenarios>5000 || !Number.isInteger(seed)) throw new Error("Parâmetros de simulação inválidos.");
  const random=rng(seed), totals:number[]=[];
  // Shared shocks by expense nature; this is a declared scenario assumption, not a fitted correlation.
  for(let k=0;k<scenarios;k++) {
    const shocks=new Map<string,number>(); let total=0;
    for(const item of items) {
      const group=item.gnd.trim() || "sem-gnd";
      if(!shocks.has(group)) shocks.set(group,normal(random));
      const error=Math.sqrt(rho)*shocks.get(group)!+Math.sqrt(1-rho)*normal(random);
      total+=itemValue(item)*Math.exp(sigma*error-sigma*sigma/2);
    }
    totals.push(total);
  }
  totals.sort((a,b)=>a-b);
  return { ...options, mean: totals.reduce((s,v)=>s+v,0)/scenarios, p05: quantile(totals,.05), p50: quantile(totals,.5), p95: quantile(totals,.95), baseline: items.reduce((s,i)=>s+itemValue(i),0) };
}

/** Descriptive hierarchical comparison; does not diagnose bias or change official scores. */
export function unitComparisons(items: ScenarioItem[], seed=20261017) {
  validatePortfolio(items);
  const valid=items.filter(i=>!i.fixed10 && validLevel(i.impact) && validLevel(i.timing) && i.unitId);
  const grouped=new Map<string,ScenarioItem[]>();
  for(const item of valid) { const group=grouped.get(item.unitId)||[]; group.push(item); grouped.set(item.unitId,group); }
  const priority=(i:ScenarioItem)=>(i.impact+i.timing-2)/6;
  const mean=valid.length?valid.reduce((s,i)=>s+priority(i),0)/valid.length:0;
  const k=grouped.size, n=valid.length;
  let between=0, within=0, sizeSquares=0;
  for(const group of grouped.values()) { const m=group.reduce((s,i)=>s+priority(i),0)/group.length; between+=group.length*(m-mean)**2; within+=group.reduce((s,i)=>s+(priority(i)-m)**2,0); sizeSquares+=group.length**2; }
  const msw=n>k?within/(n-k):0, msb=k>1?between/(k-1):0;
  const n0=k>1?(n-sizeSquares/Math.max(1,n))/(k-1):0;
  const tau2=n0>0?Math.max(0,(msb-msw)/n0):0;
  const random=rng(seed);
  const units=[...grouped.entries()].map(([id,group])=>{
    const m=group.reduce((s,i)=>s+priority(i),0)/group.length;
    const dfds=new Map<string,number[]>();
    for(const item of group) { const rows=dfds.get(item.dfdId)||[]; rows.push(priority(item)); dfds.set(item.dfdId,rows); }
    const clusters=[...dfds.values()], replicates:number[]=[];
    if(clusters.length>=2) for(let b=0;b<1000;b++) { let total=0,count=0; for(let c=0;c<clusters.length;c++) { const draw=clusters[Math.floor(random()*clusters.length)]; total+=draw.reduce((s,v)=>s+v,0); count+=draw.length; } replicates.push(total/count); }
    replicates.sort((a,b)=>a-b);
    const weight=tau2+msw/group.length>0?tau2/(tau2+msw/group.length):0;
    return { id, unit:group[0].unitName, n:group.length, dfds:clusters.length, mean:m,
      adjusted:mean+weight*(m-mean), weight, low:replicates.length?quantile(replicates,.025):null,
      high:replicates.length?quantile(replicates,.975):null,
      status:clusters.length<2?"DFDs insuficientes para bootstrap":new Set(group.map(priority)).size===1?"Sem variação observada; não comprova precisão":"Bootstrap por DFD" };
  });
  return { mean, tau2, msw, icc:tau2+msw>0?tau2/(tau2+msw):null, eta2:between+within>0?between/(between+within):null, units, seed, replicates:1000 };
}

export function dataIssues(item: ScenarioItem): string[] {
  const issues:string[]=[];
  if (!Number.isFinite(item.price) || item.price<=0) issues.push("Preço ausente, não positivo ou inválido");
  else if(item.price<=1) issues.push("Preço unitário até R$ 1: conferir estimativa e unidade");
  if(!Number.isFinite(item.quantity)||item.quantity<=0) issues.push("Quantidade ausente, não positiva ou inválida");
  if(!/^[34]/.test(item.gnd.trim())) issues.push("Natureza da despesa não identificada");
  if(!validLevel(item.impact)||!validLevel(item.timing)) issues.push("Avaliação incompleta ou inválida");
  if(item.group==="nao_identificado") issues.push("Nível institucional não classificado");
  if(item.gnd.trim().startsWith("4") && /^(PAPEL\s*-|BORRACHA\s*-|ALCOOL\s|SABONETE\s*-|PAPEL HIGIENICO)/i.test(item.description)) issues.push("Descrição de possível consumo registrada como capital: conferir natureza");
  return issues;
}
