import { mkdir, copyFile } from 'node:fs/promises'
const source=new URL('../node_modules/opencascade.js/dist/',import.meta.url)
const target=new URL('../public/kernel/',import.meta.url)
await mkdir(target,{recursive:true})
for(const name of ['opencascade.full.js','opencascade.full.wasm'])await copyFile(new URL(name,source),new URL(name,target))
await copyFile(new URL('../node_modules/opencascade.js/LICENSE',import.meta.url),new URL('LICENSE',target))
console.log('Prepared local OpenCascade WASM assets.')

const solverTarget=new URL('../public/licenses/planegcs/',import.meta.url)
await mkdir(solverTarget,{recursive:true})
await copyFile(new URL('../node_modules/@salusoft89/planegcs/LICENSE',import.meta.url),new URL('LICENSE',solverTarget))
