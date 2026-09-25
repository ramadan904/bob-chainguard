import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Relative base so the built atlas works from any static host or sub-path.
// Two pages: the Signalbox panel (index.html) and the pitch deck (deck.html).
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { panel: resolve(import.meta.dirname, 'index.html'), deck: resolve(import.meta.dirname, 'deck.html') },
    },
  },
})
