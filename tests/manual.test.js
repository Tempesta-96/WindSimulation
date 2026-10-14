import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,validatePlan,contribution} from '../web/model.js';
const config={manualMode:true,autoCount:false,countPolicy:'manual',ceiling:1,standing:2,reach:4,even:70,cooling:100,ventilation:60};
const plan={width:8,depth:6,elements:[{type:'occupied',a:{x:5,y:3},b:{x:5,y:3}}],fans:[{type:'ceiling',x:2,y:3,angle:0},{type:'standing',x:4,y:3,angle:0}]};
test('manual calculation preserves exact fan positions and directions',()=>{const r=analyze(plan,config);assert.deepEqual(r.fans,plan.fans);assert.equal(r.manualMode,true);assert.equal(r.alternatives.length,1);const expected=plan.fans.reduce((s,f)=>s+contribution(f,{x:5,y:3},config.reach,plan),0);assert.ok(Math.abs(r.occupiedAreas[0].index-100*Math.min(1,expected))<1e-8);});
test('changing standing fan direction changes occupied airflow',()=>{const p={...plan,fans:[plan.fans[1]]},forward=analyze(p,config),backward=analyze({...p,fans:[{...p.fans[0],angle:Math.PI}]},config);assert.ok(forward.cooling>backward.cooling);});
test('manual fan lists survive plan saving and validation',()=>{assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))).fans,plan.fans);assert.throws(()=>validatePlan({...plan,fans:[{type:'ceiling',x:Infinity,y:2,angle:0}]}));});
test('invalid manual placements are rejected and no fans is allowed',()=>{assert.throws(()=>analyze({...plan,fans:[{type:'ceiling',x:0,y:0,angle:0}]},config));const r=analyze({...plan,fans:[]},config);assert.equal(r.fans.length,0);assert.ok(r.field.every(v=>v===0));});
