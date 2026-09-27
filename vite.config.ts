import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// base './' 讓 build 出來的檔案放在任何子路徑（GitHub Pages）都能跑
/**
 * 列出這一版所有的 assets/ 檔案（public/sw.js 用：場景、小遊戲用到才載入，不在 index.html 裡，
 * 離線快取要靠這張表才知道哪些要留、哪些可以先在背景抓下來）
 */
const assetList = (): Plugin => ({
  name: 'asset-list',
  generateBundle(_, bundle) {
    const files = Object.keys(bundle).filter((f) => f.startsWith('assets/') && /\.(js|css)$/.test(f))
    this.emitFile({ type: 'asset', fileName: 'asset-list.json', source: JSON.stringify(files) })
  },
})

export default defineConfig({
  plugins: [react(), assetList()],
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
