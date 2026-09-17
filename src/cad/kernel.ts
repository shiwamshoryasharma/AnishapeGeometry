import type { OpenCascadeInstance, TopoDS_Shape, TopAbs_ShapeEnum, STEPControl_StepModelType } from 'opencascade.js'
import type { CadDocument, Vec3, ModelResult, EdgeMesh, ExportOptions, ExportResult, BodyResult, StepResult, PlaneFrame } from './types'
import { UnitService } from './units'
import { Scope, xyz, normalizedCenter, planarNormal, planarFrame, visitEdges } from './kernel-support'
import { buildBodies, compound, edgeKey } from './kernel-features'
interface TriangleFace {frame?:PlaneFrame; normal:Vec3|null; id: string; positions: Float64Array; area: number; center: Vec3 }
function triangulate(oc: OpenCascadeInstance, shape: TopoDS_Shape, tolerance: number, angle: number): TriangleFace[] {
  const scope = new Scope()
  try {
    scope.own(new oc.BRepMesh_IncrementalMesh_2(shape,tolerance,false,angle,false))
    const explorer = scope.own(new oc.TopExp_Explorer_2(shape,oc.TopAbs_ShapeEnum.TopAbs_FACE as TopAbs_ShapeEnum,oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum))
    const faces: TriangleFace[] = []
    let triangleCount = 0
    while(explorer.More()) {
      const fs = new Scope()
      try {
        const raw = fs.own(explorer.Current())
        const face = fs.own(oc.TopoDS.Face_1(raw))
        const location = fs.own(new oc.TopLoc_Location_1())
        const handle = fs.own(oc.BRep_Tool.Triangulation(face,location,0))
        if(handle.IsNull()) throw new Error('A model face could not be tessellated.')
        const mesh = handle.get() // borrowed object: the handle owns its lifetime
        triangleCount += mesh.NbTriangles()
        if(triangleCount > 1000000) throw new Error('Tessellation exceeds one million triangles. Increase the chord tolerance.')
        const transform = fs.own(location.Transformation())
        const reverse = face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED
        const positions = new Float64Array(mesh.NbTriangles()*9)
        for(let i=1;i<=mesh.NbTriangles();i++) {
          const triangle = mesh.Triangle(i)
          try {
            const order = reverse ? [1,3,2] : [1,2,3]
            for(let v=0;v<3;v++) {
              const node = mesh.Node(triangle.Value(order[v]))
              try { node.Transform(transform); positions.set([node.X(),node.Y(),node.Z()],(i-1)*9+v*3) }
              finally { node.delete() }
            }
          } finally { triangle.delete() }
        }
        const props = fs.own(new oc.GProp_GProps_1())
        oc.BRepGProp.SurfaceProperties_1(face,props,false,false)
        const center = xyz(props.CentreOfMass())
        faces.push({ id: `face:${faces.length}`, positions, area: props.Mass(), center, normal:planarNormal(oc,face),frame:planarFrame(oc,face)??undefined })
      } finally { fs.dispose() }
      explorer.Next()
    }
    return faces
  } finally { scope.dispose() }
}
function writeBrep(oc:OpenCascadeInstance,shape:TopoDS_Shape,scope:Scope):string {
 const filename='/model.brep';if(!oc.BRepTools.Write_3(shape,filename,scope.own(new oc.Message_ProgressRange_1())))throw Error('Cannot serialize B-Rep.')
 try{return oc.FS.readFile(filename,{encoding:'utf8'}) as string}finally{oc.FS.unlink(filename)}
}
export function buildModel(oc:OpenCascadeInstance,doc:CadDocument):ModelResult {
 const started=performance.now(),scope=new Scope()
 try {
  const frames=new Map<string,PlaneFrame>(),output=buildBodies(oc,doc,scope,frames),faces:ModelResult['faces']=[],edges:EdgeMesh[]=[],bodies:BodyResult[]=[]
  for(const body of output.values()){
   const shape=body.shape,mesh=triangulate(oc,shape,.05,.2),vp=scope.own(new oc.GProp_GProps_1()),ap=scope.own(new oc.GProp_GProps_1()),box=scope.own(new oc.Bnd_Box_1())
   oc.BRepGProp.VolumeProperties_1(shape,vp,true,false,false);oc.BRepGProp.SurfaceProperties_1(shape,ap,false,false);oc.BRepBndLib.AddOptimal(shape,box,false,false)
   const bounds={min:xyz(box.CornerMin()),max:xyz(box.CornerMax())},brep=writeBrep(oc,shape,scope)
   bodies.push({id:body.id,name:body.name,sourceId:body.sourceId,volume:vp.Mass(),surfaceArea:ap.Mass(),center:xyz(vp.CentreOfMass()),bounds,brep,...(body.pitchDiameter?{pitchDiameter:body.pitchDiameter}:{})})
   faces.push(...mesh.map(f=>({...f,id:body.id+':'+f.id,bodyId:body.id,positions:new Float32Array(f.positions),reference:f.normal?{featureId:body.sourceId,bodyId:body.id,normal:f.normal,center:normalizedCenter(f.center,bounds)}:null})))
   edges.push(...visitEdges(oc,shape,scope).map(edge=>{
    const curve=scope.own(new oc.BRepAdaptor_Curve_2(edge)),start=curve.FirstParameter(),end=curve.LastParameter(),signature=edgeKey(oc,edge,body),count=curve.GetType()===oc.GeomAbs_CurveType.GeomAbs_Line?2:65,positions=new Float32Array(count*3)
    for(let i=0;i<count;i++)positions.set(xyz(curve.Value(start+(end-start)*i/(count-1))),i*3)
    const props=scope.own(new oc.GProp_GProps_1());oc.BRepGProp.LinearProperties(edge,props,false,false)
    let circular:EdgeMesh['curve'];if(curve.GetType()===oc.GeomAbs_CurveType.GeomAbs_Circle){const c=scope.own(curve.Circle()),axis=scope.own(c.Axis()),direction=scope.own(axis.Direction());circular={type:'circle',radius:c.Radius(),center:xyz(c.Location()),normal:[direction.X(),direction.Y(),direction.Z()],closed:Math.abs(Math.abs(end-start)-2*Math.PI)<1e-6}}
    return {curve:circular,reference:{id:body.id+':'+body.sourceId+':edge:'+signature,featureId:body.sourceId,bodyId:body.id,signature},positions,length:props.Mass(),center:xyz(props.CentreOfMass()),filletEligible:true}
   }))
  }
  const volume=bodies.reduce((v,b)=>v+b.volume,0),surfaceArea=bodies.reduce((v,b)=>v+b.surfaceArea,0)
  const center=[0,1,2].map(i=>volume?bodies.reduce((v,b)=>v+b.center[i]*b.volume,0)/volume:0) as Vec3
  const bounds={min:[0,1,2].map(i=>bodies.length?Math.min(...bodies.map(b=>b.bounds.min[i])):0) as Vec3,max:[0,1,2].map(i=>bodies.length?Math.max(...bodies.map(b=>b.bounds.max[i])):0) as Vec3}
  return {revision:doc.revision,faces,edges,bodies,sketches:[...frames].map(([id,frame])=>({id,frame})),volume,surfaceArea,center,bounds,triangleCount:faces.reduce((v,f)=>v+f.positions.length/9,0),brep:bodies.length?writeBrep(oc,compound(oc,output,scope),scope):'',durationMs:performance.now()-started}
 }finally{scope.dispose()}
}
export function exportStep(oc:OpenCascadeInstance,doc:CadDocument):StepResult {
 const scope=new Scope(),filename='/export.step'
 try{
  const shape=compound(oc,buildBodies(oc,doc,scope),scope),writer=scope.own(new oc.STEPControl_Writer_1()),progress=scope.own(new oc.Message_ProgressRange_1())
  if(writer.Transfer(shape,oc.STEPControl_StepModelType.STEPControl_AsIs as STEPControl_StepModelType,true,progress)!==oc.IFSelect_ReturnStatus.IFSelect_RetDone)throw Error('STEP translation failed.')
  if(writer.Write(filename)!==oc.IFSelect_ReturnStatus.IFSelect_RetDone)throw Error('STEP file could not be written.')
  return {bytes:new Uint8Array(oc.FS.readFile(filename) as Uint8Array)}
 }finally{try{oc.FS.unlink(filename)}catch{/* No file when translation fails. */}scope.dispose()}
}
// At spherical parameter poles OpenCascade can emit a triangle whose two
// vertices are identical. Remove only these zero-area artifacts, then require
// the entire remaining mesh to pass the closed-manifold checks.
function removePoleTriangles(faces: TriangleFace[]): TriangleFace[] {
  return faces.map(face => {
    const kept: number[] = []
    for (let i=0;i<face.positions.length;i+=9) {
      const p=face.positions.subarray(i,i+9)
      const same=(a:number,b:number)=>p[a]===p[b]&&p[a+1]===p[b+1]&&p[a+2]===p[b+2]
      if(!same(0,3)&&!same(3,6)&&!same(6,0))kept.push(...p)
    }
    return {...face,positions:new Float64Array(kept)}
  })
}
function validateTriangles(faces: TriangleFace[]) {
  const edgeCounts = new Map<string,{count:number;balance:number}>(), triangles = new Set<string>()
  const key = (x:number,y:number,z:number) => [x,y,z].map(n => Math.round(n/1e-7)).join(',')
  for(const face of faces) for(let i=0;i<face.positions.length;i+=9) {
    const p=face.positions, a=[p[i],p[i+1],p[i+2]], b=[p[i+3],p[i+4],p[i+5]], c=[p[i+6],p[i+7],p[i+8]]
    const n=normal(a,b,c)
    if(!n.every(Number.isFinite) || Math.hypot(...n)<0.5) throw new Error('Export contains a degenerate triangle.')
    const vertices=[key(a[0],a[1],a[2]),key(b[0],b[1],b[2]),key(c[0],c[1],c[2])]
    const triangleKey=[...vertices].sort().join('|')
    if(triangles.has(triangleKey)) throw new Error('Export contains duplicate triangles.')
    triangles.add(triangleKey)
    for(let v=0;v<3;v++) { const a=vertices[v],b=vertices[(v+1)%3],k=[a,b].sort().join('|'); const value=edgeCounts.get(k)??{count:0,balance:0};value.count++;value.balance+=a<b?1:-1;edgeCounts.set(k,value) }
  }
  if([...edgeCounts.values()].some(e=>e.count!==2||e.balance!==0)) throw new Error('Export mesh is open, non-manifold, or has inconsistent normals. Increase tessellation quality and try again.')
}
function normal(a:number[],b:number[],c:number[]) {
  const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i])
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n)
  return n.map(x=>x/length)
}
export function exportModel(oc: OpenCascadeInstance, doc: CadDocument, options: ExportOptions): ExportResult {
  if(!Number.isFinite(options.tolerance)||options.tolerance<0.001||options.tolerance>1||!Number.isFinite(options.angle)||options.angle<0.02||options.angle>0.8) throw new Error('Use chord tolerance 0.001–1 mm and angular tolerance 0.02–0.8 radians.')
  const scope=new Scope()
  try {
    const shape=compound(oc,buildBodies(oc,doc,scope),scope)
    const faces=removePoleTriangles(triangulate(oc,shape,options.tolerance,options.angle))
    validateTriangles(faces)
    if(options.format==='binary') {
      const rounded=faces.map(face=>({...face,positions:Float64Array.from(face.positions,value=>{
        const converted=UnitService.fromInternal(value,options.unit)
        const stored=UnitService.toInternal(Math.fround(converted),options.unit)
        if(Math.abs(stored-value)>options.tolerance)throw new Error('Binary STL coordinate precision exceeds the requested tolerance. Use ASCII STL or move the sketch closer to the origin.')
        return stored
      })}))
      try { validateTriangles(rounded) }
      catch(cause) { throw new Error('Binary STL coordinate precision would damage the mesh. Use ASCII STL or move the sketch closer to the origin.',{cause}) }
    }
    const triangles=faces.reduce((n,f)=>n+f.positions.length/9,0)
    const bytes=new Uint8Array(84+triangles*50),view=new DataView(bytes.buffer)
    bytes.set(new TextEncoder().encode(`AnishapeGeometry | units=${options.unit} | B-Rep tessellation`))
    view.setUint32(80,triangles,true)
    const ascii=['solid AnishapeGeometry']
    let triangleIndex=0
    for(const face of faces) for(let i=0;i<face.positions.length;i+=9) {
      const p=Array.from(face.positions.subarray(i,i+9),v=>UnitService.fromInternal(v,options.unit))
      const n=normal(p.slice(0,3),p.slice(3,6),p.slice(6,9))
      if(options.format==='binary') {
        const offset=84+triangleIndex*50
        n.forEach((v,j)=>view.setFloat32(offset+j*4,v,true))
        p.forEach((v,j)=>view.setFloat32(offset+12+j*4,v,true))
      } else {
        ascii.push(`facet normal ${n.join(' ')}`,'outer loop')
        for(let v=0;v<3;v++) ascii.push(`vertex ${p.slice(v*3,v*3+3).map(x=>x.toPrecision(15)).join(' ')}`)
        ascii.push('endloop','endfacet')
      }
      triangleIndex++
    }
    ascii.push('endsolid AnishapeGeometry')
    return {bytes:options.format==='binary'?bytes:new TextEncoder().encode(ascii.join('\n')),triangles,unit:options.unit,closed:true}
  } finally {scope.dispose()}
}
