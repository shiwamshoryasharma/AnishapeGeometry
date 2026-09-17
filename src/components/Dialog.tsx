import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
export function Dialog({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{const element=ref.current;element?.showModal();return()=>element?.close()},[])
  return <dialog ref={ref} className={`dialog ${wide?'dialog-wide':''}`} aria-label={title} onCancel={event=>{event.preventDefault();onClose()}} onClick={event=>{if(event.target===ref.current){const bounds=ref.current.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)onClose()}}}>
    <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19}/></button></div>{children}
  </dialog>
}
