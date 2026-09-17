import {beforeAll,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import initOpenCascade from 'opencascade.js/dist/node.js'
import type {OpenCascadeInstance} from 'opencascade.js'
import type {CadDocument,FeatureInput,ExtrudeFeature} from '../cad/types'
import {applyCommand,createDocument,parseProject,serializeProject,dependentFeatures} from '../cad/document'
import {buildModel} from '../cad/kernel'
let oc:OpenCascadeInstance
beforeAll(async()=>{oc=await initOpenCascade({module:{wasmBinary:readFileSync(new URL('../../node_modules/opencascade.js/dist/opencascade.full.wasm',import.meta.url))}})})
const add=(d:CadDocument,f:FeatureInput)=>applyCommand(d,{type:'feature',feature:f})
it('through-all cut derives depth from its target and follows upstream height changes',()=>{
 let d=add(createDocument('Through all','mm'),{type:'box',parameters:{x:0,y:0,z:0,width:20,depth:20,height:30,operation:'new'}}),body=d.features[0].id
 d=add(d,{type:'sketch',parameters:{plane:'XY',x:10,y:10,width:4,height:4,profile:'circle',offset:100}})
 d=add(d,{type:'extrude',parameters:{profileId:d.features[1].id,bodyId:body,distance:1,direction:'reverse',operation:'cut',extent:'through-all'}} as FeatureInput)
 expect(buildModel(oc,d).volume).toBeCloseTo(12000-Math.PI*4*30,4)
 d=applyCommand(d,{type:'feature',id:body,feature:{type:'box',parameters:{x:0,y:0,z:0,width:20,depth:20,height:60,operation:'new'}}})
 expect(buildModel(oc,parseProject(serializeProject(d))).volume).toBeCloseTo(24000-Math.PI*4*60,4)
})
it('two-sided extrusion has independent depths and a start offset',()=>{
 let d=add(createDocument('Two sides','mm'),{type:'sketch',parameters:{plane:'XY',x:0,y:0,width:20,height:10}})
 d=add(d,{type:'extrude',parameters:{profileId:d.features[0].id,distance:5,secondDistance:7,startOffset:3,extent:'two-sided',operation:'new'}} as FeatureInput)
 const result=buildModel(oc,d);expect(result.volume).toBeCloseTo(2400,5);expect(result.bounds.min[2]).toBeCloseTo(-4,5);expect(result.bounds.max[2]).toBeCloseTo(8,5)
})
it('up-to-face extrusion persists its reference and follows a moved limiting face',()=>{
 let d=add(createDocument('Up to face','mm'),{type:'box',parameters:{x:0,y:0,z:25,width:20,depth:20,height:10,operation:'new'}})
 const target=d.features[0].id,face=buildModel(oc,d).faces.find(f=>f.normal?.[2]===-1)!
 d=add(d,{type:'sketch',parameters:{plane:'XY',x:0,y:0,width:5,height:5}})
 d=add(d,{type:'extrude',parameters:{profileId:d.features[1].id,distance:1,operation:'new',extent:'up-to-face',endFace:face.reference!}} as FeatureInput)
 expect(buildModel(oc,d).bodies![1].volume).toBeCloseTo(625,4)
 expect(dependentFeatures(d,target)).toHaveLength(2)
 d=applyCommand(d,{type:'feature',id:target,feature:{type:'box',parameters:{x:0,y:0,z:40,width:20,depth:20,height:10,operation:'new'}}})
 expect(buildModel(oc,parseProject(serializeProject(d))).bodies![1].volume).toBeCloseTo(1000,4)
})
it('rejects unsupported or incomplete extent definitions before mutation',()=>{
 const d=add(createDocument('Bad extent','mm'),{type:'sketch',parameters:{plane:'XY',x:0,y:0,width:10,height:10}})
 for(const parameters of [{extent:'through-all',operation:'new'},{extent:'two-sided',secondDistance:0},{extent:'up-to-face'},{extent:'unknown'}]){
  expect(()=>add(d,{type:'extrude',parameters:{distance:10,...parameters}} as ExtrudeFeature)).toThrow()
 }
})
it('two-sided reverse extrusion works on XZ and YZ sketch frames',()=>{
 for(const plane of ['XZ','YZ'] as const){let d=add(createDocument('Side frame','mm'),{type:'sketch',parameters:{plane,x:0,y:0,width:10,height:5}});d=add(d,{type:'extrude',parameters:{distance:-4,direction:'reverse',extent:'two-sided',secondDistance:6}} as FeatureInput);expect(buildModel(oc,d).volume).toBeCloseTo(500,5)}
})
