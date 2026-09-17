/** Convert a screen-space drag to a positive blind-extrusion distance in mm. */
export function extrusionDragDistance(
  initial:number, dx:number, dy:number, axis:{x:number;y:number},
  worldPerPixel:number, step:number, signed=false,
):number {
  const lengthSquared=axis.x*axis.x+axis.y*axis.y
  const delta=lengthSquared>.04?(dx*axis.x+dy*axis.y)/lengthSquared:-dy*worldPerPixel
  const snapped=Math.round((initial+delta)/step)*step
  return Math.max(signed?-100000:.001,Math.min(100000,Number(snapped.toPrecision(12))))
}
