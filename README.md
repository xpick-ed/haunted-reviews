# 靈異好評

阿嬤過世後還守著老家，孫子把三合院改成民宿。阿嬤只想招待客人，但客人看到的是恐怖片。

網頁遊戲，手機跟電腦瀏覽器都能玩。設計文件見 [DESIGN.md](DESIGN.md)，進度見 [TODO.md](TODO.md)。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc
npm run build      # 輸出到 dist/
```

`npm run dev` 會同時開 LAN 位址（終端機會印出 `Network: http://<ip>:5173`），手機連同一個 Wi-Fi 就能開。
在 WSL2 裡跑的話，Windows 端要先做一次 port forwarding 手機才連得到：

```powershell
# 以系統管理員身分在 PowerShell 執行，<wsl-ip> 換成 `hostname -I` 的結果
netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=<wsl-ip>
```

## 技術

TypeScript + Vite + React + react-three-fiber（Three.js）+ @react-three/postprocessing（N8AO、Bloom、TiltShift）+ zustand。
材質是 Poly Haven 的 CC0 貼圖（`scripts/fetch_textures.py`），人物是 SVG 插畫。
音效目前全部用 Web Audio 現場合成，語音用瀏覽器內建 Web Speech API；正式素材見 DESIGN.md §15–16。

手機太卡的話在網址後面加 `?q=low`。

## 目錄

```
src/
  store.ts          遊戲狀態與規則（陰氣、客人、動作、星數）
  audio.ts          合成音效、環境音、語音
  art/              人物 SVG 插畫、客家花布
  scene/
    layout.ts       三合院平面配置（所有座標從這裡來）
    kit.tsx         共用材質、世界座標 UV、風吹、canvas／SVG 貼圖
    House.tsx       三合院本體（牆、窗、門、屋頂、步口廊、燈籠、春聯）
    Interior.tsx    客房家具、神明廳
    Yard.tsx        埕、圍牆、盆栽、曬衣竿、腳踏車、機車
    Landscape.tsx   草地、路、水田、電線桿、遠山、夜霧、螢火蟲
    Plants.tsx      香蕉樹、竹叢、植物共用工具
    Tree.tsx        榕樹
    Characters.tsx  阿嬤、小美、花布被子
    MergeStatic.tsx 靜態網格合併（省 draw call）
    Effects.tsx     後製
  ui/               HUD、開場木門、評論卡
public/tex/         CC0 PBR 貼圖（WebP）
scripts/            貼圖下載腳本
```
