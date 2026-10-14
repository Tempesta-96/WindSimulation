import {optimize} from './optimizer.js';
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function normalizeBoundary(vertices){
 if(!Array.isArray(vertices))throw Error('Click at least three outer corners before finishing.');
 const result=[];
 for(const p of vertices){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Invalid outline corner.');if(!result.length||distance(result[result.length-1],p)>.01)result.push({...p});}
 if(result.length>1&&distance(result[0],result[result.length-1])<.01)result.pop();
 return result;
}
export function boundaryCrossings(v){const pairs=[];for(let i=0;i<v.length;i++)for(let j=i+1;j<v.length;j++){if(j===i+1||(i===0&&j===v.length-1))continue;if(intersects(v[i],v[(i+1)%v.length],v[j],v[(j+1)%v.length]))pairs.push([i,j]);}return pairs;}
export const outline=plan=>plan.boundary||[{x:0,y:0},{x:plan.width,y:0},{x:plan.width,y:plan.depth},{x:0,y:plan.depth}];
const edgeDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return distance(p,{x:a.x+t*dx,y:a.y+t*dy});};
export function inside(p,plan){const vertices=outline(plan);let contained=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){const a=vertices[j],b=vertices[i];if(edgeDistance(p,a,b)<1e-8)return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)contained=!contained;}return contained;}
export function floorArea(plan){const v=outline(plan);return Math.abs(v.reduce((sum,p,i)=>{const q=v[(i+1)%v.length];return sum+p.x*q.y-q.x*p.y;},0))/2;}
export function pathInside(a,b,plan){
 const ts=[0,1],dx=b.x-a.x,dy=b.y-a.y,v=outline(plan);
 for(let i=0;i<v.length;i++){const c=v[i],d=v[(i+1)%v.length],ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;if(Math.abs(den)<1e-10)continue;const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/den,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/den;if(t>0&&t<1&&u>=0&&u<=1)ts.push(t);}
 ts.sort((x,y)=>x-y);return ts.slice(1).every((t,i)=>{const mid=(t+ts[i])/2;return inside({x:a.x+dx*mid,y:a.y+dy*mid},plan);});
}
export function intersects(a,b,c,d){
 const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x),eps=1e-9;
 const on=(p,q,r)=>Math.abs(cross(p,q,r))<eps&&r.x>=Math.min(p.x,q.x)-eps&&r.x<=Math.max(p.x,q.x)+eps&&r.y>=Math.min(p.y,q.y)-eps&&r.y<=Math.max(p.y,q.y)+eps;
 const x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
 return (x*y<0&&u*v<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
export function blocked(a,b,plan){return !pathInside(a,b,plan)||plan.elements.some(e=>{if(e.type==='wall')return intersects(a,b,e.a,e.b);if(e.type==='room')return roomEdges(e,plan).some(edge=>intersects(a,b,edge.a,edge.b));if(e.type==='furniture'){const x=Math.min(e.a.x,e.b.x),y=Math.min(e.a.y,e.b.y),w=Math.abs(e.a.x-e.b.x),h=Math.abs(e.a.y-e.b.y),corners=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];return corners.some((p,i)=>intersects(a,b,p,corners[(i+1)%4]));}return false;});}
export function validPoint(p,plan,clearance=.25){const v=outline(plan);if(!inside(p,plan)||v.some((a,i)=>edgeDistance(p,a,v[(i+1)%v.length])<clearance))return false;return !plan.elements.some(e=>{if(e.type==='furniture')return p.x>=Math.min(e.a.x,e.b.x)-clearance&&p.x<=Math.max(e.a.x,e.b.x)+clearance&&p.y>=Math.min(e.a.y,e.b.y)-clearance&&p.y<=Math.max(e.a.y,e.b.y)+clearance;if(e.type==='room')return roomEdges(e,plan).some(edge=>edgeDistance(p,edge.a,edge.b)<clearance);if(e.type!=='wall')return false;const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-e.a.x)*dx+(p.y-e.a.y)*dy)/l)):0;return distance(p,{x:e.a.x+t*dx,y:e.a.y+t*dy})<clearance;});}
export function contribution(f,p,reach,plan){const d=distance(f,p);if(d>reach||blocked(f,p,plan))return 0;let strength=Math.max(0,1-d/reach);if(f.type==='standing')strength*=Math.max(0,Math.cos(Math.atan2(p.y-f.y,p.x-f.x)-f.angle))**4;return strength;}
export function analyze(plan,config,onProgress){return optimize(plan,config,onProgress);}
export function validatePlan(raw){
 if(!raw||!Number.isFinite(raw.width)||!Number.isFinite(raw.depth)||raw.width<3||raw.width>30||raw.depth<3||raw.depth>30||!Array.isArray(raw.elements)||raw.elements.length>3000)throw Error('Invalid plan. Dimensions must be 3-30 m, with at most 3,000 elements.');
 for(const e of raw.elements){if(!['wall','door','window','furniture','occupied','room'].includes(e.type))throw Error('Unknown floor-plan element.');for(const p of [e.a,e.b])if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>raw.width||p.y>raw.depth)throw Error('An element is outside the floor-plan dimensions.');}
 for(const e of raw.elements)if(e.type==='room'){const v=rectangleCorners(e);if(Math.abs(e.a.x-e.b.x)<.2||Math.abs(e.a.y-e.b.y)<.2||!v.every((p,i)=>inside(p,raw)&&pathInside(p,v[(i+1)%4],raw)))throw Error('Rooms must be at least 0.2 m wide and deep and stay inside the house.');}
 let boundary;
 if(raw.boundary!==undefined){
  boundary=normalizeBoundary(raw.boundary);
  if(boundary.length<3||boundary.length>100)throw Error('Click 3-100 outer corners in perimeter order, then Finish outline.');
  for(const p of boundary)if(p.x<0||p.y<0||p.x>raw.width||p.y>raw.depth)throw Error('Outline corners must be within the drawing dimensions.');
  const pairs=boundaryCrossings(boundary);
  if(pairs.length){const [i,j]=pairs[0],n=boundary.length;throw Error(`Sides ${i+1}-${(i+1)%n+1} and ${j+1}-${(j+1)%n+1} cross or overlap. Use Undo corner and trace around the perimeter; the red sides show the conflict.`);}
  if(floorArea({...raw,boundary})<1)throw Error('Outline must enclose at least 1 square meter.');
 }
 if(raw.fans!==undefined){if(!Array.isArray(raw.fans)||raw.fans.length>30)throw Error('Manual fans must be a list of at most 30.');for(const f of raw.fans)if(!f||!['ceiling','standing'].includes(f.type)||!Number.isFinite(f.x)||!Number.isFinite(f.y)||!Number.isFinite(f.angle)||f.x<0||f.y<0||f.x>raw.width||f.y>raw.depth)throw Error('Invalid manual fan.');}
 return {...(raw.fans?{fans:raw.fans.map(f=>({x:f.x,y:f.y,type:f.type,angle:f.angle}))}:{}),width:raw.width,depth:raw.depth,elements:raw.elements,...(boundary?{boundary}:{})};
}

