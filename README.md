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

TypeScript + Vite + React + react-three-fiber（Three.js）+ @react-three/postprocessing + zustand。
音效目前全部用 Web Audio 現場合成，語音用瀏覽器內建 Web Speech API；正式素材見 DESIGN.md §15–16。

## 目錄

```
src/
  store.ts          遊戲狀態與規則（陰氣、客人、動作、星數）
  audio.ts          合成音效、環境音、語音
  pixel.ts          像素小人（佔位）
  textures.ts       程式產生的貼圖
  scene/            3D 模型屋：天色、房子、樹、人物、鏡頭、後製
  ui/               HUD、開場木門、評論卡
```
