import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' 讓 build 出來的檔案放在任何子路徑（GitHub Pages）都能跑
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: true },
  build: {
    // three.js 這些函式庫很少變：拆成獨立檔案，遊戲更新時玩家只要重抓自己的程式（加上 public/sw.js 的快取）
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/](three|three-stdlib|postprocessing|n8ao|three-mesh-bvh|troika-[^\\/]+)[\\/]/, priority: 2 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
})
