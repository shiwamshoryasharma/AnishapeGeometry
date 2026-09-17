import type {Point2,SketchEntity} from './types'
import {arcGeometry,validateEntities} from './sketch-entities'
export function entityDimension(e:SketchEntity):{value:number;prefix:string;anchor:Point2}{
 if(e.type==='point')throw Error('Use X/Y coordinate constraints to dimension a point.')
 if(e.type==='circle'){const dx=(e.dimension?.[0]??e.center[0]+1)-e.center[0],dy=(e.dimension?.[1]??e.center[1])-e.center[1],length=Math.hypot(dx,dy);return {value:e.radius*2,prefix:'Ø ',anchor:length>1e-9?[e.center[0]+dx/length*e.radius,e.center[1]+dy/length*e.radius]:[e.center[0]+e.radius,e.center[1]]}}
 if(e.type==='arc'){const a=arcGeometry(e.start,e.mid,e.end);return {value:a.radius,prefix:'R ',anchor:e.mid}}
 return {value:Math.hypot(e.end[0]-e.start[0],e.end[1]-e.start[1]),prefix:'',anchor:[(e.start[0]+e.end[0])/2,(e.start[1]+e.end[1])/2]}
}
export function resizeSketchEntity(entities:SketchEntity[],id:string,value:number){
 if(!Number.isFinite(value)||value<.001||value>100000)throw Error('Dimension must be between 0.001 and 100000 mm.')
 const original=entities.find(e=>e.id===id);if(!original)throw Error('Dimension entity is missing.');let changed:SketchEntity
 if(original.type==='point')throw Error('Use X/Y coordinate constraints to dimension a point.')
 if(original.type==='circle')changed={...original,radius:value/2}
 else if(original.type==='line'){const ratio=value/entityDimension(original).value;changed={...original,end:[original.start[0]+(original.end[0]-original.start[0])*ratio,original.start[1]+(original.end[1]-original.start[1])*ratio]}}
 else{const a=arcGeometry(original.start,original.mid,original.end),scale=(p:Point2):Point2=>[a.center[0]+(p[0]-a.center[0])*value/a.radius,a.center[1]+(p[1]-a.center[1])*value/a.radius];changed={...original,start:scale(original.start),mid:scale(original.mid),end:scale(original.end)}}
 const links=original.type!=='circle'&&changed.type!=='circle'?[[original.start,changed.start],[original.end,changed.end]]:[],point=(p:Point2)=>links.find(([a])=>Math.hypot(a[0]-p[0],a[1]-p[1])<1e-6)?.[1]??p
 const result=entities.map(e=>e.id===id?changed:e.type==='circle'||e.type==='point'?e:{...e,start:point(e.start),end:point(e.end)});validateEntities(result);return result
}
