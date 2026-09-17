import type {Point2,SketchEntity,SketchCurve} from './types'
import {arcGeometry,entityPoints,sketchRegions,validateEntities} from './sketch-entities'
const EPS=1e-7,TAU=Math.PI*2
const sub=(a:Point2,b:Point2):Point2=>[a[0]-b[0],a[1]-b[1]]
const dot=(a:Point2,b:Point2)=>a[0]*b[0]+a[1]*b[1]
const cross=(a:Point2,b:Point2)=>a[0]*b[1]-a[1]*b[0]
const pointAt=(e:SketchCurve,t:number):Point2=>{
 if(e.type==='line')return [e.start[0]+(e.end[0]-e.start[0])*t,e.start[1]+(e.end[1]-e.start[1])*t]
 const a=e.type==='circle'?{center:e.center,radius:e.radius,start:0,sweep:TAU}:arcGeometry(e.start,e.mid,e.end),angle=a.start+a.sweep*t
 return [a.center[0]+a.radius*Math.cos(angle),a.center[1]+a.radius*Math.sin(angle)]
}
const circleOf=(e:Exclude<SketchCurve,{type:'line'}>)=>e.type==='circle'?{center:e.center,radius:e.radius,start:0,sweep:TAU}:arcGeometry(e.start,e.mid,e.end)
function parameter(e:SketchCurve,p:Point2):number{
 if(e.type==='line'){const d=sub(e.end,e.start);return dot(sub(p,e.start),d)/dot(d,d)}
 const a=circleOf(e),angle=(Math.atan2(p[1]-a.center[1],p[0]-a.center[0])-a.start)*Math.sign(a.sweep),wrapped=(angle%TAU+TAU)%TAU
 return wrapped/Math.abs(a.sweep)
}
const contains=(e:SketchCurve,p:Point2)=>{const t=parameter(e,p);return e.type==='circle'||(t>=-EPS&&t<=1+EPS)}
/** Intersections of supporting analytic curves; callers choose which finite extents apply. */
function intersections(a:SketchCurve,b:SketchCurve):Point2[]{
 if(a.type==='line'&&b.type==='line'){
  const u=sub(a.end,a.start),v=sub(b.end,b.start),den=cross(u,v)
  if(Math.abs(den)<EPS)return []
  return [pointAt(a,cross(sub(b.start,a.start),v)/den)]
 }
 if(a.type==='line'||b.type==='line'){
  const line=a.type==='line'?a:b,circle=a.type==='line'?b:a
  if(line.type!=='line'||circle.type==='line')return []
  const c=circleOf(circle),u=sub(line.end,line.start),v=sub(line.start,c.center),aa=dot(u,u),bb=2*dot(u,v),cc=dot(v,v)-c.radius*c.radius,disc=bb*bb-4*aa*cc
  if(disc<-EPS)return [];const root=Math.sqrt(Math.max(0,disc))
  return [pointAt(line,(-bb-root)/(2*aa)),pointAt(line,(-bb+root)/(2*aa))]
 }
 const ca=circleOf(a),cb=circleOf(b),v=sub(cb.center,ca.center),d=Math.hypot(...v)
 if(d<EPS||d>ca.radius+cb.radius+EPS||d<Math.abs(ca.radius-cb.radius)-EPS)return []
 const x=(ca.radius**2-cb.radius**2+d*d)/(2*d),h=Math.sqrt(Math.max(0,ca.radius**2-x*x)),base:Point2=[ca.center[0]+v[0]*x/d,ca.center[1]+v[1]*x/d]
 return [[base[0]-v[1]*h/d,base[1]+v[0]*h/d],[base[0]+v[1]*h/d,base[1]-v[0]*h/d]]
}
function piece(e:SketchCurve,a:number,b:number,id=e.id):SketchEntity{
 const common={id,construction:e.construction,...(e.dimension?{dimension:e.dimension}:{})}
 return e.type==='line'?{...common,type:'line',start:pointAt(e,a),end:pointAt(e,b)}:{...common,type:'arc',start:pointAt(e,a),mid:pointAt(e,(a+b)/2),end:pointAt(e,b)}
}
const unique=(values:number[])=>values.sort((a,b)=>a-b).filter((n,i,all)=>!i||Math.abs(n-all[i-1])>EPS)
const replace=(entities:SketchEntity[],id:string,parts:SketchEntity[])=>{const result=entities.flatMap(e=>e.id===id?parts:[e]);validateEntities(result);return result}
const target=(entities:SketchEntity[],id:string)=>{const e=entities.find(e=>e.id===id);if(!e)throw Error('Select an existing sketch entity.');if(e.type==='point')throw Error('Select a curve; a point cannot be trimmed, extended or split.');return e}
export function trimEntity(entities:SketchEntity[],id:string,at:Point2):SketchEntity[]{
 const e=target(entities,id),cuts=unique(entities.filter((v):v is SketchCurve=>v.id!==id&&v.type!=='point').flatMap(v=>intersections(e,v).filter(p=>contains(e,p)&&contains(v,p)).map(p=>parameter(e,p))).filter(t=>e.type==='circle'||t>EPS&&t<1-EPS))
 const t=parameter(e,at)
 if(e.type==='circle'){
  if(cuts.length<2)throw Error('Trim needs two distinct circle intersections.')
  const next=cuts.findIndex(v=>v>t),hi=next<0?cuts[0]+1:cuts[next],lo=next<0?cuts.at(-1)!:next===0?cuts.at(-1)!-1:cuts[next-1]
  return replace(entities,id,[piece(e,hi,lo+1)])
 }
 if(!cuts.length)throw Error('Trim needs an intersection with another sketch entity.')
 const stops=[0,...cuts,1],index=stops.findIndex((v,i)=>i<stops.length-1&&t>=v-EPS&&t<=stops[i+1]+EPS)
 if(index<0)throw Error('Click the portion of the curve to trim.')
 const parts:SketchEntity[]=[]
 if(stops[index]>EPS)parts.push(piece(e,0,stops[index]))
 if(stops[index+1]<1-EPS)parts.push(piece(e,stops[index+1],1,parts.length?crypto.randomUUID():id))
 return replace(entities,id,parts)
}
export function splitEntity(entities:SketchEntity[],id:string,at:Point2):SketchEntity[]{
 const e=target(entities,id),t=parameter(e,at)
 if(e.type==='circle')return replace(entities,id,[piece(e,t,t+.5),piece(e,t+.5,t+1,crypto.randomUUID())])
 if(t<=EPS||t>=1-EPS)throw Error('Split at a point inside the entity, away from its endpoints.')
 return replace(entities,id,[piece(e,0,t),piece(e,t,1,crypto.randomUUID())])
}
export function extendEntity(entities:SketchEntity[],id:string,at:Point2):SketchEntity[]{
 const e=target(entities,id);if(e.type==='circle')throw Error('A full circle has no endpoint to extend.')
 const end=Math.hypot(...sub(at,e.end))<=Math.hypot(...sub(at,e.start)),period=e.type==='arc'?TAU/Math.abs(arcGeometry(e.start,e.mid,e.end).sweep):0
 const values=entities.filter((v):v is SketchCurve=>v.id!==id&&v.type!=='point').flatMap(v=>intersections(e,v).filter(p=>contains(v,p)).map(p=>{const t=parameter(e,p);return e.type==='arc'&&!end&&t>EPS?t-period:t})).filter(t=>end?t>1+EPS:t<-EPS)
 const t=end?Math.min(...values):Math.max(...values)
 if(!Number.isFinite(t))throw Error('No boundary can be reached from this endpoint.')
 if(e.type==='arc'&&(end?t:1-t)>=period-EPS)throw Error('Extending would close or overlap the arc.')
 return replace(entities,id,[piece(e,end?0:t,end?t:1)])
}
function transformed(entities:SketchEntity[],point:(p:Point2)=>Point2,scale:number,copy=false):SketchEntity[]{
 const result=entities.map((e):SketchEntity=>{const common={...e,id:copy?crypto.randomUUID():e.id,...(e.dimension?{dimension:point(e.dimension)}:{})};return e.type==='point'?{...common,type:'point',position:point(e.position)}:e.type==='circle'?{...common,type:'circle',center:point(e.center),radius:e.radius*scale}:e.type==='arc'?{...common,type:'arc',start:point(e.start),mid:point(e.mid),end:point(e.end)}:{...common,type:'line',start:point(e.start),end:point(e.end)}})
 validateEntities(result);return result
}
export function rotateEntities(entities:SketchEntity[],pivot:Point2,degrees:number,copy=false):SketchEntity[]{
 if(!Number.isFinite(degrees)||Math.abs(degrees)>360)throw Error('Use an angle between -360 and 360 degrees.')
 const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a)
 return transformed(entities,p=>[pivot[0]+(p[0]-pivot[0])*c-(p[1]-pivot[1])*s,pivot[1]+(p[0]-pivot[0])*s+(p[1]-pivot[1])*c],1,copy)
}
export function scaleEntities(entities:SketchEntity[],pivot:Point2,factor:number,copy=false):SketchEntity[]{
 if(!Number.isFinite(factor)||factor<.001||factor>1000)throw Error('Scale factor must be 0.001–1000.')
 return transformed(entities,p=>[pivot[0]+(p[0]-pivot[0])*factor,pivot[1]+(p[1]-pivot[1])*factor],factor,copy)
}
export function circularPatternEntities(entities:SketchEntity[],pivot:Point2,count:number,angle:number):SketchEntity[]{
 if(!Number.isInteger(count)||count<2||count>64||entities.length*count>256||!Number.isFinite(angle)||Math.abs(angle)<.01||Math.abs(angle)>360)throw Error('Circular pattern needs 2–64 instances, a nonzero angle up to 360°, and at most 256 entities.')
 return Array.from({length:count-1},(_,i)=>rotateEntities(entities,pivot,angle*(i+1)/(Math.abs(angle)===360?count:count-1),true)).flat()
}
/** Positive offset is outward for closed contours; left of an open line. */
export function offsetEntities(entities:SketchEntity[],offset:number):SketchEntity[]{
 if(!Number.isFinite(offset)||Math.abs(offset)<.001||Math.abs(offset)>100000)throw Error('Offset must be nonzero and within ±100000 mm.')
 if(entities.length===1){
  const e=entities[0],id=crypto.randomUUID();if(e.type==='point')throw Error('Offset requires a curve, not a point.')
  if(e.type!=='line'){
   const a=circleOf(e),r=a.radius+offset;if(r<.001)throw Error('Offset collapses the curve radius.')
   return transformed([e],p=>[a.center[0]+(p[0]-a.center[0])*r/a.radius,a.center[1]+(p[1]-a.center[1])*r/a.radius],r/a.radius,true)
  }
  const u=sub(e.end,e.start),d=Math.hypot(...u),shift=(p:Point2):Point2=>[p[0]-u[1]/d*offset,p[1]+u[0]/d*offset]
  const result:SketchEntity[]=[{...e,id,start:shift(e.start),end:shift(e.end)}];validateEntities(result);return result
 }
 if(entities.some(e=>e.type!=='line'))throw Error('Offset one circle/arc, one line, or a closed straight-sided contour.')
 const regions=sketchRegions(entities)
 if(regions.length!==1||regions[0].holes.length||regions[0].outer.segments.length!==entities.length)throw Error('Select one complete closed straight-sided contour for offset.')
 const edges=regions[0].outer.segments.map(s=>{const e=s.entity;if(e.type!=='line')throw Error('Select a line contour.');return {start:s.reversed?e.end:e.start,end:s.reversed?e.start:e.end}})
 const shifted=edges.map((e,i):SketchCurve=>{const u=sub(e.end,e.start),d=Math.hypot(...u),p=(a:Point2):Point2=>[a[0]+u[1]*offset/d,a[1]-u[0]*offset/d];return {id:'offset'+i,type:'line',start:p(e.start),end:p(e.end)}})
 const vertices=shifted.map((e,i)=>{const p=intersections(shifted[(i+shifted.length-1)%shifted.length],e)[0];if(!p)throw Error('Offset cannot join collinear corners.');return p})
 const result=vertices.map((start,i):SketchEntity=>({id:crypto.randomUUID(),type:'line',start,end:vertices[(i+1)%vertices.length],construction:entities[0].construction}))
 for(let i=0;i<result.length;i++){const e=result[i];if(e.type==='line'&&dot(sub(e.end,e.start),sub(edges[i].end,edges[i].start))<=EPS)throw Error('Offset collapses or reverses the contour. Reduce the distance.')}
 validateEntities(result);if(sketchRegions(result).length!==1)throw Error('Offset produces an invalid contour.')
 return result
}
export function windowSelection(entities:SketchEntity[],a:Point2,b:Point2,crossing:boolean):string[]{
 const lo:Point2=[Math.min(a[0],b[0]),Math.min(a[1],b[1])],hi:Point2=[Math.max(a[0],b[0]),Math.max(a[1],b[1])],inside=(p:Point2)=>p[0]>=lo[0]-EPS&&p[0]<=hi[0]+EPS&&p[1]>=lo[1]-EPS&&p[1]<=hi[1]+EPS
 const corners:Point2[]=[lo,[hi[0],lo[1]],hi,[lo[0],hi[1]]],borders=corners.map((start,i):SketchCurve=>({id:'window'+i,type:'line',start,end:corners[(i+1)%4]}))
 return entities.filter(e=>{
  if(e.type==='point')return inside(e.position)
  const points=entityPoints(e)
  if(e.type!=='line'){const c=circleOf(e);for(let i=0;i<4;i++){const p:Point2=[c.center[0]+c.radius*Math.cos(i*Math.PI/2),c.center[1]+c.radius*Math.sin(i*Math.PI/2)];if(contains(e,p))points.push(p)}}
  if(points.every(inside))return true
  return crossing&&(points.some(inside)||borders.some(border=>intersections(e,border).some(p=>contains(e,p)&&contains(border,p))))
 }).map(e=>e.id)
}
