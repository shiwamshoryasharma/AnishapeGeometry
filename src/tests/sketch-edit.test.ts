import {it,expect} from 'vitest'
import type {SketchEntity} from '../cad/types'
import {trimEntity,splitEntity,extendEntity,offsetEntities,rotateEntities,scaleEntities,circularPatternEntities,windowSelection} from '../cad/sketch-edit'
import {rectangleEntities,sketchRegions,arcGeometry} from '../cad/sketch-entities'
const line=(id:string,a:[number,number],b:[number,number]):SketchEntity=>({id,type:'line',start:a,end:b})
it('trims only the clicked interval between crossing lines and preserves the rest',()=>{
 const source=[line('base',[0,0],[30,0]),line('left',[10,-10],[10,10]),line('right',[20,-10],[20,10])]
 const result=trimEntity(source,'base',[15,0]),pieces=result.filter(e=>e.id!=='left'&&e.id!=='right')
 expect(pieces).toHaveLength(2);expect(pieces[0]).toMatchObject({start:[0,0],end:[10,0]});expect(pieces[1]).toMatchObject({start:[20,0],end:[30,0]});expect(source).toHaveLength(3)
})
it('trims a circle against a diameter into an analytic semicircle',()=>{
 const result=trimEntity([{id:'circle',type:'circle',center:[0,0],radius:10},line('cross',[-20,0],[20,0])],'circle',[0,10])
 const arc=result.find(e=>e.id==='circle')!;expect(arc.type).toBe('arc')
 if(arc.type!=='arc')throw Error('Expected arc');expect(arc.mid[1]).toBeCloseTo(-10,7);expect(Math.abs(arcGeometry(arc.start,arc.mid,arc.end).sweep)).toBeCloseTo(Math.PI,7)
})
it('splits line and arc at a projected point without losing curve geometry',()=>{
 const a=splitEntity([line('a',[0,0],[30,0])],'a',[10,1]);expect(a).toHaveLength(2);expect(a[0]).toMatchObject({id:'a',end:[10,0]})
 const arc:SketchEntity={id:'arc',type:'arc',start:[10,0],mid:[0,10],end:[-10,0]}
 const b=splitEntity([arc],'arc',[0,10]);expect(b).toHaveLength(2);for(const e of b){if(e.type!=='arc')throw Error('Expected arc');expect(arcGeometry(e.start,e.mid,e.end).radius).toBeCloseTo(10,7)}
})
it('extends the selected endpoint to the nearest actual boundary',()=>{
 const source=[line('a',[0,0],[5,0]),line('wall',[12,-10],[12,10]),line('far',[20,-10],[20,10])]
 expect(extendEntity(source,'a',[5,0])[0]).toMatchObject({start:[0,0],end:[12,0]})
 expect(()=>extendEntity([source[0]],'a',[5,0])).toThrow(/boundary/i)
})
it('offsets a rectangle outward as a connected closed region and a circle analytically',()=>{
 const source=rectangleEntities([0,0],[20,10],'rect'),offset=offsetEntities(source,2)
 expect(sketchRegions(offset)).toHaveLength(1);expect(sketchRegions(offset)[0].area).toBeCloseTo(24*14,6)
 const circles=offsetEntities([{id:'c',type:'circle',center:[2,3],radius:10}],2);expect(circles[0]).toMatchObject({center:[2,3],radius:12});expect(circles[0].id).not.toBe('c')
 expect(()=>offsetEntities([{id:'c',type:'circle',center:[0,0],radius:2}],-3)).toThrow(/radius|offset/i)
})
it('rejects inward offsets that collapse or invert a region',()=>{
 expect(()=>offsetEntities(rectangleEntities([0,0],[20,10]),-6)).toThrow(/collapse|offset/i)
})
it('rotates and scales about a pivot, preserving IDs unless copies are requested',()=>{
 const source=[line('a',[1,0],[3,0])]
 expect(rotateEntities(source,[1,0],90)[0]).toMatchObject({id:'a',start:[1,0]});const rotated=rotateEntities(source,[1,0],90)[0];if(rotated.type!=='line')throw Error();expect(rotated.end[0]).toBeCloseTo(1);expect(rotated.end[1]).toBeCloseTo(2)
 expect(scaleEntities(source,[1,0],2)[0]).toMatchObject({id:'a',end:[5,0]});expect(()=>scaleEntities(source,[0,0],0)).toThrow()
})
it('creates circular pattern copies with unique IDs and exact angular spacing',()=>{
 const source:SketchEntity[]=[{id:'c',type:'circle',center:[10,0] as [number,number],radius:1}]
 const result=circularPatternEntities(source,[0,0],4,360);expect(result).toHaveLength(3);expect(new Set(result.map(e=>e.id)).size).toBe(3)
 const last=result[2];if(last.type!=='circle')throw Error();expect(last.center[0]).toBeCloseTo(0);expect(last.center[1]).toBeCloseTo(-10)
})
it('distinguishes enclosing selection from crossing selection, including tangent circles',()=>{
 const entities:SketchEntity[]=[line('a',[-10,0],[10,0]),{id:'c',type:'circle',center:[0,0] as [number,number],radius:5}]
 expect(windowSelection(entities,[-1,-1],[1,1],false)).toEqual([])
 expect(windowSelection(entities,[-1,-1],[1,1],true)).toEqual(['a'])
 expect(windowSelection(entities,[4.9,-.1],[5.1,.1],true)).toEqual(['a','c'])
})
it('refuses trim without intersections instead of deleting an entire entity',()=>{
 expect(()=>trimEntity([line('a',[0,0],[10,0])],'a',[5,0])).toThrow(/intersection/i)
})
