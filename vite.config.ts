import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: loadEnv(mode, process.cwd(), '').VITE_API_BASE_URL || 'http://34.47.170.169',
        changeOrigin: true,
      },
    },
  },
}))
