import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { INCIDENT_INFO, incidentState, type IncidentKind, type IncidentStatus } from '../world/night/incidents'
import './IncidentHud.css'

// 半夜突發事件的 HUD（DESIGN §27.2）：畫面下方的橫幅——發生什麼事、現在該做什麼；
// 處理完顯示結果幾秒。阿嬤不在家（去鬼夜市、托夢……）時提醒「家裡出事了」。

interface View {
  kind: IncidentKind
  status: IncidentStatus
  hint: string
  outcome: string
  outcomeT: number
}

export function IncidentHud() {
  const phase = useStore((s) => s.phase)
  const scene = useStore((s) => s.scene)
  const hidden = useStore((s) => !!s.dialogue || !!s.minigame || !!s.summary || !!s.panel)
  const [v, setV] = useState<View | null>(null)
  useEffect(() => {
    if (phase !== 'night') {
      setV(null)
      return
    }
    const id = window.setInterval(() => {
      const c = incidentState.current
      if (!c || c.status === 'waiting' || c.status === 'cancelled') {
        setV((p) => (p ? null : p))
        return
      }
      const next: View = { kind: c.kind, status: c.status, hint: c.hint(), outcome: c.outcome, outcomeT: c.outcomeT }
      setV((p) => (p && p.status === next.status && p.hint === next.hint && p.outcome === next.outcome && (p.outcomeT > 0) === (next.outcomeT > 0) ? p : next))
    }, 250)
    return () => window.clearInterval(id)
  }, [phase])
  if (!v || hidden) return null
  const info = INCIDENT_INFO[v.kind]
  const active = v.status === 'active'
  // 處理完：結果顯示幾秒；小偷掉的袋子還沒撿時繼續提示
  if (!active && v.outcomeT <= 0 && !v.hint) return null
  const away = active && scene !== 'home'
  return (
    <div className={`incident-hud ${active ? 'on' : v.status === 'resolved' ? 'ok' : 'bad'}`}>
      <span className="incident-icon">{info.icon}</span>
      <div className="incident-body">
        <div className="incident-title">
          {away ? `家裡出事了：${info.title}` : v.outcomeT > 0 && !active ? (v.status === 'resolved' ? '✓ ' : '✗ ') + v.outcome : info.title}
        </div>
        {(active || v.hint) && <div className="incident-hint">{away ? '快回家看看！' : v.hint}</div>}
      </div>
    </div>
  )
}
