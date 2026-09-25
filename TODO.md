# TODO

## Current

**Doing:** 3D Q 版角色＋一輪修正：開始後黑畫面（shader 預先編譯＋載入畫面）、移動抖動（每幀順序）、NPC 碰撞、角色細修、效能。

**Next:**
1. 真機確認：還會不會閃白／抖、載入要等多久、手機順不順（`?q=low` 比較）
2. 階段 A 收尾：點地板走路、設定選單（音量、畫質、減少閃爍）、存檔槽、第一章改成阿桂夫婦帶路
3. 階段 B：客人會走（起夜、視線判定）、村路、鬼夜市

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
- `window.__store`（dev 模式）可以直接操作遊戲狀態，例如 `__store.getState().act('tuck')`、`__store.setState({ time: 23 })`
- `window.__three`（dev 模式）：`gl.info.render.calls` 量 draw call
- 網址參數：`?q=low|high` 畫質；dev 限定 `?fx=0` 關後製、`?nofx=ao,bloom,tilt` 關單一效果、`?shadow=0` 關陰影
- Three r155+ 的點光源是物理單位，intensity 大概 1–8 就夠；之前設 24 整個爆白
- headless Chromium 是軟體渲染（high 約 0.5fps），Playwright 預設 5 秒截圖逾時會失敗，要用 `browser_run_code_unsafe` 自己 `page.screenshot({ timeout: 120000 })`
- 測 high 要擋掉自動降級：`__store.setState({ quality: 'high', setQuality: () => {} })`
- 貼圖重新下載：`python3 scripts/fetch_textures.py`（CC0，來源列在 public/tex/CREDITS.txt）
- 新增台詞：寫進 `src/data/story.lines.json`（who 用 cast.json 的 id），再跑 `scripts/gen_voices.py` 生成語音
- 新增互動點：`src/world/hotspots.ts`；新增對話：`src/world/dialogues.ts`；新增場景：`src/world/scenes.ts` + `src/scene/` 的視覺
- 每幀順序靠 useFrame 的負 priority：Ticker -4 → World -3 → 阿嬤 -2 → 鏡頭 -1 → 其他 0。新增會動的東西要注意順序
- `pkill -f "vite ..."` 會連自己的 shell 一起殺掉（指令列裡也有那串字），停 server 要單獨下指令
- 3D 角色：長相在 `src/chars/specs.ts`、臉在 `src/chars/faces.ts`、姿勢在 `src/chars/Chibi.tsx` 的 POSES
- 人物 SVG 預覽（對話頭像）：`src/art/characters.ts` 不依賴 three，可以用 node 匯出 SVG 再轉 PNG 看

## 參考

- 靈感來源：YouTube `fxS4P6IhKxs`「AIが考えるおばあちゃんゲーム」（ババア・セフト・シニアカー），AI 生成的阿嬤版 GTA 惡搞影片
