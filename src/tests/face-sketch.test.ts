import { beforeAll, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import initOpenCascade from 'opencascade.js/dist/node.js'
import type { OpenCascadeInstance } from 'opencascade.js'
import { applyCommand, createDocument, parseProject, serializeProject } from '../cad/document'
import { buildModel } from '../cad/kernel'
import type { CadDocument, FaceMesh, FaceReference, FeatureInput, Vec3 } from '../cad/types'

let oc: OpenCascadeInstance
beforeAll(async () => {
  oc = await initOpenCascade({ module: { wasmBinary: readFileSync(new URL('../../node_modules/opencascade.js/dist/opencascade.full.wasm', import.meta.url)) } })
})
const add = (doc: CadDocument, feature: FeatureInput) => applyCommand(doc, { type: 'feature', feature })
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, value, i) => sum + value * b[i], 0)
type FramedFace = FaceMesh & { frame?: { origin: Vec3; u: Vec3; v: Vec3; normal: Vec3 } }
function block() {
  let doc = add(createDocument('Face sketch', 'mm'), { type: 'sketch', parameters: { plane: 'XY', x: 0, y: 0, width: 20, height: 20 } })
  doc = add(doc, { type: 'extrude', parameters: { profileId: doc.features[0].id, distance: 20, operation: 'new' } })
  return doc
}
function supportedSketch(doc: CadDocument, face: FramedFace, profile: 'rectangle' | 'circle' = 'rectangle') {
  expect(face.reference, 'a planar support must expose a persistent face reference').toBeTruthy()
  expect(face.frame, 'a planar support must expose its sketch coordinate frame').toBeTruthy()
  const frame = face.frame!
  const relative = face.center.map((value, i) => value - frame.origin[i]) as Vec3
  const radius = profile === 'circle' ? 0 : 5
  const parameters = { plane: 'XY' as const, x: dot(relative, frame.u) - radius, y: dot(relative, frame.v) - radius, width: 10, height: 10, profile, support: face.reference! }
  return add(doc, { type: 'sketch', parameters })
}
function extrudeSupported(doc: CadDocument, distance: number, operation: 'join' | 'cut', direction: 'forward' | 'reverse' = 'forward') {
  return add(doc, { type: 'extrude', parameters: { profileId: doc.features.at(-1)!.id, bodyId: doc.features[1].id, distance, operation, direction } })
}

it('joins a boss drawn on the top face rather than extruding from the global XY plane', () => {
  let doc = block()
  const top = buildModel(oc, doc).faces.find(face => face.normal?.[2] === 1)!
  doc = extrudeSupported(supportedSketch(doc, top), 5, 'join')
  const model = buildModel(oc, doc)
  expect(model.bodies).toHaveLength(1)
  expect(model.volume).toBeCloseTo(8500, 5)
  expect(model.bounds.min[2]).toBeCloseTo(0, 5)
  expect(model.bounds.max[2]).toBeCloseTo(25, 5)
})

it('moves an attached boss with an upstream extrusion edit and retains its support in the saved project', () => {
  let doc = block()
  const top = buildModel(oc, doc).faces.find(face => face.normal?.[2] === 1)!
  doc = extrudeSupported(supportedSketch(doc, top), 5, 'join')
  const base = doc.features[1]
  if (base.type !== 'extrude') throw Error('Missing base extrusion')
  doc = applyCommand(doc, { type: 'feature', id: base.id, feature: { type: 'extrude', parameters: { ...base.parameters, distance: 30 } } })
  const model = buildModel(oc, parseProject(serializeProject(doc)))
  expect(model.bodies).toHaveLength(1)
  expect(model.volume).toBeCloseTo(12500, 5)
  expect(model.bounds.max[2]).toBeCloseTo(35, 5)
})

it('cuts a circular pocket into a selected top face with reverse extrusion', () => {
  let doc = block()
  const top = buildModel(oc, doc).faces.find(face => face.normal?.[2] === 1)!
  doc = extrudeSupported(supportedSketch(doc, top, 'circle'), 5, 'cut', 'reverse')
  const model = buildModel(oc, doc)
  expect(model.volume).toBeCloseTo(8000 - Math.PI * 25 * 5, 4)
  expect(model.bounds.max[2]).toBeCloseTo(20, 5)
  expect(model.bounds.min[2]).toBeCloseTo(0, 5)
})

it('extrudes a side-face sketch along its outward normal', () => {
  let doc = block()
  const right = buildModel(oc, doc).faces.find(face => face.normal?.[0] === 1)!
  doc = extrudeSupported(supportedSketch(doc, right), 5, 'join')
  const model = buildModel(oc, doc)
  expect(model.volume).toBeCloseTo(8500, 5)
  expect(model.bounds.max[0]).toBeCloseTo(25, 5)
  expect(model.bounds.max[2]).toBeCloseTo(20, 5)
})

