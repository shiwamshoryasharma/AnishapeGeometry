import {holeCutters} from './kernel-holes'
import {extendedExtrusionRange} from './extrusion-extents'
import {primitiveSolid,transformedSolid,splitSolid} from './kernel-solid-tools'
import {circularPlacement} from './sketch-entities'
import {entityProfileFace,sweepWire} from './kernel-sketch'
import type { OpenCascadeInstance, TopoDS_Shape, TopoDS_Face, TopoDS_Edge, TopAbs_ShapeEnum, ChFi3d_FilletShape, BRepOffset_Mode, GeomAbs_JoinType } from 'opencascade.js'
import type { CadDocument, SketchFeature, ExtrudeFeature, FaceReference, Vec3, Axis, GearFeature, Operation, PlaneFrame } from './types'
import { Scope, xyz, shapeBounds, normalizedCenter, planarNormal, planarFrame, visitEdges, endsOf, edgeSignature, pushPull } from './kernel-support'
import { toWorld, resolveSketchPlane, sketchToWorld, sketchNormal, planeFrame } from './planes'
export interface KernelBody {id:string;name:string;sourceId:string;shape:TopoDS_Shape;sketch?:SketchFeature;extrude?:ExtrudeFeature;pitchDiameter?:number;bounds?:{min:Vec3;max:Vec3}}
const axisVector=(axis:Axis):Vec3=>axis==='X'?[1,0,0]:axis==='Y'?[0,1,0]:[0,0,1]
export function edgeKey(oc:OpenCascadeInstance,edge:TopoDS_Edge,body:KernelBody):string {
 if(body.sketch&&body.extrude){const key=edgeSignature(body.sketch,body.extrude.parameters.distance,...endsOf(oc,edge),body.extrude.parameters.direction);if(key)return key}
 const bounds=body.bounds??=shapeBounds(oc,body.shape),curve=new oc.BRepAdaptor_Curve_2(edge)
 try {const points=[...endsOf(oc,edge),xyz(curve.Value((curve.FirstParameter()+curve.LastParameter())/2))].map(p=>normalizedCenter(p,bounds).map(n=>Number(n.toFixed(6))).join(','));return 'g:'+String(curve.GetType())+':'+points.slice(0,2).sort().join(':')+':'+points[2]}
 finally{curve.delete()}
}
export function resolveFace(oc:OpenCascadeInstance,body:KernelBody,ref:FaceReference,scope:Scope):TopoDS_Face {
 if(ref.bodyId&&ref.bodyId!==body.id)throw Error('Selected face belongs to another body.')
 const bounds=shapeBounds(oc,body.shape),matches:{face:TopoDS_Face;score:number}[]=[]
 const explorer=scope.own(new oc.TopExp_Explorer_2(body.shape,oc.TopAbs_ShapeEnum.TopAbs_FACE as TopAbs_ShapeEnum,oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum))
 while(explorer.More()){
  const face=scope.own(oc.TopoDS.Face_1(scope.own(explorer.Current()))),normal=planarNormal(oc,face)
  if(normal&&normal.every((n,i)=>Math.abs(n-ref.normal[i])<1e-6)){const props=scope.own(new oc.GProp_GProps_1());oc.BRepGProp.SurfaceProperties_1(face,props,false,false);const c=normalizedCenter(xyz(props.CentreOfMass()),bounds);matches.push({face,score:Math.hypot(...c.map((v,i)=>v-ref.center[i]))})}explorer.Next()
 }
 matches.sort((a,b)=>a.score-b.score)
 if(!matches.length||matches[0].score>.15||(matches[1]&&matches[1].score-matches[0].score<.01))throw Error('Face reference is missing or ambiguous. Reselect the intended planar face.')
 return matches[0].face
}
function checkSolid(oc:OpenCascadeInstance,shape:TopoDS_Shape,scope:Scope){
 const it=scope.own(new oc.TopExp_Explorer_2(shape,oc.TopAbs_ShapeEnum.TopAbs_SOLID as TopAbs_ShapeEnum,oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum));let count=0;while(it.More()){count++;it.Next()}
 if(count!==1||!scope.own(new oc.BRepCheck_Analyzer(shape,true,false)).IsValid_2())throw Error('Operation must retain one valid solid per body. It removed, split, or invalidated the body.')
}
function boolean(oc:OpenCascadeInstance,a:TopoDS_Shape,b:TopoDS_Shape,op:Exclude<Operation,'new'>,scope:Scope){
 const progress=scope.own(new oc.Message_ProgressRange_1())
 const builder=scope.own(op==='join'?new oc.BRepAlgoAPI_Fuse_3(a,b,progress):op==='cut'?new oc.BRepAlgoAPI_Cut_3(a,b,progress):new oc.BRepAlgoAPI_Common_3(a,b,progress))
 if(!builder.IsDone())throw Error('Boolean '+op+' failed. Check whether the bodies overlap.')
 const result=scope.own(builder.Shape()),unify=scope.own(new oc.ShapeUpgrade_UnifySameDomain_2(result,true,true,false));unify.Build();return scope.own(unify.Shape())
}
function polygonFace(oc:OpenCascadeInstance,points:Vec3[],scope:Scope){const poly=scope.own(new oc.BRepBuilderAPI_MakePolygon_1());for(const point of points)poly.Add_1(scope.own(new oc.gp_Pnt_3(...point)));poly.Close();if(!poly.IsDone())throw Error('Profile is not a valid closed wire.');const wire=scope.own(poly.Wire());return scope.own(scope.own(new oc.BRepBuilderAPI_MakeFace_15(wire,true)).Face())}
function profileFace(oc:OpenCascadeInstance,sketch:SketchFeature,depth:number,scope:Scope,regionId?:string){
 const p=sketch.parameters
 if(p.entities)return entityProfileFace(oc,sketch,depth,regionId,scope)
 if(p.profile==='circle'){
  const center=scope.own(new oc.gp_Pnt_3(...sketchToWorld(p,p.x,p.y,depth))),normal=scope.own(new oc.gp_Dir_4(...sketchNormal(p))),ax=scope.own(new oc.gp_Ax2_3(center,normal)),circle=scope.own(new oc.gp_Circ_2(ax,p.width/2)),edge=scope.own(scope.own(new oc.BRepBuilderAPI_MakeEdge_8(circle)).Edge()),wire=scope.own(scope.own(new oc.BRepBuilderAPI_MakeWire_2(edge)).Wire());return scope.own(scope.own(new oc.BRepBuilderAPI_MakeFace_15(wire,true)).Face())
 }
 return polygonFace(oc,[[p.x,p.y],[p.x+p.width,p.y],[p.x+p.width,p.y+p.height],[p.x,p.y+p.height]].map(([u,v])=>sketchToWorld(p,u,v,depth)),scope)
}
function cylinder(oc:OpenCascadeInstance,point:Vec3,normal:Vec3,radius:number,depth:number,scope:Scope){const ax=scope.own(new oc.gp_Ax2_3(scope.own(new oc.gp_Pnt_3(...point)),scope.own(new oc.gp_Dir_4(...normal))));return scope.own(scope.own(new oc.BRepPrimAPI_MakeCylinder_3(ax,radius,depth)).Shape())}
function gearFace(oc:OpenCascadeInstance,p:GearFeature['parameters'],scope:Scope){
 const pitch=p.module*p.teeth/2,base=pitch*Math.cos(p.pressureAngle*Math.PI/180),outer=pitch+p.module,root=pitch-1.25*p.module
 const inv=(r:number)=>{const t=Math.sqrt(Math.max(0,(r/base)**2-1));return t-Math.atan(t)}
 const half=Math.PI/(2*p.teeth)-p.backlash/(4*pitch),atPitch=inv(pitch),startRadius=Math.max(base+1e-5*p.module,root)
 const rootAngle=half+atPitch-inv(startRadius),tipAngle=half+atPitch-inv(outer)
 if(tipAngle<=0)throw Error('Tooth tip is pointed. Reduce backlash or pressure angle.')
 const point=(r:number,a:number):Vec3=>[p.x+r*Math.cos(a),p.y+r*Math.sin(a),p.z]
 const wire=scope.own(new oc.BRepBuilderAPI_MakeWire_1())
 const line=(a:Vec3,b:Vec3)=>{if(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-8)return;wire.Add_1(scope.own(scope.own(new oc.BRepBuilderAPI_MakeEdge_3(scope.own(new oc.gp_Pnt_3(...a)),scope.own(new oc.gp_Pnt_3(...b)))).Edge()))}
 const ax=scope.own(new oc.gp_Ax2_2(scope.own(new oc.gp_Pnt_3(p.x,p.y,p.z)),scope.own(new oc.gp_Dir_4(0,0,1)),scope.own(new oc.gp_Dir_4(1,0,0))))
 const arc=(radius:number,a:number,b:number)=>{const circle=scope.own(new oc.gp_Circ_2(ax,radius));wire.Add_1(scope.own(scope.own(new oc.BRepBuilderAPI_MakeEdge_9(circle,a,b)).Edge()))}
 const t0=Math.sqrt(Math.max(0,(startRadius/base)**2-1)),t1=Math.sqrt((outer/base)**2-1)
 const flank=(center:number,sign:number,reverse:boolean)=>{
  const count=25,points=scope.own(new oc.TColgp_Array1OfPnt_2(1,count))
  for(let i=0;i<count;i++){const t=t0+(t1-t0)*(reverse?count-1-i:i)/(count-1),r=base*Math.sqrt(1+t*t),a=center+sign*(half+atPitch-(t-Math.atan(t)));points.SetValue(i+1,scope.own(new oc.gp_Pnt_3(...point(r,a))))}
  const fit=scope.own(new oc.GeomAPI_PointsToBSpline_2(points,3,3,oc.GeomAbs_Shape.GeomAbs_C2 as import('opencascade.js').GeomAbs_Shape,1e-5))
  if(!fit.IsDone())throw Error('Involute curve fitting failed.')
  const curve=scope.own(fit.Curve()),baseCurve=scope.own(new oc.Handle_Geom_Curve_2(curve.get())),edge=scope.own(scope.own(new oc.BRepBuilderAPI_MakeEdge_24(baseCurve)).Edge());return edge
 }
 const lowerFlank=flank(0,-1,false),upperFlank=flank(0,1,true)
 const rotatedFlank=(edge:TopoDS_Edge,angle:number)=>{const trsf=scope.own(new oc.gp_Trsf_1()),axis=scope.own(new oc.gp_Ax1_2(scope.own(new oc.gp_Pnt_3(p.x,p.y,p.z)),scope.own(new oc.gp_Dir_4(0,0,1))));trsf.SetRotation_1(axis,angle);const shape=scope.own(scope.own(new oc.BRepBuilderAPI_Transform_2(edge,trsf,true)).Shape());wire.Add_1(scope.own(oc.TopoDS.Edge_1(shape)))}
 for(let tooth=0;tooth<p.teeth;tooth++){
  const center=tooth*2*Math.PI/p.teeth
  line(point(root,center-rootAngle),point(startRadius,center-rootAngle));rotatedFlank(lowerFlank,center)
  arc(outer,center-tipAngle,center+tipAngle);rotatedFlank(upperFlank,center)
  line(point(startRadius,center+rootAngle),point(root,center+rootAngle));arc(root,center+rootAngle,(tooth+1)*2*Math.PI/p.teeth-rootAngle)
 }
 if(!wire.IsDone())throw Error('Gear tooth wire could not close.')
 return scope.own(scope.own(new oc.BRepBuilderAPI_MakeFace_15(scope.own(wire.Wire()),true)).Face())
}
export function buildBodies(oc:OpenCascadeInstance,doc:CadDocument,scope:Scope,frames:Map<string,PlaneFrame>=new Map()):Map<string,KernelBody>{
 const bodies=new Map<string,KernelBody>(),sketches=new Map<string,SketchFeature>()
 const body=(id?:string)=>{const value=id?bodies.get(id):bodies.values().next().value;if(!value)throw Error('Target body is unavailable. Check earlier features.');return value}
 const put=(id:string,name:string,shape:TopoDS_Shape,sourceId:string,extra:Partial<KernelBody>={})=>{checkSolid(oc,shape,scope);bodies.set(id,{...extra,id,name,shape,sourceId,bounds:undefined})}
 for(const f of doc.features){try{
  if(f.type==='plane')continue
  if(f.type==='sketch'){const sk=structuredClone(f);sk.parameters=resolveSketchPlane(sk.parameters,doc.features);if(sk.parameters.support){const supportBody=body(sk.parameters.support.bodyId);const face=resolveFace(oc,supportBody,sk.parameters.support,scope);sk.parameters.frame=planarFrame(oc,face)!;sk.parameters.offset=0}else delete sk.parameters.frame;frames.set(f.id,sk.parameters.frame??planeFrame(sk.parameters.plane,sk.parameters.offset??0));sketches.set(f.id,sk);continue}
  if(f.type==='extrude'||f.type==='revolve'){
   const p=f.parameters,sk=p.profileId?sketches.get(p.profileId):sketches.values().next().value;if(!sk)throw Error('Sketch profile is unavailable.')
   let shape:TopoDS_Shape
   if(f.type==='extrude'){const q=f.parameters,range=extendedExtrusionRange(q,sk.parameters,q.extent==='through-all'?shapeBounds(oc,body(q.bodyId).shape):undefined,q.endFace?planarFrame(oc,resolveFace(oc,body(q.endFace.bodyId),q.endFace,scope))??undefined:undefined),face=profileFace(oc,sk,(sk.parameters.offset??0)+(q.startOffset??0)+range.start,scope,q.regionId),vector=scope.own(new oc.gp_Vec_4(...sketchNormal(sk.parameters).map(n=>n*range.travel) as Vec3));shape=scope.own(scope.own(new oc.BRepPrimAPI_MakePrism_1(face,vector,true,true)).Shape())}
   else{const q=f.parameters,face=profileFace(oc,sk,sk.parameters.offset??0,scope,q.regionId),point=sketchToWorld(sk.parameters,q.axisOffset,0,sk.parameters.offset??0),ax=scope.own(new oc.gp_Ax1_2(scope.own(new oc.gp_Pnt_3(...point)),scope.own(new oc.gp_Dir_4(...axisVector(q.axis)))));shape=scope.own(scope.own(new oc.BRepPrimAPI_MakeRevol_1(face,ax,q.angle*Math.PI/180,true)).Shape())}
   if(!p.operation||p.operation==='new')put(f.id,f.name,shape,f.id,{sketch:sk,extrude:f.type==='extrude'&&(!f.parameters.extent||f.parameters.extent==='blind')&&!f.parameters.startOffset?f:undefined})
   else{const b=body(p.bodyId);put(b.id,b.name,boolean(oc,b.shape,shape,p.operation,scope),f.id,b)}continue
  }
  if(f.type==='loft'||f.type==='sweep'){
   const p=f.parameters;let shape:TopoDS_Shape
   const profile=(id:string,regionId?:string)=>{const sk=sketches.get(id);if(!sk)throw Error('Sketch profile is unavailable.');return {sk,face:profileFace(oc,sk,sk.parameters.offset??0,scope,regionId)}}
   if(f.type==='loft'){
    const builder=scope.own(new oc.BRepOffsetAPI_ThruSections(true,f.parameters.ruled,1e-6));builder.CheckCompatibility(true)
    for(const section of f.parameters.sections){const {face}=profile(section.profileId,section.regionId),it=scope.own(new oc.TopExp_Explorer_2(face,oc.TopAbs_ShapeEnum.TopAbs_WIRE as TopAbs_ShapeEnum,oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum));let count=0;while(it.More()){count++;it.Next()}if(count!==1)throw Error('Loft sections must have one outer contour without holes. Select another region.');builder.AddWire(scope.own(oc.BRepTools.OuterWire(face)))}
    builder.Build(scope.own(new oc.Message_ProgressRange_1()));if(!builder.IsDone())throw Error('Loft failed. Check section order, separation and shape compatibility.');shape=scope.own(builder.Shape())
   }else{
    const q=f.parameters,{sk,face}=profile(q.profileId,q.regionId),path=sketches.get(q.pathId);if(!path)throw Error('Sweep path sketch is unavailable.');const spine=sweepWire(oc,path,scope),normal=sketchNormal(sk.parameters),origin=sketchToWorld(sk.parameters,0,0,sk.parameters.offset??0)
    if(Math.abs(spine.start.reduce((sum,n,i)=>sum+(n-origin[i])*normal[i],0))>1e-5||Math.abs(spine.direction.reduce((sum,n,i)=>sum+n*normal[i],0))<1-1e-6)throw Error('Sweep profile must lie at the path start and be perpendicular to its tangent.')
    const builder=scope.own(new oc.BRepOffsetAPI_MakePipe_1(spine.wire,face));if(!builder.IsDone())throw Error('Sweep failed. Check path curvature and profile size.');shape=scope.own(builder.Shape())
   }
   if(p.operation==='new')put(f.id,f.name,shape,f.id)
   else{const b=body(p.bodyId);put(b.id,b.name,boolean(oc,b.shape,shape,p.operation,scope),f.id,{pitchDiameter:b.pitchDiameter})}continue
  }
  if(f.type==='box'||f.type==='cylinder'||f.type==='sphere'){
   const shape=primitiveSolid(oc,f,scope),p=f.parameters
   if(p.operation==='new'){if(bodies.size>=128)throw Error('Maximum 128 bodies per document.');put(f.id,f.name,shape,f.id)}else{const b=body(p.bodyId);put(b.id,b.name,boolean(oc,b.shape,shape,p.operation,scope),f.id)}continue
  }
  if(f.type==='gear'){
const p=f.parameters,face=gearFace(oc,p,scope),vector=scope.own(new oc.gp_Vec_4(0,0,p.thickness));let shape=scope.own(scope.own(new oc.BRepPrimAPI_MakePrism_1(face,vector,true,true)).Shape());if(p.bore>0)shape=boolean(oc,shape,cylinder(oc,[p.x,p.y,p.z],[0,0,1],p.bore/2,p.thickness,scope),'cut',scope);put(f.id,f.name,shape,f.id,{pitchDiameter:p.module*p.teeth});continue}
  const p=f.parameters,b=body('bodyId'in p?p.bodyId:undefined)
  let shape=b.shape
  if(f.type==='rotate'||f.type==='scale'){
   const shape=transformedSolid(oc,b.shape,f,scope),pitchDiameter=b.pitchDiameter===undefined?undefined:b.pitchDiameter*(f.type==='scale'?f.parameters.factor:1)
   if(f.parameters.copy){if(bodies.size>=128)throw Error('Maximum 128 bodies per document.');put(f.id+':copy:1',f.name+' copy',shape,f.id,{pitchDiameter})}else put(b.id,b.name,shape,f.id,{pitchDiameter});continue
  }
  if(f.type==='split'){
   const pieces=splitSolid(oc,b.shape,f,doc.features,scope);if(bodies.size+pieces.length-1>128)throw Error('Maximum 128 bodies per document.')
   pieces.forEach((shape,i)=>put(i===0?b.id:f.id+':copy:'+i,i===0?b.name:f.name+' '+(i+1),shape,f.id));continue
  }
  if(f.type==='hole'){const q={...f.parameters};let placement:SketchFeature|undefined;if(q.profileId){const sk=sketches.get(q.profileId);const circle=sk&&circularPlacement(sk.parameters);if(!sk||!circle)throw Error('Hole placement requires a single circular region.');placement=sk;q.x=circle.x;q.y=circle.y;q.diameter=circle.diameter;q.plane=sk.parameters.plane;q.offset+=sk.parameters.offset??0}for(const cutter of holeCutters(oc,b.shape,q,placement?sketchToWorld(placement.parameters,q.x,q.y,q.offset):toWorld(q.plane,q.x,q.y,q.offset),placement?sketchNormal(placement.parameters).map(n=>-n) as Vec3:toWorld(q.plane,0,0,-1),scope))shape=boolean(oc,shape,cutter,'cut',scope)}
  else if(f.type==='move'){const trsf=scope.own(new oc.gp_Trsf_1());trsf.SetTranslation_1(scope.own(new oc.gp_Vec_4(f.parameters.x,f.parameters.y,f.parameters.z)));shape=scope.own(scope.own(new oc.BRepBuilderAPI_Transform_2(b.shape,trsf,true)).Shape());put(b.id,b.name,shape,f.id,{pitchDiameter:b.pitchDiameter});continue}
  else if(f.type==='pushpull')shape=pushPull(oc,b.shape,f,scope)
  else if(f.type==='fillet'||f.type==='chamfer'){
   const edges=visitEdges(oc,b.shape,scope),builder=scope.own(f.type==='fillet'?new oc.BRepFilletAPI_MakeFillet(b.shape,oc.ChFi3d_FilletShape.ChFi3d_Rational as ChFi3d_FilletShape):new oc.BRepFilletAPI_MakeChamfer(b.shape))
   for(const ref of f.references){if(ref.bodyId&&ref.bodyId!==b.id)throw Error('Selected edge belongs to another body.');const matches=edges.filter(e=>edgeKey(oc,e,b)===ref.signature);if(matches.length!==1)throw Error('Edge reference could not be resolved uniquely. Reselect the edge.');builder.Add_2(f.type==='fillet'?f.parameters.radius:f.parameters.distance,matches[0])}
   builder.Build(scope.own(new oc.Message_ProgressRange_1()));if(!builder.IsDone())throw Error('Radius or distance exceeds the available geometry.');shape=scope.own(builder.Shape())
  }else if(f.type==='shell'){
   const faces=scope.own(new oc.TopTools_ListOfShape_1());for(const ref of f.openingFaces??[f.reference])faces.Append_1(resolveFace(oc,b,ref,scope));const builder=scope.own(new oc.BRepOffsetAPI_MakeThickSolid());builder.MakeThickSolidByJoin(b.shape,faces,-f.parameters.thickness,1e-5,oc.BRepOffset_Mode.BRepOffset_Skin as BRepOffset_Mode,false,false,oc.GeomAbs_JoinType.GeomAbs_Arc as GeomAbs_JoinType,true,scope.own(new oc.Message_ProgressRange_1()));if(!builder.IsDone())throw Error('Shell thickness fails on this topology.');shape=scope.own(builder.Shape())
  }else if(f.type==='draft'){
   const q=f.parameters,normal=scope.own(new oc.gp_Dir_4(...toWorld(q.plane,0,0,1))),plane=scope.own(new oc.gp_Pln_3(scope.own(new oc.gp_Pnt_3(...toWorld(q.plane,0,0,q.offset))),normal)),builder=scope.own(new oc.BRepOffsetAPI_DraftAngle_2(b.shape));builder.Add(resolveFace(oc,b,f.reference,scope),normal,q.angle*Math.PI/180,plane,true);if(!builder.AddDone())throw Error('Face cannot be drafted relative to this neutral plane.');builder.Build(scope.own(new oc.Message_ProgressRange_1()));if(!builder.IsDone())throw Error('Draft failed; reduce the angle.');shape=scope.own(builder.Shape())
  }else if(f.type==='combine'){for(const id of f.parameters.toolIds){shape=boolean(oc,shape,body(id).shape,f.parameters.operation,scope);if(!f.parameters.keepTools)bodies.delete(id)}}
  else if(f.type==='linear-pattern'||f.type==='circular-pattern'||f.type==='mirror'){
   const count=f.type==='mirror'?2:f.parameters.count
   if(bodies.size+count-1>128)throw Error('Maximum 128 bodies per document.')
   for(let i=1;i<count;i++){
    const trsf=scope.own(new oc.gp_Trsf_1())
    if(f.type==='linear-pattern')trsf.SetTranslation_1(scope.own(new oc.gp_Vec_4(...axisVector(f.parameters.axis).map(v=>v*f.parameters.spacing*i) as Vec3)))
    else if(f.type==='circular-pattern'){const ax=scope.own(new oc.gp_Ax1_2(scope.own(new oc.gp_Pnt_3(0,0,0)),scope.own(new oc.gp_Dir_4(...axisVector(f.parameters.axis)))));trsf.SetRotation_1(ax,f.parameters.angle*Math.PI/180*i/(f.parameters.angle===360?count:count-1))}
    else {const q=f.parameters;trsf.SetMirror_3(scope.own(new oc.gp_Ax2_3(scope.own(new oc.gp_Pnt_3(...toWorld(q.plane,0,0,q.offset))),scope.own(new oc.gp_Dir_4(...toWorld(q.plane,0,0,1))))))}
    const copy=scope.own(scope.own(new oc.BRepBuilderAPI_Transform_2(b.shape,trsf,true)).Shape());put(f.id+':copy:'+i,f.name+' '+i,copy,f.id)
   }continue
  }
  put(b.id,b.name,shape,f.id,b)
 }catch(cause){throw new Error(f.name+': '+(cause instanceof Error?cause.message:'OpenCascade could not complete the operation. Try smaller parameters.'),{cause})}}
 return bodies
}
export function compound(oc:OpenCascadeInstance,bodies:Map<string,KernelBody>,scope:Scope){if(!bodies.size)throw Error('Create a solid before exporting.');const shape=scope.own(new oc.TopoDS_Compound()),builder=scope.own(new oc.BRep_Builder());builder.MakeCompound(shape);for(const b of bodies.values())builder.Add(shape,b.shape);return shape}
