import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {InlineItemRow} from '../components/triagem/InlineItemRow';
import {AnalysisSession} from './analysis-session';
import type {AnalysisDfd} from './dfd-analysis';
import {summarizeDfd} from './dfd-analysis-queue';
function scenario(highlights: number, removed = false) {
  const dfd: AnalysisDfd = {id:'dfd',numero_protocolo:'DFD-TEST',requester:'Ana',sector:'Laboratório',objeto_contratacao:'Equipamentos',justificativa_contratacao:'Ensino',created_at:'2026-10-02',valor_total_estimado:500,status:'triagem',revision:'base',draft:null,items:Array.from({length:5},(_,i)=>({id:`item-${i}`,descricao:`Item ${i}`,quantidade:1,valor_unitario_estimado:100,criticidade:'alta',moscow_categoria:'deve_ter',is_highlight_item:i<highlights,remove:removed&&i===0}))};
  const session = new AnalysisSession({dfd,actorId:'actor',send:async()=>({ok:true})});
  session.start();
  const render = (index:number,compactMode=false) => renderToStaticMarkup(React.createElement(InlineItemRow,{item:dfd.items[index],dfdSummary:summarizeDfd(dfd),session,onOpenDfd:()=>{},compactMode}));
  return {render,session};
}
for(const compact of [false,true]) {
  test(`limite impede nova estrela e permite retirar destaque (${compact?'compacto':'expandido'})`,()=>{
    const {render,session}=scenario(1);
    const blocked=render(1,compact).match(/<button[^>]*aria-label="Destacar item[^>]*>/)?.[0];
    assert.ok(blocked);assert.match(blocked,/disabled/);
    const removable=render(0,compact).match(/<button[^>]*aria-label="Retirar estrela[^>]*>/)?.[0];
    assert.ok(removable);assert.doesNotMatch(removable,/disabled/);
    assert.match(render(1,compact),compact?/1\/1 estrelas/:/1 de 1 estrelas nesta DFD/);
    session.dispose();
  });
}
test('rascunho antigo excedente orienta retirar estrelas sem perder classificações',()=>{
  const {render,session}=scenario(4);assert.match(render(0),/Retire as estrelas excedentes/);assert.match(render(0),/Impacto se não atendido/);session.dispose();
});
test('estrela em item retirado libera vaga',()=>{
  const {render,session}=scenario(1,true);const button=render(1).match(/<button[^>]*aria-label="Destacar item[^>]*>/)?.[0];assert.ok(button);assert.doesNotMatch(button,/disabled/);session.dispose();
});