function rectangleCorners(e){const x=Math.min(e.a.x,e.b.x),y=Math.min(e.a.y,e.b.y),u=Math.max(e.a.x,e.b.x),v=Math.max(e.a.y,e.b.y);return [{x,y},{x:u,y},{x:u,y:v},{x,y:v}];}
export function roomEdges(room,plan){const v=rectangleCorners(room),edges=[];for(let i=0;i<4;i++){const a=v[i],b=v[(i+1)%4],horizontal=Math.abs(a.y-b.y)<1e-8,key=horizontal?'x':'y',other=horizontal?'y':'x',lo=Math.min(a[key],b[key]),hi=Math.max(a[key],b[key]);let spans=[[lo,hi]];for(const opening of plan.elements.filter(e=>['door','window'].includes(e.type))){if(Math.abs(opening.a[other]-a[other])>.05||Math.abs(opening.b[other]-a[other])>.05)continue;const start=Math.min(opening.a[key],opening.b[key]),end=Math.max(opening.a[key],opening.b[key]);spans=spans.flatMap(([l,h])=>end<=l||start>=h?[[l,h]]:[[l,Math.max(l,start)],[Math.min(h,end),h]].filter(([x,y])=>y-x>1e-8));}for(const [l,h] of spans)edges.push({a:{[key]:l,[other]:a[other]},b:{[key]:h,[other]:a[other]}});}return edges;}
