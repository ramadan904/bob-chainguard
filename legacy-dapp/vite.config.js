import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  // web3.js 1.x expects Node globals in the browser.
  define: { global: 'globalThis' },
  test: { environment: 'node' },
})
