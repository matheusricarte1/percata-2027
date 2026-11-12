"use client";

import { DownloadSimple } from "@/components/icons/phosphor/exports/DownloadSimple";
import { Info } from "@/components/icons/phosphor/exports/Info";
import { useMemo, useState } from "react";
import { downloadWorkbookFromSheets } from "@/lib/export-excel";
import { INSTITUTIONAL_GROUP_LABELS } from "@/lib/institutional-priority";
import { SCENARIO_VERSION, scoreScenario, budgetScenario, monteCarlo, unitComparisons, dataIssues, type ScenarioItem, type ConfirmedNeed } from "@/lib/consolidation-scenarios";

const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const control="min-h-11 rounded-lg border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 text-sm text-[var(--p-color-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p-color-action)]";
const action=control+" font-semibold hover:bg-[var(--p-color-bg-muted)] disabled:opacity-50";
const levelNames=["Baixa / postergado","Média / oportuno","Alta / relevante","Crítica / essencial"];

export function ConsolidationScenarios({items,campusName,updatedAt}:{items:ScenarioItem[];campusName:string;updatedAt:string}) {
  const [activeStep,setActiveStep]=useState(0);
  const [method,setMethod]=useState<"official"|"additive">("official");
  const [needs,setNeeds]=useState<ConfirmedNeed[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [protectedIds,setProtectedIds]=useState<string[]>([]);
  const [title,setTitle]=useState(""); const [purpose,setPurpose]=useState("");
  const [confirmed,setConfirmed]=useState(false); const [impact,setImpact]=useState(4); const [timing,setTiming]=useState(4); const [highlight,setHighlight]=useState(false);
  const [cutPercent,setCutPercent]=useState(0);
  const [sigma,setSigma]=useState(.15); const [rho,setRho]=useState(.3); const [seed,setSeed]=useState(20261017);
  const [simulation,setSimulation]=useState<ReturnType<typeof monteCarlo>|null>(null);
  const [comparisons,setComparisons]=useState<ReturnType<typeof unitComparisons>|null>(null);
  const [error,setError]=useState<string|null>(null);
  const assigned=useMemo(()=>new Set(needs.flatMap(n=>n.itemIds)),[needs]);
  const baseline=useMemo(()=>scoreScenario(items,[],"official"),[items]);
  const baselineScores=useMemo(()=>new Map(baseline.map(row=>[row.id,row.score])),[baseline]);
  const available=items.filter(i=>i.gnd.trim().startsWith("4")&&!i.fixed10&&!assigned.has(i.id));
  const result=useMemo(()=>{
    try {return {rows:scoreScenario(items,needs,method,protectedIds),error:null};}
    catch(e){return {rows:[],error:e instanceof Error?e.message:"Não foi possível calcular o cenário."};}
  },[items,needs,method,protectedIds]);
  const ranked=useMemo(()=>[...result.rows].sort((a,b)=>Number(a.score==null)-Number(b.score==null)||(b.score||0)-(a.score||0)||(b.technical||0)-(a.technical||0)||a.id.localeCompare(b.id)),[result.rows]);
  const budget=useMemo(()=>budgetScenario(result.rows,cutPercent),[result.rows,cutPercent]);
  const removed=new Set(budget.removedIds);
  const issues=useMemo(()=>items.flatMap(i=>dataIssues(i).map(reason=>({item_id:i.id,dfd_id:i.dfdId,codigo:i.code,descricao:i.description,unidade:i.unitName,motivo:reason,quantidade:i.quantity,preco:i.price,gnd:i.gnd}))),[items]);
  const addNeed=()=>{
    const next:ConfirmedNeed={id:`need-${Date.now()}`,title,purpose,itemIds:selected,confirmed,impact,timing,highlight};
    try {scoreScenario(items,[...needs,next],method,protectedIds);setNeeds(prev=>[...prev,next]);setSelected([]);setTitle("");setPurpose("");setConfirmed(false);setError(null);}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível agrupar.");}
  };
  const exportScenario=async()=>{
    try {
      await downloadWorkbookFromSheets([
        {name:"Contexto_Cenario",rows:[{versao:SCENARIO_VERSION,campus:campusName,base_atualizada_em:updatedAt,gerado_em:new Date().toISOString(),metodo:method,simulacao:"SIM — não altera avaliações, DFDs ou registros oficiais",formula_aditiva:"T=280*(criticidade+prioridade-2)/6; alternativa sem ajuste financeiro ou bônus, exceto nota administrativa fixa",corte_percent:cutPercent,semente:seed,protegidos:protectedIds.join(" | "),parametros_monte_carlo:simulation?JSON.stringify(simulation):"Não calculado",regra_corte:"Heurística de menor pontuação final; necessidades inteiras; pendentes e protegidos preservados"}]},
        {name:"Necessidades_Confirmadas",rows:needs.map(n=>({...n,itemIds:n.itemIds.join(" | ")}))},
        {name:"Base_Cenario_Por_Item",rows:baseline.map(r=>({...r,itemIds:r.itemIds.join(" | ")}))},
        {name:"Ranking_Cenario",rows:ranked.map((r,i)=>({posicao:i+1,...r,itemIds:r.itemIds.join(" | "),nivel:INSTITUTIONAL_GROUP_LABELS[r.group],pontuacoes_base_componentes:r.itemIds.map(id=>`${id}: ${baselineScores.get(id)??"pendente"}`).join(" | "),diferenca_da_base:r.itemIds.length===1 && r.score!=null && baselineScores.get(r.id)!=null?r.score-baselineScores.get(r.id)!:"Conjunto: comparar os componentes",removido_no_cenario:removed.has(r.id)?"SIM":"NAO"}))},
        {name:"Corte_Resumo",rows:[{total:budget.total,meta:budget.target,corte:budget.cut,retido:budget.retained,desvio:budget.deviation,meta_nao_atendida:budget.shortfall,jain:budget.jain,necessidades_criticas_retiradas:budget.criticalRemoved}]},
        {name:"Retencao_Unidades",rows:budget.retention},
        {name:"Incerteza_Precos",rows:simulation?[{...simulation,hipoteses:"Erro lognormal comum por GND; sigma e rho assumidos pelo usuário, não estimados; quantidades fixas"}]:[]},
        {name:"Comparacao_Unidades",rows:comparisons?.units||[]},
        {name:"Contexto_Estatistico",rows:comparisons?[{media:comparisons.mean,tau2:comparisons.tau2,MSW:comparisons.msw,ICC:comparisons.icc,eta2:comparisons.eta2,semente:comparisons.seed,reamostragens:comparisons.replicates,metodo:"Bootstrap por DFD dentro de cada unidade; ajuste descritivo, não causal nem avaliação oficial"}]:[]},
        {name:"Conferencia_Dados",rows:issues},
      ],`percata_cenario_${items[0]?.campusId||"sem-campus"}_${new Date().toISOString().slice(0,10)}.xlsx`);
      setError(null);
    } catch(e){setError(e instanceof Error?e.message:"Falha ao exportar cenário.");}
  };
  const steps=[
    ["Necessidades conjuntas","Agrupe itens semelhantes"],
    ["Método do cenário","Defina a estratégia"],
    ["Comparação entre unidades","Analise diferenças"],
    ["Conferência cadastral","Revise e ajuste"],
    ["Resultado do cenário","Visualize o consolidado"],
  ];
  return <section aria-labelledby="scenario-title" className="consolidation-scenarios">
    <div className="scenario-heading"><div className="scenario-heading-copy"><span className="consolidation-section-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="11" width="4" height="10" rx="1"/><rect x="10" y="3" width="4" height="18" rx="1"/><rect x="17" y="7" width="4" height="14" rx="1"/></svg></span><div><h2 id="scenario-title">Cenários e conferência</h2><p>Analise necessidades, gere cenários e compare unidades para subsidiar o PCA.</p></div></div><button className={action+" scenario-export"} type="button" onClick={exportScenario}><DownloadSimple size={17}/>Exportar cenário (XLSX)</button></div>
    <div role="tablist" aria-label="Etapas do cenário" className="scenario-steps">{steps.map(([label,description],index)=><button type="button" role="tab" id={`scenario-tab-${index}`} aria-controls={`scenario-panel-${index}`} aria-selected={activeStep===index} tabIndex={activeStep===index?0:-1} key={label} onClick={()=>setActiveStep(index)} onKeyDown={event=>{const next=event.key==="ArrowRight"?(index+1)%steps.length:event.key==="ArrowLeft"?(index+steps.length-1)%steps.length:event.key==="Home"?0:event.key==="End"?steps.length-1:null;if(next!=null){event.preventDefault();setActiveStep(next);document.getElementById(`scenario-tab-${next}`)?.focus();}}}><span className="scenario-step-number">{index+1}</span><span><strong>{label}</strong><small>{description}</small></span></button>)}</div>
    <p className="scenario-context">{campusName} · {items.length} itens de origem · Simulação local, sem alterar os pedidos ou as avaliações oficiais.</p>
    {(error||result.error)&&<p role="alert" className="mt-3 text-sm text-[var(--p-color-danger)]">{error||result.error}</p>}

    <div role="tabpanel" id="scenario-panel-0" aria-labelledby="scenario-tab-0" hidden={activeStep!==0} tabIndex={0} className="scenario-panel">
      <div className="scenario-group-heading"><strong>Agrupamento e análise de similaridade</strong><p>Agrupe componentes da mesma finalidade, unidade e nível. O valor conjunto é avaliado uma única vez no cenário; as origens são preservadas.</p></div>
      <div className="scenario-group-layout">

        <label className="grid gap-2 text-sm">Componentes da necessidade conjunta<select multiple size={7} aria-label="Componentes da necessidade conjunta" value={selected} onChange={e=>setSelected(Array.from(e.target.selectedOptions,o=>o.value))} className={control+" scenario-components w-full min-w-0"}>{available.map(i=><option key={i.id} value={i.id}>{i.code} · {i.description.slice(0,75)} · {i.unitName}</option>)}</select><span>Use Ctrl/Command ou Shift para selecionar vários itens.</span></label>
        <div className="grid gap-3"><label className="grid gap-1 text-sm">Nome da necessidade<input placeholder="Ex.: Equipamentos de laboratório de ensino" className={control} value={title} onChange={e=>setTitle(e.target.value)} maxLength={160}/></label><label className="grid gap-1 text-sm">Finalidade compartilhada<textarea placeholder="Descreva a finalidade comum dos itens agrupados..." className={control+" min-h-20 py-2"} value={purpose} onChange={e=>setPurpose(e.target.value)} maxLength={2000}/></label><div className="flex flex-wrap gap-3"><label className="grid gap-1 text-sm">Criticidade do conjunto<select className={control} value={impact} onChange={e=>setImpact(Number(e.target.value))}>{levelNames.map((_,i)=><option value={i+1} key={i}>{["Baixa","Média","Alta","Crítica"][i]}</option>)}</select></label><label className="grid gap-1 text-sm">Prioridade do conjunto<select className={control} value={timing} onChange={e=>setTiming(Number(e.target.value))}>{["Postergado","Oportuno","Relevante","Essencial"].map((v,i)=><option value={i+1} key={i}>{v}</option>)}</select></label></div>
</div>
      <aside className="scenario-tips"><strong><Info size={17}/>Dicas de análise</strong><ul><li>Agrupe itens com a mesma finalidade e uso.</li><li>Verifique especificações e unidades de medida.</li><li>Revise a criticidade e a prioridade do conjunto.</li><li>Confirme o agrupamento para incluí-lo no cenário.</li></ul></aside>
      </div>
      <div className="scenario-group-actions">        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={highlight} onChange={e=>setHighlight(e.target.checked)}/>Simular destaque no conjunto</label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo a finalidade compartilhada dos componentes</label><button type="button" className={action} disabled={selected.length<2||!confirmed} onClick={addNeed}>Adicionar necessidade ao cenário</button></div>
      {needs.length>0&&<ul className="mt-3 space-y-2">{needs.map(n=><li key={n.id} className="flex flex-wrap items-center gap-3 text-sm"><span>{n.title} · {n.itemIds.length} componentes · {n.purpose}</span><button type="button" className={action} onClick={()=>setNeeds(prev=>prev.filter(x=>x.id!==n.id))}>Desfazer agrupamento {n.title}</button></li>)}</ul>}
    </div>
    <div role="tabpanel" id="scenario-panel-1" aria-labelledby="scenario-tab-1" hidden={activeStep!==1} tabIndex={0} className="scenario-panel"><h3 className="font-semibold">Estratégia de pontuação</h3><p className="mt-2 text-sm">Compare métodos mantendo os níveis institucionais. A escolha afeta somente este cenário.</p>
      <label className="mt-4 grid max-w-lg gap-2 text-sm">Método do cenário<select className={control} value={method} onChange={e=>setMethod(e.target.value as "official"|"additive")}><option value="official">Fórmulas oficiais preservadas</option><option value="additive">Alternativa aditiva — experimento</option></select></label>
      {method==="additive"&&<p role="status" className="mt-2 text-sm text-[var(--p-color-warning)]">Experimento: T = 280 × (criticidade + prioridade − 2) / 6. As escalas originais 1–4 são convertidas para 0–3. Esta alternativa exclui ajuste financeiro e destaque; mantém os níveis institucionais e a nota administrativa fixa. Não substitui a pontuação oficial.</p>}
    </div>

    <div role="tabpanel" id="scenario-panel-2" aria-labelledby="scenario-tab-2" hidden={activeStep!==2} tabIndex={0} className="scenario-panel"><h3 className="font-semibold">Comparação descritiva entre unidades</h3><p className="mt-3 max-w-prose text-sm">Compara a nota aditiva normalizada entre unidades do mesmo campus, com encolhimento descritivo e 1.000 reamostragens por DFD. Exclui notas administrativas fixas e avaliações incompletas. Diferenças podem refletir necessidades distintas; não comprovam viés, exagero ou qualidade da avaliação e não alteram as notas oficiais.</p><button type="button" className={action+" mt-3"} onClick={()=>{try{setComparisons(unitComparisons(items,seed));setError(null);}catch(e){setError(e instanceof Error?e.message:"Falha na comparação.");}}}>Calcular comparação das unidades</button>{comparisons&&<><p className="mt-3 text-sm">ICC {comparisons.icc?.toFixed(3)??"indisponível"} · η² {comparisons.eta2?.toFixed(3)??"indisponível"}. Associação descritiva, sem interpretação causal.</p><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Notas médias e estimativas ajustadas por unidade</caption><thead><tr>{["Unidade","Itens / DFDs","Média","Ajustada","Faixa bootstrap 95%","Condição"].map(h=><th scope="col" className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{comparisons.units.map(u=><tr className="border-t border-[var(--p-color-border)]" key={u.id}><th scope="row" className="p-2 font-medium">{u.unit}</th><td className="p-2">{u.n} / {u.dfds}</td><td className="p-2">{u.mean.toFixed(3)}</td><td className="p-2">{u.adjusted.toFixed(3)}</td><td className="p-2">{u.low==null?"Indisponível":`${u.low.toFixed(3)}–${u.high?.toFixed(3)}`}</td><td className="p-2">{u.status}</td></tr>)}</tbody></table></div></>}</div>

    <div role="tabpanel" id="scenario-panel-3" aria-labelledby="scenario-tab-3" hidden={activeStep!==3} tabIndex={0} className="scenario-panel"><h3 className="font-semibold">Conferência cadastral — {issues.length} apontamentos</h3><p className="mt-3 text-sm">Sinais para revisão humana, sem alteração automática de natureza, preço ou quantidade. A exportação inclui todos os apontamentos do campus.</p><ul className="mt-3 space-y-2 text-sm">{issues.slice(0,30).map((r,i)=><li key={i}><a className="font-semibold underline" href={`/dfd/${r.dfd_id}`} target="_blank" rel="noopener noreferrer">{r.codigo||"Sem código"}</a> · {r.descricao.slice(0,95)} · {r.motivo}</li>)}</ul>{issues.length>30&&<p className="mt-2 text-sm">Mostrando 30 apontamentos. Consulte todos no XLSX.</p>}</div>

    <div role="tabpanel" id="scenario-panel-4" aria-labelledby="scenario-tab-4" hidden={activeStep!==4} tabIndex={0} className="scenario-panel"><h3 className="font-semibold">Resultado do cenário — {ranked.length} necessidades</h3>{activeStep===4&&<div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Primeiras vinte necessidades do cenário; ranking completo no XLSX</caption><thead><tr>{["Necessidade","Unidade / nível","Valor","Nota técnica","Base do cenário","Pontuação final","Corte"].map(h=><th scope="col" className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{ranked.slice(0,20).map(r=><tr className="border-t border-[var(--p-color-border)]" key={r.id}><th scope="row" className="max-w-xs p-2 font-medium">{r.title.slice(0,130)}{r.itemIds.length>1?` · ${r.itemIds.length} componentes`:""}</th><td className="p-2">{r.unitName}<br/>{INSTITUTIONAL_GROUP_LABELS[r.group]}</td><td className="p-2">{money(r.value)}</td><td className="p-2">{r.technical?.toFixed(2)??"Pendente"}</td><td className="p-2">{r.itemIds.length===1?baselineScores.get(r.id)?.toFixed(2)??"Pendente":"Conjunto — ver componentes no XLSX"}</td><td className="p-2">{r.score?.toFixed(2)??"Pendente"}</td><td className="p-2">{removed.has(r.id)?"Retirado no cenário":"Mantido"}</td></tr>)}</tbody></table></div>}</div>
    <details className="scenario-accordion"><summary className="cursor-pointer font-semibold">Cenário de corte e retenção por unidade</summary>
      <p className="mt-3 max-w-prose text-sm">Retira necessidades inteiras pela menor pontuação final até atingir a meta. É uma heurística, sem garantia de seleção ótima. Pendências e itens protegidos são preservados. Dependências devem ser agrupadas antes do corte; o sistema não as presume.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="grid content-start gap-2 text-sm">Meta de corte: {cutPercent}%<input aria-label="Percentual de corte do cenário" type="range" min={0} max={100} step={1} value={cutPercent} onChange={e=>setCutPercent(Number(e.target.value))}/></label><label className="grid gap-2 text-sm">Itens que devem ser preservados<select multiple size={5} aria-label="Itens protegidos no corte" className={control+" h-36 min-w-0"} value={protectedIds} onChange={e=>setProtectedIds(Array.from(e.target.selectedOptions,o=>o.value))}>{items.map(i=><option value={i.id} key={i.id}>{i.code} · {i.description.slice(0,65)}</option>)}</select></label></div>
      <p role="status" className="mt-3 text-sm">Meta {money(budget.target)} · corte simulado {money(budget.cut)} · mantido {money(budget.retained)} · desvio da meta {money(budget.deviation)} · {budget.criticalRemoved} necessidades críticas retiradas. Jain {budget.jain?.toFixed(3)??"indisponível"}.</p>
      {budget.shortfall>0&&<p className="mt-2 text-sm text-[var(--p-color-warning)]">A meta não foi atendida: faltam {money(budget.shortfall)}. Proteções e pendências foram respeitadas.</p>}
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Retenção financeira por unidade no cenário</caption><thead><tr><th scope="col" className="p-2">Unidade</th><th scope="col" className="p-2">Solicitado</th><th scope="col" className="p-2">Mantido</th><th scope="col" className="p-2">Retenção</th></tr></thead><tbody>{budget.retention.map(u=><tr key={u.id} className="border-t border-[var(--p-color-border)]"><th scope="row" className="p-2 font-medium">{u.unit}</th><td className="p-2">{money(u.requested)}</td><td className="p-2">{money(u.retained)}</td><td className="p-2">{u.retention==null?"Sem valor":`${(u.retention*100).toFixed(1)}%`}</td></tr>)}</tbody></table></div>
    </details>

    <details className="scenario-accordion"><summary className="cursor-pointer font-semibold">Incerteza de preços — Monte Carlo</summary><p className="mt-3 max-w-prose text-sm">2.000 cenários reprodutíveis, com erro lognormal de média preservada e componente comum por GND. Quantidades permanecem fixas. Os parâmetros abaixo são hipóteses escolhidas, não estimativas dos dados; a faixa de 5% a 95% depende dessas hipóteses.</p><div className="mt-4 flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm">Sigma do erro (%)<input className={control+" w-28"} type="number" min={0} max={100} step={1} value={Math.round(sigma*100)} onChange={e=>{setSigma(Number(e.target.value)/100);setSimulation(null);}}/></label><label className="grid gap-1 text-sm">Correlação latente por GND<input className={control+" w-28"} type="number" min={0} max={1} step={.05} value={rho} onChange={e=>{setRho(Number(e.target.value));setSimulation(null);}}/></label><label className="grid gap-1 text-sm">Semente<input className={control+" w-36"} type="number" step={1} value={seed} onChange={e=>{setSeed(Number(e.target.value));setSimulation(null);}}/></label><button type="button" className={action} onClick={()=>{try{setSimulation(monteCarlo(items,{sigma,rho,scenarios:2000,seed}));setError(null);}catch(e){setError(e instanceof Error?e.message:"Falha na simulação.");}}}>Simular preços</button></div>{simulation&&<p role="status" className="mt-3 text-sm">Base {money(simulation.baseline)} · média simulada {money(simulation.mean)} · P5 {money(simulation.p05)} · mediana {money(simulation.p50)} · P95 {money(simulation.p95)}.</p>}</details>

  </section>;
}
