import {beforeAll,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import initOpenCascade from 'opencascade.js/dist/node.js'
import type {OpenCascadeInstance} from 'opencascade.js'
import type {CadDocument,FeatureInput,SketchFeature} from '../cad/types'
import {applyCommand,createDocument,parseProject,serializeProject,dependentFeatures} from '../cad/document'
import {buildModel} from '../cad/kernel'
let oc:OpenCascadeInstance
beforeAll(async()=>{oc=await initOpenCascade({module:{wasmBinary:readFileSync(new URL('../../node_modules/opencascade.js/dist/opencascade.full.wasm',import.meta.url))}})})
const add=(doc:CadDocument,feature:FeatureInput)=>applyCommand(doc,{type:'feature',feature})
const circle=(d:number,z=0):FeatureInput=>({type:'sketch',parameters:{plane:'XY',x:0,y:0,width:d,height:d,profile:'circle',offset:z}})
it('lofts ordered sections to an exact cone frustum and follows edits after round-trip',()=>{
 let doc=add(add(createDocument('Loft','mm'),circle(20)),circle(10,30));const ids=doc.features.map(f=>f.id);
 doc=add(doc,{type:'loft',parameters:{sections:ids.map(profileId=>({profileId})),ruled:true,operation:'new'}});
 expect(buildModel(oc,parseProject(serializeProject(doc))).volume).toBeCloseTo(Math.PI*30/3*(100+50+25),3);
 expect(dependentFeatures(doc,ids[0]).map(f=>f.type)).toEqual(['sketch','loft']);
 const upper=doc.features[1] as SketchFeature;doc=applyCommand(doc,{type:'feature',id:upper.id,feature:{type:'sketch',parameters:{...upper.parameters,offset:45}}});expect(buildModel(oc,doc).volume).toBeCloseTo(Math.PI*45/3*175,3);
})
it('rejects duplicate or missing loft sections without creating a feature',()=>{
 const doc=add(createDocument('Bad loft','mm'),circle(20));expect(()=>add(doc,{type:'loft',parameters:{sections:[{profileId:doc.features[0].id},{profileId:doc.features[0].id}],ruled:false,operation:'new'}})).toThrow(/distinct|duplicate/i);
 expect(()=>add(doc,{type:'loft',parameters:{sections:[{profileId:doc.features[0].id},{profileId:'missing'}],ruled:false,operation:'new'}})).toThrow(/reference/i);
})
it('sweeps a circular section along an analytic quarter-circle path',()=>{
 let doc=add(createDocument('Sweep','mm'),circle(4));const profileId=doc.features[0].id;
 doc=add(doc,{type:'sketch',parameters:{plane:'XZ',x:0,y:0,width:20,height:20,entities:[{id:'bend',type:'arc',start:[0,0],mid:[20-20/Math.sqrt(2),20/Math.sqrt(2)],end:[20,20]}]}});
 doc=add(doc,{type:'sweep',parameters:{profileId,pathId:doc.features[1].id,operation:'new'}});
 const model=buildModel(oc,parseProject(serializeProject(doc)));expect(model.volume).toBeCloseTo(Math.PI*4*Math.PI*10,2);expect(model.bodies).toHaveLength(1);expect(model.bounds.max[0]).toBeCloseTo(20,3);
})
it('sweep supports a straight path and cut operation on its chosen body',()=>{
 let doc=add(createDocument('Cut sweep','mm'),{type:'sketch',parameters:{plane:'XY',x:-10,y:-10,width:20,height:20}});doc=add(doc,{type:'extrude',parameters:{profileId:doc.features[0].id,distance:30}});const bodyId=doc.features[1].id;
 doc=add(doc,circle(4));const profileId=doc.features.at(-1)!.id;doc=add(doc,{type:'sketch',parameters:{plane:'XZ',x:0,y:0,width:1,height:30,entities:[{id:'path',type:'line',start:[0,0],end:[0,30]}]}});
 doc=add(doc,{type:'sweep',parameters:{profileId,pathId:doc.features.at(-1)!.id,bodyId,operation:'cut'}});expect(buildModel(oc,doc).volume).toBeCloseTo(12000-Math.PI*4*30,4);
})
it('rejects disconnected sweep paths and preserves the source document',()=>{
 let doc=add(createDocument('Bad path','mm'),circle(4));const profileId=doc.features[0].id;doc=add(doc,{type:'sketch',parameters:{plane:'XZ',x:0,y:0,width:1,height:30,entities:[{id:'a',type:'line',start:[0,0],end:[0,10]},{id:'b',type:'line',start:[0,20],end:[0,30]}]}});const before=serializeProject(doc);const candidate=add(doc,{type:'sweep',parameters:{profileId,pathId:doc.features[1].id,operation:'new'}});expect(()=>buildModel(oc,candidate)).toThrow(/connected|path/i);expect(serializeProject(doc)).toBe(before);
})

it('loft rejects a selected region with holes instead of filling them silently',()=>{let doc=add(createDocument('Loft holes','mm'),{type:'sketch',parameters:{plane:'XY',x:0,y:0,width:20,height:20,entities:[{id:'outer',type:'circle',center:[0,0],radius:10},{id:'inner',type:'circle',center:[0,0],radius:3}]}});const profileId=doc.features[0].id;doc=add(doc,circle(10,20));doc=add(doc,{type:'loft',parameters:{sections:[{profileId,regionId:'region:outer'},{profileId:doc.features[1].id}],ruled:false,operation:'new'}});expect(()=>buildModel(oc,doc)).toThrow(/without holes/i)})
it('smooth loft handles three ordered rectangular sections and cuts only its target',()=>{let doc=add(createDocument('Loft cut','mm'),{type:'sketch',parameters:{plane:'XY',x:-10,y:-10,width:20,height:20}});doc=add(doc,{type:'extrude',parameters:{profileId:doc.features[0].id,distance:30}});const bodyId=doc.features[1].id;for(const z of [0,15,30])doc=add(doc,{type:'sketch',parameters:{plane:'XY',x:-2,y:-2,width:4,height:4,offset:z}});doc=add(doc,{type:'loft',parameters:{sections:doc.features.slice(-3).map(f=>({profileId:f.id})),ruled:false,operation:'cut',bodyId}});expect(buildModel(oc,doc).volume).toBeCloseTo(12000-480,4)})
