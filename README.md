# AnishapeGeometry

AnishapeGeometry is an early-stage CAD and simulation project for building geometry,
creating simulation assets, and developing robotics workflows in one desktop environment.
The long-term direction is a FreeCAD-like modeling tool connected to custom simulation,
NVIDIA Isaac, ROS, and URDF asset creation, free for personal, noncommercial use.

## Where the project starts

The first development phase is CAD tooling: sketches, constraints, editable solid
features, and a foundation for building assets. These tools will evolve over time as
simulation and robotics workflows take shape.

The current prototype includes sketch drawing and constraints, solid modeling, feature
history, local project persistence, and STEP/STL export. It is still under active
development: bugs remain, several CAD features are incomplete, and it is not a finished
engineering or simulation suite. The current landing page is temporary.

## Future scope and direction

The near-term simulation goal is to build usable assets with CAD support, then bring
those assets into simulation and robotics workflows.

| Area | Direction |
| --- | --- |
| CAD | Develop a FreeCAD-like tool with richer sketching, reliable modeling, and editable asset construction. |
| Custom simulation | Add focused simulation workflows around the assets created in the CAD environment. |
| NVIDIA Isaac connection | Connect asset creation and simulation workflows with NVIDIA Isaac. |
| ROS integration | Connect models and simulation workflows to ROS-based robotics systems. |
| URDF building | Build robot descriptions with links, joints, geometry, and relevant physical properties for simulation. |

These are planned capabilities. Isaac connectivity, ROS integration, URDF building, and
the custom simulation system are not implemented in the current CAD prototype.

## Planned desktop architecture

The intended product is a desktop CAD and simulation environment. The current browser
runtime is a development prototype; it does not define the final product architecture.

- **Electron wrapper:** package the interface into a desktop application.
- **Embedded Python:** provide a local runtime for automation, geometry-related workflows,
  and simulation or robotics integrations.
- **Custom Lua scripting:** support project-specific scripting and extension workflows.
- **Vulkan:** provide native GPU access through a dedicated graphics/compute layer.

The Electron shell, embedded Python, Lua runtime, and Vulkan layer are planned work.
Today, the prototype uses React/TypeScript, OpenCascade WebAssembly for geometry,
planeGCS for sketch constraints, and Three.js for viewport rendering. The desktop and
native runtime boundaries will be developed as the project evolves.

## Documentation

| Category | Document |
| --- | --- |
| Current tools and limitations | [CAD capabilities](docs/CAD-CAPABILITIES.md) |
| Installation and local execution | [Installation](docs/INSTALLATION.md) |
| Modeling and project files | [Usage](docs/USAGE.md) |
| Architecture, checks, and development | [Development](docs/DEVELOPMENT.md) |
| Dependency licenses | [Third-party notices](THIRD_PARTY_NOTICES.md) |

## License

AnishapeGeometry's original code is source-available under the
[AnishapeGeometry Personal Noncommercial License](LICENSE).
Personal learning, experimentation, and private projects are permitted. Commercial use,
client delivery, and redistribution of software or builds require prior written permission,
subject to the specific exceptions in the license. Third-party components retain their
own licenses. This is not an OSI-approved open-source license.
