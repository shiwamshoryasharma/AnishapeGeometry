import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', timeout: 120000, expect: { timeout: 30000 },
  fullyParallel: false, workers: 1, reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: './test-results',
  use: {
    baseURL: 'http://127.0.0.1:4180', viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.CHROME_PATH || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: {
    command: process.env.CAD_PRODUCTION==='1'?'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4180 --strictPort':'node scripts/prepare-kernel.mjs && node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180', reuseExistingServer: !process.env.CI, timeout: 120000,
  },
})
