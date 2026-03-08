import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

const PORT_BACKEND = Number(process.env.PORT_BACKEND ?? 3000)
const PORT_VITE_DEV = Number(process.env.PORT_VITE_DEV ?? 5173)

let GIT_COMMIT = 'unknown'
try {
  GIT_COMMIT = execSync('git rev-parse --short HEAD').toString().trim()
} catch { /* ignore */ }

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
