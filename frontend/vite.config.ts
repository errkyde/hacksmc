import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const PORT_BACKEND = Number(process.env.PORT_BACKEND ?? 3000)
const PORT_VITE_DEV = Number(process.env.PORT_VITE_DEV ?? 5173)

export default defineConfig({
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
