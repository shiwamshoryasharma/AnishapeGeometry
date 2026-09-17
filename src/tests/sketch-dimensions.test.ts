import {it,expect} from 'vitest'
import {resizeSketchEntity,entityDimension} from '../cad/sketch-dimensions'
import {rectangleEntities,sketchRegions} from '../cad/sketch-entities'
it('a placed diameter drives circle geometry and keeps its label position',()=>{const entities=resizeSketchEntity([{id:'c',type:'circle',center:[0,0],radius:10,dimension:[20,20]}],'c',5);expect(entityDimension(entities[0]).value).toBe(5);expect(entities[0].dimension).toEqual([20,20]);expect(sketchRegions(entities)[0].area).toBeCloseTo(Math.PI*2.5**2,7)})
it('line-length changes preserve coincident neighboring endpoints',()=>{const entities=rectangleEntities([0,0],[20,10],'r'),next=resizeSketchEntity(entities,'r:0',30);expect(entityDimension(next[0]).value).toBe(30);expect(sketchRegions(next)).toHaveLength(1);expect(()=>resizeSketchEntity(next,'r:0',0)).toThrow()})
