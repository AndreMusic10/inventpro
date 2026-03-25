import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,   // limpia dist antes de cada build
  },
  server: {
    port: 5173,
  },
})
