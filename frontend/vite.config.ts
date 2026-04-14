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
    // Warm commonly imported modules so first page load is faster
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/pages/TopologyPage.tsx',
        './src/pages/DashboardPage.tsx',
      ],
    },
  },
  build: {
    // Parallel chunk processing (uses all available CPU cores)
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        // Split large deps into separate chunks for better caching
        manualChunks: {
          'react-vendor':   ['react', 'react-dom', 'react-router-dom'],
          'query-vendor':   ['@tanstack/react-query'],
          'flow-vendor':    ['@xyflow/react'],
          'radix-vendor':   [
            '@radix-ui/react-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-toast',
          ],
          'icons-vendor':   ['lucide-react'],
        },
      },
    },
    // Don't warn on chunks under 800 kB
    chunkSizeWarningLimit: 800,
  },
})
