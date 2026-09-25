import { useStore } from '../store'

// 夢境的 HUD：目標與倒數（暫時的空殼）。
export function DreamHud() {
  const dream = useStore((s) => s.dream)
  const end = useStore((s) => s.endDream)
  if (!dream) return null
  return (
    <div className="dream-hud">
      <button className="chip" onClick={() => end(true)}>
        （測試）醒來
      </button>
    </div>
  )
}
