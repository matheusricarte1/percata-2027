import test from "node:test";
import assert from "node:assert/strict";
import {calculateInstitutionalPriority as calculate, institutionalGroup, compareInstitutionalGroups, INSTITUTIONAL_GROUP_LEVELS, institutionalScore} from "./institutional-priority";
import {consolidationContextKey} from "./consolidation-context";
import units from "./institutional-unit-levels.json";
test("absolute institutional precedence holds for every assessment combination",()=>{
 const groups=["administrativo","curso","laboratorio"] as const;
 for(let g=0;g<2;g++) for(let impact=1;impact<=4;impact++) for(let timing=1;timing<=4;timing++) {
  const higher=calculate({eligible:true,impact:1,timing:1,group:groups[g]});
  const lower=calculate({eligible:true,impact,timing,group:groups[g+1]});
  assert.ok(higher.score>lower.score);
 }
 const rows=[{group:"laboratorio" as const,score:252},{group:"curso" as const,score:10},{group:"administrativo" as const,score:0}];
 rows.sort((a,b)=>compareInstitutionalGroups(a.group,b.group)||b.score-a.score);
 assert.deepEqual(rows.map(r=>r.group),["administrativo","curso","laboratorio"]);
});
test("official IDs distinguish courses from management and unknown IDs remain unclassified",()=>{
 assert.equal(institutionalGroup("departamento","a0d87fe3-0ae2-4889-b099-fc8faed1d36b"),"curso");
 assert.equal(institutionalGroup("departamento","62cc320f-c59e-41c6-905a-58ddf30666bc"),"administrativo");
 assert.equal(institutionalGroup("departamento","new-id"),"nao_identificado");
 assert.equal(institutionalGroup("departamento"),"nao_identificado");
 assert.equal(institutionalGroup("laboratorio","lab"),"laboratorio");
 assert.equal(new Set(units.map(u=>u.id)).size,units.length);
 for(const unit of units) assert.ok([1,2].includes(INSTITUTIONAL_GROUP_LEVELS[institutionalGroup("departamento",unit.id)]));
});
test("invalid and unclassified assessments stay pending",()=>{
 const valid={eligible:true,impact:4,timing:4,group:"curso" as const};
 for(const change of [{eligible:false},{group:"nao_identificado" as const},{impact:NaN},{timing:5},{timing:1.5}]) assert.equal(calculate({...valid,...change}).status,"pending");
});
test("purchasing groups do not merge management, courses and laboratories",()=>{
 const input={id:"a",dfdId:"a",campusId:"c",code:"123",gnd:"3.3.90.30",unit:"UN",eligible:true,criticidade:"alta",prioridade:"deve_ter",highlight:false};
 const keys=["administrativo","curso","laboratorio"].map(institutionalGroup=>consolidationContextKey({...input,institutionalGroup}));
 assert.equal(new Set(keys).size,3);
});

test("final numeric scores enforce level bands even at extreme technical scores",()=>{
 assert.equal(institutionalScore("administrativo",0),300);
 assert.equal(institutionalScore("curso",0),200);
 assert.equal(institutionalScore("laboratorio",0),100);
 for(const n of [0,10,126,224,252,280,1e10,Number.MAX_VALUE]) {
  assert.ok(institutionalScore("laboratorio",n)! < institutionalScore("curso",0)!);
  assert.ok(institutionalScore("curso",n)! < institutionalScore("administrativo",0)!);
 }
 assert.equal(institutionalScore("curso",252),247.37);
 assert.equal(institutionalScore("laboratorio",252),147.37);
 assert.equal(institutionalScore("administrativo",252),347.37);
 for(const n of [NaN,Infinity,-1]) assert.equal(institutionalScore("curso",n),null);
 assert.equal(institutionalScore("nao_identificado",224),null);
 assert.ok(institutionalScore("curso",126)! < institutionalScore("curso",224)!);
});

test("level scoring preserves capital assessments, chefia bonus, financial adjustment and campus isolation", async()=>{
 const {calculateCapitalPriorities}=await import("./capital-priority");
 const base=[1000,1200,1500,1800,2200,25000].map((value,i)=>({key:String(i),campusId:"a",unitKey:"u",value,criticidadeLevel:4,prioridadeLevel:4,chefiaPareto:false,eligible:true}));
 const original=calculateCapitalPriorities(base);
 const highlighted=calculateCapitalPriorities(base.map((r,i)=>i===0?{...r,chefiaPareto:true}:r));
 const lowerAssessment=calculateCapitalPriorities(base.map((r,i)=>i===0?{...r,criticidadeLevel:3}:r));
 const combined=calculateCapitalPriorities([...base,...base.map(r=>({...r,key:"b"+r.key,campusId:"b",value:r.value*100}))]);
 for(const group of ["administrativo","curso","laboratorio"] as const){
  const score=(n:number)=>institutionalScore(group,n)!;
  assert.ok(score(highlighted.get("0")!.finalScore!)>score(original.get("0")!.finalScore!));
  assert.ok(score(original.get("0")!.finalScore!)>score(lowerAssessment.get("0")!.finalScore!));
  assert.ok(original.get("5")!.totalPenalty!>0);
  assert.ok(score(original.get("5")!.finalScore!)<score(original.get("0")!.finalScore!));
  assert.equal(score(combined.get("0")!.finalScore!),score(original.get("0")!.finalScore!));
 }
});
test("level scoring preserves weighted custeio assessment and value effects",async()=>{
 const {computeWeightedPriority:technical}=await import("./weighted-priority");
 for(const group of ["administrativo","curso","laboratorio"] as const){
  const score=(c:number,p:number,v:number)=>institutionalScore(group,technical(c,p,v))!;
  assert.ok(score(4,4,1000)>score(3,4,1000));
  assert.ok(score(4,4,1000)>score(4,3,1000));
  assert.ok(score(4,4,10000)>score(4,4,1000));
 }
});
