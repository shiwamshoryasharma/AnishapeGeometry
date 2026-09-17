import type {Point2,SketchEntity,SketchCurve,SketchFeature} from './types'
const EPS=1e-6,TAU=2*Math.PI
const distance=(a:Point2,b:Point2)=>Math.hypot(a[0]-b[0],a[1]-b[1])
const cross=(a:Point2,b:Point2)=>a[0]*b[1]-a[1]*b[0]
export function arcGeometry(a:Point2,m:Point2,b:Point2){
 const d=2*(a[0]*(m[1]-b[1])+m[0]*(b[1]-a[1])+b[0]*(a[1]-m[1]))
 if(Math.abs(d)<1e-9)throw Error('Arc points are collinear. Choose a point away from the chord.')
 const q=(p:Point2)=>p[0]*p[0]+p[1]*p[1]
 const center:Point2=[(q(a)*(m[1]-b[1])+q(m)*(b[1]-a[1])+q(b)*(a[1]-m[1]))/d,(q(a)*(b[0]-m[0])+q(m)*(a[0]-b[0])+q(b)*(m[0]-a[0]))/d]
 const start=Math.atan2(a[1]-center[1],a[0]-center[0]),delta=(p:Point2)=>(Math.atan2(p[1]-center[1],p[0]-center[0])-start+TAU)%TAU,end=delta(b),mid=delta(m)
 return {center,radius:distance(a,center),start,sweep:mid<end?end:end-TAU}
}
export function validateEntities(value:unknown):asserts value is SketchEntity[]{
 if(!Array.isArray(value)||value.length>256)throw Error('A sketch supports at most 256 entities.')
 const ids=new Set<string>(),point=(p:unknown)=>{if(!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>100000))throw Error('Invalid sketch point (range ±100000 mm).')}
 for(const e of value){if(!e||typeof e.id!=='string'||!e.id||e.id.length>80||ids.has(e.id))throw Error('Sketch entity IDs must be unique.');ids.add(e.id);if(e.dimension!==undefined)point(e.dimension);if(e.construction!==undefined&&typeof e.construction!=='boolean')throw Error('Invalid construction flag.')
  if(e.type==='point')point(e.position)
  else if(e.type==='circle'){point(e.center);if(!Number.isFinite(e.radius)||e.radius<.001||e.radius>100000)throw Error('Circle radius must be 0.001–100000 mm.')}
  else if(e.type==='line'||e.type==='arc'){point(e.start);point(e.end);if(distance(e.start,e.end)<EPS)throw Error('Sketch endpoints must be distinct.');if(e.type==='arc'){point(e.mid);const a=arcGeometry(e.start,e.mid,e.end);if(a.radius>100000)throw Error('Arc radius is too large.')}}
  else throw Error('Unsupported sketch entity.')
 }
}
export function rectangleEntities(a:Point2,b:Point2,prefix:string=crypto.randomUUID()):SketchEntity[]{
 const points:Point2[]=[a,[b[0],a[1]],b,[a[0],b[1]]];return points.map((start,i)=>({id:prefix+':'+i,type:'line',start:[...start],end:[...points[(i+1)%4]]}))
}
export function primitiveEntities(p:SketchFeature['parameters']):SketchEntity[]{return p.profile==='circle'?[{id:crypto.randomUUID(),type:'circle',center:[p.x,p.y],radius:p.width/2}]:rectangleEntities([p.x,p.y],[p.x+p.width,p.y+p.height])}
export function entityPoints(e:SketchEntity):Point2[]{
 if(e.type==='point')return [e.position]
 if(e.type==='line')return [e.start,e.end]
 const a=e.type==='circle'?{center:e.center,radius:e.radius,start:0,sweep:TAU}:arcGeometry(e.start,e.mid,e.end),count=Math.max(8,Math.ceil(Math.abs(a.sweep)/TAU*64))
 return Array.from({length:count+1},(_,i)=>[a.center[0]+a.radius*Math.cos(a.start+a.sweep*i/count),a.center[1]+a.radius*Math.sin(a.start+a.sweep*i/count)] as Point2)
}
export interface SketchLoop {id:string;segments:{entity:SketchCurve;reversed:boolean}[];points:Point2[];area:number;bounds:{min:Point2;max:Point2}}
export interface SketchRegion {id:string;outer:SketchLoop;holes:SketchLoop[];area:number}
const bounds=(points:Point2[])=>({min:points.reduce((a,p)=>[Math.min(a[0],p[0]),Math.min(a[1],p[1])] as Point2,[Infinity,Infinity]),max:points.reduce((a,p)=>[Math.max(a[0],p[0]),Math.max(a[1],p[1])] as Point2,[-Infinity,-Infinity])})
export function entitiesBounds(entities:SketchEntity[]){return bounds(entities.flatMap(entityPoints))}
function inside(p:Point2,points:Point2[]){let found=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])found=!found}return found}
function intersects(a:Point2,b:Point2,c:Point2,d:Point2){
 const turn=(p:Point2,q:Point2,r:Point2)=>cross([q[0]-p[0],q[1]-p[1]],[r[0]-p[0],r[1]-p[1]])
 const on=(p:Point2,q:Point2,r:Point2)=>Math.abs(turn(p,q,r))<EPS&&r[0]>=Math.min(p[0],q[0])-EPS&&r[0]<=Math.max(p[0],q[0])+EPS&&r[1]>=Math.min(p[1],q[1])-EPS&&r[1]<=Math.max(p[1],q[1])+EPS
 return (turn(a,b,c)*turn(a,b,d)<0&&turn(c,d,a)*turn(c,d,b)<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)
}
/** Closed, non-branching regions. Construction/open chains are retained but do not make faces. */
export function sketchRegions(entities:SketchEntity[]):SketchRegion[]{
 validateEntities(entities)
 const curves=entities.filter((e):e is SketchCurve=>!e.construction&&e.type!=='point'),loops:SketchLoop[]=[],used=new Set<string>()
 const makeLoop=(segments:SketchLoop['segments'])=>{
  if(loops.length>=64)throw Error('Maximum 64 closed regions per sketch.');
  let area=0;const points:Point2[]=[]
  for(const s of segments){const e=s.entity,p=entityPoints(e);if(s.reversed)p.reverse();points.push(...p.slice(0,-1));let contribution:number
   if(e.type==='circle')contribution=Math.PI*e.radius**2
   else if(e.type==='line')contribution=cross(e.start,e.end)/2
   else{const a=arcGeometry(e.start,e.mid,e.end);contribution=(a.center[0]*(e.end[1]-e.start[1])-a.center[1]*(e.end[0]-e.start[0])+a.radius**2*a.sweep)/2}
   area+=s.reversed?-contribution:contribution
  }
  if(Math.abs(area)<1e-8)throw Error('Closed profile has zero area or intersects itself.')
  if(area<0){area=-area;segments=segments.slice().reverse().map(s=>({...s,reversed:!s.reversed}));points.reverse()}
  for(let i=0;i<points.length;i++)for(let j=i+2;j<points.length;j++){if(i===0&&j===points.length-1)continue;if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))throw Error('Sketch profile intersects itself.')}
  loops.push({id:'region:'+segments.map(s=>s.entity.id).sort().join('|'),segments,points,area,bounds:bounds(points)})
 }
 for(const first of curves){if(used.has(first.id))continue;if(first.type==='circle'){used.add(first.id);makeLoop([{entity:first,reversed:false}]);continue}
  const component:SketchCurve[]=[],pending=[first];while(pending.length){const e=pending.pop()!;if(used.has(e.id))continue;used.add(e.id);component.push(e);for(const other of curves)if(other.type!=='circle'&&!used.has(other.id)&&[e.start,e.end].some(p=>distance(p,other.start)<EPS||distance(p,other.end)<EPS))pending.push(other)}
  const edges=component.filter((e):e is Extract<SketchEntity,{type:'line'|'arc'}>=>e.type==='line'||e.type==='arc'),degree=(p:Point2)=>edges.filter(e=>distance(p,e.start)<EPS||distance(p,e.end)<EPS).length
  if(edges.some(e=>degree(e.start)>2||degree(e.end)>2))throw Error('Branching profile: mark helper lines as construction or separate the contours.')
  if(edges.some(e=>degree(e.start)!==2||degree(e.end)!==2))continue
  const segments:SketchLoop['segments']=[{entity:first,reversed:false}],visited=new Set([first.id]);let end=first.end
  while(visited.size<edges.length){const next=edges.find(e=>!visited.has(e.id)&&(distance(end,e.start)<EPS||distance(end,e.end)<EPS));if(!next)throw Error('Profile wire could not close.');const reversed=distance(end,next.end)<EPS;segments.push({entity:next,reversed});visited.add(next.id);end=reversed?next.start:next.end}
  makeLoop(segments)
 }
 for(let i=0;i<loops.length;i++)for(let j=i+1;j<loops.length;j++){const a=loops[i],b=loops[j];if(a.bounds.max[0]<b.bounds.min[0]||b.bounds.max[0]<a.bounds.min[0]||a.bounds.max[1]<b.bounds.min[1]||b.bounds.max[1]<a.bounds.min[1])continue;for(let x=0;x<a.points.length;x++)for(let y=0;y<b.points.length;y++)if(intersects(a.points[x],a.points[(x+1)%a.points.length],b.points[y],b.points[(y+1)%b.points.length]))throw Error('Closed profiles overlap or intersect. Separate their boundaries.')}
 const parent=new Map<string,string>();for(const loop of loops){const outer=loops.filter(other=>other!==loop&&other.area>loop.area&&inside(loop.points[0],other.points)).sort((a,b)=>a.area-b.area)[0];if(outer)parent.set(loop.id,outer.id)}
 return loops.map(outer=>{const holes=loops.filter(l=>parent.get(l.id)===outer.id);return {id:outer.id,outer,holes,area:outer.area-holes.reduce((n,h)=>n+h.area,0)}})
}

/** Resolve a single circular region for hole placement, including converted legacy sketches. */
export function circularPlacement(p:SketchFeature['parameters']):{x:number;y:number;diameter:number}|undefined{
 if(!p.entities)return p.profile==='circle'?{x:p.x,y:p.y,diameter:p.width}:undefined
 try{const regions=sketchRegions(p.entities),r=p.defaultRegionId?regions.find(r=>r.id===p.defaultRegionId):regions.length===1?regions[0]:undefined;const e=r?.outer.segments.length===1?r.outer.segments[0].entity:undefined;return e?.type==='circle'&&!r!.holes.length?{x:e.center[0],y:e.center[1],diameter:e.radius*2}:undefined}catch{return undefined}
}
