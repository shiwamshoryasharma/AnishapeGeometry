<div align="center">

<img src="public/favicon.svg" width="88" height="88" alt="AnishapeGeometry logo" />

<h1>AnishapeGeometry</h1>

<p><strong>From geometry to simulation.</strong></p>
<p>A desktop CAD and simulation environment in development.<br />Build geometry. Create simulation assets. Connect robotics workflows.</p>

[![Validate CAD milestone](https://github.com/shiwamshoryasharma/AnishapeGeometry/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/shiwamshoryasharma/AnishapeGeometry/actions/workflows/ci.yml)
[![Stage: CAD prototype](https://img.shields.io/badge/stage-CAD_prototype-344b37?style=flat-square)](#the-first-chapter-cad)
[![License: personal noncommercial](https://img.shields.io/badge/license-personal_noncommercial-52687a?style=flat-square)](LICENSE)

<p>
<a href="#the-idea">The idea</a> ·
<a href="#where-it-is-going">Roadmap</a> ·
<a href="#built-toward-the-desktop">Desktop direction</a> ·
<a href="#explore-the-project">Documentation</a>
</p>

</div>

---

## The idea

AnishapeGeometry brings **CAD, asset creation, and simulation** into one evolving
project. The goal is a FreeCAD-like modeling environment where geometry becomes the
starting point for custom simulation and robotics workflows.

It starts with the tools needed to build a part. Over time, that foundation will grow
toward simulation-ready assets, robot descriptions, and connections to NVIDIA Isaac
and ROS. The project is free for **personal, noncommercial use** under its [license](LICENSE).

## The first chapter: CAD

The first phase focuses on sketching and solid modeling. These are the foundations
for building useful assets, and they will continue to evolve alongside the project.

| Sketch with intent | Build editable geometry | Keep the working model |
| :--- | :--- | :--- |
| Lines, points, profiles, constraints, and origin references. | Extrusions, solid features, transformations, and editable feature history. | Local project files, undo/redo, and STEP/STL export. |

**Current state:** an early CAD prototype with working tools, remaining bugs, and an
unfinished feature set. It is not yet a complete CAD or simulation suite. The current
landing page is temporary.

[Explore the current CAD tools and limitations →](docs/CAD-CAPABILITIES.md)

## Where it is going

**CAD foundations → simulation assets → connected robotics workflows**

The near-term simulation focus is practical: use CAD tooling to build assets, then
bring those assets into focused simulation workflows.

| Direction | What it adds | Stage |
| :--- | :--- | :--- |
| **FreeCAD-like CAD tooling** | Richer sketching, more reliable solid modeling, and editable asset construction. | In development |
| **Custom simulation** | Simulation workflows built around assets created in the CAD environment. | Planned |
| **NVIDIA Isaac connection** | A connection between asset creation and Isaac simulation workflows. | Planned |
| **ROS integration** | Connect models and simulation workflows to ROS-based robotics systems. | Planned |
| **URDF building** | Robot descriptions with links, joints, geometry, and relevant physical properties. | Planned |

Isaac connectivity, ROS integration, URDF building, and custom simulation are future
capabilities. They are not available in the current prototype.

## Built toward the desktop

The intended product is a **desktop CAD and simulation environment**, not a web-app
end state. The current browser runtime lets the CAD foundation develop while the
native application architecture takes shape.

| Planned layer | Responsibility |
| :--- | :--- |
| **Electron wrapper** | Package the interface into a desktop application. |
| **Embedded Python** | A local runtime for automation, asset workflows, simulation, and robotics integrations. |
| **Custom Lua scripting** | Project-specific scripting and extension workflows. |
| **Vulkan** | Native GPU access through a dedicated graphics and compute layer. |

These layers are planned; they are not implemented yet. The current prototype uses
React and TypeScript for the interface, OpenCascade WebAssembly for geometry,
planeGCS for sketch constraints, and Three.js for viewport rendering.

## Explore the project

Keep the project overview here; choose a focused guide for the details.

| I want to… | Read |
| :--- | :--- |
| See what works today | [CAD capabilities and limitations](docs/CAD-CAPABILITIES.md) |
| Set up the current prototype | [Installation](docs/INSTALLATION.md) |
| Model parts and manage files | [Usage](docs/USAGE.md) |
| Understand the code and run checks | [Development](docs/DEVELOPMENT.md) |
| Review dependency licensing | [Third-party notices](THIRD_PARTY_NOTICES.md) |

## Personal use, clearly defined

Original AnishapeGeometry code is source-available under the
**[AnishapeGeometry Personal Noncommercial License](LICENSE)**.

- **Permitted:** personal learning, experimentation, and private projects.
- **Requires prior written permission:** commercial use, client delivery, and
  redistribution of software or builds, subject to the exceptions in the license.
- **Third-party components:** retain their own licenses and permissions.

This is a personal-use, source-available project, not an OSI-approved open-source license.

---

<div align="center">
<sub>CAD first. Simulation and robotics ahead.</sub>
</div>
