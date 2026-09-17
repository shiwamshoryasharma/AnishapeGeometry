import { create } from 'zustand'
import type { CadCommand, CadDocument, ModelResult, ExportOptions, ExportResult, StepResult, Unit } from '../cad/types'
import { applyCommand, commitHistory, createDocument, createHistory, undoHistory, redoHistory, type History } from '../cad/document'
import { geometryClient } from '../cad/worker-client'
import { saveProject, deleteProject } from '../persistence/projects'
export type Selection={kind:'face'|'edge';id:string}
interface EditorState {
 history:History|null;model:ModelResult|null;preview:ModelResult|null;selection:Selection[]
 busy:boolean;progress:string;error:string|null;saveState:'saved'|'saving'|'failed'|'unsaved'
 removeProject:(id:string)=>Promise<boolean>;cancelOperation:()=>void
 open:(document:CadDocument,history?:History)=>Promise<boolean>;newProject:(name:string,unit:Unit)=>Promise<boolean>
 execute:(command:CadCommand)=>Promise<boolean>;undo:()=>Promise<void>;redo:()=>Promise<void>
 previewCommand:(command:CadCommand)=>Promise<boolean>;clearPreview:()=>void
 select:(selection:Selection|null,add?:boolean)=>void;save:()=>Promise<boolean>
 exportStl:(options:ExportOptions)=>Promise<ExportResult|null>;exportStep:()=>Promise<StepResult|null>;clearError:()=>void
}
let saveQueue:Promise<void>=Promise.resolve(),generation=0,geometryActive=false
const compute=(doc:CadDocument,onProgress:(value:string)=>void)=>doc.features.some(f=>!['sketch','plane'].includes(f.type))?geometryClient.build(doc,onProgress):Promise.resolve(null)
const message=(error:unknown)=>error instanceof Error?error.message:'The operation failed. Your previous model is preserved.'
export const useEditor=create<EditorState>((set,get)=>{
 const start=(progress:string)=>{const token=++generation;geometryActive=true;set({busy:true,error:null,progress});return token}
 const progressFor=(token:number)=>(progress:string)=>{if(token===generation)set({progress})}
 const failure=(token:number,error:unknown)=>{if(token===generation){geometryActive=false;set({busy:false,error:message(error),preview:null,progress:'Operation failed'})}}
 const rebuild=async(history:History):Promise<boolean>=>{
  if(get().busy)return false
  const token=start('Rebuilding model')
  try{const model=await compute(history.present,progressFor(token));if(token!==generation)return false;geometryActive=false;set({history,model,preview:null,selection:[],busy:false,progress:'Ready',saveState:'unsaved'});void get().save();return true}
  catch(error){failure(token,error);return false}
 }
 return {
  history:null,model:null,preview:null,selection:[],busy:false,progress:'Ready',error:null,saveState:'unsaved',
  cancelOperation:()=>{if(get().busy&&!geometryActive)return;generation++;geometryActive=false;geometryClient.dispose('Operation cancelled.');set({busy:false,preview:null,error:null,progress:'Ready'})},
  removeProject:async id=>{
   if(get().busy)return false;geometryActive=false;set({busy:true,error:null,progress:'Deleting local project'})
   try{await saveQueue.catch(()=>undefined);await deleteProject(id);if(get().history?.present.id===id)set({history:null,model:null,preview:null,selection:[],saveState:'unsaved'});set({busy:false,progress:'Ready'});return true}
   catch(error){set({busy:false,error:message(error),progress:'Delete failed'});return false}
  },
  open:(doc,history)=>rebuild(history??createHistory(doc)),
  newProject:async(name,unit)=>{try{return await get().open(createDocument(name,unit))}catch(error){set({error:message(error)});return false}},
  execute:async command=>{const h=get().history;if(!h||get().busy)return false;try{return await rebuild(commitHistory(h,command))}catch(error){set({error:message(error)});return false}},
  undo:async()=>{const h=get().history;if(h?.past.length)await rebuild(undoHistory(h))},
  redo:async()=>{const h=get().history;if(h?.future.length)await rebuild(redoHistory(h))},
  previewCommand:async command=>{
   const h=get().history;if(!h||get().busy)return false;const token=start('Computing preview')
   try{const preview=await compute(applyCommand(h.present,command),progressFor(token));if(token!==generation)return false;geometryActive=false;set({preview,busy:false,progress:'Preview · not applied'});return true}
   catch(error){failure(token,error);return false}
  },
  clearPreview:()=>set({preview:null,progress:'Ready'}),
  select:(selection,add=false)=>set(state=>({selection:!selection?[]:add?(state.selection.some(s=>s.id===selection.id&&s.kind===selection.kind)?state.selection.filter(s=>s.id!==selection.id||s.kind!==selection.kind):[...state.selection,selection]):[selection]})),
  save:async()=>{
   const {history,model}=get();if(!history||get().busy)return false;const snapshot=history.present;set({saveState:'saving'})
   try{saveQueue=saveQueue.catch(()=>undefined).then(()=>saveProject(snapshot,model?.brep??'',history));await saveQueue;if(get().history?.present===snapshot)set({saveState:'saved'});return true}
   catch(error){set({saveState:'failed',error:`Local save failed: ${message(error)} Download a .anishape backup before closing.`});return false}
  },
  exportStl:async options=>{
   const h=get().history;if(!h||!get().model||get().busy)return null;const token=start('Preparing STL')
   try{const result=await geometryClient.export(h.present,options,progressFor(token));if(token!==generation)return null;geometryActive=false;set({busy:false,progress:'Export validated'});return result}catch(error){failure(token,error);return null}
  },
  exportStep:async()=>{
   const h=get().history;if(!h||!get().model||get().busy)return null;const token=start('Writing STEP B-Rep')
   try{const result=await geometryClient.exportStep(h.present,progressFor(token));if(token!==generation)return null;geometryActive=false;set({busy:false,progress:'STEP export ready'});return result}catch(error){failure(token,error);return null}
  },
  clearError:()=>set({error:null}),
 }
})
