# TODO

## Current

**Doing:** 遊戲性：傍晚的時間壓力（17:30→22:00，做事花時間，22:00 自動天黑）＋「今天的事」（小翰的紙條＋鄰居委託）；主線（第 7 晚陳董來、第 8 晚月底小翰給期限）與四個結局（末班車、一起回家、守著老家、賣掉了）＋製作名單。八個自動測試全過。

**Next:**
1. 真機調：傍晚的時間夠不夠（DUSK_HOURS_PER_SEC、DUSK_COST 在 store.ts）、委託的難度與獎勵、結局條件（GOAL 在 story.ts）
2. 逐步解鎖：第一個月只開家、村子、菜園、廟，其他隨劇情開（避免一開始太多）
3. 背景音樂、設定選單、存檔欄位
4. 新角色的對話頭像；場景用到才載入
5. 更難的客人（道士、美食評論家、考生、孕婦）

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
- 夢境：`npm run test:dream`；國小：`npm run test:tag`；客人之間的故事：`npm run test:encounters`；裝修：`npm run test:decor`；突發事件：`npm run test:incidents`；結局判定：`npm run test:story`
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
