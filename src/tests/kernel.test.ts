import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import initOpenCascade from 'opencascade.js/dist/node.js'
import type { OpenCascadeInstance } from 'opencascade.js'
import { buildModel, exportModel } from '../cad/kernel'
import { createDocument, applyCommand } from '../cad/document'

let oc: OpenCascadeInstance
beforeAll(async () => { oc = await initOpenCascade({ module: { wasmBinary: readFileSync(new URL('../../node_modules/opencascade.js/dist/opencascade.full.wasm', import.meta.url)) } }) })
const box = () => applyCommand(applyCommand(createDocument('Kernel test', 'mm'), { type: 'set-sketch', plane: 'XY', x: 0, y: 0, width: 10, height: 20 }), { type: 'extrude', distance: 30 })
describe('real OpenCascade feature chain', () => {
  it('extrudes a rectangle into a valid 6000 mm³ B-Rep with 2200 mm² area', () => {
    const model = buildModel(oc, box())
    expect(model.volume).toBeCloseTo(6000, 6)
    expect(model.surfaceArea).toBeCloseTo(2200, 6)
    expect(model.faces).toHaveLength(6)
    expect(model.edges).toHaveLength(12)
    expect(model.brep.length).toBeGreaterThan(100)
  })
  it('fillets selected persistent edges and resolves them after a sketch resize', () => {
    const doc = box()
    const original = buildModel(oc, doc)
    const ref = original.edges.find(e => e.filletEligible)!.reference
    const rounded = applyCommand(doc, { type: 'fillet', radius: 1, references: [ref] })
    const result = buildModel(oc, rounded)
    expect(result.volume).toBeLessThan(6000)
    expect(result.volume).toBeGreaterThan(5900)
    expect(result.faces.length).toBeGreaterThan(6)
    const resized = applyCommand(rounded, { type: 'set-sketch', plane: 'XY', x: 0, y: 0, width: 15, height: 20 })
    expect(buildModel(oc, resized).volume).toBeGreaterThan(result.volume)
  })
  it('fails loudly for invalid radius and unresolved topology', () => {
    const doc = box()
    const ref = buildModel(oc, doc).edges[0].reference
    expect(() => buildModel(oc, applyCommand(doc, { type: 'fillet', radius: 100, references: [ref] }))).toThrow(/Fillet/i)
    expect(() => buildModel(oc, applyCommand(doc, { type: 'fillet', radius: 1, references: [{ ...ref, signature: 'missing' }] }))).toThrow(/reference/i)
  })
  it('exports manifold binary STL with explicit coordinate unit conversion', () => {
    const result = exportModel(oc, box(), { format: 'binary', unit: 'in', tolerance: 0.01, angle: 0.1 })
    const view = new DataView(result.bytes.buffer)
    expect(result.closed).toBe(true)
    expect(view.getUint32(80, true)).toBe(12)
    expect(result.bytes.length).toBe(84 + 12 * 50)
    const coordinates: number[] = []
    for (let i = 0; i < 12; i++) for (let v = 0; v < 3; v++) coordinates.push(view.getFloat32(84 + i * 50 + 12 + v * 12 + 8, true))
    expect(Math.max(...coordinates)).toBeCloseTo(30 / 25.4, 6)
  })
})
it.each(['XY','XZ','YZ'] as const)('maintains solid orientation on the %s plane',plane=>{
  const doc=applyCommand(applyCommand(createDocument('Planes','mm'),{type:'set-sketch',plane,x:2,y:3,width:10,height:20}),{type:'extrude',distance:30})
  expect(buildModel(oc,doc).volume).toBeCloseTo(6000,6)
  expect(exportModel(oc,doc,{format:'ascii',unit:'mm',tolerance:.01,angle:.1}).closed).toBe(true)
})
it('exports fine and ultra rounded solids as closed meshes with outward winding',()=>{
  const doc=box(),edges=buildModel(oc,doc).edges
  const rounded=applyCommand(doc,{type:'fillet',radius:1,references:edges.map(e=>e.reference)})
  const exactVolume=buildModel(oc,rounded).volume
  const result=exportModel(oc,rounded,{format:'binary',unit:'mm',tolerance:.001,angle:.03})
  const data=new DataView(result.bytes.buffer)
  let signedVolume=0
  for(let i=0;i<result.triangles;i++){
    const p=Array.from({length:9},(_,j)=>data.getFloat32(84+i*50+12+j*4,true))
    signedVolume+=(p[0]*(p[4]*p[8]-p[5]*p[7])-p[1]*(p[3]*p[8]-p[5]*p[6])+p[2]*(p[3]*p[7]-p[4]*p[6]))/6
  }
  expect(result.triangles).toBeGreaterThan(100)
  expect(signedVolume/exactVolume).toBeCloseTo(1,3)
  const ascii=exportModel(oc,rounded,{format:'ascii',unit:'in',tolerance:.01,angle:.1})
  expect(new TextDecoder().decode(ascii.bytes)).toMatch(/^solid AnishapeGeometry\nfacet normal/)
  expect(ascii.closed).toBe(true)
})
it('rejects binary coordinate precision loss while preserving an ASCII alternative',()=>{
  const doc=applyCommand(applyCommand(createDocument('Precision','mm'),{type:'set-sketch',plane:'XY',x:100000,y:0,width:.001,height:20}),{type:'extrude',distance:30})
  expect(()=>exportModel(oc,doc,{format:'binary',unit:'mm',tolerance:.001,angle:.1})).toThrow(/precision|degenerate/i)
  expect(exportModel(oc,doc,{format:'ascii',unit:'mm',tolerance:.001,angle:.1}).closed).toBe(true)
})

