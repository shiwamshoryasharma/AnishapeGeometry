# Current CAD capabilities

This describes the present prototype, not the planned desktop/simulation stack.

- All tools: searchable, grouped icon browser including Shell, Draft, Combine and patterns.
- Box, Cylinder, Sphere: analytic solids with New/Join/Cut/Intersect.
- Rotate around XYZ through a pivot; uniform Scale; optional independent transform copies.
- Split body by an offset origin or reference plane; keep both sides as separate bodies or one side.
- Direct Line and Point buttons in every sketch. Lines support chained clicks and Tab entry
  with endpoint X/Y or length/angle. Points support exact X/Y entry, snapping, selection,
  move/mirror/patterns, constraints, undo/redo, project files, and finished-sketch display.
- Selectable local origin and X/Y axes: anchor a point/endpoint/center at (0,0), or drive
  signed X/Y distances. Zero Y places a point on X; zero X places it on Y. Coordinate
  dimensions are visible and editable on the canvas. The sketch coordinate-system panel
  shows its origin and basis in world coordinates, including associative face frames.
- Points are references: they do not create extrusion regions or become sweep edges.
  Switching a primitive sketch to entity tools preserves its current shape; Clear sketch
  starts an empty entity sketch. As with More sketch tools, conversion fixes existing
  named primitive dimension bindings; entity constraint values do not bind parameters yet.
- Visible sketch origin and face/curve center markers, Show origin, geometric snap targets,
  and center rectangles with exact Tab dimensions. Snapping does not create solver constraints.

- Persistent sketch constraints: horizontal/vertical, length/radius, coincidence, point distance,
  parallel/perpendicular, equal, concentric, tangency, angle, fixed point and fixed geometry.
  A separate planeGCS worker solves constraints with DOF, redundancy and conflict feedback.
- Sketch Trim/Extend/Split, Offset, pivoted Rotate/Scale, circular copies, and enclosing/crossing selection.
  Offset supports single curves and closed straight-sided contours; copies are independent.
- Extrusion end conditions: blind, independent two-sided depths, through-all Cut/Intersect,
  parallel planar Up to face, and signed start offsets. Saved limits follow upstream edits.
- Simple/counterbore/countersink holes with blind/through-all depth; inward shells can remove
  multiple planar faces. Threads and arbitrary surface end conditions remain unsupported.

- Multi-entity sketches: points, lines, arcs, circles, rectangles, polygons and slots; Move, Mirror
  and linear Pattern, region selection, editable diameter/radius/length labels.
- Finished sketches appear in 3D and auto-hide when consumed. Tree eye overrides persist.
  Sketches on solid faces are selectable for further Join/Cut extrusion.
- Loft ordered sections (smooth/ruled) and Sweep along tangent line/arc paths, with
  New/Join/Cut/Intersect operations. Guide curves and sharp-corner sweeps remain unsupported.
- Dimension: select an edge/circle, drag its label, then click it to edit sketch geometry.
  Measure displays a draggable read-only 3D edge length, circle diameter or arc radius.
- Themed menus, landing illustrations, CSS scrollbars and customizable select popups
  in supporting browsers; Finish sketch remains visible while tools scroll.

- Multiple rectangle/circle sketches on XY/XZ/YZ, offset reference planes, or selected planar solid faces; driving
  dimensions, exact dimension entry, and safe named expressions with units.
- Multiple bodies; extrusion new/join/cut/intersect with forward/reverse/symmetric
  direction; revolve, holes, fillet, chamfer, inward shell, planar draft,
  Boolean combine with Keep Tools, mirror, and linear/circular body patterns.
- Editable spur gears with module, tooth count, pressure angle, thickness, bore,
  backlash, placement, and pitch-diameter measurement. Flanks use a cubic spline
  approximation of the involute; root relief is radial, not a generated cutter trochoid.
- New Sketch starts with explicit XY/XZ/YZ, reference-plane or planar-face selection.
- Drag arrows with editable canvas values for extrude, push/pull, fillet and chamfer.
  Press Tab during dragging to type an exact value, then Enter to preview; Apply commits.
  Sketch Tab cycles width/height (or diameter). Other numeric features also have canvas fields.
- Larger bottom-right draggable cube with colored signed axes, quarter-turn arrows and Home.
- Readable light/dark themes with persisted choice, including the solid and sketch canvases.
- Move body with three colored arrows, signed X/Y/Z offsets, Tab entry, preview and editable history.
- Expandable Origin/Sketches/Features/Bodies tree, dependency links, rename, body selection and visibility.
- Save As .anishape chooses a folder in supported browsers; Open .anishape restores model and history.
  Local autosave remains separate; unsupported browsers use a download fallback.
- Labeled SVG tool ribbon, contextual Sketch toolbar/palette, visible body context,
  pan/zoom, grid/snap and dimension visibility. Face attachments follow support edits.
- Shared command search (Ctrl+K), context menus, hover highlighting,
  S sketch, D dimension, R draw, E extrude, Q push/pull, M measure, F fit.
- Validated worker previews/commits, cancellation, dependency-aware deletion,
  and 60 bounded undo/redo transactions saved across reloads and editable backups.
- Real STEP B-Rep export and checked binary/ASCII STL with absolute chord tolerance.
  Version-1 .anishape documents remain readable.

This is a substantial solid-modeling milestone, not a completed production CAD suite.
Additional sketch primitives, projected geometry, symmetry/midpoint constraints, associative patterns,
advanced feature variants and tapered extrusion,
full topological naming, incremental geometry caching, surfaces, sheet metal, assemblies,
drawings, other generators, STEP import UI, IGES/DXF, cloud sync and collaboration remain
open. Later workspace tabs are disabled. Features rebuild the full history in the worker;
invalid or ambiguous topology preserves the last valid model. Planar face selection includes oblique faces;
conservative signature matching can still reject changed or ambiguous references. No manufacturing certification is claimed.

See [Usage](USAGE.md) for workflows and the [project direction](../README.md) for future scope.
