import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { familyState } from '../world/night/family'
import { horrorState } from '../world/night/horror'
import { incidentState } from '../world/night/incidents'
import { specialOf, specialState } from '../world/night/special'
import type { SpecialNight } from '../world/night/plan'
import './SpecialHud.css'

// 特別的夜晚的 HUD（DESIGN §31.3）：畫面下方一條橫幅。
//   前一天傍晚：預告（颱風明天登陸／明天中元有神秘客人），小翰講一句
//   當天傍晚：今晚會發生什麼、要準備什麼（颱風夜：家裡有幾根蠟燭）
//   深夜：現在該做什麼（special.ts 的 hint）；突發事件、恐怖事件、大人的心事的橫幅也在的時候往上排

const ICON: Record<SpecialNight, string> = { typhoon: '🌀', ghost: '🏮' }
const TITLE: Record<SpecialNight, string> = { typhoon: '颱風夜', ghost: '中元鬼客人夜' }
const EVE: Record<SpecialNight, string> = {
  typhoon: '📻 氣象報告：颱風明天晚上登陸。明天傍晚記得去柑仔店買蠟燭。',
  ghost: '🏮 明天是中元普渡。客房二被一位地址很奇怪的客人訂走了……',
}
const DUSK: Record<SpecialNight, string> = {
  typhoon: '半夜會停電、屋頂漏水、窗板被風吹得一直拍；兩點左右風最大，大家會躲到神明廳。',
  ghost: '客房二住的是好兄弟（看得到阿嬤、不怕她）。照顧他們，也別讓客房一的客人撞見他們。',
}

/** 小翰傍晚講的那一句（每晚一次；不存檔） */
let barked = ''

export function SpecialHud() {
  const phase = useStore((s) => s.phase)
  const scene = useStore((s) => s.scene)
  const nightNo = useStore((s) => s.meta.night)
  const tonight = useStore((s) => s.plan.special ?? null)
  const candles = useStore((s) => s.meta.pantry.candle ?? 0)
  const hidden = useStore((s) => !!s.dialogue || !!s.minigame || !!s.summary || !!s.panel || !!s.month || s.intro)
  const tomorrow = specialOf(nightNo + 1)
  const [v, setV] = useState<{ hint: string; level: number } | null>(null)

  // 傍晚：小翰講一句（今晚是特別的夜晚，或明天是）
  useEffect(() => {
    if (phase !== 'dusk' || hidden) return
    const line = tonight ? `sp.han.${tonight}.dusk` : tomorrow ? `sp.han.${tomorrow}.eve` : null
    const key = `${nightNo}:${line}`
    if (!line || barked === key) return
    const id = window.setTimeout(() => {
      barked = key
      useStore.getState().bark(line)
    }, 6000)
    return () => window.clearTimeout(id)
  }, [phase, hidden, tonight, tomorrow, nightNo])

  // 深夜：模擬的提示
  useEffect(() => {
    if (phase !== 'night') {
      setV(null)
      return
    }
    const id = window.setInterval(() => {
      const sp = specialState.current
      const hint = sp?.hint(useStore.getState().time) ?? ''
      if (!hint) {
        setV((p) => (p ? null : p))
        return
      }
      const inc = incidentState.current
      const hor = horrorState.current
      const level = (inc && (inc.status === 'active' || inc.outcomeT > 0) ? 1 : 0) + (hor && (hor.status === 'active' || hor.outcomeT > 0) ? 1 : 0) + (familyState.current?.hint() ? 1 : 0)
      setV((p) => (p && p.hint === hint && p.level === level ? p : { hint, level }))
    }, 250)
    return () => window.clearInterval(id)
  }, [phase])

  if (hidden) return null
  if (phase === 'dusk') {
    if (tonight)
      return (
        <div className={`special-hud ${tonight}`}>
          <span className="special-icon">{ICON[tonight]}</span>
          <div className="special-body">
            <div className="special-title">今晚：{TITLE[tonight]}</div>
            <div className="special-hint">{DUSK[tonight]}</div>
            {tonight === 'typhoon' && <div className={`special-check ${candles >= 2 ? 'ok' : ''}`}>🕯 家裡的蠟燭：{candles} 根{candles >= 2 ? '（夠了）' : '（停電要用，去柑仔店買）'}</div>}
          </div>
        </div>
      )
    if (tomorrow)
      return (
        <div className={`special-hud eve ${tomorrow}`}>
          <div className="special-hint">{EVE[tomorrow]}</div>
        </div>
      )
    return null
  }
  if (phase !== 'night' || !v || !tonight) return null
  return (
    <div className={`special-hud ${tonight} l${v.level}`}>
      <span className="special-icon">{ICON[tonight]}</span>
      <div className="special-body">
        <div className="special-title">{TITLE[tonight]}</div>
        <div className="special-hint">{scene !== 'home' ? '家裡出事了：快回家看看！' : v.hint}</div>
      </div>
    </div>
  )
}
