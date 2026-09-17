import {useState} from 'react'
import {Dialog} from '../components/Dialog'
import {commands,unavailable,type CommandContext,type CommandId} from './catalog'
import {ToolIcon} from './ToolIcon'
const groups:{name:string;ids:CommandId[]}[]=[
 {name:'Sketch & create',ids:['sketch','extrude','revolve','loft','sweep','hole','box','cylinder','sphere','gear']},
 {name:'Modify',ids:['fillet','chamfer','shell','draft','combine','split','pushpull']},
 {name:'Transform & pattern',ids:['move','rotate','scale','mirror','linear-pattern','circular-pattern']},
 {name:'Construct & inspect',ids:['plane','measure','parameters','fit','export']},
]
export function ToolBrowser({context,onRun,onClose}:{context:CommandContext;onRun:(id:CommandId)=>void;onClose:()=>void}){
 const [query,setQuery]=useState('');const filtered=groups.map(group=>({...group,items:group.ids.map(id=>commands.find(c=>c.id===id)!).filter(c=>(c.name+' '+c.description).toLowerCase().includes(query.toLowerCase()))})).filter(group=>group.items.length)
 return <Dialog title="CAD tools" wide onClose={onClose}><p className="dialog-description">All implemented solid tools. Select a tool to configure it; unavailable tools explain the geometry they need.</p><label className="field"><span>Find a tool</span><input autoFocus aria-label="Find CAD tool" placeholder="Name or operation…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="cad-tool-browser">{filtered.map(group=>{const items=group.items;return <section key={group.name}><h3>{group.name}</h3><div>{items.map(c=>{const reason=unavailable(c.id,context);return <button key={c.id} aria-label={c.name} disabled={!!reason} title={reason??c.description} onClick={()=>{onClose();onRun(c.id)}}><ToolIcon name={c.id}/><span><strong>{c.name}</strong><small>{reason??c.description}</small></span></button>})}</div></section>})}{!filtered.length&&<p role="status">No matching tools.</p>}</div></Dialog>
}
