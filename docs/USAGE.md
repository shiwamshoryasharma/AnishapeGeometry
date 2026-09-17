# Using the CAD prototype

## Sketch and build a solid

1. Create a local project and choose its units.
2. Start Sketch, then select XY, XZ, YZ, a reference plane, or a planar solid face.
3. Draw a profile and set its dimensions.
4. Finish the sketch, choose Extrude, set its depth and operation, and Apply.

On an existing solid, select a planar face and choose **Sketch on face**. Attached
profiles can create joined features or inward cuts and follow supporting feature edits.

## Lines, points, and references

- **Line:** click successive endpoints; Escape ends the chain. Tab opens exact endpoint
  X/Y or length/angle input while drawing.
- **Point:** click to place a reference point, or move the cursor and press Tab for exact
  coordinates. Select a point to edit its X/Y coordinates.
- **Origin / axes:** select a point, endpoint, or center and anchor it to local (0,0),
  or add signed X/Y dimensions. X=0 places it on the Y axis; Y=0 places it on the X axis.
- Coordinate dimension labels are editable. The sketch coordinate-system panel shows
  how the local origin and axes relate to world coordinates.

Points do not create closed profiles or sweep edges. Snapping is positional; it does
not automatically create persistent constraints.

## Constraints and sketch editing

Use **Constrain sketch** for geometric relationships and solver feedback. Use
**Modify sketch** for Trim, Extend, Split, Offset, Rotate, Scale, and circular copies.
More sketch tools exposes multi-entity profiles, polygons, slots, and transformations.

Opening entity tools on a primitive retains its current geometry. Clear sketch starts
an empty entity sketch. Conversion fixes existing named primitive dimension bindings;
entity constraint values do not bind named parameters yet. Trim/Extend/Split require
removing constraints attached to the edited entity. Mirror/pattern copies are independent.

## Project files and history

Local autosave stores projects in this browser and origin. Save As .anishape creates
an editable backup including bounded undo history. Open .anishape imports a project.
Supported browsers offer a native file picker; others use a download fallback.

Use STEP for exact B-Rep exchange and STL for tessellated geometry. STL has no standard
unit metadata; choose units deliberately. Keep the editable .anishape source as well.

## Current limits

Bugs and incomplete features remain. See [CAD capabilities](CAD-CAPABILITIES.md).
The Electron, Python, Lua, Vulkan, Isaac, ROS, URDF, and custom simulation work described
in the [README](../README.md) is planned, not an available workflow.
