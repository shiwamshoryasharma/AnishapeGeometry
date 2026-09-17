import {beforeAll,describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {init_planegcs_module,GcsWrapper,type ModuleStatic} from '@salusoft89/planegcs'
import type {SketchEntity} from '../cad/types'
import {solveSketch} from '../cad/sketch-solver'
import {validateConstraints,assertConstraintsSatisfied,connectedConstraints,type SketchConstraint} from '../cad/sketch-constraints'
import {applyCommand,createDocument,createHistory,commitHistory,parseHistory,serializeProject,undoHistory,redoHistory} from '../cad/document'
import {rectangleEntities} from '../cad/sketch-entities'
let mod:ModuleStatic
beforeAll(async()=>{mod=await (init_planegcs_module as unknown as (config:{wasmBinary:Uint8Array})=>Promise<ModuleStatic>)({wasmBinary:readFileSync(new URL('../../node_modules/@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm',import.meta.url))})})
const solve=(entities:SketchEntity[],constraints:SketchConstraint[])=>{const gcs=new GcsWrapper(new mod.GcsSystem(),mod);try{return solveSketch(gcs,entities,constraints)}finally{gcs.destroy_gcs_module()}}
describe('persistent sketch constraints with real planeGCS',()=>{
 it('makes a slanted line horizontal and retains its length through later edits',()=>{
  const source:SketchEntity[]=[{id:'line',type:'line',start:[0,0],end:[20,3]}]
  const constraints:SketchConstraint[]=[{id:'h',type:'horizontal',entityId:'line'},{id:'len',type:'length',entityId:'line',value:30}]
  const before=JSON.stringify(source),result=solve(source,constraints)
  expect(JSON.stringify(source)).toBe(before);expect(result.dof).toBe(2)
  assertConstraintsSatisfied(result.entities,constraints)
  const line=result.entities[0];if(line.type!=='line')throw Error('Expected line')
  expect(line.end[1]).toBeCloseTo(line.start[1],7);expect(line.end[0]-line.start[0]).toBeCloseTo(30,7)
  expect(solve([{...line,end:[line.end[0]+8,line.end[1]+4]}],constraints).dof).toBe(2)
 })
 it('fully constrains a rectangle with connected endpoints, H/V, sizes and a fixed corner',()=>{
  const entities=rectangleEntities([0,0],[20,10],'rect')
  const constraints:SketchConstraint[]=[...connectedConstraints(entities),
   ...entities.map((e,i)=>({id:'axis'+i,type:i%2?'vertical':'horizontal',entityId:e.id} as SketchConstraint)),
   {id:'width',type:'length',entityId:'rect:0',value:40},{id:'height',type:'length',entityId:'rect:1',value:25},
   {id:'anchor',type:'position',point:{entityId:'rect:0',point:'start'},position:[0,0]}]
  const result=solve(entities,constraints);expect(result.dof).toBe(0);assertConstraintsSatisfied(result.entities,constraints)
  expect(result.entities[1]).toMatchObject({start:[40,0],end:[40,25]})
 })
 it('rejects contradictory driving dimensions without mutating the last valid geometry',()=>{
  const entities:SketchEntity[]=[{id:'c',type:'circle',center:[5,8],radius:10}],before=JSON.stringify(entities)
  expect(()=>solve(entities,[{id:'r1',type:'radius',entityId:'c',value:10},{id:'r2',type:'radius',entityId:'c',value:15}])).toThrow(/conflict|satisf|solve/i)
  expect(JSON.stringify(entities)).toBe(before)
 })
 it('reports redundant dimensions and solves concentric equal circles',()=>{
  const entities:SketchEntity[]=[{id:'a',type:'circle',center:[0,0],radius:10},{id:'b',type:'circle',center:[3,2],radius:5}]
  const constraints:SketchConstraint[]=[{id:'centers',type:'concentric',entityIds:['a','b']},{id:'equal',type:'equal',entityIds:['a','b']},{id:'r',type:'radius',entityId:'a',value:8}]
  const result=solve(entities,constraints);expect(result.dof).toBe(2);assertConstraintsSatisfied(result.entities,constraints)
  const duplicate=solve(result.entities,[...constraints,{id:'r-copy',type:'radius',entityId:'a',value:8}]);expect(duplicate.redundant.length).toBeGreaterThan(0)
 })
 it('preserves an analytic arc while applying its radius constraint',()=>{
  const entities:SketchEntity[]=[{id:'arc',type:'arc',start:[10,0],mid:[Math.sqrt(50),Math.sqrt(50)],end:[0,10]}]
  const constraints:SketchConstraint[]=[{id:'radius',type:'radius',entityId:'arc',value:20}]
  const result=solve(entities,constraints);assertConstraintsSatisfied(result.entities,constraints);expect(result.dof).toBe(4)
 })
 it('solves parallel/perpendicular lines, equal lengths and line angle',()=>{
  const entities:SketchEntity[]=[{id:'a',type:'line',start:[0,0],end:[20,0]},{id:'b',type:'line',start:[30,2],end:[31,12]}]
  for(const type of ['parallel','perpendicular'] as const){const constraints:SketchConstraint[]=[{id:'relation',type,entityIds:['a','b']},{id:'same',type:'equal',entityIds:['a','b']}];assertConstraintsSatisfied(solve(entities,constraints).entities,constraints)}
  const angle:SketchConstraint[]=[{id:'angle',type:'angle',entityIds:['a','b'],value:45}];assertConstraintsSatisfied(solve(entities,angle).entities,angle)
 })
 it('keeps fixed geometry and rejects an incompatible edit rather than dropping constraints',()=>{
  const line:SketchEntity={id:'a',type:'line',start:[0,0],end:[20,0]}
  const constraints:SketchConstraint[]=[{id:'fixed',type:'fixed',entityId:'a',geometry:line}]
  expect(solve([{...line,start:[3,4],end:[23,4]}],constraints).entities).toEqual([line])
  expect(solve([line],constraints).dof).toBe(0)
 })
})
describe('constraint document contracts',()=>{
 it('rejects missing entities, malformed refs, invalid values and duplicate IDs',()=>{
  const entities:SketchEntity[]=[{id:'a',type:'line',start:[0,0],end:[20,0]}]
  for(const constraints of [[{id:'x',type:'horizontal',entityId:'missing'}],[{id:'x',type:'radius',entityId:'a',value:1}],[{id:'x',type:'length',entityId:'a',value:NaN}],[{id:'x',type:'horizontal',entityId:'a'},{id:'x',type:'vertical',entityId:'a'}]])expect(()=>validateConstraints(entities,constraints)).toThrow()
 })
 it('persists constraints through file reload and undo/redo, while old projects still load',()=>{
  const entities:SketchEntity[]=[{id:'a',type:'circle',center:[0,0],radius:10}]
  const constraints:SketchConstraint[]=[{id:'radius',type:'radius',entityId:'a',value:10}]
  let h=createHistory(createDocument('Constrained','mm'));h=commitHistory(h,{type:'feature',feature:{type:'sketch',parameters:{plane:'XY',x:0,y:0,width:20,height:20,entities,constraints}}})
  const loaded=parseHistory(serializeProject(h.present,h));expect(loaded.present.features[0].parameters).toMatchObject({constraints});expect(undoHistory(loaded).present.features).toHaveLength(0);expect(redoHistory(undoHistory(loaded)).present).toEqual(loaded.present)
  const legacy=applyCommand(createDocument('Legacy','mm'),{type:'set-sketch',plane:'XY',x:0,y:0,width:20,height:10});expect(parseHistory(serializeProject(legacy)).present).toEqual(legacy)
 })
 it('rejects saved geometry that violates its driving constraints',()=>{
  const document=createDocument('Invalid constraint','mm')
  expect(()=>applyCommand(document,{type:'feature',feature:{type:'sketch',parameters:{plane:'XY',x:0,y:0,width:20,height:20,entities:[{id:'a',type:'circle',center:[0,0],radius:10}],constraints:[{id:'radius',type:'radius',entityId:'a',value:5}]}}})).toThrow(/constraint|satisf/i)
 })
})

it('keeps imported constraint identities separate from solver geometry and point identities',()=>{
 const source:SketchEntity[]=[{id:'user',type:'line',start:[0,0],end:[20,3]}]
 const constraints:SketchConstraint[]=[{id:'e0',type:'horizontal',entityId:'user'},{id:'e0:start',type:'length',entityId:'user',value:30},{id:'anchor',type:'position',point:{entityId:'user',point:'start'},position:[0,0]},{id:'anchor:x',type:'length',entityId:'user',value:30}]
 const result=solve(source,constraints);expect(result.dof).toBe(0);assertConstraintsSatisfied(result.entities,constraints);expect(result.redundant.every(id=>constraints.some(c=>c.id===id))).toBe(true)
})

it('solves line-circle and external circle-circle tangency with fixed references',()=>{
 const line:SketchEntity={id:'line',type:'line',start:[0,0],end:[20,0]},circle:SketchEntity={id:'circle',type:'circle',center:[10,8],radius:5}
 const constraints:SketchConstraint[]=[{id:'fix',type:'fixed',entityId:'line',geometry:line},{id:'radius',type:'radius',entityId:'circle',value:5},{id:'touch',type:'tangent',entityIds:['line','circle']}]
 const result=solve([line,circle],constraints);assertConstraintsSatisfied(result.entities,constraints)
 const a:SketchEntity={id:'a',type:'circle',center:[0,0],radius:5},b:SketchEntity={id:'b',type:'circle',center:[10,1],radius:3}
 const pair:SketchConstraint[]=[{id:'fix',type:'fixed',entityId:'a',geometry:a},{id:'r',type:'radius',entityId:'b',value:3},{id:'touch',type:'tangent',entityIds:['a','b']}]
 const solved=solve([a,b],pair);assertConstraintsSatisfied(solved.entities,pair);expect(solved.dof).toBe(1)
})
it('solves point distance and preserves clockwise arcs while resizing',()=>{
 const a:SketchEntity={id:'a',type:'circle',center:[0,0],radius:2},b:SketchEntity={id:'b',type:'circle',center:[12,0],radius:2}
 const constraints:SketchConstraint[]=[{id:'fix',type:'fixed',entityId:'a',geometry:a},{id:'r',type:'radius',entityId:'b',value:2},{id:'distance',type:'distance',first:{entityId:'a',point:'center'},second:{entityId:'b',point:'center'},value:20}]
 assertConstraintsSatisfied(solve([a,b],constraints).entities,constraints)
 const arc:SketchEntity={id:'arc',type:'arc',start:[10,0],mid:[0,-10],end:[-10,0]},r:SketchConstraint[]=[{id:'r',type:'radius',entityId:'arc',value:7}]
 const result=solve([arc],r);assertConstraintsSatisfied(result.entities,r);const curve=result.entities[0];if(curve.type!=='arc')throw Error('Expected arc');expect(curve.mid[1]).toBeLessThan(0)
})
