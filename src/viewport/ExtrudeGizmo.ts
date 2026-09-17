import type { SketchRegion } from '../cad/sketch-entities'
import * as THREE from 'three'
import { toWorld, extrusionCenter, sketchNormal, sketchToWorld, extrusionRange } from '../cad/planes'
import { extrusionDragDistance } from '../cad/extrusion-drag'
import { UnitService } from '../cad/units'
import type { SketchFeature, Unit, FaceMesh, ExtrudeDirection, Vec3 } from '../cad/types'

export interface ExtrusionHandle {
  color?:number
  showValue?:boolean
  onActivate?:()=>void
  region?:SketchRegion
  signed?:boolean
  anchor?:Vec3
  axis?:Vec3
  label?:string
  inputLabel?:string
  text?:string
  onText?:(value:string)=>void
  onAccept?:()=>void
  sketch?:SketchFeature['parameters']
  face?:FaceMesh
  direction?:ExtrudeDirection
  distance:number
  unit:Unit
  draft:boolean
  disabled:boolean
  onChange:(distance:number)=>void
  onRelease:(distance:number)=>void
}
type Camera=THREE.PerspectiveCamera|THREE.OrthographicCamera
interface Drag {
  pointer:number;x:number;y:number;initial:number;value:number
  axis:{x:number;y:number};worldPerPixel:number
}
const snap:Record<Unit,number>={mm:1,cm:1,m:1,um:1,in:.254,ft:.3048}

