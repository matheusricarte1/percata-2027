import test from "node:test";
import assert from "node:assert/strict";
import { scoreScenario, budgetScenario, monteCarlo, unitComparisons, dataIssues, type ScenarioItem, type ConfirmedNeed } from "./consolidation-scenarios";
const portfolio=():ScenarioItem[] => [100,120,150,180,200,25000,5000,5000,5000,5000,5000].map((price,i)=>({id:String(i),campusId:"a",unitId:"u",unitName:"Unidade",dfdId:String(i%3),code:"123",description:"Equipamento",gnd:"4.4.90.52",quantity:1,price,impact:4,timing:4,highlight:false,group:"curso",eligible:true,fixed10:false}));
const need:ConfirmedNeed={id:"need",title:"Necessidade",purpose:"Equipamentos para a mesma finalidade confirmada",itemIds:["6","7","8","9","10"],confirmed:true,impact:4,timing:4,highlight:false};
test("confirmed need combines value and evaluates capital once without mutating source items",()=>{
 const items=portfolio(), snapshot=JSON.stringify(items);
 const grouped=scoreScenario(items,[need]);
 const combined=grouped.find(r=>r.id==="need")!;
 assert.equal(combined.value,25000); assert.equal(combined.itemIds.length,5);
 assert.equal(grouped.length,7); assert.equal(JSON.stringify(items),snapshot);
 assert.equal(grouped.find(r=>r.id==="5")?.technical,combined.technical);
});
test("groups reject ambiguity, overlap, cross-unit and unconfirmed associations",()=>{
 for(const change of [{confirmed:false},{purpose:""},{itemIds:["6","6"]},{itemIds:["absent","6"]}]) assert.throws(()=>scoreScenario(portfolio(),[{...need,...change}]));
 assert.throws(()=>scoreScenario(portfolio().map(i=>i.id==="6"?{...i,unitId:"other"}:i),[need]));
 assert.throws(()=>scoreScenario(portfolio(),[need,{...need,id:"second"}]));
 assert.throws(()=>scoreScenario(portfolio().map(i=>i.id==="6"?{...i,campusId:"b"}:i),[need]));
});
test("budget heuristic respects confirmed bundles, protected members and actual cut",()=>{
 const rows=scoreScenario(portfolio(),[need],"official",["6"]);
 const cut=budgetScenario(rows,50);
 assert.ok(!cut.removedIds.includes("need"));
 assert.equal(cut.cut+cut.retained,cut.total);
 assert.equal(cut.retention[0].retained,cut.retained);
 assert.equal(budgetScenario(rows,0).removedIds.length,0);
 assert.throws(()=>budgetScenario(rows,101));
 const all=budgetScenario(rows,100); assert.ok(all.shortfall>=25000);
});
test("additive alternative remains explicit and preserves institutional score bands",()=>{
 const rows=scoreScenario(portfolio(),[],"additive");
 assert.equal(rows[0].technical,280); assert.equal(rows[0].score,250);
 assert.equal(scoreScenario(portfolio().map(i=>({...i,fixed10:true})),[],"additive")[0].technical,10);
});
test("Monte Carlo is reproducible, preserves baseline at zero sigma and rejects mixed campuses",()=>{
 const options={sigma:0,rho:.3,scenarios:100,seed:42};
 const zero=monteCarlo(portfolio(),options);
 assert.equal(zero.p05,zero.baseline); assert.equal(zero.p95,zero.baseline);
 const variable={...options,sigma:.15,scenarios:1000};
 assert.deepEqual(monteCarlo(portfolio(),variable),monteCarlo(portfolio(),variable));
 const simulated=monteCarlo(portfolio(),variable);
 assert.ok(simulated.p05<simulated.p95);
 assert.ok(Math.abs(simulated.mean/simulated.baseline-1)<.05);
 assert.throws(()=>monteCarlo(portfolio().map((i,n)=>n===0?{...i,campusId:"b"}:i),options));
});
test("unit comparisons bootstrap entire DFDs and report insufficient clusters",()=>{
 const one=unitComparisons(portfolio().map(i=>({...i,dfdId:"single"})));
 assert.equal(one.units[0].low,null);
 const several=unitComparisons(portfolio());
 assert.equal(several.units[0].dfds,3); assert.equal(several.units[0].mean,1);
 assert.match(several.units[0].status,/Sem variação/);
 assert.deepEqual(unitComparisons(portfolio()),several);
});
test("data issues identify questionable capital consumption and low estimates without correction",()=>{
 const item={...portfolio()[0],description:"PAPEL - SULFITE A4",price:1};
 assert.equal(dataIssues(item).length,2); assert.equal(item.gnd,"4.4.90.52");
});
