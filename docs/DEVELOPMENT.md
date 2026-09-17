# Development

## Current prototype architecture

| Location | Responsibility |
| --- | --- |
| src/cad/document.ts, features.ts, parameters.ts, types.ts, units.ts | Validated features/dependencies, bounded history, safe expressions, Float64 millimeter values |
| src/cad/kernel.ts, kernel-features.ts, kernel-support.ts | Per-body B-Rep feature construction, conservative topology matching, meshes/measurements, STEP and checked STL |
| src/workers/geometry.worker.ts | Serial local WASM jobs and transferable result buffers |
| src/cad/worker-client.ts | Request IDs, progress, errors, 90-second watchdog and worker recreation |
| src/store/editor.ts | Atomic successful edits, separate preview, undo/redo, serialized saves |
| src/persistence/projects.ts | Dexie projects and up to five distinct previous snapshots |
| src/viewport/Viewport.tsx | Disposable Three renderer, cameras, picking and selection |
| src/pages | Landing, CAD editor, dimensioned SVG sketch surface |
| src/styles, src/index.css | Responsive cream/olive design and accessible focus styles |

Rendering uses Float32 buffers. Authoritative parameters, kernel geometry, and export
tessellation remain double precision. Displaying 12 decimal places does not guarantee
12-place geometric accuracy. Model dimensions are limited to 0.001–100000 mm, and
sketch coordinates to ±100000 mm.

STL has no standard unit metadata. Binary coordinates are Float32: export checks
precision loss and rejects damaged meshes, suggesting ASCII or moving toward the
origin. Exact duplicate-vertex triangles at kernel surface poles are removed before
closed-manifold validation. No general mesh healing or self-intersection repair is claimed.

## Verification

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
```

Vitest runs real OpenCascade (not a mocked geometry engine), document/unit tests,
cancellation, expression/unit and history checks, and Dexie persistence against fake IndexedDB. Playwright covers the expanded acceptance workflow,
face-sketch drawing, attached bosses/pockets, support edits, gear editing, reload/undo/redo, STEP/STL downloads, directions/push-pull, named dimensions, error recovery, import, viewport picking, and mobile landing layout.
Browser tests use installed Chrome on Windows or Playwright Chromium elsewhere;
set CHROME_PATH to override. On a clean machine without Chrome, run
`npx playwright install chromium` first.

Screenshots/downloads/traces are in test-results; the HTML report is in
playwright-report. These generated directories are ignored. CI configuration is
provided; hosted CI has not been run in this local session.

## Production build and hosting

```powershell
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4180 --strictPort
```

Serve dist through HTTPS with application/wasm MIME for the kernel. Preserve local
kernel asset paths. Vite dev/preview sets COOP same-origin, COEP require-corp,
nosniff, and referrer policy; a deployment host must configure equivalent headers.
Root hosting is verified; subpath deployment needs its own smoke test and Vite base.
The Vite preview server is a local verification server, not a production service.

The full OC kernel is approximately 50.3 MB uncompressed, and the initial JavaScript
bundle includes Three. A custom kernel build, measured loading optimization,
cross-browser/device QA, deployment security review, and offline strategy remain
release work. IndexedDB may be evicted or cleared; downloaded backups are essential.

## Planned runtime changes

The Electron desktop wrapper, embedded Python, custom Lua scripting and native Vulkan
layer are future work. Native GPU calls belong in the native runtime boundary; Electron
and embedded scripting are not implemented by the current WASM/browser workers. See
[project direction](../README.md).

## Verified local checkpoint

The 2026-09-17 checkpoint passed 160 unit/kernel tests and 58 production Chrome tests,
plus build and lint. This does not establish that every user workflow is bug-free.
