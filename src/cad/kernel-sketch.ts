import {sweepPath,pathTangent} from './sweep-path'
import type {OpenCascadeInstance,TopoDS_Edge} from 'opencascade.js'
import type {SketchFeature,Point2,SketchCurve,Vec3} from './types'
import {Scope} from './kernel-support'
import {sketchNormal,sketchToWorld} from './planes'
import {sketchRegions,type SketchLoop} from './sketch-entities'
export function entityProfileFace(oc:OpenCascadeInstance,sketch:SketchFeature,depth:number,regionId:string|undefined,scope:Scope){
 regionId??=sketch.parameters.defaultRegionId
 const regions=sketchRegions(sketch.parameters.entities!),region=regionId?regions.find(r=>r.id===regionId):regions.length===1?regions[0]:undefined
 if(!region)throw Error(regionId?'Selected sketch region is missing or unavailable. Reselect a closed region.':'Choose one closed sketch region; open and construction geometry cannot extrude.')
 const wire=(loop:SketchLoop,reverse=false)=>{
  const builder=scope.own(new oc.BRepBuilderAPI_MakeWire_1())
  for(const segment of loop.segments){const e=segment.entity;let edge:TopoDS_Edge
   edge=entityEdge(oc,sketch,e,depth,scope)
   if(segment.reversed)edge=scope.own(oc.TopoDS.Edge_1(scope.own(edge.Reversed())))
   builder.Add_1(edge)
  }
  if(!builder.IsDone())throw Error('Sketch edges do not form a closed wire.')
  const value=scope.own(builder.Wire());return reverse?scope.own(oc.TopoDS.Wire_1(scope.own(value.Reversed()))):value
 }
 const face=scope.own(new oc.BRepBuilderAPI_MakeFace_15(wire(region.outer),true))
 for(const hole of region.holes)face.Add(wire(hole,true))
 if(!face.IsDone())throw Error('Selected sketch region cannot form a planar face.')
 const result=scope.own(face.Face());if(!scope.own(new oc.BRepCheck_Analyzer(result,true,false)).IsValid_2())throw Error('Sketch region boundaries are invalid or intersect. Repair the sketch before extruding.')
 return result
}

function entityEdge(oc:OpenCascadeInstance,sketch:SketchFeature,e:SketchCurve,depth:number,scope:Scope){
 const p=sketch.parameters,point=(v:Point2)=>scope.own(new oc.gp_Pnt_3(...sketchToWorld(p,v[0],v[1],depth)));let edge:TopoDS_Edge
   if(e.type==='line')edge=scope.own(scope.own(new oc.BRepBuilderAPI_MakeEdge_3(point(e.start),point(e.end))).Edge())
   else if(e.type==='circle'){const axis=scope.own(new oc.gp_Ax2_3(point(e.center),scope.own(new oc.gp_Dir_4(...sketchNormal(p))))),circle=scope.own(new oc.gp_Circ_2(axis,e.radius));edge=scope.own(scope.own(new oc.BRepBuilderAPI_MakeEdge_8(circle)).Edge())}
   else{const arc=scope.own(new oc.GC_MakeArcOfCircle_4(point(e.start),point(e.mid),point(e.end)));if(!arc.IsDone())throw Error('Arc construction failed.');const trimmed=scope.own(arc.Value()),curve=scope.own(new oc.Handle_Geom_Curve_2(trimmed.get()));edge=scope.own(scope.own(new oc.BRepBuilderAPI_MakeEdge_24(curve)).Edge())}
 return edge
}
export function sweepWire(oc:OpenCascadeInstance,sketch:SketchFeature,scope:Scope){
 if(!sketch.parameters.entities)throw Error('Draw an open line/arc path in a multi-entity sketch first.')
 const segments=sweepPath(sketch.parameters.entities),builder=scope.own(new oc.BRepBuilderAPI_MakeWire_1()),p=sketch.parameters
 for(const segment of segments){let edge=entityEdge(oc,sketch,segment.entity,p.offset??0,scope);if(segment.reversed)edge=scope.own(oc.TopoDS.Edge_1(scope.own(edge.Reversed())));builder.Add_1(edge)}
 if(!builder.IsDone())throw Error('Sweep path cannot form a connected wire.')
 const first=segments[0],start=first.reversed?first.entity.end:first.entity.start,t=pathTangent(first),origin=sketchToWorld(p,0,0,0),direction=sketchToWorld(p,t[0],t[1],0).map((n,i)=>n-origin[i]) as Vec3
 return {wire:scope.own(builder.Wire()),start:sketchToWorld(p,start[0],start[1],p.offset??0),direction}
}
