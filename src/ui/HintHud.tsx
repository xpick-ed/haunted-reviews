import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useSettings } from '../settings'
import { HOTSPOTS } from '../world/hotspots'
import { currentHint, hintNow, type Hint, type HintTarget } from '../world/hints'
import { encounterState } from '../world/night/encounters'
import { familyState } from '../world/night/family'
import { horrorState } from '../world/night/horror'
import { incidentState } from '../world/night/incidents'
import { specialState } from '../world/night/special'
import './HintHud.css'

// 現在該做什麼的提示條（DESIGN §33）：狀態列（右上）下面一顆小膠囊，點開多講一點（為什麼、在哪裡）。
// 每 0.25 秒算一次；新的提示要連續出現 0.75 秒才換（兩條規則來回跳的時候不會閃）。
// 介紹新地方：走到那裡、顯示夠久、或按「知道了」就記 hint_seen_<place>，一天最多介紹一個（hint_day_<第幾晚>）。

/** 熱點的位置（阿嬤站的地方） */
const SPOTS = new Map(HOTSPOTS.map((h) => [h.id, { scene: h.scene, x: h.x, z: h.z } as HintTarget]))
export const hintSpot = (id: string) => SPOTS.get(id) ?? null

/** 別的橫幅正在講話（突發事件、大人的恐怖、心事、特別的夜晚、客人之間的故事） */
function bannerActive(time: number) {
  const inc = incidentState.current
  if (inc && (inc.status === 'active' || inc.outcomeT > 0)) return true
  const hor = horrorState.current
  if (hor && (hor.status === 'active' || hor.outcomeT > 0)) return true
  if (familyState.current?.hint()) return true
  if (specialState.current?.hint(time)) return true
  const enc = encounterState.view
  return !!enc && enc.phase !== 'done'
}

/** 介紹顯示多久就算看過了（秒） */
const INTRO_SEEN_AFTER = 40

export function HintHud() {
  const on = useSettings((s) => s.hints)
  const [shown, setShown] = useState<Hint | null>(null)
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [top, setTop] = useState<number | null>(null)
  const pending = useRef<{ id: string | null; n: number }>({ id: null, n: 0 })
  const cur = useRef<Hint | null>(null)
  const introT = useRef(0)

  useEffect(() => {
    if (!on) {
      hintNow.current = null
      cur.current = null
      setVisible(false)
      return
    }
    let swap = 0
    const tick = () => {
      const s = useStore.getState()
      const cand = currentHint(s, { spot: hintSpot, banner: s.phase === 'night' && bannerActive(s.time) })
      // 放在狀態列下面（狀態列的高度會變：傍晚多一排技能鈕）
      const st = document.querySelector('.hud .status')
      const b = st?.getBoundingClientRect()
      const t = b ? Math.round(b.bottom + 8) : null
      setTop((p) => (p === t ? p : t))

      // 同一條規則：字可能更新了（例如還有多久天黑），直接換
      const c = cur.current
      if (cand && c && cand.id === c.id) {
        if (cand.text !== c.text || cand.why !== c.why || cand.target?.x !== c.target?.x || cand.target?.scene !== c.target?.scene) {
          cur.current = cand
          hintNow.current = cand
          setShown(cand)
        }
      } else {
        const key = cand?.id ?? null
        const p = pending.current
        if (p.id === key) p.n++
        else pending.current = { id: key, n: 1 }
        // 新提示連續出現三次（0.75 秒）才換；要收起來也等兩次
        if (pending.current.n >= (cand ? 3 : 2)) {
          cur.current = cand
          hintNow.current = cand
          introT.current = 0
          setOpen(false)
          window.clearTimeout(swap)
          if (!cand) setVisible(false)
          else {
            // 先淡出舊的，再換字淡入
            setVisible(false)
            swap = window.setTimeout(() => {
              setShown(cand)
              setVisible(true)
            }, c ? 220 : 0)
            // 開始介紹一個新地方：今天就是它了
            if (cand.place && s.phase === 'dusk') {
              const f = s.flags
              if (!f[`hint_now_${cand.place}`] || !f[`hint_day_${s.meta.night}`]) useStore.setState({ flags: { ...f, [`hint_day_${s.meta.night}`]: true, [`hint_now_${cand.place}`]: true } })
            }
          }
        }
      }

      // 介紹過的地方：走到了、或顯示夠久了
      const h = cur.current
      if (h?.place) {
        introT.current += 0.25
        if (s.scene === h.place || introT.current >= INTRO_SEEN_AFTER) markSeen(h.place)
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(swap)
    }
  }, [on])

  if (!on || !shown || top === null) return null
  return (
    <div className={`hint-hud ${visible ? 'in' : ''} ${open ? 'open' : ''}`} style={{ top }}>
      <button className="hint-pill" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="hint-dot" aria-hidden="true">
          {shown.target ? '➜' : '✦'}
        </span>
        <span className="hint-text">{shown.text}</span>
      </button>
      {open && (
        <div className="hint-more">
          {shown.why && <p>{shown.why}</p>}
          <div className="hint-actions">
            {shown.place && (
              <button className="hint-ok" onClick={() => (markSeen(shown.place!), setOpen(false))}>
                知道了
              </button>
            )}
            <button className="hint-close" onClick={() => setOpen(false)}>
              收起來
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function markSeen(place: string) {
  const s = useStore.getState()
  if (s.flags[`hint_seen_${place}`]) return
  useStore.setState({ flags: { ...s.flags, [`hint_seen_${place}`]: true } })
}
