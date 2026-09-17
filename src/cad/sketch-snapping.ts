import type {PlaneFrame,ModelResult,Point2,SketchEntity,Vec3} from './types'
import {frameLocal} from './planes'
import {arcGeometry} from './sketch-entities'
export interface SketchSnapPoint {point:Point2;kind:'origin'|'center'|'face-center'|'endpoint'|'midpoint'|'point';label:string}
export function sketchSnapPoints(frame:PlaneFrame,model?:ModelResult|null,entities:SketchEntity[]=[]):SketchSnapPoint[]{
 const result:SketchSnapPoint[]=[{point:[0,0],kind:'origin',label:'Origin'}]
 const add=(point:Point2,kind:SketchSnapPoint['kind'],label:string)=>{if(point.every(Number.isFinite)&&!result.some(v=>Math.hypot(v.point[0]-point[0],v.point[1]-point[1])<1e-7))result.push({point,kind,label})}
 for(const face of model?.faces??[]){const p=frameLocal(frame,face.center);if(face.normal&&Math.abs(p[2])<1e-5&&Math.abs(face.normal.reduce((n,v,i)=>n+v*frame.normal[i],0))>1-1e-6)add([p[0],p[1]],'face-center','Face center')}
 for(const edge of model?.edges??[]){if(edge.positions.length<6)continue;const points:Vec3[]=[];for(let i=0;i<edge.positions.length;i+=3)points.push(frameLocal(frame,Array.from(edge.positions.slice(i,i+3)) as Vec3));if(points.some(p=>Math.abs(p[2])>1e-4))continue
  if(edge.curve){const p=frameLocal(frame,edge.curve.center);add([p[0],p[1]],'center','Circle center')}
  if(!edge.curve?.closed){const a=points[0],b=points.at(-1)!;add([a[0],a[1]],'endpoint','Endpoint');add([b[0],b[1]],'endpoint','Endpoint');if(Math.abs(Math.hypot(a[0]-b[0],a[1]-b[1])-edge.length)<1e-4)add([(a[0]+b[0])/2,(a[1]+b[1])/2],'midpoint','Midpoint')}
 }
 for(const e of entities){if(e.type==='point')add(e.position,'point','Sketch point');else if(e.type==='circle')add(e.center,'center','Circle center');else{add(e.start,'endpoint','Endpoint');add(e.end,'endpoint','Endpoint');if(e.type==='line')add([(e.start[0]+e.end[0])/2,(e.start[1]+e.end[1])/2],'midpoint','Midpoint');else{const a=arcGeometry(e.start,e.mid,e.end);add(a.center,'center','Arc center')}}}
 return result
}
export function snapSketchPoint(point:Point2,targets:SketchSnapPoint[],scale:number,grid:boolean):{point:Point2;target?:SketchSnapPoint}{
 let closest:SketchSnapPoint|undefined,distance=8/scale
 for(const target of targets){const d=Math.hypot(target.point[0]-point[0],target.point[1]-point[1]);if(d<distance){distance=d;closest=target}}
 return closest?{point:[...closest.point],target:closest}:{point:grid?[Math.round(point[0]),Math.round(point[1])]:point}
}
