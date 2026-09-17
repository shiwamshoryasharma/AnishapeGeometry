import * as THREE from 'three'
import type {Vec3} from '../cad/types'
export interface Measurement {key:string;text:string;anchor:Vec3}
/** Screen-space leader with a world-space anchor; this never changes geometry. */
export class MeasurementOverlay {
 private readonly root=document.createElement('div')
 private readonly svg=document.createElementNS('http://www.w3.org/2000/svg','svg')
 private readonly line=document.createElementNS('http://www.w3.org/2000/svg','path')
 private readonly button=document.createElement('button')
 private options:Measurement|null=null
 private offset={x:95,y:-60}
 private drag:{x:number;y:number;offset:{x:number;y:number}}|null=null
 private host:HTMLElement
 private camera:()=>THREE.Camera
 private lock:(locked:boolean)=>void
 constructor(host:HTMLElement,camera:()=>THREE.Camera,lock:(locked:boolean)=>void){
  this.host=host;this.camera=camera;this.lock=lock
  this.root.className='measurement-overlay';this.button.type='button';this.button.className='measurement-callout';this.button.setAttribute('aria-label','Drag edge measurement');this.button.title='Drag to place this measurement. Arrow keys move the label. Read-only measurement.'
  const id='measure-arrow-'+crypto.randomUUID(),defs=document.createElementNS(this.svg.namespaceURI,'defs'),marker=document.createElementNS(this.svg.namespaceURI,'marker'),arrow=document.createElementNS(this.svg.namespaceURI,'path');marker.setAttribute('id',id);marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','0');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','7');marker.setAttribute('markerHeight','7');marker.setAttribute('orient','auto');arrow.setAttribute('d','M0 5L10 0V10Z');arrow.setAttribute('fill','currentColor');marker.append(arrow);defs.append(marker);this.line.setAttribute('marker-start','url(#'+id+')');this.svg.append(defs,this.line);this.root.append(this.svg,this.button);host.append(this.root)
  this.button.onpointerdown=e=>{e.preventDefault();e.stopPropagation();this.drag={x:e.clientX,y:e.clientY,offset:{...this.offset}};this.button.setPointerCapture(e.pointerId);this.lock(true)}
  this.button.onpointermove=e=>{if(!this.drag)return;e.stopPropagation();this.offset={x:this.drag.offset.x+e.clientX-this.drag.x,y:this.drag.offset.y+e.clientY-this.drag.y};this.update()}
  const end=(e:PointerEvent)=>{if(this.button.hasPointerCapture(e.pointerId))this.button.releasePointerCapture(e.pointerId);this.drag=null;this.lock(false)};this.button.onpointerup=end;this.button.onpointercancel=end;this.button.onlostpointercapture=()=>{this.drag=null;this.lock(false)}
  this.button.onkeydown=e=>{e.stopPropagation();const step=e.shiftKey?20:5;if(e.key.startsWith('Arrow')){e.preventDefault();if(e.key==='ArrowLeft')this.offset.x-=step;if(e.key==='ArrowRight')this.offset.x+=step;if(e.key==='ArrowUp')this.offset.y-=step;if(e.key==='ArrowDown')this.offset.y+=step;this.update()}if(e.key==='Escape'){this.offset={x:95,y:-60};this.update()}}
  this.root.hidden=true
 }
 setOptions(options:Measurement|null){if(options?.key!==this.options?.key)this.offset={x:95,y:-60};this.options=options;this.root.hidden=!options;if(options)this.button.textContent=options.text;this.update()}
 update(){if(!this.options)return;const projected=new THREE.Vector3(...this.options.anchor).project(this.camera()),width=this.host.clientWidth,height=this.host.clientHeight,x=(projected.x+1)/2*width,y=(1-projected.y)/2*height;this.root.hidden=projected.z>1||projected.z< -1;const labelX=Math.max(65,Math.min(width-65,x+this.offset.x)),labelY=Math.max(20,Math.min(height-20,y+this.offset.y));this.svg.setAttribute('viewBox','0 0 '+width+' '+height);this.line.setAttribute('d','M'+x+' '+y+'L'+labelX+' '+labelY);this.button.style.left=labelX+'px';this.button.style.top=labelY+'px'}
 dispose(){if(this.drag)this.lock(false);this.root.remove()}
}
