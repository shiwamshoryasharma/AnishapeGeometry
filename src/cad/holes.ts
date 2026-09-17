import type {HoleFeature} from './types'
export function holeRecess(p:HoleFeature['parameters'],diameter=p.diameter){
 if((p.style??'simple')==='simple')return undefined
 const outer=p.counterDiameter
 if(!Number.isFinite(outer)||outer!<=diameter)throw Error('Recess diameter must exceed the hole diameter.')
 const depth=p.style==='counterbore'?p.counterDepth!:(outer!-diameter)/2/Math.tan(p.sinkAngle!*Math.PI/360)
 if(!Number.isFinite(depth)||depth<.001||depth>100000)throw Error('Invalid recess depth or countersink angle.')
 if(p.termination!=='through-all'&&depth>p.depth)throw Error('Recess depth cannot exceed the hole depth.')
 return {diameter:outer!,depth}
}
