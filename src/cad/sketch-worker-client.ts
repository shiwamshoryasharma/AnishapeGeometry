import type {SketchEntity} from './types'
import type {SketchConstraint} from './sketch-constraints'
import type {SketchSolution} from './sketch-solver'
type Pending={resolve:(result:SketchSolution)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}
/** One client per editing session. Termination makes cancellation bounded even inside WASM. */
export class SketchSolverClient{
 private worker:Worker|null=null
 private sequence=0
 private pending=new Map<number,Pending>()
 solve(entities:SketchEntity[],constraints:SketchConstraint[]):Promise<SketchSolution>{
  return new Promise((resolve,reject)=>{
   const id=++this.sequence,timer=setTimeout(()=>this.dispose('Sketch solving exceeded 10 seconds. Simplify the sketch or remove a constraint.'),10000)
   this.pending.set(id,{resolve,reject,timer})
   try{
    if(!this.worker){
     this.worker=new Worker(new URL('../workers/sketch.worker.ts',import.meta.url),{type:'module'})
     this.worker.onmessage=({data}:{data:{id:number;result:SketchSolution;error?:string}})=>{const p=this.pending.get(data.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(data.id);if(data.error)p.reject(Error(data.error));else p.resolve(data.result)}
     this.worker.onerror=()=>this.dispose('The sketch solver stopped. Retry the operation.')
    }
    this.worker.postMessage({id,entities,constraints})
   }catch(error){clearTimeout(timer);this.pending.delete(id);reject(error)}
  })
 }
 dispose(message='Sketch solving cancelled.'){
  this.worker?.terminate();this.worker=null
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error(message))}this.pending.clear()
 }
}
