# Installation and local execution

These instructions run the current CAD prototype. There is no Electron installer or
embedded Python/Lua/Vulkan runtime yet.

## Requirements

- Node.js 22.12 or newer and npm.
- Git and a modern browser with WebAssembly and WebGL support.

## Get the source

```powershell
git clone https://github.com/shiwamshoryasharma/AnishapeGeometry.git
cd AnishapeGeometry
npm ci
```

## Start the prototype

```powershell
npm run dev
```

Open the address printed by Vite. To keep a fixed local address:

```powershell
node scripts/prepare-kernel.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort
```

The predev/prebuild scripts copy the installed geometry kernel and dependency notices
into local public assets. No remote geometry service is required.

Project storage belongs to the exact browser origin: changing the hostname or port
uses a different IndexedDB database. Download .anishape backups before clearing site data.

## Build and inspect locally

```powershell
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4180 --strictPort
```

Port 4180 is also used by the browser tests. Vite preview is for local build inspection.
See [Development](DEVELOPMENT.md) for checks and runtime details and [Usage](USAGE.md)
for modeling workflows. Usage is subject to the [license](../LICENSE).
