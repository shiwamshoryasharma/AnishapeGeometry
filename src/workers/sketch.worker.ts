/// <reference lib="webworker" />
import {init_planegcs_module,GcsWrapper,type ModuleStatic} from '@salusoft89/planegcs'
import wasmUrl from '@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm?url'
import {solveSketch} from '../cad/sketch-solver'
import type {SketchEntity} from '../cad/types'
import type {SketchConstraint} from '../cad/sketch-constraints'
let modulePromise:Promise<ModuleStatic>|undefined
let queue=Promise.resolve()
self.onmessage=({data}:{data:{id:number;entities:SketchEntity[];constraints:SketchConstraint[]}})=>{
 queue=queue.then(async()=>{
  let wrapper:GcsWrapper|undefined
  try{
   modulePromise??=init_planegcs_module({locateFile:()=>wasmUrl}).catch((error:unknown)=>{modulePromise=undefined;throw error})
   const mod=await modulePromise;wrapper=new GcsWrapper(new mod.GcsSystem(),mod)
   const result=solveSketch(wrapper,data.entities,data.constraints)
   self.postMessage({id:data.id,result})
  }catch(error){self.postMessage({id:data.id,error:error instanceof Error?error.message:'Sketch solver failed. Previous geometry is preserved.'})}
  finally{wrapper?.destroy_gcs_module()}
 })
}
