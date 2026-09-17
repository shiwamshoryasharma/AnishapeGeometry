import {useState} from 'react'
import type {Point2,SketchEntity,Unit} from '../cad/types'
import type {EntityTool} from './EntitySketchCanvas'
import {UnitService} from '../cad/units'
import {offsetEntities,rotateEntities,scaleEntities,circularPatternEntities} from '../cad/sketch-edit'
type Modification='offset'|'rotate'|'scale'|'circular-pattern'|'trim'|'extend'|'split'
interface Props{entities:SketchEntity[];selected:string[];unit:Unit;busy:boolean;onChange:(entities:SketchEntity[],selected:string[])=>void;onTool:(tool:EntityTool)=>void;onClose:()=>void}
export function SketchModify(p:Props){
 const [operation,setOperation]=useState<Modification>('offset'),[value,setValue]=useState('5'),[pivotX,setPivotX]=useState('0'),[pivotY,setPivotY]=useState('0'),[count,setCount]=useState('4'),[copy,setCopy]=useState(false),[error,setError]=useState<string|null>(null)
 const direct=['trim','extend','split'].includes(operation)
 const apply=()=>{
  try{
   const source=p.entities.filter(e=>p.selected.includes(e.id));if(!source.length)throw Error('Select entities in the sketch first.')
   const pivot:Point2=[UnitService.parse(pivotX,p.unit),UnitService.parse(pivotY,p.unit)]
   const result=operation==='offset'?offsetEntities(source,UnitService.parse(value,p.unit)):operation==='rotate'?rotateEntities(source,pivot,Number(value),copy):operation==='scale'?scaleEntities(source,pivot,Number(value),copy):circularPatternEntities(source,pivot,Number(count),Number(value))
   const append=operation==='offset'||operation==='circular-pattern'||copy
   p.onChange(append?[...p.entities,...result]:p.entities.map(e=>result.find(v=>v.id===e.id)??e),result.map(e=>e.id));setError(null)
  }catch(e){setError(e instanceof Error?e.message:String(e))}
 }
 return <section className="sketch-constraints sketch-modify" aria-label="Sketch modification tools" onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')e.stopPropagation()}}>
  <div className="constraint-heading"><strong>Modify sketch</strong><button className="icon-button" aria-label="Close modify tools" onClick={p.onClose}>×</button></div>
  <fieldset disabled={p.busy}>
   <label>Operation<select aria-label="Sketch modification" value={operation} onChange={e=>{const next=e.target.value as Modification;setOperation(next);setValue(next==='rotate'?'90':next==='scale'?'1.5':next==='circular-pattern'?'360':'5');p.onTool(['trim','extend','split'].includes(next)?next as EntityTool:'select');setError(null)}}>
    <option value="offset">Offset</option><option value="trim">Trim</option><option value="extend">Extend</option><option value="split">Split entity</option><option value="rotate">Rotate sketch</option><option value="scale">Scale sketch</option><option value="circular-pattern">Circular pattern</option>
   </select></label>
   {direct?<p>{operation==='trim'?'Click the curve portion between intersections to remove it.':operation==='extend'?'Click near the endpoint to extend to the nearest boundary.':'Click inside an edge to split it at that point.'} Remove constraints on that entity before changing its topology.</p>:<>
    <p>{p.selected.length} selected. {operation==='offset'?'Positive offsets are outward for closed contours and left of an open line. Supports individual lines/circles/arcs and closed straight-sided contours.':'Pivot coordinates are in the sketch plane.'}</p>
    {operation!=='offset'&&<div className="field-grid"><label>Pivot X<input aria-label="Modification pivot X" value={pivotX} onChange={e=>setPivotX(e.target.value)}/></label><label>Pivot Y<input aria-label="Modification pivot Y" value={pivotY} onChange={e=>setPivotY(e.target.value)}/></label></div>}
    <label>{operation==='offset'?'Offset · '+p.unit:operation==='scale'?'Scale factor':'Angle · degrees'}<input aria-label="Modification value" value={value} onChange={e=>setValue(e.target.value)}/></label>
    {operation==='circular-pattern'&&<label>Total instances<input aria-label="Circular sketch instances" value={count} onChange={e=>setCount(e.target.value)}/></label>}
    {(operation==='rotate'||operation==='scale')&&<label className="checkbox-field"><input type="checkbox" checked={copy} onChange={e=>setCopy(e.target.checked)}/>Create independent copy</label>}
    <button className="button" onClick={apply}>Apply sketch modification</button>
   </>}
  </fieldset>
  {error&&<p role="alert" className="constraint-error">{error}</p>}
 </section>
}
