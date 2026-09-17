import type {FaceReference,ModelResult} from '../cad/types'
const key=(r:FaceReference)=>JSON.stringify([r.bodyId,r.normal.map(n=>Number(n.toFixed(5))),r.center.map(n=>Number(n.toFixed(5)))])
function name(r:FaceReference){
 const i=r.normal.findIndex(n=>Math.abs(n)>1-1e-6)
 return i<0?'normal '+r.normal.map(n=>n.toFixed(2)).join(', '):(r.normal[i]>0?'+':'−')+'XYZ'[i]
}
export function ShellOpenings({model,bodyId,faces,onChange,editing}:{model:ModelResult|null;bodyId:string;faces:FaceReference[];onChange:(faces:FaceReference[])=>void;editing:boolean}){
 const available=editing?faces:model?.faces.filter(f=>f.bodyId===bodyId&&f.reference).map(f=>f.reference!)??[]
 return <fieldset className="body-tools" aria-label="Shell openings"><legend>Shell openings</legend><p>{faces.length} openings selected</p>{available.map((r,i)=><label key={key(r)}><input aria-label={'Shell opening '+name(r)} type="checkbox" checked={faces.some(f=>key(f)===key(r))} onChange={e=>onChange(e.target.checked?[...faces,r]:faces.filter(f=>key(f)!==key(r)))}/>{name(r)} face · {i+1}</label>)}<small>{editing?'Saved openings are retained while editing thickness. Remove an opening by clearing its checkbox.':'Choose one or more planar faces to remove.'}</small></fieldset>
}
