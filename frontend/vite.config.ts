import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
        // ❌ 不要 rewrite，因为后端本身就有 /api 前缀
      }
    }
  }
})
