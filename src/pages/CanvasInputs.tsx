import { forwardRef, useImperativeHandle, useRef } from 'react'
export interface CanvasField {key:string;label:string;value:string;unit?:string}
export interface CanvasInputsHandle {focus():void}
/** Draft values share the inspector's state; accepting previews but never commits a feature. */
export const CanvasInputs=forwardRef<CanvasInputsHandle,{fields:CanvasField[];disabled:boolean;onChange:(key:string,value:string)=>void;onAccept:()=>void}>(function CanvasInputs({fields,disabled,onChange,onAccept},ref){
 const inputs=useRef<(HTMLInputElement|null)[]>([]),initial=useRef('')
 const focus=(index:number)=>{const input=inputs.current[index];input?.focus();input?.select()}
 useImperativeHandle(ref,()=>({focus:()=>focus(0)}),[])
 return <div className="canvas-inputs" role="group" aria-label="Canvas dimensions"><div className="canvas-input-fields">{fields.map((field,index)=><label key={field.key}><span>{field.label}<small>{field.unit}</small></span><input ref={el=>{inputs.current[index]=el}} aria-label={'Canvas '+field.label.toLowerCase()} value={field.value} disabled={disabled} spellCheck={false} onFocus={e=>{initial.current=field.value;e.currentTarget.select()}} onChange={e=>onChange(field.key,e.target.value)} onKeyDown={e=>{
 if(e.key==='Tab'){e.preventDefault();e.stopPropagation();focus((index+(e.shiftKey?fields.length-1:1))%fields.length)}
 if(e.key==='Enter'){e.preventDefault();e.stopPropagation();e.currentTarget.blur();onAccept()}
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onChange(field.key,initial.current);e.currentTarget.blur()}
 }}/></label>)}</div><small>Tab: next value · Enter: accept · Esc: restore value</small></div>
})
