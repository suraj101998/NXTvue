import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    proxy: {
      // Forward /api/* to the FastAPI backend running on port 8000
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})