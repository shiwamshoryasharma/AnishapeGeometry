import { ToolIcon } from './ToolIcon'
import { useEffect, useRef } from 'react'
import { commands, unavailable, type CommandContext, type CommandId } from './catalog'
export function CommandMenu({x,y,ids,context,onRun,onClose,label='CAD context menu'}:{
  x:number;y:number;ids:CommandId[];context:CommandContext;onRun:(id:CommandId)=>void;onClose:()=>void;label?:string
}){
  const ref=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const menu=ref.current
    menu?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const outside=(event:PointerEvent)=>{if(!menu?.contains(event.target as Node))onClose()}
    window.addEventListener('pointerdown',outside)
    window.addEventListener('resize',onClose)
    return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('resize',onClose)}
  },[onClose])
  return <div ref={ref} className="cad-command-menu" role="menu" aria-label={label}
    style={{left:Math.min(x,window.innerWidth-280),top:Math.max(8,Math.min(y,window.innerHeight-ids.length*43-22))}}
    onContextMenu={event=>event.preventDefault()}
    onKeyDown={event=>{
      const items=Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[])
      const index=items.indexOf(document.activeElement as HTMLButtonElement)
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose()}
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();items[(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus()
      }
    }}
  >{ids.map(id=>{const command=commands.find(c=>c.id===id)!,reason=unavailable(id,context);return <button role="menuitem" key={id} disabled={!!reason} title={reason??command.description} onClick={()=>onRun(id)}><ToolIcon name={id} size={22}/><span>{command.name}</span>{command.shortcut&&<kbd>{command.shortcut}</kbd>}</button>})}</div>
}
