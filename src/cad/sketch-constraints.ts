import type {Point2,SketchEntity} from './types'
import {arcGeometry,validateEntities} from './sketch-entities'

export interface SketchPointRef {entityId:string;point:'start'|'end'|'center'|'position'}
export type SketchConstraint = {id:string}&(
 |{type:'horizontal'|'vertical';entityId:string}
 |{type:'length'|'radius';entityId:string;value:number}
 |{type:'parallel'|'perpendicular'|'equal'|'concentric'|'tangent';entityIds:[string,string]}
 |{type:'angle';entityIds:[string,string];value:number}
 |{type:'coincident';first:SketchPointRef;second:SketchPointRef}
 |{type:'distance';first:SketchPointRef;second:SketchPointRef;value:number}
 |{type:'origin';point:SketchPointRef}
 |{type:'coordinate-x'|'coordinate-y';point:SketchPointRef;value:number}
 |{type:'position';point:SketchPointRef;position:Point2}
 |{type:'fixed';entityId:string;geometry:SketchEntity}
)
export const constraintNames:Record<SketchConstraint['type'],string>={origin:'Coincident with origin','coordinate-x':'X distance from origin','coordinate-y':'Y distance from origin',horizontal:'Horizontal',vertical:'Vertical',length:'Length',radius:'Radius',parallel:'Parallel',perpendicular:'Perpendicular',equal:'Equal',concentric:'Concentric',tangent:'Tangent',angle:'Angle',coincident:'Coincident',distance:'Distance',position:'Fix point',fixed:'Fix geometry'}
export function constraintEntityIds(c:SketchConstraint):string[]{
 if('entityId'in c)return [c.entityId]
 if('entityIds'in c)return c.entityIds
 if('point'in c)return [c.point.entityId]
 return [c.first.entityId,c.second.entityId]
}
const distance=(a:Point2,b:Point2)=>Math.hypot(a[0]-b[0],a[1]-b[1])
export function curveCircle(e:SketchEntity){if(e.type==='line'||e.type==='point')throw Error('Select a circle or arc.');return e.type==='circle'?{center:e.center,radius:e.radius}:arcGeometry(e.start,e.mid,e.end)}
export function constraintPoint(entities:SketchEntity[],ref:SketchPointRef):Point2{
 if(!ref||typeof ref!=='object')throw Error('Invalid constraint point reference.')
 const e=entities.find(e=>e.id===ref.entityId);if(!e)throw Error('Constraint references a missing sketch entity.')
 if(ref.point==='position'&&e.type==='point')return e.position
 if(ref.point==='center'&&(e.type==='circle'||e.type==='arc'))return curveCircle(e).center
 if((ref.point==='start'||ref.point==='end')&&(e.type==='line'||e.type==='arc'))return e[ref.point]
 throw Error('Constraint point is not available on this entity.')
}
export function validateConstraints(entities:SketchEntity[],input:unknown):asserts input is SketchConstraint[]{
 validateEntities(entities)
 if(!Array.isArray(input)||input.length>512)throw Error('A sketch supports at most 512 constraints.')
 const ids=new Set<string>(),entity=(id:unknown)=>{const e=entities.find(e=>e.id===id);if(!e)throw Error('Constraint references a missing sketch entity.');return e}
 for(const value of input){
  const c=value as SketchConstraint
  if(!c||typeof c.id!=='string'||!c.id||c.id.length>100||ids.has(c.id)||!Object.hasOwn(constraintNames,c.type))throw Error('Invalid or duplicate sketch constraint.')
  ids.add(c.id)
  if('entityId'in c)entity(c.entityId)
  if(['parallel','perpendicular','equal','concentric','tangent','angle'].includes(c.type)){
   if(!('entityIds'in c)||!Array.isArray(c.entityIds)||c.entityIds.length!==2||c.entityIds[0]===c.entityIds[1])throw Error('Select two distinct entities.')
   const [a,b]=c.entityIds.map(entity)
   if(a.type==='point'||b.type==='point')throw Error('This constraint requires lines or circular curves.')
   if(['parallel','perpendicular','angle'].includes(c.type)&&(a.type!=='line'||b.type!=='line'))throw Error('This constraint requires two lines.')
   if(c.type==='equal'&&((a.type==='line')!==(b.type==='line')))throw Error('Equal requires two lines or two circular curves.')
   if(c.type==='concentric'&&(a.type==='line'||b.type==='line'))throw Error('Concentric requires circles or arcs.')
   if(c.type==='tangent'&&(a.type==='line'&&b.type==='line'))throw Error('Tangency requires at least one circle or arc.')
  }
  if(c.type==='horizontal'||c.type==='vertical'||c.type==='length'){if(entity(c.entityId).type!=='line')throw Error('Select a line for this constraint.')}
  if(c.type==='radius'&&!['circle','arc'].includes(entity(c.entityId).type))throw Error('Select a circle or arc for a radius.')
  if(c.type==='length'||c.type==='radius'||c.type==='distance'){if(typeof c.value!=='number'||!Number.isFinite(c.value)||c.value<.001||c.value>100000)throw Error('Constraint dimension must be 0.001–100000 mm.')}
  if(c.type==='angle'&&(!Number.isFinite(c.value)||Math.abs(c.value)>=180||Math.abs(c.value)<.01))throw Error('Angle must be between -180 and 180 degrees, excluding zero.')
  if(c.type==='coincident'||c.type==='distance'){constraintPoint(entities,c.first);constraintPoint(entities,c.second);if(c.first.entityId===c.second.entityId&&c.first.point===c.second.point)throw Error('Choose two different points.')}
  if(c.type==='origin'||c.type==='coordinate-x'||c.type==='coordinate-y')constraintPoint(entities,c.point)
  if((c.type==='coordinate-x'||c.type==='coordinate-y')&&(typeof c.value!=='number'||!Number.isFinite(c.value)||Math.abs(c.value)>100000))throw Error('Coordinate dimension must be within ±100000 mm.')
  if(c.type==='position'){constraintPoint(entities,c.point);if(!Array.isArray(c.position)||c.position.length!==2||c.position.some(n=>!Number.isFinite(n)||Math.abs(n)>100000))throw Error('Invalid fixed point.')}
  if(c.type==='fixed'){validateEntities([c.geometry]);const e=entity(c.entityId);if(c.geometry.id!==e.id||c.geometry.type!==e.type)throw Error('Fixed geometry must match its entity.')}
 }
}
const near=(a:number,b:number)=>Math.abs(a-b)<=1e-6+1e-9*Math.max(Math.abs(a),Math.abs(b))
const vector=(e:SketchEntity):Point2=>{if(e.type!=='line')throw Error('Expected line.');const d=distance(e.start,e.end);return [(e.end[0]-e.start[0])/d,(e.end[1]-e.start[1])/d]}
export function constraintSatisfied(entities:SketchEntity[],c:SketchConstraint):boolean{
 const entity=(id:string)=>entities.find(e=>e.id===id)!
 if(c.type==='coincident'||c.type==='distance')return near(distance(constraintPoint(entities,c.first),constraintPoint(entities,c.second)),c.type==='distance'?c.value:0)
 if(c.type==='origin')return near(distance(constraintPoint(entities,c.point),[0,0]),0)
 if(c.type==='coordinate-x'||c.type==='coordinate-y')return near(constraintPoint(entities,c.point)[c.type==='coordinate-x'?0:1],c.value)
 if(c.type==='position')return near(distance(constraintPoint(entities,c.point),c.position),0)
 if('entityId'in c){
  const e=entity(c.entityId)
  if(c.type==='horizontal')return e.type==='line'&&near(e.start[1],e.end[1])
  if(c.type==='vertical')return e.type==='line'&&near(e.start[0],e.end[0])
  if(c.type==='length')return e.type==='line'&&near(distance(e.start,e.end),c.value)
  if(c.type==='radius')return near(curveCircle(e).radius,c.value)
  if(c.type!=='fixed')return false
  const fixed=c.geometry
  if(e.type==='circle'&&fixed.type==='circle')return near(distance(e.center,fixed.center),0)&&near(e.radius,fixed.radius)
  if(e.type==='point'&&fixed.type==='point')return near(distance(e.position,fixed.position),0)
  if((e.type==='line'||e.type==='arc')&&(fixed.type==='line'||fixed.type==='arc'))return near(distance(e.start,fixed.start),0)&&near(distance(e.end,fixed.end),0)&&(e.type!=='arc'||fixed.type!=='arc'||near(distance(e.mid,fixed.mid),0))
  return false
 }
 if(!('entityIds'in c))return false
 const [a,b]=c.entityIds.map(entity)
 if(c.type==='equal')return near(a.type==='line'?distance(a.start,a.end):curveCircle(a).radius,b.type==='line'?distance(b.start,b.end):curveCircle(b).radius)
 if(c.type==='concentric')return near(distance(curveCircle(a).center,curveCircle(b).center),0)
 if(c.type==='tangent'){
  if(a.type==='line'||b.type==='line'){const line=a.type==='line'?a:b,curve=curveCircle(a.type==='line'?b:a),u=vector(line);if(line.type!=='line')return false;return near(Math.abs(u[0]*(curve.center[1]-line.start[1])-u[1]*(curve.center[0]-line.start[0])),curve.radius)}
  const ca=curveCircle(a),cb=curveCircle(b),d=distance(ca.center,cb.center);return near(d,ca.radius+cb.radius)||near(d,Math.abs(ca.radius-cb.radius))
 }
 const u=vector(a),v=vector(b),cross=u[0]*v[1]-u[1]*v[0],dot=u[0]*v[0]+u[1]*v[1]
 return c.type==='parallel'?near(cross,0):c.type==='perpendicular'?near(dot,0):c.type==='angle'&&near(Math.atan2(cross,dot)*180/Math.PI,c.value)
}
export function assertConstraintsSatisfied(entities:SketchEntity[],constraints:SketchConstraint[]){
 validateConstraints(entities,constraints)
 const failed=constraints.filter(c=>!constraintSatisfied(entities,c))
 if(failed.length)throw Error('Sketch constraints are not satisfied: '+failed.map(c=>constraintNames[c.type]+' ('+c.id+')').join(', ')+'. Solve or remove the conflicting constraints.')
}
/** Persist the existing endpoint connectivity when entering constrained editing. */
export function connectedConstraints(entities:SketchEntity[],existing:SketchConstraint[]=[]):SketchConstraint[]{
 const points:{ref:SketchPointRef;value:Point2}[]=[]
 for(const e of entities)if(e.type==='line'||e.type==='arc')for(const point of ['start','end'] as const)points.push({ref:{entityId:e.id,point},value:e[point]})
 const result:SketchConstraint[]=[],key=(p:SketchPointRef)=>p.entityId+'/'+p.point
 const parent=new Map(points.map(p=>[key(p.ref),key(p.ref)]))
 const root=(k:string):string=>{const p=parent.get(k)??k;return p===k?k:root(p)}
 for(const c of existing)if(c.type==='coincident')parent.set(root(key(c.first)),root(key(c.second)))
 for(let i=0;i<points.length;i++)for(let j=0;j<i;j++){
  const a=points[i],b=points[j],ra=root(key(a.ref)),rb=root(key(b.ref))
  if(ra!==rb&&a.ref.entityId!==b.ref.entityId&&distance(a.value,b.value)<1e-6){result.push({id:crypto.randomUUID(),type:'coincident',first:a.ref,second:b.ref});parent.set(ra,rb)}
 }
 return result
}
