import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * On some machines HMR/React Fast Refresh silently leaves stale UI.
 * Full reload on save is slightly slower but always reflects disk state.
 * Set VITE_NO_FULL_RELOAD=1 to restore default HMR-only behaviour.
 */
function devFullReloadOnSave(): Plugin {
  return {
    name: 'dev-full-reload-on-save',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        // Helps catch “wrong folder” / duplicate clone when UI edits don’t show up.
        // eslint-disable-next-line no-console -- intentional dev diagnostics
        console.info(`\n[hawre] Vite project root: ${server.config.root}\n`)
      })
    },
    handleHotUpdate({ server, file }) {
      if (process.env.VITE_NO_FULL_RELOAD === '1') return undefined
      const base = path.basename(file)
      if (!file.includes('node_modules')) {
        // eslint-disable-next-line no-console -- intentional dev diagnostics
        console.info(`[hawre] full page reload (saved: ${base})`)
      }
      server.ws.send({ type: 'full-reload', path: '*' })
      return []
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devFullReloadOnSave()],
  server: {
    // Default: localhost — stable HMR and avoids Node/Vite calling `os.networkInterfaces()` (can fail on some setups).
    // For phone/LAN testing run: `npm run dev:lan` (same as `vite --host`).
    host: process.env.VITE_DEV_LAN === '1' ? true : 'localhost',
    port: 5173,
    strictPort: true,
    // Some macOS setups (iCloud/Desktop, special paths, or aggressive indexing) miss native FS events;
    // polling makes HMR reliably pick up saves.
    watch: {
      usePolling: true,
      interval: 100,
      binaryInterval: 300,
      // Editors often save in two steps; wait until the file stops changing before invalidating.
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    },
    // Explicit HMR endpoint avoids broken websocket / stale UI after saves (especially on Safari-like stacks).
    hmr:
      process.env.VITE_DEV_LAN === '1'
        ? { protocol: 'ws' as const, clientPort: 5173 }
        : { protocol: 'ws' as const, host: 'localhost', port: 5173 },
    headers: {
      'Cache-Control': 'no-store',
    },
    // Must match scripts/run-django-backend.mjs (default 8001; 8000 is often another Django app).
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/media': {
        target: process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
