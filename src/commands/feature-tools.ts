import { circularPlacement, sketchRegions } from '../cad/sketch-entities'
import type { Feature, FeatureInput, CadDocument, ModelResult, Unit } from '../cad/types'
import { evaluateExpression, resolveParameters, lengthBinding } from '../cad/parameters'
import { UnitService } from '../cad/units'
export type AdvancedTool=Exclude<Feature['type'],'sketch'|'extrude'|'fillet'|'pushpull'>
export interface ToolField {key:string;label:string;kind:'length'|'number'|'angle'|'axis'|'plane'|'body'|'profile'|'operation'|'boolean'|'tools'|'region'|'sections'|'path'|'reference-plane'|'keep'|'hole-style'|'hole-termination'}
const f=(key:string,label:string,kind:ToolField['kind']='length'):ToolField=>({key,label,kind})
export const toolFields:Record<AdvancedTool,ToolField[]>={
 box:[f('x','Origin X'),f('y','Origin Y'),f('z','Origin Z'),f('width','Width'),f('depth','Depth'),f('height','Height'),f('operation','Operation','operation'),f('bodyId','Target body','body')],
 cylinder:[f('x','Origin X'),f('y','Origin Y'),f('z','Origin Z'),f('axis','Cylinder axis','axis'),f('diameter','Diameter'),f('height','Height'),f('operation','Operation','operation'),f('bodyId','Target body','body')],
 sphere:[f('x','Origin X'),f('y','Origin Y'),f('z','Origin Z'),f('diameter','Diameter'),f('operation','Operation','operation'),f('bodyId','Target body','body')],
 rotate:[f('bodyId','Target body','body'),f('axis','Rotation axis','axis'),f('angle','Rotation angle','angle'),f('x','Pivot X'),f('y','Pivot Y'),f('z','Pivot Z'),f('copy','Create copy','boolean')],
 scale:[f('bodyId','Target body','body'),f('factor','Scale factor','number'),f('x','Pivot X'),f('y','Pivot Y'),f('z','Pivot Z'),f('copy','Create copy','boolean')],
 split:[f('bodyId','Target body','body'),f('planeId','Split reference','reference-plane'),f('plane','Split plane','plane'),f('offset','Split offset'),f('keep','Keep side','keep')],
 loft:[f('sections','Loft sections','sections'),f('ruled','Ruled transitions','boolean'),f('operation','Operation','operation'),f('bodyId','Target body','body')],
 sweep:[f('profileId','Sweep profile','profile'),f('regionId','Sweep region','region'),f('pathId','Sweep path','path'),f('operation','Operation','operation'),f('bodyId','Target body','body')],
 move:[f('bodyId','Target body','body'),f('x','Move X'),f('y','Move Y'),f('z','Move Z')],
 plane:[f('plane','Base plane','plane'),f('offset','Plane offset')],
 revolve:[f('profileId','Profile','profile'),f('regionId','Revolve region','region'),f('axis','Revolve axis','axis'),f('axisOffset','Axis offset'),f('angle','Revolve angle','angle'),f('operation','Operation','operation'),f('bodyId','Target body','body')],
 hole:[f('style','Hole style','hole-style'),f('termination','Hole termination','hole-termination'),f('counterDiameter','Recess diameter'),f('counterDepth','Counterbore depth'),f('sinkAngle','Countersink angle','angle'),f('bodyId','Target body','body'),f('profileId','Placement sketch','profile'),f('plane','Hole plane','plane'),f('x','Hole X'),f('y','Hole Y'),f('offset','Hole start offset'),f('diameter','Hole diameter'),f('depth','Hole depth')],
 chamfer:[f('bodyId','Target body','body'),f('distance','Chamfer distance')],
 shell:[f('bodyId','Target body','body'),f('thickness','Wall thickness')],
 draft:[f('bodyId','Target body','body'),f('plane','Neutral plane','plane'),f('offset','Neutral offset'),f('angle','Draft angle','angle')],
 combine:[f('bodyId','Target body','body'),f('toolIds','Tool bodies','tools'),f('operation','Operation','operation'),f('keepTools','Keep tools','boolean')],
 'linear-pattern':[f('bodyId','Source body','body'),f('axis','Pattern axis','axis'),f('count','Instance count','number'),f('spacing','Spacing')],
 'circular-pattern':[f('bodyId','Source body','body'),f('axis','Pattern axis','axis'),f('count','Instance count','number'),f('angle','Pattern angle','angle')],
 mirror:[f('bodyId','Source body','body'),f('plane','Mirror plane','plane'),f('offset','Mirror offset')],
 gear:[f('module','Module'),f('teeth','Teeth','number'),f('pressureAngle','Pressure angle','angle'),f('thickness','Gear thickness'),f('bore','Bore diameter'),f('backlash','Backlash'),f('x','Gear X'),f('y','Gear Y'),f('z','Gear Z')],
}
export const isAdvanced=(tool:string|null):tool is AdvancedTool=>!!tool&&Object.hasOwn(toolFields,tool)
export function defaults(tool:AdvancedTool,doc:CadDocument,model:ModelResult|null,bodyId?:string):Record<string,string>{
 const values:Record<string,string>={style:'simple',termination:'blind',counterDiameter:'8',counterDepth:'3',sinkAngle:'90',plane:'XY',offset:'0',x:'0',y:'0',z:'0',profileId:doc.features.findLast(f=>f.type==='sketch')?.id??'',bodyId:bodyId??model?.bodies?.[0]?.id??'',toolIds:model?.bodies?.[1]?.id??'',operation:tool==='combine'?'cut':'new',axis:'Z',axisOffset:'0',angle:tool==='draft'?'5':'360',diameter:'4',depth:'20',distance:'1',thickness:tool==='gear'?'10':'1',count:'3',spacing:'30',keepTools:'false',module:'2',teeth:'24',pressureAngle:'20',bore:'8',backlash:'0',width:'20',height:'20',factor:'1',copy:'false',keep:'both'}
 if(['box','cylinder','sphere'].includes(tool))values.diameter='20'
 if(tool==='rotate')values.angle='90'
 const target=model?.bodies?.find(b=>b.id===values.bodyId)
 if(target&&['rotate','scale'].includes(tool)){values.x=String(target.center[0]);values.y=String(target.center[1]);values.z=String(target.center[2])}
 if(target&&tool==='split')values.offset=String((target.bounds.min[2]+target.bounds.max[2])/2)
 if(tool==='loft')values.sections=JSON.stringify(doc.features.filter(f=>f.type==='sketch').slice(-2).map(f=>({profileId:f.id,...(f.type==='sketch'&&f.parameters.defaultRegionId?{regionId:f.parameters.defaultRegionId}:{})})))
 if(tool==='sweep'){values.pathId=doc.features.findLast(f=>f.type==='sketch'&&f.parameters.entities?.some(e=>e.type!=='circle'&&!e.construction))?.id??'';values.profileId=doc.features.findLast(f=>{if(f.type!=='sketch'||f.id===values.pathId)return false;if(!f.parameters.entities)return true;try{return sketchRegions(f.parameters.entities).length>0}catch{return false}})?.id??''}
 if(tool==='hole')values.profileId=doc.features.findLast(f=>f.type==='sketch'&&!!circularPlacement(f.parameters))?.id??''
 if(model&&tool==='hole'){values.x=String((model.bounds.min[0]+model.bounds.max[0])/2);values.y=String((model.bounds.min[1]+model.bounds.max[1])/2);values.offset=String(model.bounds.max[2]);values.depth=String(model.bounds.max[2]-model.bounds.min[2])}
 if(tool==='hole'&&values.profileId)values.offset='0'
 for(const field of toolFields[tool])if(field.kind==='length')values[field.key]=String(UnitService.fromInternal(Number(values[field.key]),doc.unit))
 return values
}
export function featureValues(feature:FeatureInput,unit:Unit):Record<string,string>{
 const result:Record<string,string>={}
 for(const field of toolFields[feature.type as AdvancedTool]){const value=(feature.parameters as unknown as Record<string,unknown>)[field.key]??({style:'simple',termination:'blind',counterDiameter:8,counterDepth:3,sinkAngle:90} as Record<string,unknown>)[field.key];result[field.key]=feature.expressions?.[field.key]??(field.kind==='sections'?JSON.stringify(value):Array.isArray(value)?value.join(','):field.kind==='length'&&typeof value==='number'?String(UnitService.fromInternal(value,unit)):String(value??''))}return result
}
export function advancedInput(tool:AdvancedTool,values:Record<string,string>,doc:CadDocument):FeatureInput {
 const parameters:Record<string,unknown>={},expressions:Record<string,string>={},named=resolveParameters(doc.parameters??{})
 for(const field of toolFields[tool]){
  if(tool==='hole'&&!holeFieldActive(field.key,values))continue
  const text=values[field.key]??''
  if(field.kind==='sections')parameters[field.key]=JSON.parse(text||'[]')
  else if(field.kind==='boolean')parameters[field.key]=text==='true'
  else if(field.kind==='tools')parameters[field.key]=text.split(',').filter(Boolean)
  else if(['length','number','angle'].includes(field.kind)){
   const q=evaluateExpression(text,named);let value=q.value
   if(field.kind==='length'){if(q.angle||![0,1].includes(q.length))throw Error('Use a length for '+field.label);if(!q.length)value=UnitService.toInternal(value,doc.unit)}
   if(field.kind==='angle'){if(q.length||![0,1].includes(q.angle))throw Error('Use an angle for '+field.label);if(q.angle)value=value*180/Math.PI}
   if(field.kind==='number'&&(q.angle||q.length))throw Error(field.label+' must be unitless.')
   parameters[field.key]=value
   if(Object.keys(named).some(name=>new RegExp('\\b'+name+'\\b').test(text)))expressions[field.key]=field.kind==='length'?lengthBinding(text,named,doc.unit):text
  }else if(text)parameters[field.key]=text
 }
 if(['loft','sweep','revolve','box','cylinder','sphere'].includes(tool)&&parameters.operation==='new')delete parameters.bodyId
 return {type:tool,parameters,...(Object.keys(expressions).length?{expressions}:{})} as FeatureInput
}

export function holeFieldActive(key:string,values:Record<string,string>){
 if(key==='counterDiameter')return !!values.style&&values.style!=='simple'
 if(key==='counterDepth')return values.style==='counterbore'
 if(key==='sinkAngle')return values.style==='countersink'
 return true
}
