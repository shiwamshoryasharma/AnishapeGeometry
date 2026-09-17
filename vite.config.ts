import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}
export default defineConfig({
  plugins: [react(), babel({presets:[reactCompilerPreset()]}), tailwindcss()],
  server: {host:'127.0.0.1',headers},
  preview: {host:'127.0.0.1',headers},
  worker: {format:'es'},
})
