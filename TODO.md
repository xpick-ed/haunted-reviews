# TODO

## Current

**Doing:** M1 畫面精緻化完成：PBR 材質（Poly Haven）、細緻三合院、插畫人物、客家花布、水田／電線桿／香蕉樹／竹叢／榕樹、AO＋移軸後製。

**Next:**
1. 在真的手機跟電腦上跑，看效能（headless 是軟體渲染 0.5fps，量不準）。手機卡的話用 `?q=low` 比較
2. 畫面小修：
   - 阿嬤「伸手」姿勢的手臂有點彆扭（src/art/characters.ts）
   - 路燈的光錐在直式畫面像一個黃色三角形，可能要淡一點或拿掉
   - 月亮在寬景鏡頭看不到（鏡頭俯角太大）
3. M1 收尾：客人「起夜」、語音在 Windows Edge／Chrome 測試
4. M2 核心循環：三種客人、六個動作、觀察線索、存檔

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

- `window.__store`（dev 模式）可以直接操作遊戲狀態，例如 `__store.getState().act('tuck')`、`__store.setState({ time: 23 })`
- `window.__three`（dev 模式）：`gl.info.render.calls` 量 draw call
- 網址參數：`?q=low|high` 畫質；dev 限定 `?fx=0` 關後製、`?nofx=ao,bloom,tilt` 關單一效果、`?shadow=0` 關陰影
- Three r155+ 的點光源是物理單位，intensity 大概 1–8 就夠；之前設 24 整個爆白
- headless Chromium 是軟體渲染（high 約 0.5fps），Playwright 預設 5 秒截圖逾時會失敗，要用 `browser_run_code_unsafe` 自己 `page.screenshot({ timeout: 120000 })`
- 測 high 要擋掉自動降級：`__store.setState({ quality: 'high', setQuality: () => {} })`
- 貼圖重新下載：`python3 scripts/fetch_textures.py`（CC0，來源列在 public/tex/CREDITS.txt）
- 人物 SVG 預覽：`src/art/characters.ts` 不依賴 three，可以用 node 匯出 SVG 再轉 PNG 看

## 參考

- 靈感來源：YouTube `fxS4P6IhKxs`「AIが考えるおばあちゃんゲーム」（ババア・セフト・シニアカー），AI 生成的阿嬤版 GTA 惡搞影片
