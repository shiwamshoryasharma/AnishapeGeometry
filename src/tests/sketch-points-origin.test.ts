import {createDocument,createHistory,commitHistory,parseHistory,serializeProject,undoHistory,redoHistory} from '../cad/document'
import {displaySketches} from '../cad/sketch-display'
import {sweepPath} from '../cad/sweep-path'
import {beforeAll,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {init_planegcs_module,GcsWrapper,type ModuleStatic} from '@salusoft89/planegcs'
import type {SketchEntity} from '../cad/types'
import {solveSketch} from '../cad/sketch-solver'
import {assertConstraintsSatisfied,type SketchConstraint} from '../cad/sketch-constraints'
import {rectangleEntities,sketchRegions,validateEntities} from '../cad/sketch-entities'
import {rotateEntities,windowSelection,trimEntity} from '../cad/sketch-edit'
import {mirrorEntities} from '../cad/sketch-tools'
import {sketchSnapPoints,snapSketchPoint} from '../cad/sketch-snapping'
import {planeFrame} from '../cad/planes'
let mod:ModuleStatic
beforeAll(async()=>{mod=await (init_planegcs_module as unknown as(config:{wasmBinary:Uint8Array})=>Promise<ModuleStatic>)({wasmBinary:readFileSync(new URL('../../node_modules/@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm',import.meta.url))})})
const solve=(entities:SketchEntity[],constraints:SketchConstraint[])=>{const gcs=new GcsWrapper(new mod.GcsSystem(),mod);try{return solveSketch(gcs,entities,constraints)}finally{gcs.destroy_gcs_module()}}
const p:SketchEntity={id:'p',type:'point',position:[3,7]}
it('retains standalone points without changing closed profile topology',()=>{
 expect(()=>validateEntities([p])).not.toThrow()
 const rect=rectangleEntities([0,0],[20,10],'r');expect(sketchRegions([...rect,p])).toEqual(sketchRegions(rect));expect(sketchRegions([p])).toEqual([])
 expect(()=>validateEntities([{...p,position:[NaN,0]}])).toThrow(/point/i)
})
it('solves signed X/Y dimensions and a persistent origin anchor with real WASM',()=>{
 const dimensions:SketchConstraint[]=[{id:'x',type:'coordinate-x',point:{entityId:'p',point:'position'},value:-12},{id:'y',type:'coordinate-y',point:{entityId:'p',point:'position'},value:8}]
 const result=solve([p],dimensions);expect(result.dof).toBe(0);expect(result.entities[0]).toMatchObject({position:[-12,8]});assertConstraintsSatisfied(result.entities,dimensions)
 const origin:SketchConstraint[]=[{id:'o',type:'origin',point:{entityId:'p',point:'position'}}]
 const anchored=solve([p],origin);expect(anchored.dof).toBe(0);expect(anchored.entities[0]).toMatchObject({position:[0,0]})
 expect(()=>solve([p],[...origin,dimensions[0]])).toThrow(/conflict|satisf/i)
})
it('supports point-to-endpoint coincidence, axis alignment and rejects curve-only relations',()=>{
 const line:SketchEntity={id:'l',type:'line',start:[3,7],end:[20,9]}
 const constraints:SketchConstraint[]=[{id:'origin',type:'origin',point:{entityId:'p',point:'position'}},{id:'join',type:'coincident',first:{entityId:'p',point:'position'},second:{entityId:'l',point:'start'}},{id:'axis',type:'coordinate-y',point:{entityId:'l',point:'end'},value:0},{id:'len',type:'length',entityId:'l',value:20}]
 const result=solve([p,line],constraints);expect(result.dof).toBe(0);assertConstraintsSatisfied(result.entities,constraints)
 expect(()=>solve([p],[{id:'radius',type:'radius',entityId:'p',value:10}])).toThrow(/circle|arc/i)
})
it('transforms, selects and snaps to points without passing them to curve editing',()=>{
 expect(mirrorEntities([p],'Y',0)[0]).toMatchObject({position:[-3,7]})
 const rotated=rotateEntities([p],[0,0],90)[0];expect(rotated.type==='point'&&rotated.position[0]).toBeCloseTo(-7)
 expect(windowSelection([p],[0,0],[10,10],false)).toEqual(['p'])
 expect(windowSelection([p],[0,0],[1,1],true)).toEqual([])
 const targets=sketchSnapPoints(planeFrame('XY'),null,[p]);expect(snapSketchPoint([3.1,7],targets,10,false).point).toEqual([3,7])
 expect(()=>trimEntity([p],'p',[3,7])).toThrow(/point|curve/i)
})

it('persists point-only sketches, constraints and history in project files',()=>{
 const constraints:SketchConstraint[]=[{id:'o',type:'origin',point:{entityId:'p',point:'position'}}]
 const entities=solve([p],constraints).entities
 let history=createHistory(createDocument('Points','mm'));history=commitHistory(history,{type:'feature',feature:{type:'sketch',parameters:{plane:'XZ',offset:12,x:0,y:0,width:.001,height:.001,entities,constraints}}})
 const loaded=parseHistory(serializeProject(history.present,history));expect(loaded.present.features[0].parameters).toMatchObject({entities,constraints});expect(redoHistory(undoHistory(loaded)).present).toEqual(loaded.present)
 expect(displaySketches(loaded.present,null)[0].lines[0].points).toEqual([[0,-12,0]])
 expect(sweepPath([{id:'l',type:'line',start:[0,0],end:[20,0]},p])).toHaveLength(1)
})
it('keeps fixed points fixed and validates point relations before entering the solver',()=>{
 expect(solve([p],[{id:'f',type:'fixed',entityId:'p',geometry:p}]).dof).toBe(0)
 for(const type of ['equal','tangent','concentric'] as const)expect(()=>solve([p,{id:'c',type:'circle',center:[5,5],radius:2}],[{id:'bad',type,entityIds:['p','c']}])).toThrow(/curves/i)
 expect(()=>solve([p],[{id:'x',type:'coordinate-x',point:{entityId:'p',point:'position'},value:NaN}])).toThrow(/coordinate/i)
})
