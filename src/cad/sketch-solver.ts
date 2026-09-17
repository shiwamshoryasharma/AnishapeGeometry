import {SolveStatus,type GcsWrapper,type SketchPrimitive,type SketchArc,type SketchCircle} from '@salusoft89/planegcs'
import type {SketchEntity,Point2} from './types'
import {arcGeometry,validateEntities} from './sketch-entities'
import {validateConstraints,assertConstraintsSatisfied,curveCircle,type SketchConstraint,type SketchPointRef} from './sketch-constraints'
export interface SketchSolution {entities:SketchEntity[];dof:number;redundant:string[]}
/** The adapter runs exclusively in the sketch worker (or the real-WASM tests). */
export function solveSketch(gcs:GcsWrapper,source:SketchEntity[],constraints:SketchConstraint[]):SketchSolution{
 validateConstraints(source,constraints)
 gcs.clear_data();gcs.set_max_iterations(100);gcs.set_convergence_threshold(1e-10)
 const primitives:SketchPrimitive[]=[],entityIds=new Map(source.map((e,i)=>[e.id,'e'+i]))
 const eid=(id:string)=>entityIds.get(id)!
 const pid=(ref:SketchPointRef)=>eid(ref.entityId)+':'+ref.point
 const point=(id:string,value:Point2,fixed=false)=>primitives.push({id,type:'point',x:value[0],y:value[1],fixed})
 const fixed=new Map(constraints.filter(c=>c.type==='fixed').map(c=>[c.entityId,c.geometry]))
 const working=source.map(e=>fixed.get(e.id)?{...fixed.get(e.id)!,dimension:e.dimension}:e)
 for(const e of working){
  const id=eid(e.id),locked=fixed.has(e.id)
  if(e.type==='point')point(id+':position',e.position,locked)
  else if(e.type==='line'){point(id+':start',e.start,locked);point(id+':end',e.end,locked);primitives.push({id,type:'line',p1_id:id+':start',p2_id:id+':end'})}
  else{
   const circle=curveCircle(e);point(id+':center',circle.center,locked)
   if(e.type==='circle')primitives.push({id,type:'circle',c_id:id+':center',radius:e.radius})
   else{
    const arc=arcGeometry(e.start,e.mid,e.end),ccw=arc.sweep>0
    point(id+':start',e.start,locked);point(id+':end',e.end,locked)
    primitives.push({id,type:'arc',c_id:id+':center',radius:arc.radius,start_id:id+(ccw?':start':':end'),end_id:id+(ccw?':end':':start'),start_angle:ccw?arc.start:arc.start+arc.sweep,end_angle:ccw?arc.start+arc.sweep:arc.start})
    primitives.push({id:id+':rules',type:'arc_rules',a_id:id})
   }
   if(locked)primitives.push({id:id+':fixed-radius',type:'equal',param1:{o_id:id,prop:'radius'},param2:circle.radius})
  }
 }
 for(const [index,c] of constraints.entries()){
  const cid='c'+index
  if(c.type==='fixed')continue
  if(c.type==='horizontal'||c.type==='vertical')primitives.push({id:cid,type:c.type==='horizontal'?'horizontal_l':'vertical_l',l_id:eid(c.entityId)})
  else if(c.type==='length')primitives.push({id:cid,type:'p2p_distance',p1_id:eid(c.entityId)+':start',p2_id:eid(c.entityId)+':end',distance:c.value})
  else if(c.type==='radius')primitives.push({id:cid,type:'equal',param1:{o_id:eid(c.entityId),prop:'radius'},param2:c.value})
  else if(c.type==='coordinate-x'||c.type==='coordinate-y')primitives.push({id:cid,type:'equal',param1:{o_id:pid(c.point),prop:c.type==='coordinate-x'?'x':'y'},param2:c.value})
  else if(c.type==='origin'){for(const prop of ['x','y'] as const)primitives.push({id:cid+':'+prop,type:'equal',param1:{o_id:pid(c.point),prop},param2:0})}
  else if(c.type==='position'){for(const [i,prop]of (['x','y'] as const).entries())primitives.push({id:cid+':'+prop,type:'equal',param1:{o_id:pid(c.point),prop},param2:c.position[i]})}
  else if(c.type==='coincident')primitives.push({id:cid,type:'p2p_coincident',p1_id:pid(c.first),p2_id:pid(c.second)})
  else if(c.type==='distance')primitives.push({id:cid,type:'p2p_distance',p1_id:pid(c.first),p2_id:pid(c.second),distance:c.value})
  else if('entityIds'in c){
   const [a,b]=c.entityIds.map(id=>working.find(e=>e.id===id)!),ai=eid(a.id),bi=eid(b.id)
   if(c.type==='parallel')primitives.push({id:cid,type:'parallel',l1_id:ai,l2_id:bi})
   else if(c.type==='perpendicular')primitives.push({id:cid,type:'perpendicular_ll',l1_id:ai,l2_id:bi})
   else if(c.type==='angle')primitives.push({id:cid,type:'l2l_angle_ll',l1_id:ai,l2_id:bi,angle:c.value*Math.PI/180})
   else if(c.type==='concentric')primitives.push({id:cid,type:'p2p_coincident',p1_id:ai+':center',p2_id:bi+':center'})
   else if(c.type==='equal')primitives.push(a.type==='line'?{id:cid,type:'equal_length',l1_id:ai,l2_id:bi}:{id:cid,type:'equal',param1:{o_id:ai,prop:'radius'},param2:{o_id:bi,prop:'radius'}})
   else if(a.type==='line'||b.type==='line'){
    const line=a.type==='line'?ai:bi,curve=a.type==='line'?b:a,ci=eid(curve.id)
    primitives.push(curve.type==='circle'?{id:cid,type:'tangent_lc',l_id:line,c_id:ci}:{id:cid,type:'tangent_la',l_id:line,a_id:ci})
   }else{
    primitives.push({id:cid,type:'tangent_circumf',p1_id:ai+':center',p2_id:bi+':center',rd1:{o_id:ai,prop:'radius'},rd2:{o_id:bi,prop:'radius'},internal:false})
   }
  }
 }
 try{
  gcs.push_primitives_and_params(primitives)
  const userId=(id:string)=>constraints[Number(/^c(\d+)/.exec(id)?.[1])]?.id??id
  const status=gcs.solve(),conflicts=gcs.get_gcs_conflicting_constraints().map(userId)
  if(conflicts.length||status===SolveStatus.Failed||status===SolveStatus.SuccessfulSolutionInvalid)throw Error('Conflicting sketch constraints'+(conflicts.length?': '+conflicts.join(', '):'')+'. Remove or change a constraint; the previous sketch is preserved.')
  gcs.apply_solution()
  const getPoint=(id:string):Point2=>{const p=gcs.sketch_index.get_sketch_point(id);return [p.x,p.y]}
  const entities=working.map((e):SketchEntity=>{
   const id=eid(e.id)
   if(fixed.has(e.id))return structuredClone(e)
   if(e.type==='point')return {...e,position:getPoint(id+':position')}
   if(e.type==='line')return {...e,start:getPoint(id+':start'),end:getPoint(id+':end')}
   const curve=gcs.sketch_index.get_primitive_or_fail(id) as SketchCircle|SketchArc,center=getPoint(id+':center')
   if(e.type==='circle')return {...e,center,radius:curve.radius}
   const arc=curve as SketchArc,angle=(arc.start_angle+arc.end_angle)/2
   return {...e,start:getPoint(id+':start'),end:getPoint(id+':end'),mid:[center[0]+arc.radius*Math.cos(angle),center[1]+arc.radius*Math.sin(angle)]}
  })
  validateEntities(entities);assertConstraintsSatisfied(entities,constraints)
  const redundant=[...new Set([...gcs.get_gcs_redundant_constraints(),...gcs.get_gcs_partially_redundant_constraints()].map(userId))].filter(id=>constraints.some(c=>id===c.id))
  return {entities,dof:Math.max(0,gcs.gcs.dof()),redundant}
 }finally{gcs.clear_data()}
}
