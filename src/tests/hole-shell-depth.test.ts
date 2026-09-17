import {beforeAll,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import initOpenCascade from 'opencascade.js/dist/node.js'
import type {OpenCascadeInstance} from 'opencascade.js'
import type {CadDocument,FeatureInput,HoleFeature} from '../cad/types'
import {applyCommand,createDocument,parseProject,serializeProject} from '../cad/document'
import {buildModel} from '../cad/kernel'
let oc:OpenCascadeInstance
beforeAll(async()=>{oc=await initOpenCascade({module:{wasmBinary:readFileSync(new URL('../../node_modules/opencascade.js/dist/opencascade.full.wasm',import.meta.url))}})})
const add=(d:CadDocument,f:FeatureInput)=>applyCommand(d,{type:'feature',feature:f})
const base=()=>add(createDocument('Hole and shell','mm'),{type:'box',parameters:{x:0,y:0,z:0,width:20,depth:20,height:30,operation:'new'}})
const hole=(d:CadDocument,extra:Record<string,unknown>={})=>add(d,{type:'hole',parameters:{bodyId:d.features[0].id,plane:'XY',x:10,y:10,offset:30,diameter:4,depth:10,...extra}} as FeatureInput)
it('counterbore removes the exact stepped cylinder volume and persists parameters',()=>{
 const d=hole(base(),{style:'counterbore',counterDiameter:8,counterDepth:3})
 expect(buildModel(oc,parseProject(serializeProject(d))).volume).toBeCloseTo(12000-Math.PI*(4*10+12*3),4)
})
it('countersink creates the requested cone angle without changing its shaft diameter',()=>{
 const d=hole(base(),{style:'countersink',counterDiameter:8,sinkAngle:90})
 const cone=Math.PI*2/3*(16+8+4),shaft=Math.PI*4*8
 expect(buildModel(oc,d).volume).toBeCloseTo(12000-cone-shaft,4)
})
it('through-all hole follows body bounds and remains valid after depth edits',()=>{
 let d=hole(base(),{termination:'through-all',depth:1,offset:60})
 expect(buildModel(oc,d).volume).toBeCloseTo(12000-Math.PI*4*30,4)
 d=applyCommand(d,{type:'feature',id:d.features[0].id,feature:{type:'box',parameters:{x:0,y:0,z:0,width:20,depth:20,height:50,operation:'new'}}})
 expect(buildModel(oc,d).volume).toBeCloseTo(20000-Math.PI*4*50,4)
})
it('face-mounted circle provides the hole diameter and rejects an undersized recess',()=>{
 let d=base();const face=buildModel(oc,d).faces.find(f=>f.normal?.[2]===1)!
 d=add(d,{type:'sketch',parameters:{plane:'XY',x:10,y:10,width:6,height:6,profile:'circle',support:face.reference!}})
 const feature={type:'hole',parameters:{bodyId:d.features[0].id,profileId:d.features[1].id,plane:'XY',x:0,y:0,offset:0,diameter:4,depth:10,style:'counterbore',counterDiameter:10,counterDepth:3}} as FeatureInput
 expect(buildModel(oc,add(d,feature)).volume).toBeCloseTo(12000-Math.PI*(9*10+16*3),4)
 ;(feature as HoleFeature).parameters.counterDiameter=5
 expect(()=>buildModel(oc,add(d,feature))).toThrow(/diameter/i)
})
it('shell removes two opposing faces to make an open tube with uniform walls',()=>{
 const d=base(),m=buildModel(oc,d),faces=m.faces.filter(f=>Math.abs(f.normal?.[2]??0)===1).map(f=>f.reference!)
 const shelled=add(d,{type:'shell',parameters:{bodyId:d.features[0].id,thickness:2},reference:faces[0],openingFaces:faces} as FeatureInput)
 expect(buildModel(oc,parseProject(serializeProject(shelled))).volume).toBeCloseTo((400-256)*30,3)
})
it('invalid hole recesses and duplicate shell openings fail before committing',()=>{
 for(const extra of [{style:'counterbore',counterDiameter:3,counterDepth:2},{style:'counterbore',counterDiameter:8,counterDepth:12},{style:'countersink',counterDiameter:8,sinkAngle:0},{termination:'invalid'}])expect(()=>hole(base(),extra)).toThrow()
 const d=base(),face=buildModel(oc,d).faces.find(f=>f.normal?.[2]===1)!.reference!
 expect(()=>add(d,{type:'shell',parameters:{bodyId:d.features[0].id,thickness:2},reference:face,openingFaces:[face,face]} as FeatureInput)).toThrow(/distinct|duplicate/i)
})
