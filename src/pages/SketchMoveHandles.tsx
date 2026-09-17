import type {PointerEvent} from 'react'
import type {Point2} from '../cad/types'
export function SketchMoveHandles({center,onStart,onFocusValue}:{center:Point2;onStart:(event:PointerEvent,axis:'X'|'Y'|'XY')=>void;onFocusValue:()=>void}){
 const key=(event:React.KeyboardEvent)=>{if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();event.stopPropagation();onFocusValue()}}
 return <g className="sketch-move-handles" transform={'translate('+center.join(' ')+')'}>
  <g role="button" tabIndex={0} aria-label="Drag sketch X" onPointerDown={e=>onStart(e,'X')} onKeyDown={key} className="sketch-move-x"><title>Move along sketch X · Tab for exact offset</title><path className="move-hit" d="M12 0H76"/><path d="M12 0H76"/><path d="M76 0L63 -6V6Z"/><text x="80" y="4">X</text></g>
  <g role="button" tabIndex={0} aria-label="Drag sketch Y" onPointerDown={e=>onStart(e,'Y')} onKeyDown={key} className="sketch-move-y"><title>Move along sketch Y · Tab for exact offset</title><path className="move-hit" d="M0 -12V-76"/><path d="M0 -12V-76"/><path d="M0 -76L-6 -63H6Z"/><text x="-4" y="-84">Y</text></g>
  <g role="button" tabIndex={0} aria-label="Drag sketch freely" onPointerDown={e=>onStart(e,'XY')} onKeyDown={key}><title>Move freely in sketch plane</title><rect x="-7" y="-7" width="14" height="14" rx="2"/></g>
 </g>
}