it('deleting the support producer also removes its attached sketch and downstream extrusion', () => {
  let doc = block()
  const bodyId = doc.features[1].id
  const support: FaceReference = { featureId: bodyId, bodyId, normal: [0, 0, 1], center: [.5, .5, 1] }
  const parameters = { plane: 'XY' as const, x: 5, y: 5, width: 10, height: 10, support }
  doc = add(doc, { type: 'sketch', parameters })
  const attachedId = doc.features.at(-1)!.id
  doc = extrudeSupported(doc, 5, 'join')
  expect(doc.features.find(feature => feature.id === attachedId)!.dependencies).toContain(bodyId)
  const remaining = applyCommand(doc, { type: 'remove-feature', id: bodyId })
  expect(remaining.features.map(feature => feature.type)).toEqual(['sketch'])
})

it('provides an orthonormal outward sketch frame on an oblique planar face', () => {
  let doc = block()
  const side = buildModel(oc, doc).faces.find(face => face.normal?.[0] === 1)!
  doc = add(doc, { type: 'draft', parameters: { bodyId: doc.features[1].id, plane: 'XY', offset: 0, angle: 10 }, reference: side.reference! })
  const oblique = buildModel(oc, doc).faces.find(face => face.normal && Math.abs(face.normal[0]) > .1 && Math.abs(face.normal[2]) > .1) as FramedFace | undefined
  expect(oblique, 'drafted planar faces must be selectable sketch supports').toBeTruthy()
  const frame = oblique!.frame!
  expect(frame).toBeTruthy()
  for (const axis of [frame.u, frame.v, frame.normal]) expect(Math.hypot(...axis)).toBeCloseTo(1, 8)
  expect(dot(frame.u, frame.v)).toBeCloseTo(0, 8)
  expect(dot(frame.u, frame.normal)).toBeCloseTo(0, 8)
  expect(dot(frame.v, frame.normal)).toBeCloseTo(0, 8)
  const cross: Vec3 = [frame.u[1] * frame.v[2] - frame.u[2] * frame.v[1], frame.u[2] * frame.v[0] - frame.u[0] * frame.v[2], frame.u[0] * frame.v[1] - frame.u[1] * frame.v[0]]
  expect(dot(cross, frame.normal)).toBeCloseTo(1, 8)
  expect(dot(frame.normal, oblique!.normal!)).toBeCloseTo(1, 8)
  const before = buildModel(oc, doc).volume
  doc = extrudeSupported(supportedSketch(doc, oblique!), 3, 'join')
  expect(buildModel(oc, doc).volume).toBeCloseTo(before + 300, 3)
})


it('cuts a five millimeter circular pocket with a negative forward distance and survives reload', () => {
  let doc = block()
  const top = buildModel(oc, doc).faces.find(face => face.normal?.[2] === 1)!
  doc = extrudeSupported(supportedSketch(doc, top, 'circle'), -5, 'cut', 'forward')
  const model = buildModel(oc, parseProject(serializeProject(doc)))
  expect(model.bodies).toHaveLength(1)
  expect(model.volume).toBeCloseTo(8000 - Math.PI * 25 * 5, 4)
  expect(model.bounds.min[2]).toBeCloseTo(0, 5)
  expect(model.bounds.max[2]).toBeCloseTo(20, 5)
  const cut = doc.features.at(-1)!
  if (cut.type !== 'extrude') throw Error('Expected extrusion')
  doc = applyCommand(doc, {type:'feature',id:cut.id,feature:{type:'extrude',parameters:{...cut.parameters,distance:-20}}})
  const through = buildModel(oc, doc)
  expect(through.volume).toBeCloseTo(8000 - Math.PI * 25 * 20, 4)
  expect(through.faces.filter(face => face.normal && Math.abs(face.normal[2]) === 1)).toHaveLength(2)
})

it('supports signed New extrusion on every origin plane without implicitly cutting', () => {
  for (const plane of ['XY','XZ','YZ'] as const) {
    for (const direction of ['forward','reverse','symmetric'] as const) {
      let doc = add(createDocument('Signed depth','mm'),{type:'sketch',parameters:{plane,x:0,y:0,width:10,height:10}})
      doc = add(doc,{type:'extrude',parameters:{profileId:doc.features[0].id,distance:-5,direction,operation:'new'}})
      const model=buildModel(oc,doc),axis=plane==='XY'?2:plane==='XZ'?1:0
      const sign=plane==='XZ'?-1:1,travel=(direction==='reverse'?5:-5)*sign
      expect(model.volume).toBeCloseTo(500,5)
      expect(model.bounds.min[axis]).toBeCloseTo(direction==='symmetric'?-2.5:Math.min(0,travel),5)
      expect(model.bounds.max[axis]).toBeCloseTo(direction==='symmetric'?2.5:Math.max(0,travel),5)
    }
  }
})

it('rejects zero, sub-tolerance and nonfinite extrusion distances', () => {
  const doc=block()
  for(const distance of [0,.0001,-.0001,NaN,Infinity,-100001,100001]) {
    expect(()=>extrudeSupported(doc,distance,'join')).toThrow()
  }
})
