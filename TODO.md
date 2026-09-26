# TODO

## Current

**Doing:** 第三批內容完成（DESIGN §27）：小火車站「後壁厝站」（傍晚觀察下車的客人、半夜鬼末班車、五分車小遊戲）、老街（冰果室剉冰、老戲院放映回憶、照相館）、海邊漁港＋燈塔（漲退潮、抓螃蟹、守燈人支線）、回到 1958（三個年輕阿春的關卡）；裝修民宿（12 種擺設、擺放模式）、半夜突發事件（小偷、夢遊、小孩走失、醉漢、保險絲）、客人之間的故事（5 段、耳語選項）、好感度＋送禮（14 位、托夢給小翰）。回憶 15 片。所有自動測試全過（night / dream / tag / encounters / decor / incidents / motion）。

**Next:**
1. 真機玩：所有新小遊戲、擺放模式、耳語的時機、夢遊帶路、1958 的慢鞋子（無頭瀏覽器 < 2fps，時機都沒辦法測）
2. 語音已經很大（30MB 以上）：考慮依場景分包、只預載今晚用得到的
3. 新角色（小孩鬼、火伯、玉姨、班主、阿桃、放映師、守燈人、鬼車掌…）沒有對話頭像
4. 老戲院只有大廳，沒有放映廳；照相館老闆只在傍晚
5. 結局：回憶收齊、好感度滿、小翰的心

**Blockers:** 無

## Backlog

- M2 核心循環（三種客人、六個動作、觀察、星數、評論畫面、存檔、手機版面）
- M3 教學月（四晚 + 月結、技能樹、語音接上）
- M4 全年內容（12 種客人、行事曆、員工、升級、壓力線、季節聲光）
- M5 結局與正式素材（立繪、音樂、正式語音）
- M6 上線 GitHub Pages + PWA + 實機測試
- M7 無盡模式與平衡
- edge-tts 試聽：曉雨放慢 vs 曉臻降調，各生一句「免驚，是阿嬤啦」

## 開發筆記

- `?zoom=0.4`（dev 模式）：鏡頭拉近看角色
- `window.__player`（dev 模式）：阿嬤的位置，測試時可以直接 `__player.x = 7.5` 瞬移
- `window.__store`（dev 模式）可以直接操作遊戲狀態，例如 `__store.getState().sit()`、`__store.setState({ time: 23 })`；`window.__night.sim` 是深夜模擬（客人在 `.guests`）
- 夢境：`npm run test:dream`；國小：`npm run test:tag`；客人之間的故事：`npm run test:encounters`；裝修：`npm run test:decor`；突發事件：`npm run test:incidents`
- 截圖（不佔用共用瀏覽器）：scratchpad 的 `pw/shot.mjs <port> <out.png> <setup.js>`；5173 常被別的專案佔用，dev server 用別的 port
- 深夜平衡：`npm run test:night`（`ONLY=M1-N2 TRACE=zhang TRACE_SEED=102` 印出某位客人整晚的狀態）
- `window.__three`（dev 模式）：`gl.info.render.calls` 量 draw call
- 網址參數：`?q=low|high` 畫質；dev 限定 `?fx=0` 關後製、`?nofx=ao,bloom,tilt` 關單一效果、`?shadow=0` 關陰影
- Three r155+ 的點光源是物理單位，intensity 大概 1–8 就夠；之前設 24 整個爆白
- headless Chromium 是軟體渲染（high 約 0.5fps），Playwright 預設 5 秒截圖逾時會失敗，要用 `browser_run_code_unsafe` 自己 `page.screenshot({ timeout: 120000 })`
- 測 high 要擋掉自動降級：`__store.setState({ quality: 'high', setQuality: () => {} })`
- 貼圖重新下載：`python3 scripts/fetch_textures.py`（CC0，來源列在 public/tex/CREDITS.txt）
- 新增台詞：寫進 `src/data/story.lines.json`（who 用 cast.json 的 id），再跑 `scripts/gen_voices.py` 生成語音
- 新增互動點：`src/world/hotspots.ts`；新增對話：`src/world/dialogues.ts`；新增場景：`src/world/scenes.ts` + `src/scene/` 的視覺
- 移動手感測試：`npm run test:motion`（scripts/sim-motion.ts，用真的移動程式模擬 60／30fps 換方向、急轉身，量上下抖、轉身搖擺、鏡頭頓挫）。改移動或鏡頭後要跑
- 動畫不要寫 `sin(總時間 × 會變的頻率)`：頻率一變相位就跳。相位要累加（見 world/motion.ts 的 floatBob）
- 每幀順序靠 useFrame 的負 priority：Ticker -4 → World -3 → 阿嬤 -2 → 鏡頭 -1 → 其他 0。新增會動的東西要注意順序
- `pkill -f "vite ..."` 會連自己的 shell 一起殺掉（指令列裡也有那串字），停 server 要單獨下指令
- 3D 角色：長相在 `src/chars/specs.ts`、臉在 `src/chars/faces.ts`、姿勢在 `src/chars/Chibi.tsx` 的 POSES
- 人物 SVG 預覽（對話頭像）：`src/art/characters.ts` 不依賴 three，可以用 node 匯出 SVG 再轉 PNG 看

## 參考

- 靈感來源：YouTube `fxS4P6IhKxs`「AIが考えるおばあちゃんゲーム」（ババア・セフト・シニアカー），AI 生成的阿嬤版 GTA 惡搞影片
