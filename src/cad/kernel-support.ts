import { extrusionRange, frameLocal } from './planes'
import type { OpenCascadeInstance, TopoDS_Shape, TopoDS_Edge, TopoDS_Face, TopAbs_ShapeEnum, gp_Pnt } from 'opencascade.js'
import type { SketchFeature, Vec3, PushPullFeature, ExtrudeDirection, PlaneFrame } from './types'

export class Scope {
  private objects: { delete(): void }[] = []
  own<T extends { delete(): void }>(object: T): T { this.objects.push(object); return object }
  dispose() { for (const object of this.objects.reverse()) object.delete(); this.objects = [] }
}
export function xyz(point: gp_Pnt): Vec3 { const value: Vec3 = [point.X(), point.Y(), point.Z()]; point.delete(); return value }
function toLocal(sketch: SketchFeature, point: Vec3): Vec3 {
  if(sketch.parameters.frame)return frameLocal(sketch.parameters.frame,point)
  const [x,y,z] = point
  return sketch.parameters.plane === 'XY' ? [x,y,z] : sketch.parameters.plane === 'XZ' ? [x,z,-y] : [y,z,x]
}
// Semantic identity for this milestone's rectangular prism edges. Normalized corner
// endpoints survive width/height/depth changes; array indices never enter features.
export function edgeSignature(sketch: SketchFeature, depth: number, start: Vec3, end: Vec3, direction:ExtrudeDirection='forward'): string | null {
  if(sketch.parameters.entities)return null
  const {x,y,width,height} = sketch.parameters
  const normalize = (point: Vec3) => {
    const p = toLocal(sketch, point)
    const range=extrusionRange(depth,direction)
    return [(p[0]-x)/width, (p[1]-y)/height, (p[2]-range.start)/range.travel]
  }
  const ends = [normalize(start), normalize(end)]
  if (ends.flat().some(v => Math.abs(v-Math.round(v)) > 1e-6 || v < -1e-6 || v > 1.000001)) return null
  const rounded = ends.map(p => p.map(Math.round))
  const changing = [0,1,2].filter(i => rounded[0][i] !== rounded[1][i])
  if (changing.length !== 1) return null
  return `${'xyz'[changing[0]]}:${rounded.map(p => p.join(',')).sort().join(':')}`
}
export function visitEdges(oc: OpenCascadeInstance, shape: TopoDS_Shape, scope: Scope) {
  const explorer = scope.own(new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE as TopAbs_ShapeEnum, oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum))
  const edges: TopoDS_Edge[] = []
  while (explorer.More()) {
    const current = scope.own(explorer.Current())
    const edge = scope.own(oc.TopoDS.Edge_1(current))
    if (!edges.some(other => edge.IsSame(other))) edges.push(edge)
    explorer.Next()
  }
  return edges
}
export function endsOf(oc: OpenCascadeInstance, edge: TopoDS_Edge): [Vec3, Vec3] {
  const curve = new oc.BRepAdaptor_Curve_2(edge)
  try { return [xyz(curve.Value(curve.FirstParameter())), xyz(curve.Value(curve.LastParameter()))] }
  finally { curve.delete() }
}
export function shapeBounds(oc:OpenCascadeInstance,shape:TopoDS_Shape) {
  const box=new oc.Bnd_Box_1()
  try {oc.BRepBndLib.AddOptimal(shape,box,false,false);return {min:xyz(box.CornerMin()),max:xyz(box.CornerMax())}}
  finally {box.delete()}
}
export function normalizedCenter(center:Vec3,bounds:{min:Vec3;max:Vec3}):Vec3 {
  return center.map((n,i)=>(n-bounds.min[i])/Math.max(bounds.max[i]-bounds.min[i],1e-9)) as Vec3
}
export function planarNormal(oc:OpenCascadeInstance,face:TopoDS_Face):Vec3|null {
  const scope=new Scope()
  try {
    const surface=scope.own(new oc.BRepAdaptor_Surface_2(face,true))
    if(surface.GetType()!==oc.GeomAbs_SurfaceType.GeomAbs_Plane)return null
    const plane=scope.own(surface.Plane()),axis=scope.own(plane.Axis()),direction=scope.own(axis.Direction())
    const sign=face.Orientation_1()===oc.TopAbs_Orientation.TopAbs_REVERSED?-1:1
    const normal=[direction.X()*sign,direction.Y()*sign,direction.Z()*sign]
    const rounded=normal.map(Math.round) as Vec3
    return normal.map((n,i)=>Math.abs(n-rounded[i])<1e-10?rounded[i]:n) as Vec3
  }finally{scope.dispose()}
}
export function pushPull(oc:OpenCascadeInstance,shape:TopoDS_Shape,feature:PushPullFeature,scope:Scope):TopoDS_Shape {
  const bounds=shapeBounds(oc,shape)
  const explorer=scope.own(new oc.TopExp_Explorer_2(shape,oc.TopAbs_ShapeEnum.TopAbs_FACE as TopAbs_ShapeEnum,oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum))
  const matches:{face:TopoDS_Face;score:number}[]=[]
  while(explorer.More()){
    const raw=scope.own(explorer.Current()),face=scope.own(oc.TopoDS.Face_1(raw))
    const normal=planarNormal(oc,face)
    if(normal&&normal.every((n,i)=>Math.abs(n-feature.reference.normal[i])<1e-6)){
      const props=scope.own(new oc.GProp_GProps_1())
      oc.BRepGProp.SurfaceProperties_1(face,props,false,false)
      const center=normalizedCenter(xyz(props.CentreOfMass()),bounds)
      matches.push({face,score:Math.hypot(...center.map((n,i)=>n-feature.reference.center[i]))})
    }
    explorer.Next()
  }
  matches.sort((a,b)=>a.score-b.score)
  if(!matches.length||matches[0].score>.25||(matches[1]&&matches[1].score-matches[0].score<.01))throw new Error('Push/pull face reference is missing or ambiguous after the earlier edit. Remove this feature and reselect the intended planar face.')
  const vector=scope.own(new oc.gp_Vec_4(...feature.reference.normal.map(n=>n*feature.parameters.distance) as Vec3))
  const prism=scope.own(new oc.BRepPrimAPI_MakePrism_1(matches[0].face,vector,true,true))
  const tool=scope.own(prism.Shape()),progress=scope.own(new oc.Message_ProgressRange_1())
  const operation=scope.own(feature.parameters.distance>0?new oc.BRepAlgoAPI_Fuse_3(shape,tool,progress):new oc.BRepAlgoAPI_Cut_3(shape,tool,progress))
  if(!operation.IsDone())throw new Error('Push/pull could not produce a solid. Reduce the distance.')
  const result=scope.own(operation.Shape())
  const unify=scope.own(new oc.ShapeUpgrade_UnifySameDomain_2(result,true,true,false))
  unify.Build()
  return scope.own(unify.Shape())
}

/** Stable world-oriented axes and closest-to-origin point on the actual support plane. */
export function planarFrame(oc:OpenCascadeInstance,face:TopoDS_Face):PlaneFrame|null {
 const normal=planarNormal(oc,face);if(!normal)return null
 const props=new oc.GProp_GProps_1();let center:Vec3
 try{oc.BRepGProp.SurfaceProperties_1(face,props,false,false);center=xyz(props.CentreOfMass())}finally{props.delete()}
 const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
 const seed:Vec3=Math.abs(normal[2])>.9?[0,1,0]:[0,0,1],raw=cross(seed,normal),length=Math.hypot(...raw),u=raw.map(n=>n/length) as Vec3,v=cross(normal,u)
 const distance=center.reduce((sum,n,i)=>sum+n*normal[i],0)
 return {origin:normal.map(n=>n*distance) as Vec3,u,v,normal}
}
