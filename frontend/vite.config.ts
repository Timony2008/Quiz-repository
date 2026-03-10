import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        path.resolve(__dirname, '..'), // 允许访问项目根目录，解决 KaTeX 字体 403
      ]
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
        // ❌ 不要 rewrite，因为后端本身就有 /api 前缀
      }
    }
  }
})
