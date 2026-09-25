import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' 讓 build 出來的檔案放在任何子路徑（GitHub Pages）都能跑
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: true },
})
