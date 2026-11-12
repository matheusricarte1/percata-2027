import test from "node:test";
import assert from "node:assert/strict";
import { concentration, priceSignals } from "./consolidation-analytics";
test("concentration handles empty, zero, equality and concentrated portfolios",()=>{
 assert.equal(concentration([]).effectiveCount,0);
 assert.equal(concentration([0,0]).pareto80Count,0);
 assert.equal(concentration([10,10,10,10]).gini,0);
 assert.equal(concentration([10,10,10,10]).effectiveCount,4);
 assert.equal(concentration([0,0,100]).pareto80Count,1);
 assert.ok(Math.abs(concentration([0,0,100]).gini-2/3)<1e-12);
});
const rows=(prices:number[])=>prices.map((price,i)=>({id:String(i),campusId:"a",code:"123",unit:"UN",gnd:"4.4.90.52",price}));
test("MAD zero is unavailable even when prices differ",()=>{
 const r=priceSignals(rows([100,100,100,100,100,100,100,1000])).get("7")!;
 assert.equal(r.status,"zero_mad"); assert.equal(r.z,undefined); assert.equal(r.flagged,false);
});
test("price comparison isolates campus and supply unit, flags invalid prices",()=>{
 const r=rows([90,95,100,105,110,115,120,10000]);
 assert.equal(priceSignals(r).get("7")?.flagged,true);
 assert.equal(priceSignals(r.map((x,i)=>i===7?{...x,campusId:"b"}:x)).get("7")?.status,"insufficient");
 assert.equal(priceSignals(r.map((x,i)=>i===7?{...x,unit:"CX"}:x)).get("7")?.status,"insufficient");
 assert.equal(priceSignals(rows([0])).get("0")?.status,"invalid");
});
