import { beforeAll, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import initOpenCascade from 'opencascade.js/dist/node.js'
import type { OpenCascadeInstance } from 'opencascade.js'
import { createDocument, applyCommand, parseProject, serializeProject } from '../cad/document'
import { buildModel, exportStep, exportModel } from '../cad/kernel'
import type { CadDocument, FeatureInput } from '../cad/types'
let oc:OpenCascadeInstance
beforeAll(async()=>{oc=await initOpenCascade({module:{wasmBinary:readFileSync(new URL('../../node_modules/opencascade.js/dist/opencascade.full.wasm',import.meta.url))}})})
const add=(doc:CadDocument,feature:FeatureInput)=>applyCommand(doc,{type:'feature',feature})
function block(x=0){let d=add(createDocument('Expansion','mm'),{type:'sketch',parameters:{plane:'XY',x,y:0,width:20,height:20}});const profileId=d.features[0].id;d=add(d,{type:'extrude',parameters:{profileId,distance:20,operation:'new'}});return d}
it('preserves two independent bodies through editing, serialization and STEP exchange',()=>{
 let d=block();const body=d.features[1].id
 d=add(d,{type:'sketch',parameters:{plane:'XY',x:30,y:0,width:10,height:10}})
 d=add(d,{type:'extrude',parameters:{profileId:d.features.at(-1)!.id,distance:10,operation:'new'}})
 const m=buildModel(oc,d);expect(m.bodies).toHaveLength(2);expect(m.volume).toBeCloseTo(9000,5)
 d=applyCommand(d,{type:'feature',id:body,feature:{type:'extrude',parameters:{profileId:d.features[0].id,distance:30,operation:'new'}}})
 expect(buildModel(oc,parseProject(serializeProject(d))).volume).toBeCloseTo(13000,5)
 const step=exportStep(oc,d);expect(new TextDecoder().decode(step.bytes)).toContain('ISO-10303-21');expect(step.bytes.length).toBeGreaterThan(1000)
})
it('cuts a positioned hole and chamfers an edge on the resulting body',()=>{
 let d=block();const bodyId=d.features[1].id
 d=add(d,{type:'hole',parameters:{bodyId,plane:'XY',x:10,y:10,offset:20,diameter:4,depth:20}})
 let m=buildModel(oc,d);expect(m.volume).toBeCloseTo(8000-Math.PI*4*20,4)
 const edge=m.edges.find(e=>e.filletEligible)!
 d=add(d,{type:'chamfer',parameters:{bodyId,distance:1},references:[edge.reference]})
 m=buildModel(oc,d);expect(m.volume).toBeLessThan(8000-Math.PI*4*20)
})
it('creates an editable involute spur gear with exact pitch metadata and a real bore',()=>{
 let d=add(createDocument('Gear','mm'),{type:'gear',parameters:{module:2,teeth:24,pressureAngle:20,thickness:10,bore:8,x:0,y:0,z:0,backlash:0}})
 let m=buildModel(oc,d);expect(m.bodies).toHaveLength(1);expect(m.bodies![0].pitchDiameter).toBe(48);expect(m.volume).toBeGreaterThan(10000);expect(m.faces.length).toBeLessThan(300)
 const f=d.features[0];if(f.type!=='gear')throw Error('gear')
 d=applyCommand(d,{type:'feature',id:f.id,feature:{type:'gear',parameters:{...f.parameters,teeth:30}}})
 m=buildModel(oc,d);expect(m.bodies![0].pitchDiameter).toBe(60);expect(m.bounds.max[0]).toBeCloseTo(32,2)
})
it('patterns, mirrors and combines real bodies while maintaining dependencies',()=>{
 let d=block(),bodyId=d.features[1].id
 d=add(d,{type:'linear-pattern',parameters:{bodyId,count:3,spacing:30,axis:'X'}})
 expect(buildModel(oc,d).bodies).toHaveLength(3)
 d=add(d,{type:'mirror',parameters:{bodyId,plane:'YZ',offset:-10}})
 expect(buildModel(oc,d).bodies).toHaveLength(4)
 expect(()=>applyCommand(d,{type:'feature',feature:{type:'combine',parameters:{bodyId,toolIds:['missing'],operation:'cut',keepTools:false}}})).toThrow(/reference|body|dependency/i)
})
it('shells a selected top face and drafts a selected side without corrupting the source',()=>{
 const d=block(),bodyId=d.features[1].id,m=buildModel(oc,d),top=m.faces.find(f=>f.normal?.[2]===1)!,side=m.faces.find(f=>f.normal?.[0]===1)!
 const shelled=add(d,{type:'shell',parameters:{bodyId,thickness:1},reference:top.reference!})
 expect(buildModel(oc,shelled).volume).toBeCloseTo(8000-18*18*19,3)
 const drafted=add(d,{type:'draft',parameters:{bodyId,plane:'XY',offset:0,angle:5},reference:side.reference!})
 expect(buildModel(oc,drafted).volume).not.toBeCloseTo(8000,2)
})
it('revolves a sketch on a reference plane and creates a circular body pattern',()=>{
 let d=add(createDocument('Revolve','mm'),{type:'plane',parameters:{plane:'XZ',offset:0}})
 const planeId=d.features[0].id
 d=add(d,{type:'sketch',parameters:{plane:'XZ',planeId,x:10,y:0,width:5,height:10}})
 d=add(d,{type:'revolve',parameters:{profileId:d.features.at(-1)!.id,axis:'Z',axisOffset:0,angle:360,operation:'new'}})
 expect(buildModel(oc,d).volume).toBeCloseTo(Math.PI*(225-100)*10,3)
 let a=block(30);a=add(a,{type:'circular-pattern',parameters:{bodyId:a.features[1].id,axis:'Z',count:4,angle:360}})
 expect(buildModel(oc,a).volume).toBeCloseTo(32000,3)
})
it('boolean cuts overlapping independent bodies and preserves tools only when requested',()=>{
 let d=block();const bodyId=d.features[1].id
 d=add(d,{type:'sketch',parameters:{plane:'XY',x:10,y:0,width:20,height:20}})
 d=add(d,{type:'extrude',parameters:{profileId:d.features.at(-1)!.id,distance:20,operation:'new'}})
 const toolId=d.features.at(-1)!.id
 const cut=add(d,{type:'combine',parameters:{bodyId,toolIds:[toolId],operation:'cut',keepTools:false}})
 expect(buildModel(oc,cut).volume).toBeCloseTo(4000,3);expect(buildModel(oc,cut).bodies).toHaveLength(1)
 const kept=add(d,{type:'combine',parameters:{bodyId,toolIds:[toolId],operation:'cut',keepTools:true}})
 expect(buildModel(oc,kept).volume).toBeCloseTo(12000,3)
})
it('reimports exported STEP and recovers the same authoritative volume',()=>{
 const d=block(),bytes=exportStep(oc,d).bytes,path='/roundtrip.step';oc.FS.writeFile(path,bytes)
 const reader=new oc.STEPControl_Reader_1(),progress=new oc.Message_ProgressRange_1(),props=new oc.GProp_GProps_1()
 try{expect(reader.ReadFile(path)).toBe(oc.IFSelect_ReturnStatus.IFSelect_RetDone);expect(reader.TransferRoots(progress)).toBeGreaterThan(0);const shape=reader.OneShape();try{oc.BRepGProp.VolumeProperties_1(shape,props,true,false,false);expect(props.Mass()).toBeCloseTo(8000,4)}finally{shape.delete()}}finally{props.delete();progress.delete();reader.delete();oc.FS.unlink(path)}
})
it('rebuilds the complete solid-tool dependency chain through shell',()=>{
 let d=add(createDocument('Acceptance','mm'),{type:'sketch',parameters:{plane:'XY',x:0,y:0,width:80,height:60}})
 d=add(d,{type:'extrude',parameters:{profileId:d.features[0].id,distance:20,operation:'new'}});const bodyId=d.features[1].id
 d=add(d,{type:'sketch',parameters:{plane:'XY',profile:'circle',x:15,y:15,width:8,height:8}})
 d=add(d,{type:'hole',parameters:{bodyId,profileId:d.features.at(-1)!.id,plane:'XY',x:15,y:15,offset:20,diameter:8,depth:20}})
 let m=buildModel(oc,d)
 const vertical=m.edges.find(e=>Math.abs(e.length-20)<1e-5&&e.center[0]<.01&&e.center[1]<.01)!
 expect(vertical).toBeTruthy();d=add(d,{type:'fillet',parameters:{bodyId,radius:3},references:[vertical.reference]});m=buildModel(oc,d)
 const bottom=m.edges.find(e=>Math.abs(e.length-60)<1e-5&&e.center[0]>79.9&&e.center[2]<.01)!
 expect(bottom).toBeTruthy();d=add(d,{type:'chamfer',parameters:{bodyId,distance:2},references:[bottom.reference]});m=buildModel(oc,d)
 const top=m.faces.find(f=>f.normal?.[2]===1)!
 d=add(d,{type:'shell',parameters:{bodyId,thickness:1},reference:top.reference!});m=buildModel(oc,d)
 expect(m.volume).toBeGreaterThan(5000);expect(m.volume).toBeLessThan(11000)
})

it('locates sketch-driven holes relative to the reference plane',()=>{
 let d=add(createDocument('Offset hole','mm'),{type:'plane',parameters:{plane:'XY',offset:50}})
 const planeId=d.features[0].id
 d=add(d,{type:'sketch',parameters:{plane:'XY',planeId,x:0,y:0,width:20,height:20}})
 d=add(d,{type:'extrude',parameters:{profileId:d.features[1].id,distance:20}})
 const bodyId=d.features[2].id
 d=add(d,{type:'sketch',parameters:{plane:'XY',planeId,x:10,y:10,width:4,height:4,profile:'circle'}})
 d=add(d,{type:'hole',parameters:{bodyId,profileId:d.features[3].id,plane:'XY',x:0,y:0,offset:20,diameter:4,depth:20}})
 expect(buildModel(oc,d).volume).toBeCloseTo(8000-Math.PI*4*20,4)
})

it('exports the smooth gear with bounded display mesh and fine STL',()=>{
 const d=add(createDocument('Gear export','mm'),{type:'gear',parameters:{module:2,teeth:30,pressureAngle:20,thickness:10,bore:8,x:270,y:0,z:0,backlash:0}})
 const m=buildModel(oc,d);expect(m.triangleCount).toBeLessThan(100000)
 const stl=exportModel(oc,d,{format:'binary',unit:'mm',tolerance:.01,angle:.1});expect(stl.closed).toBe(true);expect(stl.triangles).toBeLessThan(200000)
})

it('gives each patterned body independently selectable edge identifiers',()=>{
 let d=block();d=add(d,{type:'linear-pattern',parameters:{bodyId:d.features[1].id,count:3,spacing:30,axis:'X'}})
 const m=buildModel(oc,d);expect(new Set(m.edges.map(e=>e.reference.id)).size).toBe(m.edges.length)
})
