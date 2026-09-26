import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { familyState } from '../world/night/family'
import { horrorState } from '../world/night/horror'
import { incidentState } from '../world/night/incidents'
import './FamilyHud.css'

// 大人的心事（DESIGN §29）的提示：福伯半夜找阿玉、志偉坐在茶桌前時，畫面下方一條溫和的提示。
// 突發事件、恐怖事件的橫幅也在的時候往上排。

export function FamilyHud() {
  const phase = useStore((s) => s.phase)
  const scene = useStore((s) => s.scene)
  const hidden = useStore((s) => !!s.dialogue || !!s.minigame || !!s.summary || !!s.panel)
  const [v, setV] = useState<{ hint: string; level: number } | null>(null)
  useEffect(() => {
    if (phase !== 'night') {
      setV(null)
      return
    }
    const id = window.setInterval(() => {
      const hint = familyState.current?.hint() ?? ''
      if (!hint) {
        setV((p) => (p ? null : p))
        return
      }
      const inc = incidentState.current
      const hor = horrorState.current
      const level = (inc && (inc.status === 'active' || inc.outcomeT > 0) ? 1 : 0) + (hor && (hor.status === 'active' || hor.outcomeT > 0) ? 1 : 0)
      setV((p) => (p && p.hint === hint && p.level === level ? p : { hint, level }))
    }, 250)
    return () => window.clearInterval(id)
  }, [phase])
  if (!v || hidden) return null
  return (
    <div className={`family-hud l${v.level}`}>
      <span className="family-icon">🫖</span>
      <div className="family-hint">{scene !== 'home' ? '家裡的客人需要妳：快回家看看' : v.hint}</div>
    </div>
  )
}
