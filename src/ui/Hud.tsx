import { useEffect, useState } from 'react'
import { ACTIONS, useStore, type ActionKind } from '../store'
import { Result } from './Result'

const PHASE_NAME = { dusk: '傍晚', night: '深夜', dawn: '清晨' } as const
const STATE_NAME = { awake: '醒著', asleep: '睡著', scared: '嚇到' } as const

function clockText(t: number) {
  const h = Math.floor(t) % 24
  const m = Math.floor((t % 1) * 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function Hud() {
  const phase = useStore((s) => s.phase)
  const quarter = useStore((s) => Math.floor(s.time * 4))
  const yin = useStore((s) => s.yin)
  const guest = useStore((s) => s.guest)
  const busy = useStore((s) => s.busy)
  const result = useStore((s) => s.result)
  const speed = useStore((s) => s.speed)
  const voice = useStore((s) => s.voice)
  const focusRoom = useStore((s) => s.focusRoom)
  const nightCount = useStore((s) => s.nightCount)
  const { startNight, act, toggleSpeed, toggleVoice, setFocus } = useStore.getState()

  const canAct = phase === 'night' && !busy && !result
  const hint =
    phase === 'dusk'
      ? '小美今晚住右邊那間。等她睡著再蓋被子。'
      : phase === 'dawn'
        ? '天亮了，看看她給幾顆星。'
        : guest.state === 'asleep'
          ? '小美睡著了，現在蓋被子最安全。'
          : guest.state === 'scared'
            ? '……她看到被子自己動了。'
            : '小美還醒著。現在蓋被子會嚇到她，先調溫，等她睡著。'

  return (
    <div className="hud">
      <div className="topbar">
        <div className="title">
          <span className="title-main">靈異好評</span>
          <span className="title-sub">M1 聲光原型</span>
        </div>
        <div className="clock">
          <span className="clock-phase">{PHASE_NAME[phase]}</span>
          <span className="clock-time">{clockText(quarter / 4)}</span>
        </div>
      </div>

      <Subtitles />

      <div className="panel">
        <div className="row between">
          <span className="muted">農曆二月 · 第 {nightCount} 晚</span>
          <button className="chip" onClick={toggleVoice}>
            {voice ? '🔊 語音開' : '🔇 語音關'}
          </button>
        </div>

        <div className="meter-row">
          <span className="label ghost">陰氣</span>
          <div className="meter">
            <i style={{ width: `${yin}%` }} />
          </div>
          <span className="num">{yin}</span>
        </div>

        <div className="guest">
          <div className="avatar">美</div>
          <div className="guest-info">
            <div className="row between">
              <span className="guest-name">
                小美 <span className="muted">一般旅客</span>
              </span>
              <span className={`state state-${guest.state}`}>{STATE_NAME[guest.state]}</span>
            </div>
            <div className="mini-meters">
              <div className="meter-row">
                <span className="label">舒適</span>
                <div className="meter warm">
                  <i style={{ width: `${Math.min(100, guest.comfort)}%` }} />
                </div>
                <span className="num">{guest.comfort}</span>
              </div>
              <div className="meter-row">
                <span className="label">驚嚇</span>
                <div className="meter fear">
                  <i style={{ width: `${Math.min(100, guest.fear)}%` }} />
                </div>
                <span className="num">{guest.fear}</span>
              </div>
            </div>
          </div>
        </div>

        <p className="hint">{hint}</p>

        {phase === 'dusk' && (
          <button className="btn primary big" onClick={startNight}>
            開始深夜
          </button>
        )}

        {phase === 'night' && (
          <>
            <div className="actions">
              {(Object.keys(ACTIONS) as ActionKind[]).map((k) => {
                const a = ACTIONS[k]
                const risky = k === 'tuck' && guest.state !== 'asleep'
                return (
                  <button key={k} className={`btn action ${risky ? 'risky' : ''}`} disabled={!canAct || yin < a.yin} onClick={() => act(k)}>
                    <span className="action-name">{a.name}</span>
                    <span className="action-cost">陰氣 {a.yin}</span>
                    <span className="action-hint">{risky ? '她還醒著！' : a.hint}</span>
                  </button>
                )
              })}
            </div>
            <div className="row gap">
              <button className="chip" onClick={toggleSpeed}>
                {speed === 1 ? '⏩ 快轉 ×4' : '▶ 正常速度'}
              </button>
              <button className="chip" onClick={() => setFocus(!focusRoom)}>
                {focusRoom ? '🏠 看全景' : '🔍 看房間'}
              </button>
            </div>
          </>
        )}

        {phase === 'dawn' && !result && <p className="muted">結算中……</p>}
      </div>

      {result && <Result />}
    </div>
  )
}

function Subtitles() {
  const sub = useStore((s) => s.subtitle)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!sub) return
    setVisible(true)
    const t = window.setTimeout(() => setVisible(false), 3400)
    return () => window.clearTimeout(t)
  }, [sub])
  if (!sub || !visible) return null
  const cls = sub.speaker === '阿嬤' ? 'grandma' : sub.speaker === '小美' ? 'guest' : sub.speaker === '小翰' ? 'grandson' : 'system'
  return (
    <div className={`subtitle ${cls}`} key={sub.id}>
      {sub.speaker && <span className="speaker">{sub.speaker}</span>}
      <span className="text">{sub.text}</span>
    </div>
  )
}
