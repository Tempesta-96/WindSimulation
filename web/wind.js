import {outline,inside,distance,blocked} from './model.js';

// Direction is where the wind travels, clockwise from right on the plan.
export function windSources(plan,config){
 if(!config.naturalWind)return [];
 const angle=(config.windDirection??0)*Math.PI/180,dx=Math.cos(angle),dy=Math.sin(angle),sources=[];
 for(const opening of plan.elements.filter(e=>['window','door'].includes(e.type))){
  const center={x:(opening.a.x+opening.b.x)/2,y:(opening.a.y+opening.b.y)/2};
  let origin=null,nearest=.15;const vertices=outline(plan);
  for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],ex=b.x-a.x,ey=b.y-a.y,l=ex*ex+ey*ey,t=l?Math.max(0,Math.min(1,((center.x-a.x)*ex+(center.y-a.y)*ey)/l)):0,q={x:a.x+t*ex,y:a.y+t*ey},d=distance(center,q);if(d<nearest){nearest=d;origin=q;}}
  if(!origin)continue;
  const entry={x:origin.x+dx*.04,y:origin.y+dy*.04},outside={x:origin.x-dx*.04,y:origin.y-dy*.04};
  if(!inside(entry,plan)||inside(outside,plan))continue;
  sources.push({...entry,angle,width:distance(opening.a,opening.b)});
 }
 return sources;
}
export function windInfluence(p,sources,plan,config){
 const strength=(config.windStrength??50)/100,reach=config.windReach??6;
 return sources.reduce((sum,s)=>{const dx=p.x-s.x,dy=p.y-s.y,forward=dx*Math.cos(s.angle)+dy*Math.sin(s.angle),lateral=Math.abs(-dx*Math.sin(s.angle)+dy*Math.cos(s.angle));if(forward<0||forward>reach||blocked(s,p,plan))return sum;const spread=Math.max(.15,s.width/2+forward*.2);return sum+strength*(1-forward/reach)*Math.exp(-((lateral/spread)**2));},0);
}