it.each(['reverse','symmetric'] as const)('constructs a valid %s extrusion on the sketch normal',direction=>{
  const doc=applyCommand(box(),{type:'extrude',distance:30,direction})
  const result=buildModel(oc,doc)
  expect(result.volume).toBeCloseTo(6000,6)
  expect(result.bounds.min[2]).toBeCloseTo(direction==='reverse'?-30:-15,6)
  expect(result.bounds.max[2]).toBeCloseTo(direction==='reverse'?0:15,6)
})
it('pushes and pulls a selected side face using exact solid booleans',()=>{
  const doc=box(),original=buildModel(oc,doc)
  const face=original.faces.find(face=>face.reference?.normal[0]===1)!
  const pushed=applyCommand(doc,{type:'push-pull',distance:5,reference:face.reference!})
  expect(buildModel(oc,pushed).volume).toBeCloseTo(9000,6)
  const pulled=applyCommand(doc,{type:'push-pull',distance:-2,reference:face.reference!})
  expect(buildModel(oc,pulled).volume).toBeCloseTo(4800,6)
  const resized=applyCommand(pushed,{type:'set-sketch',plane:'XY',x:0,y:0,width:15,height:20})
  expect(buildModel(oc,resized).volume).toBeCloseTo(12000,6)
  expect(exportModel(oc,pushed,{format:'binary',unit:'mm',tolerance:.01,angle:.1}).closed).toBe(true)
})
it('supports successive planar face offsets and rejects removal of the whole solid',()=>{
  let doc=box(),result=buildModel(oc,doc)
  doc=applyCommand(doc,{type:'push-pull',distance:2,reference:result.faces.find(f=>f.reference?.normal[0]===1)!.reference!})
  result=buildModel(oc,doc)
  doc=applyCommand(doc,{type:'push-pull',distance:2,reference:result.faces.find(f=>f.reference?.normal[1]===1)!.reference!})
  expect(buildModel(oc,doc).volume).toBeCloseTo(12*22*30,6)
  const original=box(),top=buildModel(oc,original).faces.find(f=>f.reference?.normal[2]===1)!
  expect(()=>buildModel(oc,applyCommand(original,{type:'push-pull',distance:-40,reference:top.reference!}))).toThrow(/solid|remov|push/i)
})
