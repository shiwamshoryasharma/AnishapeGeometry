import {downloadFile} from './download'
export interface EditableFileHandle {name:string;createWritable():Promise<{write(data:string):Promise<void>;close():Promise<void>;abort?():Promise<void>}>}
interface FilePickerWindow {showSaveFilePicker?:(options:{suggestedName:string;types:{description:string;accept:Record<string,string[]>}[]})=>Promise<EditableFileHandle>}
export async function saveEditableFile(data:string,name:string,existing?:EditableFileHandle):Promise<EditableFileHandle|undefined>{
 const picker=(window as unknown as FilePickerWindow).showSaveFilePicker
 if(!existing&&!picker){downloadFile(data,name+'.anishape','application/json');return undefined}
 const handle=existing??await picker!.call(window,{suggestedName:name.replace(/[<>:"/\\|?*]/g,'_')+'.anishape',types:[{description:'Anishape editable CAD project',accept:{'application/json':['.anishape']}}]})
 const writable=await handle.createWritable()
 try{await writable.write(data);await writable.close()}catch(error){try{await writable.abort?.()}catch{/* Retain the original write error. */}throw error}
 return handle
}
