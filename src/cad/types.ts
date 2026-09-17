export type Unit = 'mm' | 'cm' | 'm' | 'um' | 'in' | 'ft'
export type ExtrudeDirection = 'forward' | 'reverse' | 'symmetric'
export type Plane = 'XY' | 'XZ' | 'YZ'
export type Axis = 'X' | 'Y' | 'Z'
export type Operation = 'new' | 'join' | 'cut' | 'intersect'
export type Vec3 = [number, number, number]
export interface PlaneFrame {origin:Vec3;u:Vec3;v:Vec3;normal:Vec3}
export type FeatureStatus = 'valid' | 'failed' | 'suppressed'
export interface EdgeReference { id: string; featureId: string; signature: string; bodyId?:string }
export interface FaceReference { featureId:string; normal:Vec3; center:Vec3; bodyId?:string }
export interface FeatureBase {
 id:string; name:string; dependencies:string[]; status:FeatureStatus
 visible:boolean; suppressed:boolean; createdAt:string; updatedAt:string
 expressions?:Record<string,string>
}
export type Point2=[number,number]
export type SketchEntity=({id:string;construction?:boolean;dimension?:Point2}&(
 |{type:'point';position:Point2} | {type:'line';start:Point2;end:Point2}
 |{type:'circle';center:Point2;radius:number}
 |{type:'arc';start:Point2;mid:Point2;end:Point2}
))
export type SketchCurve = Exclude<SketchEntity,{type:'point'}>
export interface SketchFeature extends FeatureBase {
 type:'sketch'; parameters:{constraints?:import('./sketch-constraints').SketchConstraint[];dimensionPositions?:{width?:Point2;height?:Point2};display?:'auto'|'visible'|'hidden';entities?:SketchEntity[];defaultRegionId?:string;plane:Plane;x:number;y:number;width:number;height:number;profile?:'rectangle'|'circle';planeId?:string;offset?:number;support?:FaceReference;frame?:PlaneFrame}
}
export interface ExtrudeFeature extends FeatureBase {type:'extrude';parameters:{extent?:'blind'|'through-all'|'up-to-face'|'two-sided';secondDistance?:number;endFace?:FaceReference;distance:number;direction?:ExtrudeDirection;profileId?:string;bodyId?:string;operation?:Operation;startOffset?:number;regionId?:string}}
export interface FilletFeature extends FeatureBase {type:'fillet';parameters:{radius:number;bodyId?:string};references:EdgeReference[]}
export interface PushPullFeature extends FeatureBase {type:'pushpull';parameters:{distance:number;bodyId?:string};reference:FaceReference}
export interface PlaneFeature extends FeatureBase {type:'plane';parameters:{plane:Plane;offset:number}}
export interface RevolveFeature extends FeatureBase {type:'revolve';parameters:{profileId:string;axis:Axis;angle:number;bodyId?:string;operation:Operation;axisOffset:number;regionId?:string}}
export interface HoleFeature extends FeatureBase {type:'hole';parameters:{style?:'simple'|'counterbore'|'countersink';termination?:'blind'|'through-all';counterDiameter?:number;counterDepth?:number;sinkAngle?:number;bodyId:string;profileId?:string;plane:Plane;x:number;y:number;offset:number;diameter:number;depth:number}}
export interface ChamferFeature extends FeatureBase {type:'chamfer';parameters:{bodyId:string;distance:number};references:EdgeReference[]}
export interface ShellFeature extends FeatureBase {type:'shell';openingFaces?:FaceReference[];parameters:{bodyId:string;thickness:number};reference:FaceReference}
export interface DraftFeature extends FeatureBase {type:'draft';parameters:{bodyId:string;angle:number;plane:Plane;offset:number};reference:FaceReference}
export interface CombineFeature extends FeatureBase {type:'combine';parameters:{bodyId:string;toolIds:string[];operation:Exclude<Operation,'new'>;keepTools:boolean}}
export interface LinearPatternFeature extends FeatureBase {type:'linear-pattern';parameters:{bodyId:string;count:number;spacing:number;axis:Axis}}
export interface CircularPatternFeature extends FeatureBase {type:'circular-pattern';parameters:{bodyId:string;count:number;angle:number;axis:Axis}}
export interface MirrorFeature extends FeatureBase {type:'mirror';parameters:{bodyId:string;plane:Plane;offset:number}}
export interface LoftSection {profileId:string;regionId?:string}
export interface LoftFeature extends FeatureBase {type:'loft';parameters:{sections:LoftSection[];ruled:boolean;operation:Operation;bodyId?:string}}
export interface SweepFeature extends FeatureBase {type:'sweep';parameters:{profileId:string;regionId?:string;pathId:string;operation:Operation;bodyId?:string}}
export interface MoveFeature extends FeatureBase {type:'move';parameters:{bodyId:string;x:number;y:number;z:number}}
export interface GearFeature extends FeatureBase {type:'gear';parameters:{module:number;teeth:number;pressureAngle:number;thickness:number;bore:number;backlash:number;x:number;y:number;z:number}}
export interface RotateFeature extends FeatureBase {type:'rotate';parameters:{bodyId:string;axis:Axis;angle:number;x:number;y:number;z:number;copy:boolean}}
export interface ScaleFeature extends FeatureBase {type:'scale';parameters:{bodyId:string;factor:number;x:number;y:number;z:number;copy:boolean}}
export interface SplitFeature extends FeatureBase {type:'split';parameters:{bodyId:string;plane:Plane;planeId?:string;offset:number;keep:'both'|'positive'|'negative'}}
type PrimitivePlacement={x:number;y:number;z:number;operation:Operation;bodyId?:string}
export interface BoxFeature extends FeatureBase {type:'box';parameters:PrimitivePlacement&{width:number;depth:number;height:number}}
export interface CylinderFeature extends FeatureBase {type:'cylinder';parameters:PrimitivePlacement&{diameter:number;height:number;axis:Axis}}
export interface SphereFeature extends FeatureBase {type:'sphere';parameters:PrimitivePlacement&{diameter:number}}
export type Feature =RotateFeature|ScaleFeature|SplitFeature|BoxFeature|CylinderFeature|SphereFeature| SketchFeature|ExtrudeFeature|FilletFeature|PushPullFeature|PlaneFeature|RevolveFeature|HoleFeature|ChamferFeature|ShellFeature|DraftFeature|CombineFeature|LinearPatternFeature|CircularPatternFeature|MirrorFeature|GearFeature|MoveFeature|LoftFeature|SweepFeature
export type FeatureInput = Feature extends infer F ? F extends Feature ? Omit<F,keyof FeatureBase> & {expressions?:Record<string,string>} : never : never
export interface CadDocument {id:string;name:string;unit:Unit;precision:number;revision:number;createdAt:string;updatedAt:string;features:Feature[];parameters?:Record<string,string>}
export type CadCommand =
 | {type:'set-sketch';plane:Plane;x:number;y:number;width:number;height:number}
 | {type:'extrude';distance:number;direction?:ExtrudeDirection}
 | {type:'push-pull';distance:number;reference:FaceReference;id?:string}
 | {type:'fillet';radius:number;references:EdgeReference[]}
 | {type:'feature';feature:FeatureInput;id?:string}
 | {type:'parameters';values:Record<string,string>}
 | {type:'sketch-display';id:string;display:'auto'|'visible'|'hidden'}
 | {type:'rename-feature';id:string;name:string}
 | {type:'remove-last'} | {type:'remove-feature';id:string}
 | {type:'settings';unit:Unit;precision:number}
