import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsolidationScenarios } from "../components/admin/ConsolidationScenarios";
import type { ScenarioItem } from "./consolidation-scenarios";

test("scenario surface exposes explicit simulation scope, parameters, protection and review without hiding empty states",()=>{
  const items:ScenarioItem[]=[{id:"fixture",campusId:"a",unitId:"u",unitName:"Unidade de teste",dfdId:"d",code:"123",description:"Equipamento de teste",gnd:"4.4.90.52",quantity:1,price:100,impact:4,timing:4,highlight:false,group:"curso",eligible:true,fixed10:false}];
  const html=renderToStaticMarkup(React.createElement(ConsolidationScenarios,{items,campusName:"Campus de teste",updatedAt:"2026-10-17"}));
  for(const text of ["Cenários e conferência","Exportar cenário (XLSX)","Simulação local, sem alterar os pedidos ou as avaliações oficiais","Finalidade compartilhada","Itens protegidos no corte","Monte Carlo","Comparação descritiva","Conferência cadastral","Resultado do cenário"]) assert.ok(html.includes(text),text);
  assert.equal((html.match(/role="tab"/g)||[]).length,5);
  assert.match(html,/id="scenario-tab-0"[^>]*aria-selected="true"[^>]*tabindex="0"/);
  assert.match(html,/id="scenario-panel-1"[^>]*hidden=""/);
  assert.match(html,/id="scenario-panel-0"[^>]*class="scenario-panel"/);
  assert.match(html,/aria-label="Componentes da necessidade conjunta"/);
  assert.match(html,/scope="col"/);
  assert.match(html,/disabled=""/);
  assert.doesNotThrow(()=>renderToStaticMarkup(React.createElement(ConsolidationScenarios,{items:[],campusName:"Sem itens",updatedAt:""})));
});
