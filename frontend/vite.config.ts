import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

const PORT_BACKEND = Number(process.env.PORT_BACKEND ?? 3000)
const PORT_VITE_DEV = Number(process.env.PORT_VITE_DEV ?? 5173)

let GIT_COMMIT = (process.env.GIT_COMMIT ?? '').slice(0, 7)
if (!GIT_COMMIT) {
  try {
    GIT_COMMIT = execSync('git rev-parse --short HEAD').toString().trim()
  } catch { GIT_COMMIT = 'unknown' }
}

export default defineConfig({
  define: {
    __GIT_COMMIT__: JSON.stringify(GIT_COMMIT),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: PORT_VITE_DEV,
    proxy: {
      '/api': {
        target: `http://localhost:${PORT_BACKEND}`,
        changeOrigin: true,
      },
    },
  },
})
