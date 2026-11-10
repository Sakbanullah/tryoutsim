import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local-first: bound to loopback only (NFR-1). `/api/v1` is proxied so the browser stays same-origin: the backend
// sends no CORS headers and has no OPTIONS handler, so a direct cross-origin call from :5173 would be refused.
const proxy = {
  '/api/v1': { target: 'http://127.0.0.1:4317', changeOrigin: false },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy },
})
