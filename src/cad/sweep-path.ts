import type {Point2,SketchEntity} from './types'
import {arcGeometry,validateEntities} from './sketch-entities'
type PathEntity=Extract<SketchEntity,{type:'line'|'arc'}>
export interface PathSegment {entity:PathEntity;reversed:boolean}
const near=(a:Point2,b:Point2)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6
export function pathTangent(segment:PathSegment,end=false):Point2{
 const {entity:e,reversed}=segment;let vector:Point2
 if(e.type==='line')vector=[e.end[0]-e.start[0],e.end[1]-e.start[1]]
 else{const a=arcGeometry(e.start,e.mid,e.end),p=(end!==reversed)?e.end:e.start,sign=Math.sign(a.sweep);vector=[-(p[1]-a.center[1])*sign,(p[0]-a.center[0])*sign]}
 const length=Math.hypot(...vector);return vector.map(v=>v/length*(reversed?-1:1)) as Point2
}
/** A sweep consumes a single open, tangent chain; never silently ignores extra curves. */
export function sweepPath(entities:SketchEntity[]):PathSegment[]{
 validateEntities(entities);const curves=entities.filter(e=>!e.construction&&e.type!=='point')
 if(!curves.length||curves.some(e=>e.type==='circle'))throw Error('Sweep path needs an open line/arc chain. Circles and closed paths are not supported yet.')
 const edges=curves as PathEntity[],degree=(p:Point2)=>edges.reduce((n,e)=>n+Number(near(p,e.start))+Number(near(p,e.end)),0)
 if(edges.some(e=>degree(e.start)>2||degree(e.end)>2))throw Error('Sweep path branches. Use one connected chain or mark helper curves as construction.')
 const ends=edges.flatMap(e=>[e.start,e.end]).filter(p=>degree(p)===1)
 if(ends.length!==2)throw Error('Sweep path must be one connected open chain.')
 let current=ends[0];const used=new Set<string>(),result:PathSegment[]=[]
 while(result.length<edges.length){const e=edges.find(e=>!used.has(e.id)&&(near(current,e.start)||near(current,e.end)));if(!e)throw Error('Sweep path is disconnected.');const reversed=near(current,e.end);result.push({entity:e,reversed});used.add(e.id);current=reversed?e.start:e.end}
 for(let i=1;i<result.length;i++){const a=pathTangent(result[i-1],true),b=pathTangent(result[i]);if(a[0]*b[0]+a[1]*b[1]<1-1e-6)throw Error('Sweep path has a sharp corner. Connect segments tangentially with an arc.')}
 return result
}
