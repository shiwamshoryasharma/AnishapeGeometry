import {beforeAll,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import initOpenCascade from 'opencascade.js/dist/node.js'
import type {OpenCascadeInstance} from 'opencascade.js'
import {applyCommand,createDocument,parseProject,serializeProject} from '../cad/document'
import {buildModel} from '../cad/kernel'
let oc:OpenCascadeInstance
beforeAll(async()=>{oc=await initOpenCascade({module:{wasmBinary:readFileSync(new URL('../../node_modules/opencascade.js/dist/opencascade.full.wasm',import.meta.url))}})})
it('moves only the chosen body, preserves volume and persists editable signed offsets',()=>{let doc=applyCommand(createDocument('Move','mm'),{type:'feature',feature:{type:'sketch',parameters:{plane:'XY',x:0,y:0,width:20,height:10}}});doc=applyCommand(doc,{type:'feature',feature:{type:'extrude',parameters:{profileId:doc.features[0].id,distance:5,operation:'new'}}});doc=applyCommand(doc,{type:'feature',feature:{type:'extrude',parameters:{profileId:doc.features[0].id,distance:8,operation:'new'}}});doc=applyCommand(doc,{type:'feature',feature:{type:'move',parameters:{bodyId:doc.features[2].id,x:40,y:-15,z:7}}});let model=buildModel(oc,parseProject(serializeProject(doc)));expect(model.volume).toBeCloseTo(2600,5);expect(model.bodies![0].bounds.min[0]).toBeCloseTo(0,5);expect(model.bodies![1].bounds.min).toEqual(expect.arrayContaining([expect.closeTo(40,5),expect.closeTo(-15,5),expect.closeTo(7,5)]));doc=applyCommand(doc,{type:'feature',id:doc.features[3].id,feature:{type:'move',parameters:{bodyId:doc.features[2].id,x:-30,y:0,z:0}}});model=buildModel(oc,doc);expect(model.bodies![1].bounds.min[0]).toBeCloseTo(-30,5);expect(model.volume).toBeCloseTo(2600,5)})
