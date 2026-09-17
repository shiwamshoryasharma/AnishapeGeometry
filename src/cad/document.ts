import { resolveDocumentParameters } from './parameters'
import { validateFeature, dependenciesFor, featureNames } from './features'
import type { CadCommand, CadDocument, Feature, Unit, FaceReference, Vec3, ExtrudeDirection } from './types'
import { units } from './units'
export const MAX_PROJECT_BYTES = 5 * 1024 * 1024
export const dimension = (n: number) => {
  if (!Number.isFinite(n) || n < 0.001 || n > 100000) throw new Error('Dimensions must be between 0.001 and 100,000 mm.')
  return n
}
const signedDistance=(n:number)=>{dimension(Math.abs(n));return n}
const extrusionDirection=(value:unknown):ExtrudeDirection=>{
  if(value===undefined)return 'forward'
  if(value==='forward'||value==='reverse'||value==='symmetric')return value
  throw new Error('Unsupported extrusion direction.')
}
function faceReference(value:unknown):FaceReference {
  const r=record(value)
  const vector=(input:unknown)=>{
    if(!Array.isArray(input)||input.length!==3)throw new Error('Invalid face reference.')
    return input.map(num) as Vec3
  }
  const normal=vector(r.normal),center=vector(r.center)
  if(normal.some(n=>![0,1,-1].includes(n))||normal.reduce((sum,n)=>sum+Math.abs(n),0)!==1||center.some(n=>n<-.01||n>1.01))throw new Error('Unsupported planar face reference.')
  return {featureId:text(r.featureId),normal,center}
}
const coordinate = (n: number) => { if (!Number.isFinite(n) || Math.abs(n) > 100000) throw new Error('Sketch position is outside the supported ±100,000 mm range.'); return n }
export function createDocument(name: string, unit: Unit): CadDocument {
  if (!name.trim() || name.trim().length > 100) throw new Error('Use a project name between 1 and 100 characters.')
  if (!units.some(u => u.value === unit)) throw new Error('Unsupported unit.')
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), name: name.trim(), unit, precision: 3, revision: 0, createdAt: now, updatedAt: now, features: [] }
}
function base(name: string, dependencies: string[]) {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), name, dependencies, status: 'valid' as const, visible: true, suppressed: false, createdAt: now, updatedAt: now }
}
export function dependentFeatures(doc:CadDocument,id:string):Feature[] {
  if(!doc.features.some(feature=>feature.id===id))throw new Error('The selected feature could not be found.')
  const affected=new Set([id])
  for(const feature of doc.features) {
    if(feature.dependencies.some(dependency=>affected.has(dependency)))affected.add(feature.id)
  }
  return doc.features.filter(feature=>affected.has(feature.id))
}
export function applyCommand(source: CadDocument, command: CadCommand): CadDocument {
  const doc = structuredClone(source)
  const now = new Date().toISOString()
  switch (command.type) {
    case 'feature': {
      validateFeature(command.feature)
      const index=command.id?doc.features.findIndex(f=>f.id===command.id):doc.features.length
      if(index<0)throw new Error('Feature could not be found.')
      if(command.id&&doc.features[index].type!==command.feature.type)throw new Error('Feature type cannot change.')
      const dependencies=dependenciesFor(doc,command.feature,index)
      const common=command.id?doc.features[index]:base(featureNames[command.feature.type]+' '+(doc.features.filter(f=>f.type===command.feature.type).length+1),[])
      const feature={...common,...structuredClone(command.feature),dependencies,updatedAt:now} as Feature
      if(feature.type==='sketch'&&feature.parameters.entities)delete feature.expressions
      if(command.id)doc.features[index]=feature;else{if(doc.features.length>=256)throw new Error('Maximum 256 features.');doc.features.push(feature)}
      break
    }
    case 'sketch-display': {
      const f=doc.features.find(f=>f.id===command.id);if(f?.type!=='sketch'||!['auto','visible','hidden'].includes(command.display))throw Error('Invalid sketch visibility.');f.parameters.display=command.display;f.updatedAt=now;break
    }
    case 'rename-feature': {
      const f=doc.features.find(f=>f.id===command.id);if(!f)throw new Error('Feature could not be found.')
      f.name=text(command.name).trim();if(!f.name)throw new Error('Feature needs a name.');break
    }
    case 'parameters': {
      if(!command.values||typeof command.values!=='object'||Object.keys(command.values).length>64)throw new Error('Invalid parameters.')
      for(const [name,value]of Object.entries(command.values))if(!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)||typeof value!=='string'||value.length>500)throw new Error('Invalid parameter name or expression.')
      doc.parameters=structuredClone(command.values);break
    }
    case 'set-sketch': {
      if (!['XY', 'XZ', 'YZ'].includes(command.plane)) throw new Error('Choose an origin plane.')
      const parameters = { plane: command.plane, x: coordinate(command.x), y: coordinate(command.y), width: dimension(command.width), height: dimension(command.height) }
      const existing = doc.features.find(f => f.type === 'sketch')
      if (existing) { existing.parameters = parameters; existing.updatedAt = now }
      else doc.features.push({ ...base('Sketch 1', []), type: 'sketch', parameters })
      break
    }
    case 'extrude': {
      const sketch = doc.features.find(f => f.type === 'sketch')
      if (!sketch) throw new Error('Finish a rectangle sketch before extruding.')
      const existing = doc.features.find(f => f.type === 'extrude')
      if (existing) { existing.parameters = { distance: dimension(command.distance), direction:extrusionDirection(command.direction) }; existing.updatedAt = now }
      else doc.features.push({ ...base('Extrude 1', [sketch.id]), type: 'extrude', parameters: { distance: dimension(command.distance), direction:extrusionDirection(command.direction) } })
      break
    }
    case 'push-pull': {
      const existing=command.id?doc.features.find(feature=>feature.id===command.id):undefined
      if(command.id&&existing?.type!=='pushpull')throw new Error('Push/pull feature could not be found.')
      const source=existing?doc.features[doc.features.indexOf(existing)-1]:doc.features.at(-1)
      const reference=faceReference(command.reference)
      if(!source||source.type==='sketch'||reference.featureId!==source.id)throw new Error('Reselect a planar face on the current solid.')
      if(existing?.type==='pushpull'){
        existing.parameters={distance:signedDistance(command.distance)};existing.updatedAt=now
      }else{
        if(doc.features.length>=32)throw new Error('This release supports up to 32 features.')
        doc.features.push({...base('Push/pull '+(doc.features.filter(f=>f.type==='pushpull').length+1),[source.id]),type:'pushpull',parameters:{distance:signedDistance(command.distance)},reference})
      }
      break
    }
    case 'fillet': {
      const extrude = doc.features.find(f => f.type === 'extrude')
      if (!extrude) throw new Error('Create an extrusion before a fillet.')
      if (!command.references.length || command.references.length > 12) throw new Error('Select between 1 and 12 extrusion edges.')
      if (command.references.some(r => r.featureId !== extrude.id)) throw new Error('The selected edge does not belong to this extrusion. Reselect an edge.')
      if(doc.features.some(f=>f.type==='pushpull')&&!doc.features.some(f=>f.type==='fillet'))throw new Error('Add fillets before push/pull features in this release.')
      const references = structuredClone(command.references)
      const existing = doc.features.find(f => f.type === 'fillet')
      if (existing?.type === 'fillet') { existing.parameters = { radius: dimension(command.radius) }; existing.references = references; existing.updatedAt = now }
      else doc.features.push({ ...base('Fillet 1', [extrude.id]), type: 'fillet', parameters: { radius: dimension(command.radius) }, references })
      break
    }
    case 'remove-feature': {
      const removed=new Set(dependentFeatures(doc,command.id).map(feature=>feature.id))
      doc.features=doc.features.filter(feature=>!removed.has(feature.id))
      break
    }
    case 'remove-last': doc.features.pop(); break
    case 'settings':
      if (!units.some(u => u.value === command.unit) || !Number.isInteger(command.precision) || command.precision < 0 || command.precision > 12) throw new Error('Invalid document units or precision.')
      doc.unit = command.unit; doc.precision = command.precision; break
    default: throw new Error('Unknown CAD command.')
  }
  resolveDocumentParameters(doc)
  doc.revision++; doc.updatedAt = now
  return doc
}
export interface Transaction { command: CadCommand; before: CadDocument; after: CadDocument }
export interface History { present: CadDocument; past: Transaction[]; future: Transaction[] }
export const createHistory = (doc: CadDocument): History => ({ present: doc, past: [], future: [] })
export function commitHistory(history: History, command: CadCommand): History {
  const next = applyCommand(history.present, command)
  return { present: next, past: [...history.past, { command, before: history.present, after: next }].slice(-60), future: [] }
}
export function undoHistory(h: History): History {
  const transaction = h.past.at(-1)
  return transaction ? { present: transaction.before, past: h.past.slice(0, -1), future: [...h.future, transaction] } : h
}
export function redoHistory(h: History): History {
  const transaction = h.future.at(-1)
  return transaction ? { present: transaction.after, past: [...h.past, transaction], future: h.future.slice(0, -1) } : h
}
export function serializeProject(document:CadDocument,history?:History):string {
  if(history&&!same(history.present,document))throw new Error('History does not belong to this document.')
  return JSON.stringify({format:'AnishapeGeometry',version:2,document,...(history?{history:{past:history.past,future:history.future}}:{})},null,2)
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid project structure.')
  return value as Record<string, unknown>
}
function text(value: unknown) { if (typeof value !== 'string' || !value || value.length > 150) throw new Error('Invalid project text.'); return value }
function num(value: unknown) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid numeric project value.'); return value }
function same(a:unknown,b:unknown):boolean {return JSON.stringify(a)===JSON.stringify(b)}
function readDocument(input:unknown):CadDocument {
 const v=record(input)
 createDocument(text(v.name),text(v.unit) as Unit)
 if(!Number.isSafeInteger(v.revision)||Number(v.revision)<0||!Number.isInteger(v.precision)||Number(v.precision)<0||Number(v.precision)>12)throw new Error('Invalid revision or precision.')
 for(const k of ['id','createdAt','updatedAt'])text(v[k])
 if(!Array.isArray(v.features)||v.features.length>256)throw new Error('Invalid features (maximum 256).')
 const doc=structuredClone(v) as unknown as CadDocument
 const seen=new Set<string>()
 for(let i=0;i<doc.features.length;i++){
  const f=doc.features[i];record(f);text(f.id);text(f.name);text(f.createdAt);text(f.updatedAt)
  if(seen.has(f.id))throw new Error('Duplicate feature identity.');seen.add(f.id)
  if(f.status!=='valid'||f.visible!==true||f.suppressed!==false)throw new Error('Unsupported feature state.')
  validateFeature(f)
  if(!Array.isArray(f.dependencies)||new Set(f.dependencies).size!==f.dependencies.length||f.dependencies.some(id=>!doc.features.slice(0,i).some(p=>p.id===id)))throw new Error('Broken feature dependency.')
  const required=dependenciesFor(doc,f,i)
  if(required.some(id=>!f.dependencies.includes(id)))throw new Error('Missing feature dependency.')
 }
 if(doc.parameters){if(typeof doc.parameters!=='object'||Array.isArray(doc.parameters)||Object.keys(doc.parameters).length>64)throw new Error('Invalid parameters.');for(const [k,val]of Object.entries(doc.parameters))if(!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k)||typeof val!=='string'||val.length>500)throw new Error('Invalid parameter.')}
 const resolved=structuredClone(doc);resolveDocumentParameters(resolved);if(!same(resolved,doc))throw new Error('Saved parameter bindings do not match geometry values.');
 return doc
}
// Compare replayed state while permitting newly generated IDs and timestamps.
function semantic(doc:CadDocument){
 const d=structuredClone(doc);d.updatedAt='';d.createdAt=''
 d.features=d.features.map(f=>({...f,createdAt:'',updatedAt:''}))
 return d
}
function validateTransaction(input:unknown,projectId:string):Transaction {
 const v=record(input),before=readDocument(v.before),after=readDocument(v.after)
 if(before.id!==projectId||after.id!==projectId)throw new Error('History belongs to a different project.')
 const command=record(v.command) as unknown as CadCommand
 const replay=applyCommand(before,command)
 // A create command allocates new IDs. Map only its new identities to saved IDs.
 const oldIds=new Set(before.features.map(f=>f.id))
 replay.features.forEach((f,i)=>{if(!oldIds.has(f.id)&&after.features[i])f.id=after.features[i].id})
 if(!same(semantic(replay),semantic(after)))throw new Error('History command does not produce its saved result.')
 return {command,before,after}
}
export function parseHistory(contents:string):History {
 if(new TextEncoder().encode(contents).length>MAX_PROJECT_BYTES)throw new Error('Project file exceeds the 5 MB limit.')
 const file=record(JSON.parse(contents))
 if(file.format!=='AnishapeGeometry')throw new Error('This is not an AnishapeGeometry project.')
 if(file.version!==1&&file.version!==2)throw new Error('Unsupported project version.')
 const present=readDocument(file.document)
 if(file.history===undefined)return createHistory(present)
 const h=record(file.history)
 if(!Array.isArray(h.past)||!Array.isArray(h.future)||h.past.length+h.future.length>60)throw new Error('Invalid history (maximum 60 transactions).')
 const past=h.past.map(t=>validateTransaction(t,present.id)),future=h.future.map(t=>validateTransaction(t,present.id))
 let cursor=present
 for(const t of [...past].reverse()){if(!same(t.after,cursor))throw new Error('Disconnected undo history.');cursor=t.before}
 cursor=present
 for(const t of [...future].reverse()){if(!same(t.before,cursor))throw new Error('Disconnected redo history.');cursor=t.after}
 return {present,past,future}
}
export function parseProject(contents:string):CadDocument{return parseHistory(contents).present}
