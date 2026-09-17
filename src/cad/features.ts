import {holeRecess} from './holes'
import {assertConstraintsSatisfied} from './sketch-constraints'
import {validateEntities} from './sketch-entities'
import type { FaceReference, Feature, FeatureInput, CadDocument } from './types'
export const featureNames:Record<Feature['type'],string>={rotate:'Rotate body',scale:'Scale body',split:'Split body',box:'Box',cylinder:'Cylinder',sphere:'Sphere',loft:'Loft',sweep:'Sweep',move:'Move body',sketch:'Sketch',extrude:'Extrude',fillet:'Fillet',pushpull:'Push/pull',plane:'Reference plane',revolve:'Revolve',hole:'Hole',chamfer:'Chamfer',shell:'Shell',draft:'Draft',combine:'Combine','linear-pattern':'Linear pattern','circular-pattern':'Circular pattern',mirror:'Mirror',gear:'Spur gear'}
export function validateFeature(input:FeatureInput):void {
 if(!input||!Object.hasOwn(featureNames,input.type)||!input.parameters||typeof input.parameters!=='object')throw Error('Unsupported feature type or parameters.')
 const p=input.parameters as unknown as Record<string,unknown>
 const number=(key:string,min:number,max:number,optional=false)=>{const v=p[key];if(optional&&v===undefined)return;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${key} must be between ${min} and ${max}.`)}
 const choice=(key:string,values:unknown[],optional=false)=>{if(optional&&p[key]===undefined)return;if(!values.includes(p[key]))throw Error(`Invalid ${key}.`)}
 const id=(key:string,optional=false)=>{if(optional&&p[key]===undefined)return;if(typeof p[key]!=='string'||!p[key]||String(p[key]).length>150)throw Error(`Missing ${key} reference.`)}
 const plane=()=>choice('plane',['XY','XZ','YZ']);const body=()=>id('bodyId');const axis=()=>choice('axis',['X','Y','Z'])
 switch(input.type){
 case 'sketch':if(p.dimensionPositions!==undefined){if(!p.dimensionPositions||typeof p.dimensionPositions!=='object'||Array.isArray(p.dimensionPositions))throw Error('Invalid dimension positions.');for(const [key,value]of Object.entries(p.dimensionPositions)){if(!['width','height'].includes(key)||!Array.isArray(value)||value.length!==2||value.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>100000))throw Error('Invalid dimension position.')}}choice('display',['auto','visible','hidden'],true);if(p.entities!==undefined)validateEntities(p.entities);if(p.constraints!==undefined){if(!Array.isArray(p.entities))throw Error('Constraints require a multi-entity sketch.');assertConstraintsSatisfied(p.entities,p.constraints as import('./sketch-constraints').SketchConstraint[]);}plane();for(const k of ['x','y'])number(k,-100000,100000);for(const k of ['width','height'])number(k,.001,100000);choice('profile',['rectangle','circle'],true);number('offset',-100000,100000,true);id('planeId',true);if(p.support){if(p.planeId)throw Error('Choose a face or a reference plane, not both.');validateFaceReference(p.support)};break
 case 'extrude':choice('extent',['blind','through-all','up-to-face','two-sided'],true);number('secondDistance',.001,100000,true);if(p.extent==='two-sided'&&(p.secondDistance===undefined||p.direction==='symmetric'))throw Error('Two-sided extrusion requires a second depth and Forward or Reverse direction.');if(p.extent==='through-all'&&(!['cut','intersect'].includes(String(p.operation))||!p.bodyId))throw Error('Through all requires Cut or Intersect and a target body.');if(p.extent==='up-to-face'){validateFaceReference(p.endFace);if(p.direction==='symmetric')throw Error('Up to face requires Forward or Reverse direction.');}else if(p.endFace!==undefined)throw Error('A limiting face requires Up to face termination.');number('distance',-100000,100000);if(Math.abs(Number(p.distance))<.001)throw Error('Extrusion distance magnitude must be at least 0.001 mm.');number('startOffset',-100000,100000,true);choice('direction',['forward','reverse','symmetric'],true);choice('operation',['new','join','cut','intersect'],true);id('profileId',true);id('bodyId',true);break
 case 'fillet':number('radius',.001,100000);id('bodyId',true);break
 case 'pushpull':number('distance',-100000,100000);if(Math.abs(Number(p.distance))<.001)throw Error('Offset cannot be zero.');id('bodyId',true);break
 case 'plane':plane();number('offset',-100000,100000);break
 case 'revolve':id('profileId');axis();number('angle',.01,360);number('axisOffset',-100000,100000);choice('operation',['new','join','cut','intersect']);id('bodyId',true);break
 case 'loft':{
 const sections=p.sections;if(!Array.isArray(sections)||sections.length<2||sections.length>16)throw Error('Choose 2–16 ordered loft sections.');
 const seen=new Set<string>();for(const section of sections){if(!section||typeof section.profileId!=='string'||!section.profileId||section.profileId.length>150)throw Error('Invalid loft profile reference.');if(seen.has(section.profileId))throw Error('Loft sections must use distinct sketches.');seen.add(section.profileId);if(section.regionId!==undefined&&(typeof section.regionId!=='string'||!section.regionId||section.regionId.length>22000))throw Error('Invalid loft region reference.');}
 if(typeof p.ruled!=='boolean')throw Error('Invalid ruled loft option.');choice('operation',['new','join','cut','intersect']);id('bodyId',p.operation==='new');break
 }
 case 'sweep':id('profileId');id('pathId');if(p.profileId===p.pathId)throw Error('Sweep profile and path must use distinct sketches.');choice('operation',['new','join','cut','intersect']);id('bodyId',p.operation==='new');break
 case 'box':case 'cylinder':case 'sphere':for(const k of ['x','y','z'])number(k,-100000,100000);choice('operation',['new','join','cut','intersect']);id('bodyId',p.operation==='new');if(input.type==='box'){for(const k of ['width','depth','height'])number(k,.001,100000)}else{number('diameter',.001,100000);if(input.type==='cylinder'){axis();number('height',.001,100000)}}break
 case 'rotate':case 'scale':body();for(const k of ['x','y','z'])number(k,-100000,100000);if(typeof p.copy!=='boolean')throw Error('Invalid transform copy option.');if(input.type==='rotate'){axis();number('angle',-360,360)}else number('factor',.001,1000);break
 case 'split':body();plane();id('planeId',true);number('offset',-100000,100000);choice('keep',['both','positive','negative']);break
 case 'move':body();for(const k of ['x','y','z'])number(k,-100000,100000);break
 case 'hole':choice('style',['simple','counterbore','countersink'],true);choice('termination',['blind','through-all'],true);number('counterDiameter',.001,100000,true);number('counterDepth',.001,100000,true);number('sinkAngle',1,179,true);body();id('profileId',true);plane();for(const k of ['x','y','offset'])number(k,-100000,100000);for(const k of ['diameter','depth'])number(k,.001,100000);if(!p.profileId)holeRecess(input.parameters);else if(p.style==='counterbore'&&p.counterDepth===undefined||p.style==='countersink'&&p.sinkAngle===undefined||p.style&&p.style!=='simple'&&p.counterDiameter===undefined)throw Error('Complete the recess diameter and depth/angle.');break
 case 'chamfer':body();number('distance',.001,100000);break
 case 'shell':body();number('thickness',.001,100000);if(input.openingFaces!==undefined){const refs=input.openingFaces;if(!Array.isArray(refs)||!refs.length||refs.length>32)throw Error('Select 1–32 shell openings.');refs.forEach(validateFaceReference);if(new Set(refs.map(r=>JSON.stringify([r.bodyId,r.normal,r.center]))).size!==refs.length)throw Error('Choose distinct shell openings.');if(refs.some(r=>r.bodyId&&r.bodyId!==p.bodyId))throw Error('Shell openings must belong to the target body.');}break
 case 'draft':body();plane();number('angle',-60,60);number('offset',-100000,100000);break
 case 'combine':body();choice('operation',['join','cut','intersect']);if(!Array.isArray(p.toolIds)||!p.toolIds.length||p.toolIds.length>64||p.toolIds.some(v=>typeof v!=='string'||!v||v===p.bodyId)||new Set(p.toolIds).size!==p.toolIds.length)throw Error('Choose distinct tool body references.');if(typeof p.keepTools!=='boolean')throw Error('Invalid Keep Tools option.');break
 case 'linear-pattern':body();axis();number('count',2,64);number('spacing',.001,100000);if(!Number.isInteger(p.count))throw Error('Pattern count must be an integer.');break
 case 'circular-pattern':body();axis();number('count',2,64);number('angle',.01,360);if(!Number.isInteger(p.count))throw Error('Pattern count must be an integer.');break
 case 'mirror':body();plane();number('offset',-100000,100000);break
 case 'gear':number('module',.05,100);number('teeth',8,160);if(!Number.isInteger(p.teeth))throw Error('Teeth must be an integer.');number('pressureAngle',14.5,30);number('thickness',.001,100000);number('bore',0,100000);number('backlash',0,100);for(const k of ['x','y','z'])number(k,-100000,100000);if(Number(p.bore)>=Number(p.module)*(Number(p.teeth)-2.5))throw Error('Bore must be smaller than the root diameter.');if(Number(p.backlash)>=Math.PI*Number(p.module)/2)throw Error('Backlash exceeds the tooth thickness.');break
 }
 if(['fillet','chamfer'].includes(input.type)&&!('references' in input))throw Error('Select edges for this feature.')
 if(['pushpull','shell','draft'].includes(input.type)&&!('reference' in input))throw Error('Select a face for this feature.')
 if(p.defaultRegionId!==undefined&&(typeof p.defaultRegionId!=='string'||!p.defaultRegionId||p.defaultRegionId.length>22000))throw Error('Invalid default sketch region reference.');
 if(p.regionId!==undefined&&(typeof p.regionId!=='string'||!p.regionId||p.regionId.length>22000))throw Error('Invalid sketch region reference.');
 if('references' in input){if(!Array.isArray(input.references)||!input.references.length||input.references.length>64)throw Error('Select 1–64 edges.');for(const r of input.references)if(!r||typeof r.signature!=='string'||r.signature.length>1000||typeof r.featureId!=='string'||typeof r.id!=='string')throw Error('Invalid edge reference.')}
 if('reference' in input)validateFaceReference(input.reference)
 if(input.expressions){if(typeof input.expressions!=='object'||Array.isArray(input.expressions))throw Error('Invalid parameter bindings.');for(const [key,value]of Object.entries(input.expressions))if(typeof p[key]!=='number'||typeof value!=='string'||value.length>500)throw Error('Invalid parameter expression.')}
}
export function dependenciesFor(doc:CadDocument,input:FeatureInput,index=doc.features.length):string[]{
 const prior=doc.features.slice(0,index),p=input.parameters as unknown as Record<string,unknown>;const deps=new Set<string>()
 const requireRef=(id:unknown)=>{if(typeof id!=='string'||!prior.some(f=>f.id===id||id.startsWith(f.id+':copy:')))throw Error('Missing or forward feature/body reference.');const f=prior.find(f=>f.id===id||id.startsWith(f.id+':copy:'))!;deps.add(f.id)}
 for(const key of ['profileId','pathId','planeId','bodyId'])if(p[key])requireRef(p[key])
 if(input.type==='sketch'&&input.parameters.support){requireRef(input.parameters.support.featureId);if(input.parameters.support.bodyId)requireRef(input.parameters.support.bodyId)}
 if(input.type==='extrude'&&input.parameters.endFace){requireRef(input.parameters.endFace.featureId);if(input.parameters.endFace.bodyId)requireRef(input.parameters.endFace.bodyId)}
 if(input.type==='shell')for(const ref of input.openingFaces??[]){requireRef(ref.featureId);if(ref.bodyId)requireRef(ref.bodyId)}
 if(input.type==='loft')for(const section of input.parameters.sections)requireRef(section.profileId)
 if(p.toolIds)for(const id of p.toolIds as string[])requireRef(id)
 if(input.type==='extrude'&&!p.profileId){const sketch=prior.find(f=>f.type==='sketch');if(!sketch)throw Error('Finish a sketch before extruding.');deps.add(sketch.id)}
 if(input.type==='fillet'&&!p.bodyId){const e=prior.find(f=>f.type==='extrude');if(!e)throw Error('Create an extrusion first.');deps.add(e.id)}
 if('references'in input)for(const ref of input.references)requireRef(ref.featureId)
 if('reference'in input)requireRef(input.reference.featureId)
 // In-place body edits depend on its most recent producer, not merely its creation.
 for(const target of [p.bodyId,...(Array.isArray(p.toolIds)?p.toolIds:[])].filter(Boolean)){const latest=[...prior].reverse().find(f=>f.id===target||('bodyId'in f.parameters&&f.parameters.bodyId===target));if(latest)deps.add(latest.id)}
 return [...deps]
}

function validateFaceReference(value:unknown):asserts value is FaceReference {
 const r=value as FaceReference
 if(!r||typeof r.featureId!=='string'||!r.featureId||!Array.isArray(r.normal)||!Array.isArray(r.center)||r.normal.length!==3||r.center.length!==3||![...r.normal,...r.center].every(Number.isFinite)||Math.abs(Math.hypot(...r.normal)-1)>1e-6||(r.bodyId!==undefined&&(typeof r.bodyId!=='string'||!r.bodyId)))throw Error('Invalid face reference.')
}
