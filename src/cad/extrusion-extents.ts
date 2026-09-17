import type {ExtrudeFeature,SketchFeature,Vec3,PlaneFrame} from './types'
import {extrusionRange,sketchNormal,sketchToWorld} from './planes'
export function extendedExtrusionRange(p:ExtrudeFeature['parameters'],sketch:SketchFeature['parameters'],bounds?:{min:Vec3;max:Vec3},endFrame?:PlaneFrame){
 const extent=p.extent??'blind'
 if(extent==='blind')return extrusionRange(p.distance,p.direction)
 const sign=Math.sign(p.distance)*(p.direction==='reverse'?-1:1)
 if(extent==='two-sided')return {start:-sign*p.secondDistance!,travel:sign*(Math.abs(p.distance)+p.secondDistance!)}
 const normal=sketchNormal(sketch),origin=sketchToWorld(sketch,0,0,(sketch.offset??0)+(p.startOffset??0)),projection=(point:Vec3)=>point.reduce((n,v,i)=>n+(v-origin[i])*normal[i],0)
 if(extent==='up-to-face'){
  if(!endFrame)throw Error('Select a planar limiting face.')
  const parallel=Math.abs(normal.reduce((n,v,i)=>n+v*endFrame.normal[i],0))
  if(parallel<1-1e-6)throw Error('Up to face currently requires a face parallel to the sketch plane.')
  const travel=projection(endFrame.origin)
  if(sign*travel<.001)throw Error('The limiting face lies behind the selected direction or on the start plane. Reverse the direction or choose another face.')
  return {start:0,travel}
 }
 if(!bounds)throw Error('Through all requires a target body.')
 const values:number[]=[]
 for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]])values.push(projection([x,y,z]))
 const min=Math.min(...values),max=Math.max(...values),margin=Math.max(.01,(max-min)*1e-6)
 if(p.direction==='symmetric')return {start:Math.min(0,min-margin),travel:Math.max(0,max+margin)-Math.min(0,min-margin)}
 const travel=sign>0?max+margin:min-margin
 if(travel*sign<.001)throw Error('The target body lies behind the selected extrusion direction.')
 return {start:0,travel}
}
