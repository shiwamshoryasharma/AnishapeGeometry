import { expect,it } from 'vitest'
import { extrusionCenter, resolveSketchPlane } from '../cad/planes'
import { createDocument, applyCommand } from '../cad/document'
import { advancedInput } from '../commands/feature-tools'
it('places circle and rectangle extrusion handles on their resolved reference plane',()=>{
 let doc=applyCommand(createDocument('Placement','mm'),{type:'feature',feature:{type:'plane',parameters:{plane:'XZ',offset:100}}})
 const p=resolveSketchPlane({plane:'XY',planeId:doc.features[0].id,x:10,y:20,width:8,height:8,profile:'circle'},doc.features)
 expect(extrusionCenter(p,12,'reverse',1)).toEqual([10,-88,20])
 expect(extrusionCenter({...p,profile:'rectangle'},12,'symmetric',.5)).toEqual([14,-100,24])
})
it('retains explicit document units in scalar parameter length bindings',()=>{
 let d=applyCommand(createDocument('Inches','in'),{type:'parameters',values:{size:'2'}})
 const feature=advancedInput('plane',{plane:'XY',offset:'size'},d)
 d=applyCommand(d,{type:'feature',feature})
 expect(d.features[0].parameters).toMatchObject({offset:50.8})
 d=applyCommand(d,{type:'settings',unit:'mm',precision:3})
 expect(d.features[0].parameters).toMatchObject({offset:50.8})
 d=applyCommand(d,{type:'parameters',values:{size:'3'}})
 expect((d.features[0].parameters as {offset:number}).offset).toBeCloseTo(76.2)
})

it('rejects prototype feature names and missing topology references before execution',()=>{
 const doc=createDocument('Invalid','mm')
 for(const feature of [{type:'constructor',parameters:{}},{type:'fillet',parameters:{radius:1}},{type:'shell',parameters:{bodyId:'fake',thickness:1}}])expect(()=>applyCommand(doc,{type:'feature',feature:feature as never})).toThrow()
})
