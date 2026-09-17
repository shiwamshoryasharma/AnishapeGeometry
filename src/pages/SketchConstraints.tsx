import {useState} from 'react'
import type {Point2,SketchEntity,Unit} from '../cad/types'
import {UnitService} from '../cad/units'
import {connectedConstraints,constraintEntityIds,constraintNames,constraintPoint,type SketchConstraint,type SketchPointRef} from '../cad/sketch-constraints'
import type {SketchSolution} from '../cad/sketch-solver'
interface Props{initialType?:SketchConstraint['type'];entities:SketchEntity[];constraints:SketchConstraint[];selected:string[];unit:Unit;busy:boolean;solution:SketchSolution|null;error:string|null;onChange:(constraints:SketchConstraint[])=>void;onSolve:()=>void;onClose:()=>void}
export function SketchConstraints(p:Props){
 const [type,setType]=useState<SketchConstraint['type']>(p.initialType??'horizontal'),[value,setValue]=useState(p.initialType?'0':'10'),[firstPoint,setFirstPoint]=useState<SketchPointRef['point']>('start'),[secondPoint,setSecondPoint]=useState<SketchPointRef['point']>('start'),[error,setError]=useState<string|null>(null)
 const selection=p.entities.filter(e=>p.selected.includes(e.id)),needPair=['parallel','perpendicular','equal','concentric','tangent','angle','coincident','distance'].includes(type)
 const hasValue=['length','radius','angle','distance','coordinate-x','coordinate-y'].includes(type)
 const points=(e?:SketchEntity)=>e?.type==='point'?['position']:e?.type==='circle'?['center']:e?.type==='arc'?['start','end','center']:['start','end']
 const ref=(e:SketchEntity,point:SketchPointRef['point']):SketchPointRef=>({entityId:e.id,point:points(e).includes(point)?point:e.type==='point'?'position':e.type==='circle'?'center':'start'})
 const numeric=(text:string,t:SketchConstraint['type'])=>t==='angle'?Number(text):UnitService.parse(text,p.unit)
 const add=()=>{
  try{
   if(selection.length!==(needPair?2:1))throw Error('Select '+(needPair?'two entities using Shift':'one entity')+' in the sketch.')
   const [a,b]=selection,id=crypto.randomUUID();let c:SketchConstraint
   if(type==='origin')c={id,type,point:ref(a,firstPoint)}
   else if(type==='coordinate-x'||type==='coordinate-y')c={id,type,point:ref(a,firstPoint),value:numeric(value,type)}
   else if(type==='fixed')c={id,type,entityId:a.id,geometry:structuredClone(a)}
   else if(type==='position'){const point=ref(a,firstPoint);c={id,type,point,position:[...constraintPoint(p.entities,point)] as Point2}}
   else if(type==='horizontal'||type==='vertical')c={id,type,entityId:a.id}
   else if(type==='length'||type==='radius')c={id,type,entityId:a.id,value:numeric(value,type)}
   else if(type==='coincident')c={id,type,first:ref(a,firstPoint),second:ref(b,secondPoint)}
   else if(type==='distance')c={id,type,first:ref(a,firstPoint),second:ref(b,secondPoint),value:numeric(value,type)}
   else if(type==='angle')c={id,type,entityIds:[a.id,b.id],value:numeric(value,type)}
   else c={id,type,entityIds:[a.id,b.id]}
   setError(null);p.onChange([...p.constraints,...connectedConstraints(p.entities,p.constraints),c])
  }catch(e){setError(e instanceof Error?e.message:String(e))}
 }
 return <section className="sketch-constraints" aria-label="Sketch constraint tools" onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')e.stopPropagation()}}>
  <div className="constraint-heading"><strong>Constraints</strong><button type="button" className="icon-button" aria-label="Close constraint tools" onClick={p.onClose}>×</button></div>
  <p>Select geometry; Shift selects a second entity. Connected endpoints are preserved when adding constraints.</p>
  <div data-testid="constraint-status" role="status">{p.busy?'Solving sketch…':p.solution?(p.solution.dof===0?'Fully constrained':p.solution.dof+' degrees of freedom'):'Choose Solve to inspect remaining freedom.'}{!!p.solution?.redundant.length&&<small>Redundant constraints: {p.solution.redundant.length}. Remove duplicate relationships.</small>}</div>
  {(type==='origin'||type==='coordinate-x'||type==='coordinate-y')&&<p>{type==='origin'?'Select a point, endpoint or center to anchor at local (0, 0).':type==='coordinate-x'?'Signed X coordinate from local origin. Use 0 to place the point on the Y axis.':'Signed Y coordinate from local origin. Use 0 to place the point on the X axis.'}</p>}
  <fieldset disabled={p.busy}>
   <label>Constraint type<select aria-label="Constraint type" value={type} onChange={e=>setType(e.target.value as SketchConstraint['type'])}>{Object.entries(constraintNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   {(type==='coincident'||type==='distance'||type==='position'||type==='origin'||type==='coordinate-x'||type==='coordinate-y')&&<label>First point<select aria-label="First constraint point" value={points(selection[0]).includes(firstPoint)?firstPoint:selection[0]?.type==='point'?'position':selection[0]?.type==='circle'?'center':'start'} onChange={e=>setFirstPoint(e.target.value as SketchPointRef['point'])}>{points(selection[0]).map(v=><option key={v}>{v}</option>)}</select></label>}
   {(type==='coincident'||type==='distance')&&<label>Second point<select aria-label="Second constraint point" value={points(selection[1]).includes(secondPoint)?secondPoint:selection[1]?.type==='point'?'position':selection[1]?.type==='circle'?'center':'start'} onChange={e=>setSecondPoint(e.target.value as SketchPointRef['point'])}>{points(selection[1]).map(v=><option key={v}>{v}</option>)}</select></label>}
   {hasValue&&<label>{type==='angle'?'Angle · degrees':'Value · '+p.unit}<input aria-label="Constraint value" value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add()}}/></label>}
   <button className="button" type="button" onClick={add}>Add constraint</button><button className="button" type="button" onClick={p.onSolve}>Solve sketch</button>
   <ul aria-label="Sketch constraints">{p.constraints.map((c,i)=><li key={c.id}>
    <span>{constraintNames[c.type]} <small>{constraintEntityIds(c).map(id=>{const index=p.entities.findIndex(e=>e.id===id);return p.entities[index]?.type+' '+(index+1)}).join(' / ')}</small></span>
    {'value'in c&&<input key={c.id+':'+c.value} aria-label={'Edit '+constraintNames[c.type]+' constraint'} defaultValue={String(c.type==='angle'?c.value:UnitService.fromInternal(c.value,p.unit))} onKeyDown={e=>{if(e.key==='Enter'){try{const value=numeric(e.currentTarget.value,c.type);p.onChange(p.constraints.map(v=>v.id===c.id?{...c,value}:v));setError(null)}catch(err){setError(String(err))}}}}/>}
    <button type="button" className="icon-button" aria-label={'Remove '+constraintNames[c.type]+' constraint '+(i+1)} onClick={()=>p.onChange(p.constraints.filter(v=>v.id!==c.id))}>×</button>
   </li>)}</ul>
  </fieldset>
  {(error||p.error)&&<p className="constraint-error" role="alert">{error??p.error}</p>}
 </section>
}
