import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineItemRow } from "../components/triagem/InlineItemRow";
import { AnalysisSession } from "./analysis-session";
import { queueFromWorkspace } from "./dfd-analysis-queue";
import type { AnalysisWorkspaceData } from "./dfd-analysis";

test("classificação inline distingue pendência, mantém significado e respeita bloqueios", () => {
 const item = {id:"item",descricao:"Papel",quantidade:2,unidade_medida:"resma",codigo_tce:"123",valor_unitario_estimado:10,criticidade:null,moscow_categoria:null,is_highlight_item:false};
 const dfd = {id:"dfd",numero_protocolo:"DFD-1",objeto_contratacao:"Papel",justificativa_contratacao:"Uso",status:"triagem",requester:"Ana",sector:"Setor",created_at:"2026-09-01",valor_total_estimado:20,revision:"base",items:[item],draft:null};
 const data: AnalysisWorkspaceData = {actorId:"viewer",role:"chefia",calendar:null,dfds:[dfd]};
 const summary = queueFromWorkspace(data).people[0].dfds[0];
 const session = new AnalysisSession({dfd,actorId:"viewer",send:async()=>({ok:false}),storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
 const render = (busy=false) => renderToStaticMarkup(React.createElement(InlineItemRow,{item,dfdSummary:summary,session,busy,onOpenDfd:()=>{}}));
 try {
   let html=render();
   assert.equal((html.match(/type="range"[^>]*disabled=""/g)||[]).length,2);
   session.start(); html=render();
   assert.match(html,/value="0"/); assert.match(html,/Postergado/);
   assert.equal((html.match(/aw-slider-idle/g)||[]).length,2);
   assert.match(html,/aw-item-stats/);
   assert.match(html,/Se este item não for comprado, o que acontece na unidade\?/);
   assert.match(html,/Impacto da falta do item/);
   assert.match(html,/Quando atender/);
   assert.match(html,/Para a compra planejada do próximo ano, quanto este item precisa entrar\?/);
   assert.match(html,/Atividade segue/);
   assert.match(html,/Pode parar a atividade/);
   assert.match(html,/Pode ficar para depois/);
   assert.match(html,/Tem que entrar/);
   assert.match(html,/Destaque estratégico/);
   assert.match(html,/até 20% dos itens da DFD/);
   assert.match(html,/Quantidade/); assert.match(html,/Preço unitário/); assert.match(html,/Código/);
   assert.match(html,/2 resma/); assert.match(html,/10,00/); assert.match(html,/>123<\/strong>/); assert.doesNotMatch(html,/CATMAT/);
   assert.match(html,/href="\/dfd\/dfd"[^>]*target="_blank"/);
   assert.doesNotMatch(html,/aw-item-save-row/);
   session.updateItem("item",{moscow_categoria:"nao_tera_agora"}); html=render();
   assert.match(html,/aria-valuetext="Postergado"/); assert.match(html,/value="1"/);
   assert.match(html,/aw-item-save-row/); assert.match(html,/Salvar alteração/);
   assert.equal((html.match(/aw-slider-idle/g)||[]).length,1);
   html=render(true);
   assert.equal((html.match(/type="range"[^>]*disabled=""/g)||[]).length,2);
   assert.equal((html.match(/<button[^>]*disabled=""[^>]*aw-slider-step-btn/g)||[]).length,10);
 } finally {session.dispose();}
});

test("item classificado oferece uma visão recolhida reabrível sem esconder o significado das decisões", () => {
 const item = {id:"compact",descricao:"Mesa de reunião",quantidade:1,unidade_medida:"UN",codigo_tce:"123",valor_unitario_estimado:100,criticidade:"alta" as const,moscow_categoria:"deve_ter" as const,is_highlight_item:false};
 const dfd = {id:"dfd-compact",numero_protocolo:"DFD-2",objeto_contratacao:"Mesa",justificativa_contratacao:"Uso",status:"triagem" as const,requester:"Ana",sector:"Setor",created_at:"2026-09-01",valor_total_estimado:100,revision:"base",items:[item],draft:null};
 const data: AnalysisWorkspaceData = {actorId:"viewer",role:"chefia",calendar:null,dfds:[dfd]};
 const summary = queueFromWorkspace(data).people[0].dfds[0];
 const session = new AnalysisSession({dfd,actorId:"viewer",send:async()=>({ok:true,draft:{id:"draft",revision:1,base_revision:"base",updated_at:"2026-09-01T00:00:00.000Z",payload:{items:[item],reason:""}}}),storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
 try {
   session.start();
   const html=renderToStaticMarkup(React.createElement(InlineItemRow,{item,dfdSummary:summary,session,onOpenDfd:()=>{},initiallyCollapsed:true}));
   assert.match(html,/data-inline-item-toggle/);
   assert.match(html,/aria-expanded="false"/);
   assert.match(html,/Impacto · Alto/);
   assert.match(html,/Quando · Essencial/);
   assert.doesNotMatch(html,/aw-item-decision/);
 } finally {session.dispose();}
});

test("visão rápida recolhe também uma pendência sem simular classificação", () => {
 const item = {id:"pending-compact",descricao:"Cadeira",quantidade:1,valor_unitario_estimado:50,criticidade:null,moscow_categoria:null,is_highlight_item:false};
 const dfd = {id:"dfd-pending",numero_protocolo:"DFD-3",objeto_contratacao:"Cadeira",justificativa_contratacao:"Uso",status:"triagem" as const,requester:"Ana",sector:"Setor",created_at:"2026-09-01",valor_total_estimado:50,revision:"base",items:[item],draft:null};
 const data: AnalysisWorkspaceData = {actorId:"viewer",role:"chefia",calendar:null,dfds:[dfd]};
 const summary = queueFromWorkspace(data).people[0].dfds[0];
 const session = new AnalysisSession({dfd,actorId:"viewer",send:async()=>({ok:false}),storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
 try {
   session.start();
   const html=renderToStaticMarkup(React.createElement(InlineItemRow,{item,dfdSummary:summary,session,onOpenDfd:()=>{},initiallyCollapsed:true,compactMode:true}));
   assert.match(html,/Impacto pendente/); assert.match(html,/Quando atender pendente/);
   assert.match(html,/aria-expanded="false"/); assert.doesNotMatch(html,/aw-item-decision/);
 } finally {session.dispose();}
});

test("itens em lote alterna a visão compacta, sem tentar homologar uma seleção vazia", () => {
 const workspace = readFileSync(join(process.cwd(), "src/components/triagem/AnalysisWorkspace.tsx"), "utf8");
 assert.match(workspace, /Visão compacta ativa/);
 assert.match(workspace, /onClick=\{\(\) => setCompactItems\(\(current\) => !current\)\}/);
 assert.doesNotMatch(workspace, /Visão compacta[\s\S]{0,360}prepareBatch\(\)/);
});

test("retirar o último item expõe a devolução da DFD com orientação ao solicitante", () => {
 const drawer = readFileSync(join(process.cwd(), "src/components/triagem/QuickItemDrawer.tsx"), "utf8");
 assert.match(drawer, /open=\{item\.remove\}/);
 assert.match(drawer, /Orientação para o solicitante/);
 assert.match(drawer, /Devolver DFD inteira para correção/);
});
