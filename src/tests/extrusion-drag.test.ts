import { describe, expect, it } from 'vitest'
import { extrusionDragDistance } from '../cad/extrusion-drag'
describe('extrusion arrow distance',()=>{
  it('projects pointer motion onto the plane normal in screen space',()=>{
    expect(extrusionDragDistance(16,20,-40,{x:0,y:-4},1,1)).toBe(26)
    expect(extrusionDragDistance(16,20,-40,{x:4,y:0},1,1)).toBe(21)
  })
  it('supports a finer snap step and keeps transverse motion from changing depth',()=>{
    expect(extrusionDragDistance(16,100,-1,{x:0,y:-4},1,.1)).toBe(16.3)
    expect(extrusionDragDistance(16,100,0,{x:0,y:-4},1,.1)).toBe(16)
  })
  it('provides vertical screen dragging when looking down the extrusion axis',()=>{
    expect(extrusionDragDistance(16,0,-20,{x:0,y:0},.5,1)).toBe(26)
  })
  it('clamps to the supported positive blind-extrusion range',()=>{
    expect(extrusionDragDistance(16,0,100,{x:0,y:-1},1,1)).toBe(.001)
    expect(extrusionDragDistance(99999,0,-100,{x:0,y:-1},1,1)).toBe(100000)
  })
})
