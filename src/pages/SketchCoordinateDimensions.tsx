import type {Point2,SketchEntity,Unit} from '../cad/types'
import {constraintPoint,type SketchConstraint} from '../cad/sketch-constraints'
import {UnitService} from '../cad/units'
export function SketchCoordinateDimensions({entities,constraints,selected,xy,unit,onEdit}:{entities:SketchEntity[];constraints:SketchConstraint[];selected:string[];xy:(p:Point2)=>Point2;unit:Unit;onEdit:(id:string)=>void}){
 return <g>{constraints.map(c=>{
  if(c.type!=='coordinate-x'&&c.type!=='coordinate-y'||selected.length&&!selected.includes(c.point.entityId))return null
  const p=xy(constraintPoint(entities,c.point)),o=xy([0,0]),horizontal=c.type==='coordinate-x',axis=horizontal?'X':'Y'
  const a:Point2=horizontal?[o[0],p[1]-24]:[p[0]+24,o[1]],b:Point2=horizontal?[p[0],p[1]-24]:[p[0]+24,p[1]],label:Point2=horizontal?[(a[0]+b[0])/2,a[1]-14]:[a[0]+58,Math.abs(a[1]-b[1])<40?b[1]+28:(a[1]+b[1])/2]
  return <g key={c.id} className="sketch-dimension-label"><path d={'M'+(horizontal?[o[0],p[1]]:[p[0],o[1]]).join(' ')+'L'+a.join(' ')+'L'+b.join(' ')+'L'+p.join(' ')} fill="none" stroke="var(--text-muted)" strokeDasharray="3 3" pointerEvents="none"/><g role="button" tabIndex={0} aria-label={'Edit '+axis+' coordinate dimension'} onPointerDown={e=>{e.stopPropagation();onEdit(c.id)}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();onEdit(c.id)}}}><rect x={label[0]-53} y={label[1]-12} width="106" height="24" rx="4"/><text x={label[0]} y={label[1]+4} textAnchor="middle">{axis+' '+UnitService.format(c.value,unit,3)}</text></g></g>
 })}</g>
}
