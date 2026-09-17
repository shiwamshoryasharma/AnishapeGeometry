import type {PlaneFrame,Unit} from '../cad/types'
import {UnitService} from '../cad/units'
export function SketchFrameInfo({frame,unit,attached}:{frame:PlaneFrame;unit:Unit;attached:boolean}){
 const direction=(v:number[])=>v.map(n=>Number(n.toFixed(4))).join(', ')
 return <details className="sketch-frame-info"><summary>Sketch coordinate system</summary>
  <p>Local origin: (0, 0). Red +X and green +Y lie in the sketch plane. All point coordinates and axis dimensions use this frame.</p>
  <dl><dt>Origin in world · {unit}</dt><dd>{frame.origin.map(n=>UnitService.format(n,unit,3)).join(', ')}</dd><dt>Local X direction in world</dt><dd>({direction(frame.u)})</dd><dt>Local Y direction in world</dt><dd>({direction(frame.v)})</dd><dt>Plane normal in world</dt><dd>({direction(frame.normal)})</dd></dl>
  <p>{attached?'The local frame follows the supporting face when upstream features change.':'The local frame follows the selected origin or reference plane.'} Select Origin / axes to anchor an endpoint or center, or set signed X/Y dimensions.</p>
 </details>
}
