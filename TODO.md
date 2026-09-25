# TODO

## Current

**Doing:** M1 聲光原型第一版完成，可在瀏覽器玩完一晚（開門 → 傍晚 → 深夜 → 調溫／蓋被子 → 清晨評論卡）。

**Next:**
1. 在真的手機跟電腦上跑一次，看效能跟聲音（headless 只驗證了畫面）
2. M1 收尾：
   - 月亮在寬景鏡頭看不到（鏡頭俯角太大），考慮加月光反射或換月亮位置
   - 景深（DoF）在直式畫面會整片變白，目前直式／觸控裝置直接關掉；之後找原因
   - 客人「起夜」還沒做（DESIGN §2.2）
   - 語音在 Windows Edge／Chrome 測試 zh-TW 聲音效果
3. M2 核心循環：三種客人、六個動作、觀察線索、存檔

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
- Three r155+ 的點光源是物理單位，intensity 大概 1–8 就夠；之前設 24 整個爆白
- headless Chromium 的 WebGL 很慢，PerformanceMonitor 會立刻把品質降成 low，測 high 要 `__store.setState({ quality: 'high', setQuality: () => {} })`

## 參考

- 靈感來源：YouTube `fxS4P6IhKxs`「AIが考えるおばあちゃんゲーム」（ババア・セフト・シニアカー），AI 生成的阿嬤版 GTA 惡搞影片