/** Render-only manipulator. It never creates or commits authoritative geometry. */
export class ExtrudeGizmo {
  private group=new THREE.Group()
  private arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(),1,0xc37434)
  private ghost=new THREE.Group()
  private body=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({
    color:0xcba367,transparent:true,opacity:.36,depthWrite:false,
  }))
  private outline=new THREE.LineSegments(new THREE.EdgesGeometry(this.body.geometry),new THREE.LineBasicMaterial({color:0xb47531}))
  private faceGhost=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xe3b669,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}))
  private profileGhost=new THREE.Group()
  private profileBody=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xcba367,transparent:true,opacity:.36,depthWrite:false,side:THREE.DoubleSide}))
  private profileEdges=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xb47531}))
  private profileKey=''
  private circleProfile=false
  private sourceFace:FaceMesh|undefined
  private button=document.createElement('button')
  private label=document.createElement('input')
  private inputWrap=document.createElement('div')
  private unitLabel=document.createElement('span')
  private editStart=''
  private options:ExtrusionHandle|null=null
  private drag:Drag|null=null

  private scene:THREE.Scene
  private host:HTMLElement
  private camera:()=>Camera
  private lockOrbit:(locked:boolean)=>void
  constructor(
    scene:THREE.Scene,
    host:HTMLElement,
    camera:()=>Camera,
    lockOrbit:(locked:boolean)=>void,
  ) {
    this.scene=scene;this.host=host;this.camera=camera;this.lockOrbit=lockOrbit
    this.group.add(this.arrow,this.ghost,this.faceGhost,this.profileGhost)
    this.profileGhost.add(this.profileBody,this.profileEdges)
    this.ghost.add(this.body,this.outline)
    this.group.visible=false
    this.scene.add(this.group)
    for(const part of [this.arrow.line,this.arrow.cone]){
      const material=part.material as THREE.Material
      material.depthTest=false
      part.renderOrder=1000
    }
    this.button.className='extrude-drag-handle'
    this.button.type='button'
    this.button.setAttribute('aria-label','Drag extrusion distance')
    this.button.title='Drag along the arrow. Shift: finer adjustment. Arrow keys: adjust distance.'
    this.inputWrap.className='gizmo-value-editor'
    this.label.type='text';this.label.spellcheck=false
    this.inputWrap.append(this.label,this.unitLabel);this.inputWrap.hidden=true
    this.label.addEventListener('input',this.input)
    this.label.addEventListener('focus',this.focus)
    this.label.addEventListener('keydown',this.inputKey)
    this.label.addEventListener('pointerdown',this.inputPointer)
    this.host.appendChild(this.inputWrap)
    this.button.hidden=true
    this.host.appendChild(this.button)
    this.button.addEventListener('pointerdown',this.down)
    this.button.addEventListener('pointermove',this.move)
    this.button.addEventListener('pointerup',this.up)
    this.button.addEventListener('pointercancel',this.cancel)
    this.button.addEventListener('keydown',this.key)
  }

  setOptions(options:ExtrusionHandle|null) {
    if(!!(options?.sketch?.profile==='circle')!==this.circleProfile){
      this.circleProfile=options?.sketch?.profile==='circle'
      this.body.geometry.dispose();this.outline.geometry.dispose()
      this.body.geometry=(this.circleProfile?new THREE.CylinderGeometry(.5,.5,1,64).rotateX(Math.PI/2):new THREE.BoxGeometry(1,1,1)) as THREE.BoxGeometry
      this.outline.geometry=new THREE.EdgesGeometry(this.body.geometry)
    }
    const profileKey=options?.region?JSON.stringify([options.region.outer.points,options.region.holes.map(h=>h.points)]):''
    if(profileKey!==this.profileKey){this.profileKey=profileKey;this.profileBody.geometry.dispose();this.profileEdges.geometry.dispose();this.profileBody.geometry=new THREE.BufferGeometry();this.profileEdges.geometry=new THREE.BufferGeometry();if(options?.region){const points=(p:number[][])=>p.map(v=>new THREE.Vector2(v[0],v[1])),shape=new THREE.Shape(points(options.region.outer.points));shape.holes=options.region.holes.map(h=>new THREE.Path(points(h.points)));this.profileBody.geometry=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,steps:1});this.profileEdges.geometry=new THREE.EdgesGeometry(this.profileBody.geometry)}}
    this.options=options
    this.group.visible=!!options
    this.button.hidden=!options
    this.arrow.setColor(options?.color??0xc37434)
    this.button.style.borderColor=options?.color!==undefined?'#'+options.color.toString(16).padStart(6,'0'):''
    this.inputWrap.hidden=!options||options.showValue===false
    this.label.disabled=options?.disabled??false
    this.button.setAttribute('aria-label',options?.label??'Drag extrusion distance')
    this.label.setAttribute('aria-label',options?.inputLabel??'Canvas distance')
    this.button.disabled=options?.disabled??false
    if(!options&&this.drag)this.end(false)
    if(options?.face!==this.sourceFace){
      this.sourceFace=options?.face
      this.faceGhost.geometry.dispose()
      this.faceGhost.geometry=new THREE.BufferGeometry()
      if(this.sourceFace)this.faceGhost.geometry.setAttribute('position',new THREE.BufferAttribute(this.sourceFace.positions,3))
    }
    this.update()
  }

  private worldPerPixel() {
    const camera=this.camera(),height=Math.max(this.host.clientHeight,1)
    if(camera instanceof THREE.OrthographicCamera)return (camera.top-camera.bottom)/camera.zoom/height
    const center=this.capCenter()
    const cameraPoint=center.applyMatrix4(camera.matrixWorldInverse)
    return 2*Math.abs(cameraPoint.z)*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/height
  }
  private normal() {
    const o=this.options!
    if(o.axis)return new THREE.Vector3(...o.axis).normalize()
    if(o.face)return new THREE.Vector3(...o.face.normal!)
    return new THREE.Vector3(...sketchNormal(o.sketch!)).multiplyScalar(o.direction==='reverse'?-1:1)
  }
  private capCenter(distance=this.options!.distance) {
    const o=this.options!
    if(o.anchor)return new THREE.Vector3(...o.anchor).addScaledVector(this.normal(),distance)
    if(o.face)return new THREE.Vector3(...o.face.center).addScaledVector(this.normal(),distance)
    return new THREE.Vector3(...extrusionCenter(o.sketch!,distance,o.direction,1))
  }  private screen(point:THREE.Vector3) {
    const p=point.clone().project(this.camera())
    return {x:(p.x+1)*this.host.clientWidth/2,y:(1-p.y)*this.host.clientHeight/2,z:p.z}
  }
  update() {
    const o=this.options
    if(!o)return
    const camera=this.camera()
    camera.updateMatrixWorld()
    const normal=this.normal()
    const cap=this.capCenter(),scale=Math.max(this.worldPerPixel(),.000001)
    this.arrow.position.copy(cap)
    this.arrow.setDirection(normal)
    this.arrow.setLength(scale*76,scale*18,scale*8)
    this.ghost.visible=o.draft&&!!o.sketch&&!o.sketch.entities
    this.profileGhost.visible=o.draft&&!!o.region
    this.faceGhost.visible=o.draft&&!!o.face
    if(o.sketch){
      const p=o.sketch
      this.ghost.position.set(...extrusionCenter(p,o.distance,o.direction))
      this.ghost.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...(p.frame?.u??toWorld(p.plane,1,0,0))),
        new THREE.Vector3(...(p.frame?.v??toWorld(p.plane,0,1,0))),
        new THREE.Vector3(...sketchNormal(p)),
      ))
      this.ghost.scale.set(p.width,p.height,Math.abs(o.distance))
      const range=extrusionRange(o.distance,o.direction);this.profileGhost.position.set(...sketchToWorld(p,0,0,(p.offset??0)+range.start));this.profileGhost.quaternion.copy(this.ghost.quaternion);this.profileGhost.scale.set(1,1,range.travel)
    }else this.faceGhost.position.copy(normal).multiplyScalar(o.distance);
    const tip=this.screen(cap.clone().addScaledVector(normal,scale*67))
    this.button.style.left=tip.x+'px'
    this.button.style.top=tip.y+'px'
    this.button.style.visibility=tip.z>1||tip.z<-1?'hidden':'visible'
    this.inputWrap.style.left=Math.max(8,Math.min(this.host.clientWidth-160,tip.x+28))+'px'
    this.inputWrap.style.top=Math.max(8,Math.min(this.host.clientHeight-44,tip.y-18))+'px'
    this.inputWrap.style.visibility=this.button.style.visibility
    const text=o.text??String(UnitService.fromInternal(o.distance,o.unit))
    if(this.label.value!==text)this.label.value=text
    this.unitLabel.textContent=o.unit
    this.label.title='Type a value or expression. Enter: preview. Escape: restore.'
    this.button.setAttribute('aria-description','Current value '+UnitService.format(o.distance,o.unit,3)+'. Tab to type an exact value.')
  }

  private down=(event:PointerEvent)=>{
    const o=this.options
    if(!o||o.disabled||event.button!==0)return
    event.preventDefault();event.stopPropagation();o.onActivate?.();this.button.focus()
    const cap=this.capCenter(),a=this.screen(cap),b=this.screen(this.capCenter(o.distance+1))
    this.drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,initial:o.distance,value:o.distance,
      axis:{x:b.x-a.x,y:b.y-a.y},worldPerPixel:this.worldPerPixel()*(o.direction==='symmetric'?2:1)}
    this.button.setPointerCapture(event.pointerId)
    this.button.classList.add('dragging')
    this.lockOrbit(true)
  }
  private move=(event:PointerEvent)=>{
    const drag=this.drag,o=this.options
    if(!drag||!o||event.pointerId!==drag.pointer)return
    event.preventDefault()
    drag.value=extrusionDragDistance(drag.initial,event.clientX-drag.x,event.clientY-drag.y,
      drag.axis,drag.worldPerPixel,snap[o.unit]*(event.shiftKey ? .1 : 1),(o.signed??!!o.face))
    o.onChange(drag.value)
  }
  private up=(event:PointerEvent)=>{
    if(event.pointerId!==this.drag?.pointer)return
    this.move(event);this.end(true)
  }
  focusValue() {
    if(!this.options||this.options.disabled||this.options.showValue===false)return false
    // Switching to typing freezes the current drag without triggering a stale preview.
    this.end(true,false);this.label.focus();this.label.select();return true
  }
  private inputPointer=(event:PointerEvent)=>{event.stopPropagation()}
  private focus=()=>{this.editStart=this.label.value;this.label.select()}
  private input=()=>this.options?.onText?.(this.label.value)
  private inputKey=(event:KeyboardEvent)=>{
    if(event.key==='Enter'){event.preventDefault();event.stopPropagation();this.label.blur();this.options?.onAccept?.()}
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.options?.onText?.(this.editStart);this.label.blur()}
  }
  private cancel=()=>this.end(false)
  private end(commit:boolean,preview=true) {
    const drag=this.drag,o=this.options
    if(!drag)return
    this.drag=null
    if(this.button.hasPointerCapture(drag.pointer))this.button.releasePointerCapture(drag.pointer)
    this.button.classList.remove('dragging');this.lockOrbit(false)
    const value=commit?drag.value:drag.initial
    o?.onChange(value)
    if(preview)o?.onRelease(value)
  }
  private key=(event:KeyboardEvent)=>{
    const o=this.options
    if(event.key==='Tab'&&this.focusValue()){event.preventDefault();event.stopPropagation();return}
    if(!o||o.disabled||!['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'].includes(event.key))return
    event.preventDefault();event.stopPropagation()
    const sign=event.key==='ArrowUp'||event.key==='ArrowRight'?1:-1
    const value=Math.max((o.signed??!!o.face)?-100000:.001,Math.min(100000,o.distance+sign*snap[o.unit]*(event.shiftKey ? .1 : 1)))
    o.onChange(value);o.onRelease(value)
  }
  dispose() {
    this.options=null
    this.end(false)
    this.button.removeEventListener('pointerdown',this.down)
    this.button.removeEventListener('pointermove',this.move)
    this.button.removeEventListener('pointerup',this.up)
    this.button.removeEventListener('pointercancel',this.cancel)
    this.button.removeEventListener('keydown',this.key)
    this.button.remove()
    this.label.removeEventListener('input',this.input);this.label.removeEventListener('focus',this.focus);this.label.removeEventListener('keydown',this.inputKey);this.label.removeEventListener('pointerdown',this.inputPointer);this.inputWrap.remove()
    this.scene.remove(this.group)
    this.body.geometry.dispose();this.body.material.dispose()
    this.outline.geometry.dispose();this.outline.material.dispose()
    this.faceGhost.geometry.dispose();this.faceGhost.material.dispose()
    this.profileBody.geometry.dispose();this.profileBody.material.dispose();this.profileEdges.geometry.dispose();this.profileEdges.material.dispose()
    this.arrow.dispose()

  }
}
