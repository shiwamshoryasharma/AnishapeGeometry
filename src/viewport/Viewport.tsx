import {MeasurementOverlay,type Measurement} from './MeasurementOverlay'
import type {DisplaySketch} from '../cad/sketch-display'
import { useTheme } from '../theme/theme'
import { extrusionRange, sketchToWorld } from '../cad/planes'
import { ExtrudeGizmo, type ExtrusionHandle } from './ExtrudeGizmo'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ModelResult, Plane, Vec3 } from '../cad/types'
import type { Selection } from '../store/editor'
export interface CameraOrientation {direction:Vec3;up:Vec3}
export type ViewName='Custom'|'Isometric'|'Front'|'Back'|'Top'|'Bottom'|'Left'|'Right'
export interface ViewportHandle {orbit(yaw:number,pitch:number):void; focusValue():boolean;fit():void;view(name:ViewName):void;projection(perspective:boolean):void }
interface Props {measurement?:Measurement;selectedSketch?:{id:string;regionId?:string};onSketchSelect?:(id:string,regionId?:string)=>void;sketches?:DisplaySketch[];extraHandles?:ExtrusionHandle[];bodyDraft?:{bodyId:string;offset:Vec3};onOrientation?:(value:CameraOrientation)=>void;onCustomView?:()=>void; hiddenBodies?:Set<string>; pickPlanes?:boolean;onPlaneSelect?:(plane:Plane)=>void;onContext?:(x:number,y:number,selection:Selection|null)=>void; extrusion?:ExtrusionHandle; model:ModelResult|null; selection?:Selection[];onSelect?:(selection:Selection|null,add:boolean)=>void;filter?:'face'|'edge';planes?:boolean;preview?:boolean;compact?:boolean }
interface SceneState {measurement:MeasurementOverlay;sketchGroup:THREE.Group;extras:ExtrudeGizmo[];grid:THREE.GridHelper;orbit:(yaw:number,pitch:number)=>void;gizmo:ExtrudeGizmo;scene:THREE.Scene;renderer:THREE.WebGLRenderer;camera:THREE.PerspectiveCamera|THREE.OrthographicCamera;controls:OrbitControls;group:THREE.Group;render:()=>void;fit:()=>void;view:(name:ViewName)=>void;projection:(perspective:boolean)=>void}
function disposeGroup(group:THREE.Group){group.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose())}});group.clear()}
export const Viewport=forwardRef<ViewportHandle,Props>(function Viewport(props,ref){
  const theme=useTheme()
  const {model,planes,preview,selection,hiddenBodies}=props
  const host=useRef<HTMLDivElement>(null),runtime=useRef<SceneState|null>(null),latest=useRef(props)
  const lastFramedModel=useRef<ModelResult|null|undefined>(undefined)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{latest.current=props})
  useImperativeHandle(ref,()=>({orbit:(yaw,pitch)=>runtime.current?.orbit(yaw,pitch),focusValue:()=>{const rt=runtime.current;return !!rt&&(rt.gizmo.focusValue()||rt.extras.some(g=>g.focusValue()))},fit:()=>runtime.current?.fit(),view:name=>runtime.current?.view(name),projection:p=>runtime.current?.projection(p)}),[])
  useEffect(()=>{
    const element=host.current;if(!element)return
    let renderer:THREE.WebGLRenderer
    // oxlint-disable-next-line react/set-state-in-effect -- synchronize a failed external WebGL initialization with the UI
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false})}catch{setError('WebGL could not start. Enable hardware acceleration and reopen this page.');return}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#eeeee7');renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2
    element.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-label','3D model viewport. Drag to orbit, right-drag to pan, scroll to zoom.')
    const scene=new THREE.Scene(),group=new THREE.Group(),sketchGroup=new THREE.Group();scene.add(sketchGroup)
    scene.add(group,new THREE.HemisphereLight(0xffffff,0x747d73,2.7))
    const key=new THREE.DirectionalLight(0xfff2df,4.5);key.position.set(30,-40,70);scene.add(key)
    const fill=new THREE.DirectionalLight(0xc7dbe5,2);fill.position.set(-40,20,30);scene.add(fill)
    const grid=new THREE.GridHelper(400,40,0xc4c9bc,0xdce0d5);grid.rotation.x=Math.PI/2;grid.position.z=-0.02;scene.add(grid)
    const axis=new THREE.AxesHelper(30);scene.add(axis)
    let camera:THREE.PerspectiveCamera|THREE.OrthographicCamera=new THREE.OrthographicCamera(-80,80,60,-60,0.01,1000000)
    camera.up.set(0,0,1);camera.position.set(90,-120,95)
    const controls=new OrbitControls<THREE.PerspectiveCamera | THREE.OrthographicCamera>(camera,renderer.domElement)
    controls.enableDamping=false;controls.minDistance=0.1;controls.maxDistance=100000;controls.screenSpacePanning=true
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2()
    let resize:ResizeObserver
    let measurement:MeasurementOverlay|undefined
    let gizmo:ExtrudeGizmo | undefined
    const extras:ExtrudeGizmo[]=[]
    let orientationKey=''
    const render=()=>{measurement?.update();gizmo?.update();extras.forEach(g=>g.update());renderer.render(scene,camera);const direction=camera.position.clone().sub(controls.target).normalize(),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),value={direction:direction.toArray() as Vec3,up:up.toArray() as Vec3},key=[...value.direction,...value.up].map(n=>n.toFixed(5)).join(',');if(key!==orientationKey){orientationKey=key;latest.current.onOrientation?.(value)}}
    const resizeCanvas=()=>{
      const width=element.clientWidth,height=element.clientHeight
      if(!width||!height)return
      renderer.setSize(width,height)
      if(camera instanceof THREE.PerspectiveCamera)camera.aspect=width/height
      else{const span=(camera.top-camera.bottom)/2;camera.left=-span*width/height;camera.right=span*width/height}
      camera.updateProjectionMatrix();render()
    }
    // Fit the model and draft together so small face features do not crop their support.
    const framing=()=>{
      const box=new THREE.Box3(),bounds=latest.current.model?.bounds,e=latest.current.extrusion
      if(bounds){box.expandByPoint(new THREE.Vector3(...bounds.min));box.expandByPoint(new THREE.Vector3(...bounds.max))}
      for(const sketch of latest.current.sketches??[])for(const line of sketch.lines)for(const point of line.points)box.expandByPoint(new THREE.Vector3(...point))
      const draft=latest.current.bodyDraft,body=draft?latest.current.model?.bodies?.find(b=>b.id===draft.bodyId):undefined
      if(draft&&body){box.expandByPoint(new THREE.Vector3(...body.bounds.min.map((n,i)=>n+draft.offset[i]) as Vec3));box.expandByPoint(new THREE.Vector3(...body.bounds.max.map((n,i)=>n+draft.offset[i]) as Vec3))}
      if(e?.sketch){
        const p=e.sketch,range=extrusionRange(e.distance,e.direction),circle=p.profile==='circle'
        const x0=p.x-(circle?p.width/2:0),y0=p.y-(circle?p.width/2:0)
        for(const u of [x0,x0+p.width])for(const v of [y0,y0+(circle?p.width:p.height)])for(const depth of [range.start,range.start+range.travel])
          box.expandByPoint(new THREE.Vector3(...sketchToWorld(p,u,v,(p.offset??0)+depth)))
      }
      return box
    }
    const target=()=>{const box=framing();return box.isEmpty()?new THREE.Vector3(15,10,0):box.getCenter(new THREE.Vector3())}
    const size=()=>{const box=framing();return box.isEmpty()?75:Math.max(...box.getSize(new THREE.Vector3()).toArray(),1)}
    const fit=()=>{
      const span=size()*0.9*Math.max(1,element.clientHeight/Math.max(element.clientWidth,1)),center=target()
      const direction=camera.position.clone().sub(controls.target).normalize()
      if(direction.length()<0.1)direction.set(1,-1,0.8).normalize()
      controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,size()*2.8)
      if(camera instanceof THREE.OrthographicCamera){camera.top=span;camera.bottom=-span;camera.zoom=1}
      camera.near=0.01;camera.far=Math.max(10000,size()*20);resizeCanvas();controls.update();render()
    }
    const view=(name:ViewName)=>{
      const directions:Record<ViewName,number[]>={Custom:[1,-1,0.8],Isometric:[1,-1,0.8],Front:[0,-1,0],Back:[0,1,0],Top:[0,0,1],Bottom:[0,0,-1],Left:[-1,0,0],Right:[1,0,0]}
      const d=directions[name],center=controls.target
      camera.up.set(0,0,1);if(name==='Top'||name==='Bottom')camera.up.set(0,1,0)
      camera.position.copy(center).add(new THREE.Vector3(d[0],d[1],d[2]).normalize().multiplyScalar(size()*2.8))
      camera.lookAt(center);controls.update();render()
    }
    const orbit=(yaw:number,pitch:number)=>{const offset=camera.position.clone().sub(controls.target),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);offset.applyAxisAngle(up,yaw).applyAxisAngle(right,pitch);up.applyAxisAngle(right,pitch);camera.up.copy(up);camera.position.copy(controls.target).add(offset);camera.lookAt(controls.target);controls.update();latest.current.onCustomView?.();render()}
    const projection=(perspective:boolean)=>{
      const position=camera.position.clone(),up=camera.up.clone()
      camera=perspective?new THREE.PerspectiveCamera(38,1,0.01,1000000):new THREE.OrthographicCamera(-80,80,60,-60,0.01,1000000)
      camera.position.copy(position);camera.up.copy(up);controls.object=camera
      if(runtime.current)runtime.current.camera=camera
      fit()
    }
    const pickSketch=()=>{
      if(!latest.current.onSketchSelect||latest.current.pickPlanes)return undefined
      raycaster.params.Points.threshold=size()*.012
      const hits=raycaster.intersectObjects(sketchGroup.children,false)
      return hits.find(h=>h.object.userData.kind==='sketch-region')??hits[0]
    }
    const pick=(event:MouseEvent)=>{
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);raycaster.params.Line.threshold=size()*.012
      const sketch=pickSketch();if(sketch)return sketch.object
      const hit=raycaster.intersectObjects(group.children.filter(o=>o.userData.kind===latest.current.filter),false)[0]
      return hit?.object
    }
    const onContext=(event:MouseEvent)=>{event.preventDefault();if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;const object=pick(event);latest.current.onContext?.(event.clientX,event.clientY,object&&['face','edge'].includes(object.userData.kind)?{kind:object.userData.kind as 'face'|'edge',id:String(object.userData.id)}:null)}
    let hovered:THREE.Object3D|undefined
    const resetHover=()=>{if(hovered instanceof THREE.Mesh&&hovered.userData.kind==='face')(hovered.material as THREE.MeshStandardMaterial).emissive.set(0x000000);hovered=undefined}
    const onMove=(event:PointerEvent)=>{if(event.buttons){if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)latest.current.onCustomView?.();return;}const object=pick(event);if(object===hovered)return;resetHover();hovered=object;if(object instanceof THREE.Mesh&&object.userData.kind==='face')(object.material as THREE.MeshStandardMaterial).emissive.set(0x282014);renderer.domElement.style.cursor=object?'pointer':'default';render()}
    const onLeave=()=>{resetHover();render()}
    renderer.domElement.addEventListener('contextmenu',onContext);renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointerleave',onLeave)
    const down={x:0,y:0}
    const onDown=(event:PointerEvent)=>{down.x=event.clientX;down.y=event.clientY}
    const onUp=(event:PointerEvent)=>{
      if(event.button!==0||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5||!latest.current.onSelect)return
      const rect=renderer.domElement.getBoundingClientRect()
      pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1)
      raycaster.setFromCamera(pointer,camera);raycaster.params.Line.threshold=size()*0.012
      const sketchHit=pickSketch();if(sketchHit){latest.current.onSketchSelect?.(String(sketchHit.object.userData.id),sketchHit.object.userData.regionId as string|undefined);return}
      const objects=group.children.filter(o=>o.userData.kind===latest.current.filter||(latest.current.pickPlanes&&o.userData.kind==='plane'))
      const hit=raycaster.intersectObjects(objects,false)[0]
      if(hit?.object.userData.kind==='plane'){latest.current.onPlaneSelect?.(hit.object.name as Plane);return}
      latest.current.onSelect(hit?{kind:hit.object.userData.kind as 'face'|'edge',id:String(hit.object.userData.id)}:null,event.ctrlKey||event.metaKey||event.shiftKey)
    }
    controls.addEventListener('change',render)
    renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp)
    const onLost=(e:Event)=>{e.preventDefault();setError('The graphics context was lost. Your saved project is safe; reload to restore the viewport.')}
    renderer.domElement.addEventListener('webglcontextlost',onLost)
    gizmo=new ExtrudeGizmo(scene,element,()=>camera,locked=>{controls.enabled=!locked})
    extras.push(...[0,1].map(()=>new ExtrudeGizmo(scene,element,()=>camera,locked=>{controls.enabled=!locked})))
    measurement=new MeasurementOverlay(element,()=>camera,locked=>{controls.enabled=!locked})
    runtime.current={measurement,sketchGroup,extras,grid,orbit,gizmo,scene,renderer,camera,controls,group,render,fit,view,projection}
    resize=new ResizeObserver(resizeCanvas);resize.observe(element);fit()
    return()=>{renderer.domElement.removeEventListener('contextmenu',onContext);renderer.domElement.removeEventListener('pointermove',onMove);renderer.domElement.removeEventListener('pointerleave',onLeave);gizmo?.dispose();measurement?.dispose();extras.forEach(g=>g.dispose());renderer.domElement.removeEventListener('webglcontextlost',onLost);renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);resize.disconnect();controls.dispose();disposeGroup(group);disposeGroup(sketchGroup);grid.geometry.dispose();(grid.material as THREE.Material).dispose();axis.geometry.dispose();(axis.material as THREE.Material).dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();runtime.current=null}
  },[])
  useEffect(()=>{
    const rt=runtime.current;if(!rt)return
    disposeGroup(rt.group)
    if(model){
      for(const face of model.faces){
        if(face.bodyId&&hiddenBodies?.has(face.bodyId))continue
        const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.BufferAttribute(face.positions,3))
        const geometry=mergeVertices(raw,1e-5);raw.dispose();geometry.computeVertexNormals()
        const material=new THREE.MeshStandardMaterial({color:preview?0xbdbdad:0xb7b6a8,metalness:0.5,roughness:0.37,side:THREE.DoubleSide})
        const mesh=new THREE.Mesh(geometry,material);mesh.userData={kind:'face',id:face.id,bodyId:face.bodyId};rt.group.add(mesh)
      }
      for(const edge of model.edges){
        if(edge.reference.bodyId&&hiddenBodies?.has(edge.reference.bodyId))continue
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(edge.positions,3))
        const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0x565e53,transparent:true,opacity:0.66,depthTest:true}))
        line.userData={kind:'edge',id:edge.reference.id,bodyId:edge.reference.bodyId};line.renderOrder=2;rt.group.add(line)
      }
    }
    if(planes){
      for(const [name,rotation,color] of [['XY',[0,0,0],0x8298a7],['XZ',[Math.PI/2,0,0],0xb8a27c],['YZ',[0,Math.PI/2,0],0x8ba68d]] as const){
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(70,70),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.1,side:THREE.DoubleSide,depthWrite:false}))
        mesh.rotation.set(rotation[0],rotation[1],rotation[2]);mesh.name=name;mesh.userData={kind:'plane'};rt.group.add(mesh)
      }
    }
    if((!latest.current.extrusion||latest.current.extraHandles?.length)&&lastFramedModel.current!==model)rt.fit();else rt.render();lastFramedModel.current=model
  },[model,planes,preview,hiddenBodies])
  useEffect(()=>{
    const rt=runtime.current;if(!rt)return
    const style=getComputedStyle(document.documentElement),color=(name:string)=>style.getPropertyValue(name).trim()
    rt.renderer.setClearColor(color('--canvas'));const gridColors=rt.grid.geometry.getAttribute('color');for(let i=0;i<gridColors.count;i++){const c=new THREE.Color(color(i<8?'--grid-major':'--grid'));gridColors.setXYZ(i,c.r,c.g,c.b)}gridColors.needsUpdate=true
    rt.group.children.forEach(object=>{
      const selected=selection?.some(s=>s.id===object.userData.id&&s.kind===object.userData.kind)
      if(object instanceof THREE.Mesh&&object.userData.kind==='face')(object.material as THREE.MeshStandardMaterial).color.set(selected?color('--selection'):preview?color('--body-preview'):color('--body'))
      if(object instanceof THREE.Line){const material=object.material as THREE.LineBasicMaterial;material.color.set(selected?color('--selection'):color('--edge'));material.opacity=selected?1:0.66;material.depthTest=!selected}
    });rt.render()
  },[selection,preview,model,planes,hiddenBodies,theme])
  useEffect(()=>{const rt=runtime.current;if(!rt)return;for(const object of rt.group.children){const delta=props.bodyDraft&&props.bodyDraft.bodyId===object.userData.bodyId?props.bodyDraft.offset:[0,0,0];object.position.set(delta[0],delta[1],delta[2])}rt.render()},[props.bodyDraft,model,planes,hiddenBodies])
  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;disposeGroup(rt.sketchGroup)
    const color=getComputedStyle(document.documentElement).getPropertyValue('--sketch-blue').trim()
    for(const sketch of props.sketches??[])for(const item of sketch.lines){if(item.points.length===1){const point=new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...item.points[0])]),new THREE.PointsMaterial({color:props.selectedSketch?.id===sketch.id?'#e1a340':color,size:7,sizeAttenuation:false,depthTest:false}));point.renderOrder=6;point.userData={kind:'sketch',id:sketch.id};rt.sketchGroup.add(point);continue}const geometry=new THREE.BufferGeometry().setFromPoints(item.points.map(p=>new THREE.Vector3(...p))),material=item.construction?new THREE.LineDashedMaterial({color,dashSize:1.5,gapSize:1,depthTest:false,transparent:true,opacity:.7}):new THREE.LineBasicMaterial({color:props.selectedSketch?.id===sketch.id?'#e1a340':color,depthTest:false});const line=new THREE.Line(geometry,material);line.computeLineDistances();line.renderOrder=5;line.userData={kind:'sketch',id:sketch.id};rt.sketchGroup.add(line)}
    for(const sketch of props.sketches??[])for(const region of sketch.regions){const shape=new THREE.Shape(region.outer.map(p=>new THREE.Vector2(...p)));for(const hole of region.holes)shape.holes.push(new THREE.Path(hole.map(p=>new THREE.Vector2(...p))));const geometry=new THREE.ShapeGeometry(shape),f=sketch.frame,matrix=new THREE.Matrix4().makeBasis(new THREE.Vector3(...f.u),new THREE.Vector3(...f.v),new THREE.Vector3(...f.normal));matrix.setPosition(...f.origin);geometry.applyMatrix4(matrix);const selected=props.selectedSketch?.id===sketch.id&&(!props.selectedSketch.regionId||props.selectedSketch.regionId===region.id),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#e1a340',side:THREE.DoubleSide,transparent:true,opacity:selected?.22:0,depthWrite:false,depthTest:false}));mesh.userData={kind:'sketch-region',id:sketch.id,regionId:region.id};mesh.renderOrder=4;rt.sketchGroup.add(mesh)}
    if(!model?.bodies?.length)rt.fit();else rt.render()
  },[props.sketches,props.selectedSketch,theme,model])
  useEffect(()=>{runtime.current?.measurement.setOptions(props.measurement??null)},[props.measurement])
  const hasExtrusion=!!props.extrusion
  useEffect(()=>{
    const rt=runtime.current
    if(!rt)return
    rt.gizmo.setOptions(props.extrusion??null)
    rt.extras.forEach((g,i)=>g.setOptions(props.extraHandles?.[i]??null))
    rt.group.visible=true
    rt.render()
  },[props.extrusion,props.extraHandles])
  useEffect(()=>{runtime.current?.fit()},[hasExtrusion])
  return <div data-visible-sketches={props.sketches?.filter(s=>s.lines.length).length??0} className={`viewport ${props.compact?'viewport-compact':''}`} ref={host}>{error&&<div className="viewport-error" role="alert">{error}</div>}</div>
})
