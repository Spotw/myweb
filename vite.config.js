import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  // Đường dẫn gốc khi deploy (mặc định '/', dùng được cho Cloudflare)
  base: '/',

  // Cấu hình build
  build: {
    outDir: 'dist',      // thư mục output, khớp với "Output directory" trên Cloudflare
    sourcemap: false,    // true nếu muốn debug bản production
  },

  // Cấu hình server local (npm run dev)
  server: {
    port: 5173,
    open: true,          // tự mở trình duyệt
    proxy: {
      // chuyển request /api sang backend khi chạy local
      '/api': 'http://localhost:8787',
    },
  },

  // Đặt bí danh cho đường dẫn import
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
