import { ToolIcon } from './ToolIcon'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { Dialog } from '../components/Dialog'
import { commands, unavailable, type CommandContext, type CommandId } from './catalog'
export function CommandSearch({context,onRun,onClose}:{context:CommandContext;onRun:(id:CommandId)=>void;onClose:()=>void}){
  const [query,setQuery]=useState('')
  const matches=commands.filter(command=>(command.name+' '+command.description+' '+command.group).toLowerCase().includes(query.toLowerCase().trim()))
  return <Dialog title="Command search" onClose={onClose} wide>
    <label className="command-search-input"><Search size={19}/><input autoFocus aria-label="Search commands" placeholder="Search a command, e.g. extrude or dimension…" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();const first=matches.find(command=>!unavailable(command.id,context));if(first)onRun(first.id)}}}/><kbd>Ctrl K</kbd></label>
    <div className="command-search-results">{matches.map(command=>{const reason=unavailable(command.id,context);return <button key={command.id} disabled={!!reason} title={reason??command.description} onClick={()=>onRun(command.id)}><ToolIcon name={command.id} size={24}/><div><strong>{command.name}</strong><span>{reason??command.description}</span></div>{command.shortcut&&<kbd>{command.shortcut}</kbd>}</button>})}{!matches.length&&<p>No matching implemented command.</p>}</div>
  </Dialog>
}
