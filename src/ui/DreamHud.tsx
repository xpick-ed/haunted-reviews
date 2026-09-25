import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { dreamState, timeLeft, warmth } from '../world/dream'
import { player } from '../world/player'
import { portraitDataUrl, PORTRAIT_IDS, type PortraitId } from '../art/portraits'
import './DreamHud.css'

// 夢境的 HUD：開場的標題卡、目標、進度、剩下的時間（月亮慢慢被吃掉）、結束卡片、夢的暗角。
// 規則在 src/world/dream.ts（不是 zustand），這裡每 0.1 秒讀一次。

interface View {
  title: string
  objective: string
  mode: string
  guest: string
  progress: number
  count: string
  left: number
  duration: number
  t: number
  done: boolean
  ok: boolean
  status: string | null
  hot: number
}

function read(): View | null {
  const rt = dreamState.rt
  if (!rt) return null
  const def = rt.def
  const D = rt.dreamer
  let count = ''
  let status: string | null = null
  if (def.mode === 'collect') count = `${def.itemName} ${rt.got}/${rt.items.length}`
  else if (def.mode === 'find') count = rt.rounds > 1 ? `找到 ${rt.found}/${rt.rounds}` : ''
  else {
    const name = def.title.split('的夢')[0]
    const pron = def.guest === 'atu' ? '他' : '她'
    status = D.scaredT > 0 ? `${name}嚇到了！` : D.following ? `${name}跟著妳` : `${name}跟丟了，回去找${pron}`
  }
  if (rt.boss && rt.boss.alarm > 0) status = '被老闆看到了！掉了一張'
  return {
    title: def.title,
    objective: def.objective,
    mode: def.mode,
    guest: def.guest,
    progress: rt.progress,
    count,
    left: timeLeft(rt),
    duration: def.duration,
    t: rt.t,
    done: rt.done,
    ok: rt.ok,
    status,
    hot: def.mode === 'find' ? warmth(rt, player.x, player.z) : 0,
  }
}

export function DreamHud() {
  const dream = useStore((s) => s.dream)
  const scene = useStore((s) => s.scene)
  const transitioning = useStore((s) => s.transitioning)
  const [v, setV] = useState<View | null>(null)
  useEffect(() => {
    if (!dream) return
    const id = window.setInterval(() => setV(read()), 100)
    return () => {
      window.clearInterval(id)
      setV(null)
    }
  }, [dream])
  if (!dream || scene !== 'dream' || !v) return null
  const face = (PORTRAIT_IDS as readonly string[]).includes(v.guest) ? portraitDataUrl(v.guest as PortraitId, v.done ? (v.ok ? 'happy' : 'surprised') : 'normal') : null
  const low = v.left < 10
  return (
    <>
      <div className="dream-vignette" />
      {!transitioning && v.t < 2.6 && !v.done && (
        <div className="dream-title-card">
          <div className="dream-kicker">托夢</div>
          <div className="dream-title">{v.title}</div>
          <div className="dream-obj">{v.objective}</div>
        </div>
      )}
      <div className="dream-hud">
        <div className="dream-bar">
          {face && <img className="dream-face" src={face} alt="" draggable={false} />}
          <div className="dream-info">
            <div className="dream-name">{v.title}</div>
            <div className="dream-goal">{v.objective}</div>
            <div className="dream-meters">
              <div className="dream-meter progress">
                <i style={{ width: `${Math.round(v.progress * 100)}%` }} />
              </div>
              {v.count && <span className="dream-count">{v.count}</span>}
            </div>
            <div className={`dream-meter time ${low ? 'low' : ''}`}>
              <i style={{ width: `${(v.left / v.duration) * 100}%` }} />
            </div>
          </div>
          <div className={`dream-clock ${low ? 'low' : ''}`}>{Math.ceil(v.left)}</div>
        </div>
        {v.status && !v.done && <div className="dream-status">{v.status}</div>}
        {v.hot > 0.35 && !v.done && <div className="dream-status hot">{v.hot > 0.7 ? '就在這附近！' : '好像越來越近了……'}</div>}
      </div>
      {v.done && (
        <div className={`dream-end ${v.ok ? 'ok' : 'fail'}`}>
          <div className="dream-end-main">{v.ok ? '好夢 ✨' : '夢醒了……'}</div>
          <div className="dream-end-sub">{v.ok ? '睡得很沉，一個半小時都不會醒' : '沒關係，還有下次'}</div>
        </div>
      )}
    </>
  )
}
