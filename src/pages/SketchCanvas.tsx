import {SketchAxes} from './SketchAxes'
import {sketchSnapPoints,snapSketchPoint,type SketchSnapPoint} from '../cad/sketch-snapping'
import {SketchReferences} from './SketchReferences'
import {DraggableDimension} from './DraggableDimension'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { Plane, PlaneFrame, ModelResult, Unit, Vec3, Point2 } from '../cad/types'
import { frameLocal, planeFrame } from '../cad/planes'
import { UnitService } from '../cad/units'
interface Rectangle {x:number;y:number;width:number;height:number}
export type SketchMode='rectangle'|'center-rectangle'|'dimension'|'select'
export interface SketchDisplay {grid:boolean;snap:boolean;geometrySnap?:boolean;dimensions:boolean;body:boolean}
export function SketchCanvas({onReference,dimensionPositions={},onDimensionPosition,rectangle,onChange,plane,frame:inputFrame,model,unit='mm',profile='rectangle',mode='rectangle',onDimension,display={grid:true,snap:true,dimensions:true,body:true},supportLabel}:{
 onReference?:(kind:'origin'|'x-axis'|'y-axis')=>void;dimensionPositions?:{width?:Point2;height?:Point2};onDimensionPosition?:(axis:'width'|'height',point:Point2)=>void;rectangle:Rectangle;onChange:(r:Rectangle)=>void;plane:Plane;frame?:PlaneFrame;model?:ModelResult|null;unit?:Unit;profile?:'rectangle'|'circle';mode?:SketchMode;onDimension?:(axis:'width'|'height')=>void;display?:SketchDisplay;supportLabel?:string
}){
 const frame=useMemo(()=>inputFrame??planeFrame(plane),[inputFrame,plane])
 const context=useMemo(()=>{
  if(!model)return {edges:[] as number[][][],faces:[] as {points:number[][];depth:number}[],bounds:null as null|number[]}
  const edges=model.edges.map(e=>{const points:number[][]=[];for(let i=0;i<e.positions.length;i+=3)points.push(frameLocal(frame,Array.from(e.positions.slice(i,i+3)) as Vec3));return points})
  const faces=model.faces.map(f=>{const points:number[][]=[];for(let i=0;i<f.positions.length;i+=3)points.push(frameLocal(frame,Array.from(f.positions.slice(i,i+3)) as Vec3));return {points,depth:frameLocal(frame,f.center)[2]}}).sort((a,b)=>a.depth-b.depth)
  const all=edges.flat(),bounds=all.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);return {edges,faces,bounds:all.length?bounds:null}
 },[model,frame])
 const fit=()=>{if(!context.bounds)return {scale:4,ox:160,oy:440};const [x0,y0,x1,y1]=context.bounds,scale=Math.min(560/Math.max(x1-x0,20),360/Math.max(y1-y0,20));return {scale,ox:400-(x0+x1)/2*scale,oy:310+(y0+y1)/2*scale}}
 const targets=useMemo(()=>sketchSnapPoints(frame,display.body?model:null),[frame,model,display.body])
 const [hover,setHover]=useState<SketchSnapPoint|undefined>()
 const [view,setView]=useState(fit),svg=useRef<SVGSVGElement>(null)
 const gesture=useRef<{pointer:number;kind:'draw'|'pan'|'move'|'dimension';axis?:'width'|'height';x:number;y:number;cx:number;cy:number;initial:Rectangle;view:typeof view}|null>(null)
 // Tab hands control from the pointer to the exact-value fields. A later mouse-up must not overwrite them.
 useEffect(()=>{const stop=(e:KeyboardEvent)=>{if(e.key==='Tab'&&gesture.current){const id=gesture.current.pointer;gesture.current=null;const el=svg.current;if(el?.hasPointerCapture(id))el.releasePointerCapture(id)}};window.addEventListener('keydown',stop,true);return()=>window.removeEventListener('keydown',stop,true)},[])
 const screen=(event:{clientX:number;clientY:number})=>{const matrix=svg.current?.getScreenCTM();return matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()):new DOMPoint()}
 const snapped=(event:{clientX:number;clientY:number})=>{const p=screen(event);return snapSketchPoint([(p.x-view.ox)/view.scale,(view.oy-p.y)/view.scale],display.geometrySnap===false?[]:targets,view.scale,display.snap)}
 const point=(event:{clientX:number;clientY:number})=>{const p=snapped(event).point;return {x:p[0],y:p[1]}}
 const xy=(p:number[])=>[view.ox+p[0]*view.scale,view.oy-p[1]*view.scale]
 const path=(points:number[][])=>points.map((p,i)=>{const [x,y]=xy(p);return (i?'L':'M')+x+' '+y}).join(' ')
 const move=(event:PointerEvent<SVGSVGElement>)=>{
  const g=gesture.current;if(!g)return
  if(g.kind==='pan'){const p=screen(event);setView({...g.view,ox:g.view.ox+p.x-g.cx,oy:g.view.oy+p.y-g.cy});return}
  const p=point(event)
  if(g.kind==='dimension'){onDimensionPosition?.(g.axis!,[p.x,p.y]);return}
  if(g.kind==='move'){onChange({...g.initial,x:g.initial.x+p.x-g.x,y:g.initial.y+p.y-g.y});return}
  if(profile==='circle'){const diameter=2*Math.hypot(p.x-g.x,p.y-g.y);onChange({x:g.x,y:g.y,width:diameter,height:diameter})}
  else if(mode==='center-rectangle')onChange({x:g.x-Math.abs(p.x-g.x),y:g.y-Math.abs(p.y-g.y),width:2*Math.abs(p.x-g.x),height:2*Math.abs(p.y-g.y)})
  else onChange({x:Math.min(g.x,p.x),y:Math.min(g.y,p.y),width:Math.abs(p.x-g.x),height:Math.abs(p.y-g.y)})
 }
 const circle=profile==='circle',w=rectangle.width*view.scale,h=circle?w:rectangle.height*view.scale,x=view.ox+rectangle.x*view.scale-(circle?w/2:0),y=view.oy-rectangle.y*view.scale-(circle?h/2:h)
 const dimension=(axis:'width'|'height')=>onDimension?.(axis)
 const dimensionEdge=(axis:'width'|'height',d:string,label:string)=><path d={d} className="sketch-dimension-hit" role="button" tabIndex={mode==='dimension'?0:-1} aria-label={label} onPointerDown={e=>{e.stopPropagation();if(mode!=='dimension')return;const p=point(e),s=screen(e);gesture.current={pointer:e.pointerId,kind:'dimension',axis,x:p.x,y:p.y,cx:s.x,cy:s.y,initial:rectangle,view};svg.current?.setPointerCapture(e.pointerId)}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();dimension(axis)}}}/>
 const position=(axis:'width'|'height',fallback:Point2):Point2=>dimensionPositions[axis]?xy(dimensionPositions[axis]!) as Point2:fallback
 const circleAnchor=():Point2=>{const label=position('width',[x+w/2,y-31]),cx=x+w/2,cy=y+h/2,d=Math.hypot(label[0]-cx,label[1]-cy)||1;return [cx+(label[0]-cx)/d*w/2,cy+(label[1]-cy)/d*h/2]}
 const place=(axis:'width'|'height',p:Point2)=>onDimensionPosition?.(axis,[(p[0]-view.ox)/view.scale,(view.oy-p[1])/view.scale])
 const format=(n:number)=>UnitService.format(n,unit,3)
 const grid=Math.max(10,10**Math.floor(Math.log10(60/view.scale))*view.scale)
 return <div className={'sketch-canvas sketch-mode-'+mode}>
  <div className="sketch-tip"><strong>{supportLabel??plane+' sketch plane'}</strong><span>{mode==='dimension'?'Drag an edge to place its dimension. Drag labels to arrange; click a label to edit.':mode==='select'?'Drag the profile to reposition it.':circle?'Circle: drag from center to radius.':mode==='center-rectangle'?'Center rectangle: drag from the center to a corner.':'Rectangle: drag opposite corners.'} Right-drag: pan · Wheel: zoom</span></div>
  <svg ref={svg} viewBox="0 0 800 600" data-scale={view.scale} data-origin-x={view.ox} data-origin-y={view.oy} role="img" aria-label={circle?'Circle sketch drawing surface':'Rectangle sketch drawing surface'} onContextMenu={e=>e.preventDefault()}
   onWheel={e=>{const p=screen(e),factor=e.deltaY<0?1.12:1/1.12;setView(v=>{const scale=Math.min(10000,Math.max(.002,v.scale*factor)),ratio=scale/v.scale;return {scale,ox:p.x-(p.x-v.ox)*ratio,oy:p.y-(p.y-v.oy)*ratio}})}}
   onPointerDown={event=>{if(event.button!==0&&event.button!==1&&event.button!==2)return;if(mode==='dimension'&&event.button===0)return;const p=point(event),s=screen(event);gesture.current={pointer:event.pointerId,kind:event.button!==0?'pan':mode==='select'?'move':'draw',x:p.x,y:p.y,cx:s.x,cy:s.y,initial:rectangle,view};event.currentTarget.setPointerCapture(event.pointerId)}}
   onPointerMove={event=>{setHover(snapped(event).target);move(event)}} onPointerLeave={()=>{if(!gesture.current)setHover(undefined)}} onPointerUp={event=>{if(!gesture.current)return;move(event);gesture.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}} onPointerCancel={()=>{gesture.current=null}}>
   <defs><marker id="primitive-dimension-arrow" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 5L10 0V10Z" fill="var(--text-muted)"/></marker><pattern id="sketch-grid" x={view.ox} y={view.oy} width={grid} height={grid} patternUnits="userSpaceOnUse"><path d={'M'+grid+' 0H0V'+grid} fill="none" stroke="var(--grid)" strokeWidth=".8"/></pattern></defs>
   <rect width="800" height="600" fill="var(--canvas)"/>{display.grid&&<rect width="800" height="600" fill="url(#sketch-grid)"/>}
   {display.body&&model&&<g data-testid="sketch-model-context" pointerEvents="none">{context.faces.map((face,i)=><path key={i} d={Array.from({length:face.points.length/3},(_,j)=>path(face.points.slice(j*3,j*3+3))+'Z').join(' ')} fill="var(--sketch-body)" stroke="none"/>)}{context.edges.map((edge,i)=><path key={i} d={path(edge)} fill="none" stroke="var(--text-muted)" strokeWidth="1" opacity=".65"/>)}</g>}
   <path d={'M0 '+view.oy+'H800'} stroke="var(--axis-x)" strokeWidth="1"/><path d={'M'+view.ox+' 0V600'} stroke="var(--axis-y)" strokeWidth="1"/><circle cx={view.ox} cy={view.oy} r="3" fill="var(--text)"/>
   {w>0&&h>0&&<g>
    {circle?<circle cx={x+w/2} cy={y+h/2} r={w/2} fill="var(--sketch-blue)" fillOpacity=".14" stroke="var(--sketch-blue)" strokeWidth="2"/>:<rect x={x} y={y} width={w} height={h} fill="var(--sketch-blue)" fillOpacity=".14" stroke="var(--sketch-blue)" strokeWidth="2"/>}
    {(circle?[[x+w/2,y+h/2]]:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]).map(([cx,cy])=><rect key={cx+','+cy} x={cx-3} y={cy-3} width="6" height="6" fill="var(--surface)" stroke="var(--sketch-blue)"/>)}
    {display.dimensions&&<><DraggableDimension label={circle?'Edit diameter dimension':'Edit width dimension'} text={(circle?'Ø ':'')+format(rectangle.width)} position={position('width',[x+w/2,y-31])} anchor={circle?circleAnchor():[x+w/2,y]} onPosition={p=>place('width',p)} onEdit={()=>dimension('width')}/>{!circle&&<DraggableDimension label="Edit height dimension" text={format(rectangle.height)} position={position('height',[x+w+59,y+h/2-5])} anchor={[x+w,y+h/2]} onPosition={p=>place('height',p)} onEdit={()=>dimension('height')}/>}</>}
    {circle&&dimensionEdge('width','M'+x+' '+(y+h/2)+'a'+w/2+' '+h/2+' 0 1 0 '+w+' 0a'+w/2+' '+h/2+' 0 1 0 '+(-w)+' 0','Circular sketch edge')}
    {!circle&&dimensionEdge('width','M'+x+' '+y+'h'+w,'Horizontal sketch edge')}
    {!circle&&dimensionEdge('height','M'+(x+w)+' '+y+'v'+h,'Vertical sketch edge')}
    {!circle&&dimensionEdge('width','M'+x+' '+(y+h)+'h'+w,'Bottom sketch edge')}
    {!circle&&dimensionEdge('height','M'+x+' '+y+'v'+h,'Left sketch edge')}
   </g>}
   <SketchAxes xy={xy} onReference={mode==='select'?onReference:undefined}/><SketchReferences points={targets} hover={hover} xy={xy} onReference={mode==='select'?onReference:undefined}/>
  </svg>
  <button className="sketch-origin button" onClick={()=>setView(v=>({...v,ox:400,oy:310}))}>Show origin</button>
  <button className="sketch-fit button" onClick={()=>setView(fit())}>Fit sketch</button>
  <div className="sketch-state"><span className="status-dot"/>{supportLabel?'Face-attached sketch':'Planar sketch'} · {circle?'center + diameter':'position + dimensions'} · {display.snap?'1 mm snap':'snap off'}</div>
 </div>
}
