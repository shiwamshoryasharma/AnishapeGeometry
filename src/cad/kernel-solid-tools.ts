import type {OpenCascadeInstance,TopoDS_Shape,TopAbs_ShapeEnum} from 'opencascade.js'
import type {BoxFeature,CylinderFeature,SphereFeature,RotateFeature,ScaleFeature,SplitFeature,Feature,Vec3} from './types'
import {Scope,shapeBounds} from './kernel-support'
import {toWorld} from './planes'
const axis=(name:string):Vec3=>name==='X'?[1,0,0]:name==='Y'?[0,1,0]:[0,0,1]
export function primitiveSolid(oc:OpenCascadeInstance,f:BoxFeature|CylinderFeature|SphereFeature,scope:Scope){
 const p=f.parameters,origin=scope.own(new oc.gp_Pnt_3(p.x,p.y,p.z))
 if(f.type==='box')return scope.own(scope.own(new oc.BRepPrimAPI_MakeBox_3(origin,f.parameters.width,f.parameters.depth,f.parameters.height)).Shape())
 if(f.type==='sphere')return scope.own(scope.own(new oc.BRepPrimAPI_MakeSphere_5(origin,f.parameters.diameter/2)).Shape())
 const q=f.parameters,ax=scope.own(new oc.gp_Ax2_3(origin,scope.own(new oc.gp_Dir_4(...axis(q.axis)))))
 return scope.own(scope.own(new oc.BRepPrimAPI_MakeCylinder_3(ax,q.diameter/2,q.height)).Shape())
}
export function transformedSolid(oc:OpenCascadeInstance,shape:TopoDS_Shape,f:RotateFeature|ScaleFeature,scope:Scope){
 const p=f.parameters,pivot=scope.own(new oc.gp_Pnt_3(p.x,p.y,p.z)),trsf=scope.own(new oc.gp_Trsf_1())
 if(f.type==='rotate')trsf.SetRotation_1(scope.own(new oc.gp_Ax1_2(pivot,scope.own(new oc.gp_Dir_4(...axis(f.parameters.axis))))),f.parameters.angle*Math.PI/180)
 else trsf.SetScale(pivot,f.parameters.factor)
 return scope.own(scope.own(new oc.BRepBuilderAPI_Transform_2(shape,trsf,true)).Shape())
}
/** Plane split yields one validated body per connected solid, ordered by side and bounds. */
export function splitSolid(oc:OpenCascadeInstance,shape:TopoDS_Shape,f:SplitFeature,features:Feature[],scope:Scope):TopoDS_Shape[]{
 let {plane,offset}=f.parameters
 if(f.parameters.planeId){const ref=features.find(v=>v.id===f.parameters.planeId);if(ref?.type!=='plane')throw Error('Split reference plane is unavailable.');plane=ref.parameters.plane;offset=ref.parameters.offset}
 const normal=toWorld(plane,0,0,1),index=normal.findIndex(n=>n!==0),sign=normal[index],at=offset*sign,bounds=shapeBounds(oc,shape),span=Math.max(...bounds.max.map((n,i)=>n-bounds.min[i])),margin=Math.max(1,span*.1)
 if(at<=bounds.min[index]+1e-6||at>=bounds.max[index]-1e-6)throw Error('Split plane must cross the body interior; it only touches or misses the body.')
 const side=(positive:boolean)=>{
  const min=bounds.min.map(n=>n-margin) as Vec3,max=bounds.max.map(n=>n+margin) as Vec3
  if(positive===(sign>0))min[index]=at;else max[index]=at
  const box=scope.own(scope.own(new oc.BRepPrimAPI_MakeBox_3(scope.own(new oc.gp_Pnt_3(...min)),max[0]-min[0],max[1]-min[1],max[2]-min[2])).Shape()),builder=scope.own(new oc.BRepAlgoAPI_Common_3(shape,box,scope.own(new oc.Message_ProgressRange_1())))
  if(!builder.IsDone())throw Error('Split failed on this body.')
  const result=scope.own(builder.Shape()),it=scope.own(new oc.TopExp_Explorer_2(result,oc.TopAbs_ShapeEnum.TopAbs_SOLID as TopAbs_ShapeEnum,oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum)),pieces:{shape:TopoDS_Shape;key:Vec3}[]=[]
  while(it.More()){const solid=scope.own(it.Current());pieces.push({shape:solid,key:shapeBounds(oc,solid).min});it.Next();if(pieces.length>128)throw Error('Split creates too many bodies.')}
  pieces.sort((a,b)=>a.key[0]-b.key[0]||a.key[1]-b.key[1]||a.key[2]-b.key[2]);return pieces.map(v=>v.shape)
 }
 const negative=side(false),positive=side(true)
 if(!negative.length||!positive.length)throw Error('Split plane must intersect solid material on both sides.')
 return f.parameters.keep==='negative'?negative:f.parameters.keep==='positive'?positive:[...negative,...positive]
}
