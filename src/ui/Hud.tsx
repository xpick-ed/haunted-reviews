import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { objectives } from '../world/hotspots'
import { nameOf } from '../world/lines'
import { SCENES } from '../world/scenes'
import { input } from '../world/input'
import { Result } from './Result'
import { DialogueBox } from './DialogueBox'
import { Joystick } from './Joystick'

const PHASE_NAME = { dusk: '傍晚', night: '深夜', dawn: '清晨' } as const
const STATE_NAME = { awake: '醒著', asleep: '睡著', scared: '嚇到' } as const

function clockText(t: number) {
  const h = Math.floor(t) % 24
  const m = Math.floor((t % 1) * 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function Hud() {
  const dialogue = useStore((s) => s.dialogue)
  const result = useStore((s) => s.result)
  return (
    <div className="hud">
      <Objective />
      <Status />
      <GuestCard />
      <RoomName />
      <Subtitles />
      {!dialogue && !result && <ActionButton />}
      {!dialogue && !result && <Joystick />}
      <KeyHint />
      {dialogue && <DialogueBox />}
      {result && <Result />}
    </div>
  )
}

function Objective() {
  const s = useStore()
  const o = objectives(s)
  if (!o.main || s.result) return null
  return (
    <div className="objective">
      <div className="objective-head">
        <span className="objective-tag">目標</span>
        <span className="muted">
          第 {s.nightCount} 晚 · 農曆二月 · {SCENES[s.scene].name}
        </span>
      </div>
      <div className="objective-main">{o.main}</div>
      {o.extra && <div className="objective-extra">{o.extra}</div>}
    </div>
  )
}

function Status() {
  const phase = useStore((s) => s.phase)
  const quarter = useStore((s) => Math.floor(s.time * 4))
  const yin = useStore((s) => Math.round(s.yin))
  const voice = useStore((s) => s.voice)
  const toggleVoice = useStore((s) => s.toggleVoice)
  return (
    <div className="status">
      <div className="clock">
        <span className="clock-phase">{PHASE_NAME[phase]}</span>
        <span className="clock-time">{clockText(quarter / 4)}</span>
      </div>
      <div className="yin">
        <span className="label ghost">陰氣</span>
        <div className="meter">
          <i style={{ width: `${yin}%` }} />
        </div>
        <span className="num">{yin}</span>
      </div>
      <button className="chip icon" onClick={toggleVoice} aria-label="語音開關">
        {voice ? '🔊' : '🔇'}
      </button>
    </div>
  )
}

/** 在客房裡才看得到小美的狀態（DESIGN §6.4 觀察） */
function GuestCard() {
  const room = useStore((s) => s.room)
  const phase = useStore((s) => s.phase)
  const guest = useStore((s) => s.guest)
  if (room !== 'guest' || phase !== 'night') return null
  return (
    <div className="guest-card">
      <div className="avatar">美</div>
      <div className="guest-info">
        <div className="row between">
          <span className="guest-name">
            小美 <span className="muted">一般旅客</span>
          </span>
          <span className={`state state-${guest.state}`}>{STATE_NAME[guest.state]}</span>
        </div>
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
  )
}

/** 進房間時中間上方浮出房間名稱 */
function RoomName() {
  const room = useStore((s) => s.room)
  const scene = useStore((s) => s.scene)
  const [shown, setShown] = useState<string | null>(null)
  useEffect(() => {
    const def = SCENES[scene]
    const name = room ? def.rooms.find((r) => r.id === room)?.name : null
    if (!name) return
    setShown(name)
    const t = window.setTimeout(() => setShown(null), 1800)
    return () => window.clearTimeout(t)
  }, [room, scene])
  if (!shown) return null
  return (
    <div className="room-name" key={shown}>
      {shown}
    </div>
  )
}

function ActionButton() {
  const prompt = useStore((s) => s.prompt)
  const yin = useStore((s) => s.yin)
  const busy = useStore((s) => s.busy)
  if (!prompt) return null
  const short = prompt.cost > yin
  return (
    <button
      className={`action-btn ${short ? 'short' : ''}`}
      disabled={busy}
      onPointerDown={(e) => {
        e.stopPropagation()
        input.fireAction()
      }}
    >
      <span className="action-label">{prompt.label}</span>
      {prompt.cost > 0 && <span className="action-cost">陰氣 {prompt.cost}</span>}
      <span className="action-key">E</span>
    </button>
  )
}

function KeyHint() {
  const [show, setShow] = useState(() => !matchMedia('(pointer: coarse)').matches)
  useEffect(() => {
    if (!show) return
    const t = window.setTimeout(() => setShow(false), 12000)
    return () => window.clearTimeout(t)
  }, [show])
  if (!show) return null
  return (
    <div className="key-hint">
      <b>WASD</b> 移動　<b>Shift</b> 快飄　<b>E</b> 互動
    </div>
  )
}

function Subtitles() {
  const sub = useStore((s) => s.subtitle)
  const dialogue = useStore((s) => s.dialogue)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!sub) return
    setVisible(true)
    const t = window.setTimeout(() => setVisible(false), Math.max(2600, sub.text.length * 190))
    return () => window.clearTimeout(t)
  }, [sub])
  if (!sub || !visible || dialogue) return null
  return (
    <div className={`subtitle who-${sub.who || 'system'}`} key={sub.id}>
      {sub.who && <span className="speaker">{nameOf(sub.who)}</span>}
      <span className="text">{sub.text}</span>
    </div>
  )
}
