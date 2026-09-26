# 靈異好評

阿嬤過世後還守著老家，孫子把三合院改成民宿。阿嬤只想招待客人，但客人看到的是恐怖片。

網頁 RPG，手機跟電腦瀏覽器都能玩：操控阿嬤在三合院裡走來走去、進出房間、到村子裡的土地公廟。
設計文件見 [DESIGN.md](DESIGN.md)，進度見 [TODO.md](TODO.md)。

**線上玩**：https://xpick-ed.github.io/haunted-reviews/（push 到 main 自動部署）
**角色聲音試聽**：https://xpick-ed.github.io/haunted-reviews/voices.html

## 操作

| | 電腦 | 手機 |
|---|---|---|
| 移動 | WASD／方向鍵 | 左半邊螢幕任意處拖曳（浮動搖桿） |
| 快飄（扣陰氣） | 連點方向鍵兩次（按住第二下）／Shift | 搖桿推到底 |
| 互動／下一句 | E／空白鍵 | 右下角動作鍵、點對話框 |
| 換動作（同一處有好幾個能做的事） | Q／Tab | 動作鍵左邊的 ⟳ |
| 手把 | 左搖桿、A 互動、RT 快飄 | |

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

## 部署

`.github/workflows/deploy.yml`：push 到 main 會建置並發布到 GitHub Pages。
第一次要到 repo 的 **Settings → Pages → Source** 選 **GitHub Actions**。

也可以同時放 Cloudflare Pages（台灣有節點，比較快）：Workers & Pages → Create → Pages → Connect to Git，
選這個 repo，Build command `npm run build`、Build output `dist`、環境變數 `NODE_VERSION=22`。
之後 push 到 main 兩邊都會自動更新。快取設定在 `public/_headers`（只有 Cloudflare 看得懂）。

離線快取：`public/sw.js`（只在正式版註冊）。玩過一次之後程式、貼圖、語音都從手機裡拿。
改了貼圖要把 `src/scene/kit.tsx` 的 `TEX_VERSION` 加一；改了快取規則要把 `sw.js` 的 `V` 加一。

## 聲音

- 角色語音：`src/data/*.lines.json` 是台詞，`src/data/cast.json` 是每個角色的聲線（edge-tts + ffmpeg 處理）。
  改了台詞就重新生成：
  ```bash
  python3 -m venv .venv-voice && .venv-voice/bin/pip install edge-tts
  .venv-voice/bin/python scripts/gen_voices.py
  ```
- 音效：Kenney 的 CC0 音效包，`python3 scripts/fetch_sfx.py` 重新下載。來源列在 `public/sfx/CREDITS.txt`。

## 技術

TypeScript + Vite + React + react-three-fiber（Three.js）+ @react-three/postprocessing（N8AO、Bloom、TiltShift）+ zustand。
材質是 Poly Haven 的 CC0 貼圖（`scripts/fetch_textures.py`），人物是程式建的 3D Q 版角色，對話頭像是 SVG 插畫。
音效目前全部用 Web Audio 現場合成，語音用瀏覽器內建 Web Speech API；正式素材見 DESIGN.md §15–16。

手機太卡的話在網址後面加 `?q=low`。

## 目錄

```
src/
  store.ts          遊戲狀態（流程、時間、陰氣、對話、互動），深夜的部分接 world/night/director.ts
  audio.ts          合成音效、環境音、語音
  audio/            語音（voice.ts）、音效（sfx.ts）
  chars/            3D Q 版角色（長相、臉、姿勢、卡通材質）、阿咪（Cat）、小黑（Dog）、壁虎（Gecko）
  ui/minigames/     小遊戲（index.tsx 登記）：煮宵夜、打蚊子、擲筊、撈金魚、射氣球、釣溪哥、放水燈、
                    歌仔戲鑼鼓、包粽子、跳房子、夾娃娃機、彈珠台、碟仙
  art/              對話頭像與 SVG 插畫、客家花布
  data/             台詞（*.lines.json）、角色聲線（cast.json）
  world/            遊戲規則：輸入、碰撞、玩家移動、場景定義（scenes.ts ＋ scene<Name>.ts）、熱點、對話、存檔、夢境（dream.ts）
    night/          深夜模擬（純 TS，Node 可測）：客人、行程、視線與懷疑、聲音、需求、
                    動作、廟公、狗、住客排程、技能、升級、評分、月結（director.ts 接到 store）
  scene/
    layout.ts       三合院平面配置（所有座標從這裡來）
    kit.tsx         共用材質、世界座標 UV、風吹、canvas／SVG 貼圖
    House.tsx       三合院本體（牆、窗、門、屋頂、步口廊、燈籠、春聯）
    Interior.tsx    客房家具、神明廳
    Yard.tsx        埕、圍牆、盆栽、曬衣竿、腳踏車、機車
    Landscape.tsx   草地、路、水田、電線桿、遠山、夜霧、螢火蟲
    Plants.tsx      香蕉樹、竹叢、植物共用工具
    Tree.tsx        榕樹
    Characters.tsx  阿嬤（端宵夜的碗也在這）
    Guests.tsx      深夜的客人（床上／走動／睡著）、被子、視線扇形、需求泡泡、廟公、小黑、阿咪、閃電
    Village.tsx     村路＋柑仔店（VillageKit.tsx 是村子的共用零件）
    Garden.tsx      後院菜園＋雞舍（GardenChickens.tsx）
    Market.tsx      鬼夜市（MarketStalls.tsx 攤位、MarketFx.tsx 燈籠與冥紙）
    Dream.tsx       夢境（DreamProps.tsx）
    River.tsx       溪邊＋螢火蟲（RiverFx、RiverPlants；村子那頭的小路在 RiverPath.tsx）
    School.tsx      廢棄國小（SchoolProps、SchoolKids；鬼抓人／躲貓貓的規則在 world/tag.ts）
    Hill.tsx        山上墓仔埔（HillProps；廟後的山路在 HillPath.tsx）
    Stage.tsx       廟埕野台戲（StageShow、StageTex；掛在 Temple.tsx 裡，節日才開演）
    Vision.tsx      陰陽眼才看得到的東西：回憶碎片、腳印、地基主
    Telekinesis.tsx 念力：拖被子、滾球、推窗、撿東西（world/night/tk.ts）
    Temple.tsx      土地公廟場景
    World.tsx       每幀的遊戲邏輯（移動、房間判定、淡出、熱點、出口）
    Markers.tsx     熱點光點、出口路牌
    MergeStatic.tsx 靜態網格合併（省 draw call）
    Effects.tsx     後製
  ui/               標題、HUD、搖桿、動作鍵、對話框、評論卡
public/tex/         CC0 PBR 貼圖（WebP）
public/voice/       生成好的角色語音（mp3）
public/sfx/         CC0 音效
scripts/            貼圖、音效下載與語音生成腳本
```
