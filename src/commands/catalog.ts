import { featureNames } from '../cad/features'
import type { Feature } from '../cad/types'
export interface CommandContext {
  tool:string|null;busy:boolean;hasSketch:boolean;hasBody:boolean
  face:boolean;planarFace:boolean;edge:boolean;feature:boolean;canUndo:boolean;canRedo:boolean
}
export type CommandId=Feature['type']|'sketch-face'|'parameters'|'sketch'|'rectangle'|'dimension'|'extrude'|'pushpull'|'fillet'|'measure'|'fit'|'save'|'export'|'settings'|'undo'|'redo'|'apply'|'preview'|'cancel'|'edit-feature'|'delete-feature'
export interface CadAction {id:CommandId;name:string;group:'Sketch'|'Create'|'Modify'|'Inspect'|'Document';shortcut?:string;description:string}
export const commands:CadAction[]=[
  ...(['box','cylinder','sphere','rotate','scale','split','loft','sweep','move','plane','revolve','hole','chamfer','shell','draft','combine','linear-pattern','circular-pattern','mirror','gear'] as const).map(id=>({id,name:featureNames[id],group:'Create' as const,description:'Create or edit a parametric '+featureNames[id].toLowerCase()+'.'})),
  {id:'parameters',name:'Parameters',group:'Document',description:'Edit named engineering parameters and safe expressions.'},
  {id:'sketch-face',name:'Sketch on face',group:'Sketch',description:'Attach a new sketch to the selected planar face.'},
  {id:'sketch',name:'Sketch',group:'Sketch',shortcut:'S',description:'Start a sketch or edit the active profile.'},
  {id:'rectangle',name:'Rectangle',group:'Sketch',shortcut:'R',description:'Draw an axis-aligned rectangle in the sketch.'},
  {id:'dimension',name:'Dimension',group:'Sketch',shortcut:'D',description:'Select a sketch edge or dimension label and enter an exact size.'},
  {id:'extrude',name:'Extrude',group:'Create',shortcut:'E',description:'Extrude a sketch profile into a new body, join, cut or intersection.'},
  {id:'pushpull',name:'Push / pull face',group:'Modify',shortcut:'Q',description:'Add or remove material along a planar face normal.'},
  {id:'fillet',name:'Fillet',group:'Modify',shortcut:'L',description:'Round selected solid edges with a constant radius.'},
  {id:'measure',name:'Measure',group:'Inspect',shortcut:'M',description:'Inspect kernel-derived dimensions, volume, and selected geometry.'},
  {id:'fit',name:'Fit model',group:'Inspect',shortcut:'F',description:'Frame the model in the viewport.'},
  {id:'save',name:'Save project',group:'Document',shortcut:'Ctrl+S',description:'Save the committed document in local browser storage.'},
  {id:'export',name:'Export',group:'Document',description:'Download a validated manufacturing exchange file.'},
  {id:'settings',name:'Document settings',group:'Document',description:'Choose engineering units and display precision.'},
  {id:'undo',name:'Undo',group:'Modify',shortcut:'Ctrl+Z',description:'Restore the previous modeling transaction.'},
  {id:'redo',name:'Redo',group:'Modify',shortcut:'Ctrl+Y',description:'Reapply the undone modeling transaction.'},
  {id:'edit-feature',name:'Edit feature',group:'Modify',description:'Edit the selected feature parameters.'},
  {id:'delete-feature',name:'Delete feature',group:'Modify',shortcut:'Delete',description:'Review and delete this feature and its dependents. Undo restores them.'},
  {id:'preview',name:'Preview geometry',group:'Create',description:'Compute a temporary shape without committing the feature.'},
  {id:'apply',name:'Apply',group:'Create',shortcut:'Enter',description:'Validate and commit the active modeling command.'},
  {id:'cancel',name:'Cancel command',group:'Create',shortcut:'Esc',description:'Discard the current command and its temporary preview.'},
]
export function unavailable(id:CommandId,c:CommandContext):string|null {
  if(id==='cancel')return c.tool||c.busy?null:'No command is active.'
  if(c.busy)return 'Wait for the geometry operation to finish, or press Escape to cancel.'
  if(id==='fit'||id==='save')return null
  if(id==='apply'||id==='preview')return c.tool&&c.tool!=='measure'?null:'Start a modeling command first.'
  if(id==='rectangle')return c.tool==='sketch'?null:'Enter sketch mode first.'
  if(id==='dimension')return !c.tool||c.tool==='sketch'?null:'Finish the active command first.'
  if(c.tool&&c.tool!=='measure')return 'Finish or cancel the active command first.'
  if(['rotate','scale','split','move','hole','chamfer','shell','draft','combine','linear-pattern','circular-pattern','mirror'].includes(id))return c.hasBody?null:'Create a solid first.'
  if(['revolve','loft','sweep'].includes(id))return c.hasSketch?null:'Create a sketch first.'
  if(id==='extrude')return c.hasSketch?null:'Create a sketch profile first. Use Sketch on face for a selected face.'
  if(id==='sketch-face')return c.planarFace?null:'Select a planar face.'
  if(id==='pushpull')return c.planarFace?null:'Select a planar face.'
  if(id==='fillet'||id==='measure'||id==='export')return c.hasBody?null:'Create a solid first.'
  if(id==='edit-feature'||id==='delete-feature')return c.feature?null:'Select a feature in the model tree.'
  if(id==='undo')return c.canUndo?null:'No earlier transaction.'
  if(id==='redo')return c.canRedo?null:'No transaction to redo.'
  return null
}
export function shortcutCommand(key:string,mod=false,shift=false):CommandId|null {
  const value=key.toLowerCase()
  if(mod)return value==='s'?'save':value==='z'?(shift?'redo':'undo'):value==='y'?'redo':null
  return ({s:'sketch',d:'dimension',r:'rectangle',e:'extrude',q:'pushpull',l:'fillet',m:'measure',f:'fit',escape:'cancel',enter:'apply',delete:'delete-feature'} as Record<string,CommandId>)[value]??null
}
