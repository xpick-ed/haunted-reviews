# TODO

## Current

**Doing:** 階段 A（垂直切片）第一版完成：可以操控阿嬤走動、進出房間、換場景（民宿 ↔ 土地公廟）、對話框、目標、自動存檔、每個角色不同聲音。

**Next:**
1. 真機試玩：手機搖桿手感、效能（`?q=low` 比較）、語音音量
2. 開 GitHub Pages：repo Settings → Pages → Source 選「GitHub Actions」，之後 push 就自動上線
3. 階段 A 收尾：
   - 點地板走路（觸控輔助）
   - 設定選單（音量分軌、畫質、減少閃爍）
   - 存檔槽 1–3 與匯出存檔碼
   - 第一章逐晚劇本改成阿桂夫婦帶路（DESIGN §14）
4. 階段 B：客人 NPC 會走（起夜、視線判定）、村路場景、鬼夜市

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
- 人物 SVG 預覽：`src/art/characters.ts` 不依賴 three，可以用 node 匯出 SVG 再轉 PNG 看

## 參考

- 靈感來源：YouTube `fxS4P6IhKxs`「AIが考えるおばあちゃんゲーム」（ババア・セフト・シニアカー），AI 生成的阿嬤版 GTA 惡搞影片
