import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    host: true,       // 🔥 esto es la clave
    port: process.env.PORT || 10000
  }
})
