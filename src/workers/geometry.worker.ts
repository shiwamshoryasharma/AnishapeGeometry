/// <reference lib="webworker" />
import type { OpenCascadeInstance } from 'opencascade.js'
import { buildModel, exportModel, exportStep } from '../cad/kernel'
import type { CadDocument, ExportOptions } from '../cad/types'
type KernelFactory = (options: { locateFile(path: string): string }) => Promise<OpenCascadeInstance>
let initialization: Promise<OpenCascadeInstance> | undefined
function initialize() {
  return initialization ??= (async () => {
    const base = new URL(import.meta.env.BASE_URL + 'kernel/', self.location.origin).href
    const module = await import(/* @vite-ignore */ base + 'opencascade.full.js') as { default: KernelFactory }
    return module.default({ locateFile: path => base + path })
  })().catch(error => { initialization=undefined; throw error })
}
type Request = {id:number;type:'build';document:CadDocument} | {id:number;type:'step';document:CadDocument} | {id:number;type:'export';document:CadDocument;options:ExportOptions}
let queue=Promise.resolve()
self.onmessage=(event:MessageEvent<Request>) => {
  const request=event.data
  queue=queue.then(async()=>{
    try {
      self.postMessage({id:request.id,progress:'Loading geometry kernel'})
      const oc=await initialize()
      self.postMessage({id:request.id,progress:request.type==='build'?'Rebuilding B-Rep and tessellating':'Tessellating and validating export'})
      const result=request.type==='build'?buildModel(oc,request.document):request.type==='step'?exportStep(oc,request.document):exportModel(oc,request.document,request.options)
      const transfers:Transferable[]= 'faces' in result ? [...result.faces.map(f=>f.positions.buffer),...result.edges.map(e=>e.positions.buffer)] : [result.bytes.buffer]
      self.postMessage({id:request.id,result},transfers)
    } catch(error) {
      self.postMessage({id:request.id,error:error instanceof Error?error.message:`Geometry kernel error (${String(error)}). Try a smaller operation.`})
    }
  })
}
