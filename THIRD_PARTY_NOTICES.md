# Third-party notices

The application uses packages with their own licenses; retain package and distribution
notices when distributing builds. Original AnishapeGeometry code is covered by the
Personal Noncommercial License in LICENSE. That license does not replace, restrict,
or relicense the permissions granted by third-party licenses.

## Geometry engine

- OpenCascade.js: version 2.0.0-beta.b5ff984, LGPL-2.1-only as declared by the installed package.
- Source: https://github.com/donalffons/opencascade.js
- Underlying Open CASCADE Technology: https://dev.opencascade.org/
- The application uses unmodified opencascade.full.js and opencascade.full.wasm from the
  pinned npm package. scripts/prepare-kernel.mjs copies them and its LICENSE locally.
- The worker imports the engine separately at runtime. No remote geometry service is used.

## UI and application packages

React/React DOM, Three.js, Zustand, Dexie, Tailwind CSS, and Lucide React are installed
through the lockfile. Their package directories contain their applicable licenses.
No logos, photographs, product screenshots, or proprietary assets from the landing-page
reference sites are embedded. The brand and diagrams are original SVG code.

These notes identify dependencies and source locations. Check the actual license files
and distribution obligations before public release.

## Sketch constraint solver

- @salusoft89/planegcs: pinned version 1.2.0, unmodified planeGCS WebAssembly solver and TypeScript wrapper.
- Source and build instructions: https://github.com/Salusoft89/planegcs
- Underlying solver is derived from FreeCAD PlaneGCS: https://github.com/FreeCAD/FreeCAD
- The distributed LICENSE and source headers specify LGPL-2.1-or-later. The npm metadata
  declares LGPL-2.0-or-later; the shipped LICENSE and source headers take precedence here.
- The application loads the WASM module inside a separate sketch worker. Vite emits the
  module as a separate replaceable asset; no solver source or binary is modified.
- scripts/prepare-kernel.mjs copies the complete license to public/licenses/planegcs/LICENSE
  for inclusion in production distributions. Retain this notice and the upstream license.
