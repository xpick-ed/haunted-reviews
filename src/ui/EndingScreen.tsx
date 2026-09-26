import { useStore } from '../store'

// 結局（DESIGN §28.4）：插畫卡片、台詞、製作名單，最後「繼續經營」或「重新開始」（暫時的空殼）。
export function EndingScreen() {
  const ending = useStore((s) => s.ending)
  const finish = useStore((s) => s.finishEnding)
  if (!ending) return null
  return (
    <div className="screen-backdrop">
      <div className="sheet">
        <h2 className="sheet-title">結局：{ending}</h2>
        <button className="btn" onClick={() => finish('continue')}>
          繼續經營
        </button>
        <button className="btn primary" onClick={() => finish('restart')}>
          重新開始
        </button>
      </div>
    </div>
  )
}
