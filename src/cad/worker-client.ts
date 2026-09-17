import type { CadDocument, ExportOptions, ExportResult, ModelResult, StepResult } from './types'
type Pending = { resolve:(value:unknown)=>void; reject:(error:Error)=>void; timer:ReturnType<typeof setTimeout>; progress?:(text:string)=>void }
export class GeometryClient {
  private worker:Worker|null=null
  private sequence=0
  private pending=new Map<number,Pending>()
  private connect() {
    if(this.worker) return this.worker
    const worker=new Worker(new URL('../workers/geometry.worker.ts',import.meta.url),{type:'module'})
    worker.onmessage=({data}:{data:{id:number;result?:unknown;error?:string;progress?:string}})=>{
      const entry=this.pending.get(data.id)
      if(!entry)return
      if(data.progress){entry.progress?.(data.progress);return}
      clearTimeout(entry.timer);this.pending.delete(data.id)
      if(data.error)entry.reject(new Error(data.error));else entry.resolve(data.result)
    }
    worker.onerror=()=>this.dispose('The geometry worker stopped. Your last valid model is preserved. Retry the operation.')
    this.worker=worker
    return worker
  }
  private request<T>(payload:object,progress?:(text:string)=>void):Promise<T>{
    return new Promise((resolve,reject)=>{
      const id=++this.sequence
      const timer=setTimeout(()=>this.dispose('Geometry computation exceeded 90 seconds. Reduce model complexity and try again.'),90000)
      this.pending.set(id,{resolve:value=>resolve(value as T),reject,timer,progress})
      try{this.connect().postMessage({id,...payload})}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error)}
    })
  }
  build(document:CadDocument,progress?:(text:string)=>void){return this.request<ModelResult>({type:'build',document},progress)}
  export(document:CadDocument,options:ExportOptions,progress?:(text:string)=>void){return this.request<ExportResult>({type:'export',document,options},progress)}
  exportStep(document:CadDocument,progress?:(text:string)=>void){return this.request<StepResult>({type:'step',document},progress)}
  dispose(reason='Geometry worker closed.'){
    this.worker?.terminate();this.worker=null
    for(const entry of this.pending.values()){clearTimeout(entry.timer);entry.reject(new Error(reason))}
    this.pending.clear()
  }
}
export const geometryClient=new GeometryClient()
