import Dexie, { type Table } from 'dexie'
import type { CadDocument, SavedProject } from '../cad/types'
import { parseProject, parseHistory, serializeProject, type History } from '../cad/document'
interface Snapshot extends SavedProject { snapshotId:string }
class ProjectDatabase extends Dexie {
  projects!:Table<SavedProject,string>
  snapshots!:Table<Snapshot,string>
  constructor(){super('AnishapeGeometry');this.version(1).stores({projects:'id,savedAt',snapshots:'snapshotId,id,savedAt'})}
}
export const database=new ProjectDatabase()
export async function saveProject(document:CadDocument,brep:string,history?:History){
  if(history)parseHistory(serializeProject(document,history))
  const saved:SavedProject={id:document.id,document:structuredClone(document),brep,savedAt:new Date().toISOString(),...(history?{history:structuredClone(history)}:{})}
  await database.transaction('rw',database.projects,database.snapshots,async()=>{
    const previous=await database.projects.get(document.id)
    if(previous&&serializeProject(previous.document)!==serializeProject(document)){
      await database.snapshots.put({...previous,snapshotId:crypto.randomUUID()})
      const snapshots=(await database.snapshots.where('id').equals(document.id).sortBy('savedAt')).reverse()
      await database.snapshots.bulkDelete(snapshots.slice(5).map(s=>s.snapshotId))
    }
    await database.projects.put(saved)
  })
}
export async function loadProject(id:string){
  const stored=await database.projects.get(id)
  if(!stored)throw new Error('This local project could not be found.')
  return parseProject(serializeProject(stored.document))
}
export const listProjects=()=>database.projects.orderBy('savedAt').reverse().toArray()
export async function recoverProject(id:string){
  const snapshots=await database.snapshots.where('id').equals(id).sortBy('savedAt')
  if(!snapshots.length)throw new Error('No recovery snapshot is available yet.')
  return parseProject(serializeProject(snapshots.at(-1)!.document))
}

export async function deleteProject(id:string) {
  await database.transaction('rw',database.projects,database.snapshots,async()=>{
    await database.snapshots.where('id').equals(id).delete()
    await database.projects.delete(id)
  })
}
export async function loadHistory(id:string):Promise<History>{const stored=await database.projects.get(id);if(!stored)throw new Error('This local project could not be found.');return parseHistory(serializeProject(stored.document,stored.history))}
