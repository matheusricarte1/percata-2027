/** Descriptive indicators; never change the official priority score. */
export function concentration(values: number[]) {
  const sorted = values.filter(v => Number.isFinite(v) && v >= 0).sort((a,b) => a-b);
  const count = sorted.length;
  const total = sorted.reduce((s,v) => s+v,0);
  if (!count || total === 0) return { count, total, gini: 0, hhi: 0, effectiveCount: 0, pareto80Count: 0, top10Share: 0 };
  const gini = Math.max(0, 2*sorted.reduce((s,v,i) => s+(i+1)*v,0)/(count*total)-(count+1)/count);
  const hhi = sorted.reduce((s,v) => s+(v/total)**2,0);
  let accumulated = 0, pareto80Count = 0;
  for (let i=count-1; i>=0 && accumulated < .8*total; i--) { accumulated += sorted[i]; pareto80Count++; }
  return { count, total, gini, hhi, effectiveCount: 1/hhi, pareto80Count, top10Share: sorted.slice(-10).reduce((s,v)=>s+v,0)/total };
}
export type PriceObservation = { id: string; campusId: string | null; code: string; unit: string; gnd: string; price: number };
export type PriceSignal = { status: "available" | "insufficient" | "zero_mad" | "invalid"; n: number; z?: number; flagged: boolean };
const median = (v: number[]) => { const a=[...v].sort((x,y)=>x-y); return (a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2; };
export function priceSignals(rows: PriceObservation[]): Map<string, PriceSignal> {
  const groups = new Map<string, PriceObservation[]>();
  const key = (r: PriceObservation) => JSON.stringify([r.campusId,r.code.trim(),r.unit.trim().toUpperCase(),r.gnd.trim()]);
  for (const r of rows) if (r.campusId && r.code.trim() && r.unit.trim() && r.gnd.trim() && Number.isFinite(r.price) && r.price>0) {
    const k=key(r); const group=groups.get(k) || []; group.push(r); groups.set(k,group);
  }
  const result=new Map<string,PriceSignal>();
  for (const r of rows) {
    if (!Number.isFinite(r.price) || r.price<=0) { result.set(r.id,{status:"invalid",n:0,flagged:true}); continue; }
    const group=groups.get(key(r)) || [];
    if (group.length<8) { result.set(r.id,{status:"insufficient",n:group.length,flagged:false}); continue; }
    const logs=group.map(p=>Math.log10(p.price)), m=median(logs), mad=median(logs.map(v=>Math.abs(v-m)));
    if (mad===0) { result.set(r.id,{status:"zero_mad",n:group.length,flagged:false}); continue; }
    const z=.6745*(Math.log10(r.price)-m)/mad;
    result.set(r.id,{status:"available",n:group.length,z,flagged:Math.abs(z)>=3.5});
  }
  return result;
}
