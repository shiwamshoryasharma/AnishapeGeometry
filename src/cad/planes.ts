import type { Plane, Vec3, SketchFeature, Feature, PlaneFrame } from './types'
/** Right-handed sketch coordinates; positive depth follows the sketch normal. */
export function toWorld(plane:Plane,u:number,v:number,depth=0):Vec3 {
  return plane==='XY'?[u,v,depth]:plane==='XZ'?[u,-depth,v]:[depth,u,v]
}

export function extrusionRange(distance:number,direction:'forward'|'reverse'|'symmetric'='forward') {
  return {start:direction==='symmetric'?-distance/2:0,travel:direction==='reverse'?-distance:distance}
}
export function resolveSketchPlane(parameters:SketchFeature['parameters'],features:Feature[]):SketchFeature['parameters'] {
 if(!parameters.planeId)return parameters
 const feature=features.find(f=>f.id===parameters.planeId)
 if(feature?.type!=='plane')throw Error('Reference plane is unavailable.')
 return {...parameters,plane:feature.parameters.plane,offset:feature.parameters.offset}
}
/** Common placement for the viewport, manipulator and fitted camera. */
export function extrusionCenter(p:SketchFeature['parameters'],distance:number,direction:'forward'|'reverse'|'symmetric'='forward',fraction=.5):Vec3 {
 const range=extrusionRange(distance,direction),circle=p.profile==='circle'
 return sketchToWorld(p,p.x+(circle?0:p.width/2),p.y+(circle?0:p.height/2),(p.offset??0)+range.start+range.travel*fraction)
}

export function planeFrame(plane:Plane,offset=0):PlaneFrame {
 return {origin:toWorld(plane,0,0,offset),u:toWorld(plane,1,0),v:toWorld(plane,0,1),normal:toWorld(plane,0,0,1)}
}
export function framePoint(frame:PlaneFrame,u:number,v:number,depth=0):Vec3 {
 return frame.origin.map((n,i)=>n+frame.u[i]*u+frame.v[i]*v+frame.normal[i]*depth) as Vec3
}
export function frameLocal(frame:PlaneFrame,p:Vec3):Vec3 {
 const delta=p.map((n,i)=>n-frame.origin[i]);return [frame.u,frame.v,frame.normal].map(axis=>axis.reduce((sum,n,i)=>sum+n*delta[i],0)) as Vec3
}
export function sketchToWorld(p:SketchFeature['parameters'],u:number,v:number,depth=0):Vec3 {
 return p.frame?framePoint(p.frame,u,v,depth):toWorld(p.plane,u,v,depth)
}
export function sketchNormal(p:SketchFeature['parameters']):Vec3 {return p.frame?.normal??toWorld(p.plane,0,0,1)}
