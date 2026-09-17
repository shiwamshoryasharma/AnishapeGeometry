import {it,expect} from 'vitest'
import {polygonEntities,slotEntities,mirrorEntities,patternEntities} from '../cad/sketch-tools'
import {sketchRegions,rectangleEntities} from '../cad/sketch-entities'
it('polygon and analytic slot produce closed profiles with exact areas',()=>{expect(sketchRegions(polygonEntities([0,0],10,4,0))[0].area).toBeCloseTo(200,7);expect(sketchRegions(slotEntities([0,0],[30,0],10))[0].area).toBeCloseTo(300+25*Math.PI,7)})
it('mirrored arcs and patterned profiles keep separate identities and construction flags',()=>{const source=slotEntities([10,0],[30,0],4),copy=mirrorEntities(source,'Y',0);expect(new Set([...source,...copy].map(e=>e.id)).size).toBe(8);expect(sketchRegions(copy)[0].area).toBeCloseTo(sketchRegions(source)[0].area,7);const pattern=patternEntities(rectangleEntities([0,0],[5,5]),3,10,0);expect(sketchRegions(pattern)).toHaveLength(2);expect(()=>patternEntities(source,3,0,0)).toThrow(/spacing/i)})
it('rejects invalid polygons and slots before changing the draft',()=>{expect(()=>polygonEntities([0,0],10,2,0)).toThrow();expect(()=>slotEntities([0,0],[0,0],10)).toThrow();expect(()=>slotEntities([0,0],[20,0],-2)).toThrow()})
