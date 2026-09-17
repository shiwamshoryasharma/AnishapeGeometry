import type {Point2} from '../cad/types'
export type SketchReference='origin'|'x-axis'|'y-axis'
export function SketchAxes({xy,onReference}:{xy:(p:Point2)=>number[];onReference?:(kind:SketchReference)=>void}){
 const [x,y]=xy([0,0])
 return <g>{(['x-axis','y-axis'] as const).map(axis=><g key={axis}>
  <path d={axis==='x-axis'?'M0 '+y+'H800':'M'+x+' 0V600'} stroke={axis==='x-axis'?'#c97878':'#6fbd92'} strokeWidth="1" pointerEvents="none"/>
  {onReference&&<path d={axis==='x-axis'?'M0 '+y+'H800':'M'+x+' 0V600'} stroke="transparent" strokeWidth="10" role="button" tabIndex={0} aria-label={'Select sketch '+(axis==='x-axis'?'X':'Y')+' axis'} onPointerDown={e=>{e.stopPropagation();onReference(axis)}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();onReference(axis)}}}/>}
  <text x={axis==='x-axis'?780:x+9} y={axis==='x-axis'?y-9:20} fill={axis==='x-axis'?'#c97878':'#6fbd92'} fontSize="12" pointerEvents="none">{axis==='x-axis'?'+X':'+Y'}</text>
 </g>)}</g>
}
