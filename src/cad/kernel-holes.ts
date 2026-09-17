import type {OpenCascadeInstance,TopoDS_Shape} from 'opencascade.js'
import type {HoleFeature,Vec3} from './types'
import {Scope,shapeBounds} from './kernel-support'
import {holeRecess} from './holes'
export function holeCutters(oc:OpenCascadeInstance,target:TopoDS_Shape,p:HoleFeature['parameters'],origin:Vec3,normal:Vec3,scope:Scope){
 let depth=p.depth
 if(p.termination==='through-all'){
  const bounds=shapeBounds(oc,target),values:number[]=[]
  for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]])values.push([x,y,z].reduce((sum,n,i)=>sum+(n-origin[i])*normal[i],0))
  depth=Math.max(...values)+.01;if(depth<.001)throw Error('The target body is behind the hole direction.')
 }
 const axis=scope.own(new oc.gp_Ax2_3(scope.own(new oc.gp_Pnt_3(...origin)),scope.own(new oc.gp_Dir_4(...normal))))
 const cutters=[scope.own(scope.own(new oc.BRepPrimAPI_MakeCylinder_3(axis,p.diameter/2,depth)).Shape())],recess=holeRecess(p)
 if(recess)cutters.push(scope.own(p.style==='counterbore'?scope.own(new oc.BRepPrimAPI_MakeCylinder_3(axis,recess.diameter/2,recess.depth)).Shape():scope.own(new oc.BRepPrimAPI_MakeCone_3(axis,recess.diameter/2,p.diameter/2,recess.depth)).Shape()))
 return cutters
}
