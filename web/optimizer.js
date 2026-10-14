import {distance,validPoint,inside,blocked,contribution} from './model.js';

import {windSources,windInfluence} from './wind.js';

// Deterministic finite-grid search: greedy seeds followed by coordinate ascent.
export function optimize(plan,config,onProgress=()=>{}) {
 const samples=[],targets=plan.elements.filter(e=>e.type==='occupied'&&validPoint(e.a,plan,.1)).map(e=>e.a),step=Math.max(.5,Math.max(plan.width,plan.depth)/25);
 for(let y=step/2;y<plan.depth;y+=step)for(let x=step/2;x<plan.width;x+=step)if(validPoint({x,y},plan,.1))samples.push({x,y});
 if(!samples.length)throw Error('No usable floor space.');
 const openings=plan.elements.filter(e=>['door','window'].includes(e.type)&&inside(e.a,plan)&&inside(e.b,plan)).map(e=>({x:(e.a.x+e.b.x)/2,y:(e.a.y+e.b.y)/2})),vent=[];
 for(let i=0;i<openings.length;i++)for(let j=i+1;j<openings.length;j++){if(blocked(openings[i],openings[j],plan))continue;for(let t=.15;t<1;t+=.15){const p={x:openings[i].x*(1-t)+openings[j].x*t,y:openings[i].y*(1-t)+openings[j].y*t};if(validPoint(p,plan,.1))vent.push(p);}}
 const occupiedWeight=config.cooling*2;
 const probes=[...samples,...targets,...vent],activeWeight=config.even+(targets.length?occupiedWeight:0)+(vent.length?config.ventilation:0);
 if(!activeWeight)throw Error('The selected goals have no valid targets. Enable even airflow or add occupied areas / openings.');
 const naturalSources=windSources(plan,config),baseline=Float64Array.from(probes.map(p=>windInfluence(p,naturalSources,plan,config)));
 const weights=[...samples.map(()=>config.even/samples.length/activeWeight),...targets.map(()=>occupiedWeight/targets.length/activeWeight),...vent.map(()=>config.ventilation/vent.length/activeWeight)];
 const utility=(v,i)=>i<samples.length?Math.sqrt(Math.min(1,Math.max(0,v))):Math.min(1,Math.max(0,v));
 const score=field=>field.reduce((s,v,i)=>s+weights[i]*utility(v,i),0)*100;
 const options={ceiling:[],standing:[]},candidateStep=Math.max(.75,Math.max(plan.width,plan.depth)/16);
 const positions=[];
 for(let y=candidateStep/2;y<plan.depth;y+=candidateStep)for(let x=candidateStep/2;x<plan.width;x+=candidateStep)if(validPoint({x,y},plan,.35))positions.push({x,y});
 for(const p of targets)if(validPoint(p,plan,.35)&&!positions.some(q=>distance(p,q)<.1))positions.push(p);
 if(!config.manualMode)for(const p of positions){const base=probes.map(q=>contribution({...p,type:'ceiling'},q,config.reach,plan));options.ceiling.push({fan:{...p,type:'ceiling',angle:0},values:Float64Array.from(base)});const directions=[...Array.from({length:12},(_,d)=>d*Math.PI/6),...targets.filter(q=>distance(p,q)>.1).map(q=>Math.atan2(q.y-p.y,q.x-p.x))];for(const angle of new Set(directions)){options.standing.push({fan:{...p,type:'standing',angle},values:Float64Array.from(base.map((v,i)=>v*Math.max(0,Math.cos(Math.atan2(probes[i].y-p.y,probes[i].x-p.x)-angle))**4))});}}
 if(!config.manualMode&&!options.ceiling.length)throw Error('No clear location is available for the required ceiling fan.');
 const thresholds={coverage:config.targetCoverage??100,even:config.targetEven??70,cooling:config.targetCooling??70,ventilation:config.targetVentilation??60};
 const constrained=config.autoCount&&config.countPolicy==='sufficient';
 function searchValue(field,addition){
  let weighted=0,even=0,cooling=0,minimumCooling=1,occupiedDeficit=0,ventilation=0,covered=0,weak=0;
  for(let i=0;i<field.length;i++){const v=Math.max(0,field[i]+(addition?addition[i]:0)),u=utility(v,i);weighted+=weights[i]*u;if(i<samples.length){even+=u;covered+=v>=.2?1:0;weak+=Math.max(0,.2-v)/.2;}else if(i<samples.length+targets.length){cooling+=u;minimumCooling=Math.min(minimumCooling,u);occupiedDeficit+=(Math.max(0,thresholds.cooling/100-u))**2;}else ventilation+=u;}
  if(!constrained)return weighted-(targets.length?2*occupiedDeficit/targets.length:0);
  const values={even:100*even/samples.length,cooling:targets.length?100*minimumCooling:null,ventilation:vent.length?100*ventilation/vent.length:null,coverage:100*covered/samples.length};
  let deficit=0;for(const [key,target] of Object.entries(thresholds))deficit+=(key==='cooling'?4:1)*(values[key]===null?1:(Math.max(0,target-values[key])/100)**2);
  if(deficit<1e-16)return 1+weighted;
  return -deficit-(targets.length?4*occupiedDeficit/targets.length:0)-.01*weak/samples.length;
 }
 function bestAddition(type,field,chosen){let best=null,bestScore=-Infinity;for(const option of options[type]){if(chosen.some(o=>distance(o.fan,option.fan)<.8))continue;const s=searchValue(field,option.values);if(s>bestScore+1e-12){best=option;bestScore=s;}}return best;}
 function solve(ceiling,standing,reverse=false){const types=[...Array(ceiling).fill('ceiling'),...Array(standing).fill('standing')];if(reverse)types.reverse();const chosen=[],field=Float64Array.from(baseline);for(const type of types){const o=bestAddition(type,field,chosen);if(!o)return null;chosen.push(o);for(let i=0;i<field.length;i++)field[i]+=o.values[i];}
  const initialScore=score(field),initialSearchValue=searchValue(field);
  for(let pass=0;pass<3;pass++){let improved=false;for(let j=0;j<chosen.length;j++){const old=chosen[j],rest=chosen.filter((_,i)=>i!==j);for(let i=0;i<field.length;i++)field[i]-=old.values[i];const replacement=bestAddition(old.fan.type,field,rest);const oldScore=searchValue(field,old.values),newScore=searchValue(field,replacement.values);const selected=newScore>oldScore+1e-10?replacement:old;if(selected!==old)improved=true;chosen[j]=selected;for(let i=0;i<field.length;i++)field[i]+=selected.values[i];}if(!improved)break;}
  return {chosen,field,score:score(field),initialScore,initialSearchValue,searchValue:searchValue(field),ceiling,standing};
 }
 const group=(l,start,n,even=false)=>n?100*Array.from(l.field.slice(start,start+n)).reduce((s,v)=>s+(even?Math.sqrt(Math.min(1,Math.max(0,v))):Math.min(1,Math.max(0,v))),0)/n:null;
 const metrics=l=>({even:group(l,0,samples.length,true),cooling:targets.length?100*Math.min(...Array.from(l.field.slice(samples.length,samples.length+targets.length),v=>Math.min(1,Math.max(0,v)))):null,ventilation:group(l,samples.length+targets.length,vent.length),coverage:100*Array.from(l.field.slice(0,samples.length)).filter(v=>v>=.2).length/samples.length});

 const sufficient=l=>{const m=metrics(l);return Object.entries(thresholds).every(([key,target])=>m[key]!==null&&m[key]>=target-1e-8);};
 const combinations=[];
 if(config.manualMode){const fans=plan.fans||[];if(fans.length>30)throw Error('Use at most 30 manual fans.');for(const f of fans)if(!['ceiling','standing'].includes(f.type)||!Number.isFinite(f.angle)||!validPoint(f,plan,.15))throw Error('A manual fan is outside usable space or too close to a wall/furniture. Move or remove it.');}

 if(config.manualMode)combinations.push([(plan.fans||[]).filter(f=>f.type==='ceiling').length,(plan.fans||[]).filter(f=>f.type==='standing').length]);else if(config.autoCount){for(let c=1;c<=config.ceiling;c++)for(let st=0;st<=config.standing;st++)combinations.push([c,st]);}else combinations.push([config.ceiling,config.standing]);
 combinations.sort((a,b)=>a[0]+a[1]-b[0]-b[1]||a[0]-b[0]);
 const layouts=[];let completed=0,feasibleCount=null;
 for(const [c,st] of combinations){
  if(constrained&&feasibleCount!==null&&c+st>feasibleCount)break;
  let a,b=null;if(config.manualMode){const chosen=(plan.fans||[]).map(f=>({fan:{...f},values:Float64Array.from(probes.map(p=>contribution(f,p,config.reach,plan)))})),field=Float64Array.from(baseline);for(const o of chosen)for(let i=0;i<field.length;i++)field[i]+=o.values[i];a={chosen,field,score:score(field),initialScore:score(field),initialSearchValue:searchValue(field),searchValue:searchValue(field),ceiling:c,standing:st};}else{a=solve(c,st);b=st?solve(c,st,true):null;}if(b&&(!a||b.searchValue>a.searchValue))a=b;
  if(a){layouts.push(a);if(sufficient(a))feasibleCount=c+st;}
  onProgress({completed:++completed,total:combinations.length,ceiling:c,standing:st});
 }
 if(!layouts.length)throw Error('Not enough clear space for the requested fan counts. Reduce the limits.');
 const best=layouts.reduce((a,b)=>(constrained?b.searchValue>a.searchValue:b.score>a.score)?b:a),tolerance=config.autoCount&&config.countPolicy==='efficient'?(config.scoreTolerance??3):0;
 const feasible=layouts.filter(sufficient),byCount=(a,b)=>(a.ceiling+a.standing)-(b.ceiling+b.standing)||b.score-a.score;
 const isSufficient=config.autoCount&&config.countPolicy==='sufficient';
 const selected=isSufficient?(feasible.length?feasible.sort(byCount)[0]:best):layouts.filter(l=>l.score>=best.score-tolerance-1e-9).sort(byCount)[0];
 const unmet=Object.entries(thresholds).filter(([key,target])=>metrics(selected)[key]===null||metrics(selected)[key]<target-1e-8).map(([key,target])=>({goal:key,target,achieved:metrics(selected)[key]}));
 const m=metrics(selected),fans=selected.chosen.map(o=>o.fan).sort((a,b)=>config.manualMode?0:a.type===b.type?0:a.type==='ceiling'?-1:1);
 const occupiedAreas=targets.map((p,i)=>({...p,index:100*Math.min(1,Math.max(0,selected.field[samples.length+i])),target:thresholds.cooling,met:100*Math.min(1,Math.max(0,selected.field[samples.length+i]))>=thresholds.cooling-1e-8}));
 return {manualMode:!!config.manualMode,occupiedAreas,occupiedWeightMultiplier:2,naturalWind:{enabled:!!config.naturalWind,sources:naturalSources,field:Array.from(baseline.slice(0,samples.length)),direction:config.windDirection??0,strength:config.windStrength??50,reach:config.windReach??6},fans,samples,field:Array.from(selected.field.slice(0,samples.length)),step,coverage:Math.round(100*Array.from(selected.field.slice(0,samples.length)).filter(v=>v>=.2).length/samples.length),even:Math.round(m.even),cooling:m.cooling===null?null:Math.round(m.cooling),ventilation:m.ventilation===null?null:Math.round(m.ventilation),thresholds,targetsMet:sufficient(selected),unmet,weightedScore:selected.score,initialScore:selected.initialScore,initialSearchValue:selected.initialSearchValue,searchValue:selected.searchValue,bestScore:best.score,scoreTolerance:tolerance,requested:selected.ceiling+selected.standing,config,alternatives:layouts.map(l=>({ceiling:l.ceiling,standing:l.standing,total:l.ceiling+l.standing,score:l.score,...metrics(l),meetsTargets:sufficient(l),selected:l===selected})),method:config.manualMode?'Exact user-placed fan positions and directions evaluated with the same airflow proxy; no position or count optimization.':'Two insertion orders and coordinate ascent on a finite grid with 12 base directions plus directions aimed at occupied markers. Cooling constraints apply to every occupied marker; cooling shortfalls receive extra priority. Constraint mode minimizes target shortfalls while positioning fans, tests counts in ascending order, and stops after all mixes at the first feasible total. No global optimum guarantee.'};
}