export interface FaceMesh {frame?:PlaneFrame;normal:Vec3|null;reference:FaceReference|null;id:string;positions:Float32Array;area:number;center:Vec3;bodyId?:string}
export interface EdgeMesh {curve?:{type:'circle';radius:number;center:Vec3;normal:Vec3;closed:boolean};reference:EdgeReference;positions:Float32Array;length:number;center:Vec3;filletEligible:boolean}
export interface BodyResult {id:string;name:string;sourceId:string;volume:number;surfaceArea:number;center:Vec3;bounds:{min:Vec3;max:Vec3};pitchDiameter?:number;brep:string}
export interface ModelResult {revision:number;faces:FaceMesh[];edges:EdgeMesh[];volume:number;surfaceArea:number;center:Vec3;bounds:{min:Vec3;max:Vec3};triangleCount:number;brep:string;durationMs:number;bodies?:BodyResult[];sketches?:{id:string;frame:PlaneFrame}[]}
export interface ExportOptions {format:'binary'|'ascii';unit:Unit;tolerance:number;angle:number}
export interface ExportResult {bytes:Uint8Array<ArrayBuffer>;triangles:number;unit:Unit;closed:boolean}
export interface StepResult {bytes:Uint8Array<ArrayBuffer>}
export interface SavedProject {id:string;document:CadDocument;brep:string;savedAt:string;history?:import('./document').History}
