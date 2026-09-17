import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import { database, saveProject, loadProject, recoverProject } from '../persistence/projects'
import { createDocument, applyCommand } from '../cad/document'
afterEach(async()=>{await database.projects.clear();await database.snapshots.clear()})
it('reopens the authoritative feature document and retains its previous recovery snapshot',async()=>{
  const doc=createDocument('Recovery fixture','mm')
  await saveProject(doc,'')
  const edited=applyCommand(doc,{type:'set-sketch',plane:'XY',x:0,y:0,width:10,height:20})
  await saveProject(edited,'BRep fixture')
  expect(await loadProject(doc.id)).toEqual(edited)
  expect(await recoverProject(doc.id)).toEqual(doc)
})

it('repeated saves and reopens do not evict the last distinct recovery state',async()=>{
  const doc=createDocument('Repeated save','mm')
  await saveProject(doc,'')
  const edited=applyCommand(doc,{type:'set-sketch',plane:'XY',x:0,y:0,width:10,height:20})
  await saveProject(edited,'')
  for(let i=0;i<8;i++)await saveProject(edited,'')
  expect(await recoverProject(doc.id)).toEqual(doc)
  expect(await database.snapshots.where('id').equals(doc.id).count()).toBe(1)
})

it('deletes a local project and its recovery snapshots without touching other projects',async()=>{
  const {deleteProject}=await import('../persistence/projects')
  const a=createDocument('Delete me','mm'),b=createDocument('Keep me','mm')
  await saveProject(a,'')
  await saveProject(applyCommand(a,{type:'set-sketch',plane:'XY',x:0,y:0,width:10,height:20}),'')
  await saveProject(b,'')
  await deleteProject(a.id)
  expect(await database.projects.get(a.id)).toBeUndefined()
  expect(await database.snapshots.where('id').equals(a.id).count()).toBe(0)
  expect(await loadProject(b.id)).toEqual(b)
})
