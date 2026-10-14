import {outline,inside,distance,pathInside} from './model.js';
export function roomCorners(room){const x=Math.min(room.a.x,room.b.x),y=Math.min(room.a.y,room.b.y),u=Math.max(room.a.x,room.b.x),v=Math.max(room.a.y,room.b.y);return [{x,y},{x:u,y},{x:u,y:v},{x,y:v}];}
export function structureEdges(plan,exclude=-1){const v=outline(plan),edges=v.map((a,i)=>({a,b:v[(i+1)%v.length]}));plan.elements.forEach((e,i)=>{if(i===exclude)return;if(e.type==='wall')edges.push(e);if(e.type==='room'){const c=roomCorners(e);c.forEach((a,j)=>edges.push({a,b:c[(j+1)%4]}));}});return edges;}
export function snapPoint(p,plan,exclude=-1,tolerance=.3){let best={...p},min=tolerance;for(const {a,b} of structureEdges(plan,exclude)){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0,q={x:a.x+t*dx,y:a.y+t*dy},d=distance(p,q);if(d<min){min=d;best=q;}}return best;}
export function wallEnd(a,p,plan,orthogonal=true,snap=true){let b=snap?snapPoint(p,plan):{...p};if(orthogonal){if(Math.abs(p.x-a.x)>=Math.abs(p.y-a.y))b.y=a.y;else b.x=a.x;}return b;}
export function roomFits(room,plan){const v=roomCorners(room);return v.every((p,i)=>inside(p,plan)&&pathInside(p,v[(i+1)%4],plan));}
export function roomEnd(a,p,plan,{square=false,snap=true,exclude=-1}={}){
 let b={...p};
 if(snap){let dx=.3,dy=.3;for(const e of structureEdges(plan,exclude)){if(Math.abs(e.a.x-e.b.x)<1e-8&&p.y>=Math.min(e.a.y,e.b.y)-.3&&p.y<=Math.max(e.a.y,e.b.y)+.3&&Math.abs(p.x-e.a.x)<dx){dx=Math.abs(p.x-e.a.x);b.x=e.a.x;}if(Math.abs(e.a.y-e.b.y)<1e-8&&p.x>=Math.min(e.a.x,e.b.x)-.3&&p.x<=Math.max(e.a.x,e.b.x)+.3&&Math.abs(p.y-e.a.y)<dy){dy=Math.abs(p.y-e.a.y);b.y=e.a.y;}}}
 if(square){const size=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y));b={x:a.x+(p.x<a.x?-1:1)*size,y:a.y+(p.y<a.y?-1:1)*size};}
 if(roomFits({a,b},plan))return b;
 let low=0,high=1;for(let i=0;i<35;i++){const t=(low+high)/2,q={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(roomFits({a,b:q},plan))low=t;else high=t;}
 return {x:a.x+(b.x-a.x)*low,y:a.y+(b.y-a.y)*low};
}
