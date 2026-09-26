import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store'
import { objectives } from '../world/hotspots'
import { nameOf } from '../world/lines'
import { SCENES } from '../world/scenes'
import { input } from '../world/input'
import { NEED_INFO } from '../world/night/guests'
import { yinMax, type GuestView } from '../world/night/director'
import { portraitDataUrl, type PortraitId } from '../art/portraits'
import { DialogueBox } from './DialogueBox'
import { Joystick } from './Joystick'
import { MonthSummary, NightIntro, NightSummaryCard, SkillTree, monthNight } from './NightScreens'
import { MinigameHost } from './minigames'
import { ShopPanel } from './Shop'
import { RelicPanel } from './Relics'
import { DreamHud } from './DreamHud'
import { AlbumPanel } from './Album'
import { DecorHud } from './DecorHud'
import { IncidentHud } from './IncidentHud'
import { EncounterPanel } from './EncounterPanel'
import { GiftPanel } from './GiftPanel'
import { PastHud } from './PastHud'
import { EndingScreen } from './EndingScreen'
import { SettingsPanel } from './Settings'
import { HorrorHud } from './HorrorHud'
import { FamilyHud } from './FamilyHud'
import { SpecialHud } from './SpecialHud'
import { PORTRAIT_IDS } from '../art/portraits'
import { GOAL, goalShown } from '../world/story'
import { MEMORIES } from '../world/memories'
import { requestById } from '../world/requests'

const PHASE_NAME = { dusk: '傍晚', night: '深夜', dawn: '清晨' } as const

function clockText(t: number) {
  const h = Math.floor(t) % 24
  const m = Math.floor((t % 1) * 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function Hud() {
  const dialogue = useStore((s) => s.dialogue)
  const summary = useStore((s) => s.summary)
  const month = useStore((s) => s.month)
  const intro = useStore((s) => s.intro)
  const panel = useStore((s) => s.panel)
  const minigame = useStore((s) => !!s.minigame)
  // 夢裡有自己的 HUD（DreamHud），家裡的目標、住客、動作鈕先收起來
  const inDream = useStore((s) => s.scene === 'dream')
  // 回到 1958：有自己的目標（PastHud），現在的目標、住客、陰陽眼都收起來
  const inPast = useStore((s) => s.scene === 'past')
  const ending = useStore((s) => !!s.ending)
  const modal = !!summary || !!month || intro || !!panel || minigame || ending
  return (
    <div className="hud">
      <VisionOverlay />
      <HideView />
      <PossessBadge />
      <Watched />
      {!modal && !inDream && !inPast && (
        <div className="left-col">
          <Objective />
          <TodayList />
          <GuestsPanel />
        </div>
      )}
      <Status />
      <RoomName />
      <Subtitles />
      {!dialogue && !modal && !inDream && <ActionButton />}
      {!dialogue && !modal && <Joystick />}
      <KeyHint />
      {dialogue && <DialogueBox />}
      {intro && !dialogue && <NightIntro />}
      {panel === 'skills' && <SkillTree />}
      {panel === 'shop' && <ShopPanel />}
      {panel === 'relics' && <RelicPanel />}
      {panel === 'album' && <AlbumPanel />}
      {panel === 'settings' && <SettingsPanel />}
      <HorrorHud />
      <DreamHud />
      <PastHud />
      <DecorHud />
      <IncidentHud />
      <FamilyHud />
      <SpecialHud />
      <EncounterPanel />
      <GiftPanel />
      <EndingScreen />
      {summary && <NightSummaryCard />}
      {month && <MonthSummary />}
      <MinigameHost />
    </div>
  )
}

function Objective() {
  // 只挑會影響目標的欄位，不然深夜時間每幀在跑，整張卡每幀重畫
  const s = useStore(
    useShallow((x) => ({
      phase: x.phase,
      flags: x.flags,
      meta: x.meta,
      scene: x.scene,
    })),
  )
  const challenges = useStore((x) => x.challenges)
  const o = objectives(s as Parameters<typeof objectives>[0])
  const mn = monthNight(s.meta.night)
  if (!o.main) return null
  return (
    <div className="objective">
      <div className="objective-head">
        <span className="objective-tag">目標</span>
        <span className="muted">
          第 {mn.month} 個月 · 第 {mn.night} 晚 · {SCENES[s.scene].name}
        </span>
      </div>
      <div className="objective-main">{o.main}</div>
      {o.extra && <div className="objective-extra">{o.extra}</div>}
      {goalShown(s.meta) && !s.meta.story.some((x) => x.startsWith('ended_')) && (
        <div className="objective-goal">
          主線：第 12 晚前 存款 ${s.meta.money.toLocaleString()} / {GOAL.money.toLocaleString()}・小翰的心 {s.meta.heart} / {GOAL.heart}
        </div>
      )}
      {s.phase === 'night' && challenges.length > 0 && (
        <ul className="challenges">
          {challenges.map((c) => (
            <li key={c.id} className={c.done ? 'done' : c.failed ? 'failed' : ''}>
              <span className="tick">{c.done ? '✓' : c.failed ? '✗' : '○'}</span>
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Status() {
  const phase = useStore((s) => s.phase)
  const quarter = useStore((s) => Math.floor(s.time * 4))
  const yin = useStore((s) => Math.round(s.yin))
  const max = useStore((s) => yinMax(s.meta))
  const money = useStore((s) => s.meta.money)
  const heart = useStore((s) => s.meta.heart)
  const pts = useStore((s) => s.meta.skillPts)
  const voice = useStore((s) => s.voice)
  const toggleVoice = useStore((s) => s.toggleVoice)
  const openPanel = useStore((s) => s.openPanel)
  const modal = useStore((s) => !!s.summary || !!s.month || s.intro || !!s.panel || !!s.dialogue)
  const inPast = useStore((s) => s.scene === 'past')
  return (
    <div className="status">
      <div className="clock">
        <span className="clock-phase">{PHASE_NAME[phase]}</span>
        <span className="clock-time">{clockText(quarter / 4)}</span>
      </div>
      <div className="yin">
        <span className="label ghost">陰氣</span>
        <div className="meter">
          <i style={{ width: `${(yin / max) * 100}%` }} />
        </div>
        <span className="num">{yin}</span>
      </div>
      <div className="status-row">
        <span className="pill money" title="民宿的錢">
          💰 {money.toLocaleString()}
        </span>
        <span className={`pill heart ${heart < 30 ? 'low' : ''}`} title="小翰的心">
          ❤️ {heart}
        </span>
      </div>
      {!modal && !inPast && <PowerButtons />}
      <div className="status-row">
        {phase === 'dusk' && !modal && (
          <button className={`chip ${pts > 0 ? 'glow' : ''}`} onClick={() => openPanel('skills')}>
            技能{pts > 0 ? ` · ${pts} 點` : ''}
          </button>
        )}
        <button className="chip icon" onClick={toggleVoice} aria-label="語音開關">
          {voice ? '🔊' : '🔇'}
        </button>
        <button className="chip icon" onClick={() => openPanel('settings')} aria-label="設定">
          ⚙
        </button>
      </div>
    </div>
  )
}

/** 深夜的住客列表：頭像、醒著沒、看過的需求、舒適與驚嚇 */
function GuestsPanel() {
  const phase = useStore((s) => s.phase)
  const view = useStore((s) => s.view)
  const [open, setOpen] = useState(() => innerHeight > 520)
  if (phase !== 'night' || !view.length) return null
  return (
    <div className={`guests-panel ${open ? '' : 'closed'}`}>
      <button className="guests-toggle" onClick={() => setOpen(!open)}>
        今晚住客 {open ? '▾' : '▸'}
      </button>
      {open && view.map((g) => <GuestRow key={g.id} g={g} />)}
    </div>
  )
}

function GuestRow({ g }: { g: GuestView }) {
  const state = !g.awake ? 'asleep' : g.fear > 55 ? 'scared' : g.mode !== 'bed' ? 'walk' : 'awake'
  const STATE = { asleep: '💤 睡著', scared: '😱 害怕', walk: '🚶 走動', awake: '👀 醒著' }
  const known = g.needs.filter((n) => n.known)
  const unknown = g.needs.length - known.length
  return (
    <div className={`guest-row ${g.suspicion > 0.5 && !g.seesGhost ? 'alert' : ''}`}>
      <div className="guest-face">
        {(PORTRAIT_IDS as readonly string[]).includes(g.id) ? (
          <img src={portraitDataUrl(g.id as PortraitId, g.fear > 55 ? 'surprised' : g.comfort > 70 ? 'happy' : 'normal')} alt="" draggable={false} />
        ) : (
          <span className="face-initial">{g.name.slice(0, 1)}</span>
        )}
        <span className="room-tag">{g.room === 'r1' ? '一' : '二'}</span>
      </div>
      <div className="guest-info">
        <div className="row between">
          <span className="guest-name">
            {g.name} <span className="muted">{g.label}</span>
          </span>
          <span className={`state state-${state}`}>{STATE[state]}</span>
        </div>
        <div className="guest-needs">
          {known.map((n) => (
            <span key={n.kind} className="need" title={NEED_INFO[n.kind].label}>
              {NEED_INFO[n.kind].icon}
              <small>{NEED_INFO[n.kind].label}</small>
            </span>
          ))}
          {unknown > 0 && <span className="need unknown">？靠近看看</span>}
          {!g.needs.length && g.awake && <span className="muted">沒事</span>}
        </div>
        <div className="mini-bars">
          <i className="bar warm" style={{ width: `${Math.min(100, g.comfort)}%` }} />
          <i className="bar fear" style={{ width: `${Math.min(100, g.fear)}%` }} />
        </div>
      </div>
    </div>
  )
}

/** 被看著：畫面邊緣變紅、中間提示「別動」 */
function Watched() {
  const w = useStore((s) => Math.round(s.watched * 20) / 20)
  const phase = useStore((s) => s.phase)
  if (phase !== 'night' || w < 0.1) return null
  return (
    <>
      <div className="watched-vignette" style={{ opacity: Math.min(1, w * 1.3) }} />
      {w > 0.25 && (
        <div className={`watched ${w > 0.7 ? 'hot' : ''}`}>
          <span>{w > 0.7 ? '要被發現了！別動！' : '被盯著……站著別動'}</span>
          <div className="meter fear">
            <i style={{ width: `${w * 100}%` }} />
          </div>
        </div>
      )}
    </>
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
  const cycle = useStore((s) => s.cycleOption)
  const hold = useStore((s) => s.hold)
  if (!prompt) return null
  const o = prompt.opts[prompt.i] ?? prompt.opts[0]
  if (!o) return null
  const short = o.cost > yin
  const many = prompt.opts.length > 1 && !hold
  const holding = !!hold && hold.opt.spot === o.spot && hold.opt.action === o.option?.action
  const k = holding ? Math.min(1, hold.progress / hold.need) : 0
  return (
    <div className="action-wrap">
      {many && (
        <button
          className="cycle-btn"
          onPointerDown={(e) => {
            e.stopPropagation()
            cycle()
          }}
        >
          <span className="cycle-arrow">⟳</span>
          <span>
            {prompt.i + 1}/{prompt.opts.length}
          </span>
          <span className="action-key small">Q</span>
        </button>
      )}
      <button
        className={`action-btn ${short ? 'short' : ''} ${o.needed ? 'needed' : ''} ${holding ? 'holding' : ''}`}
        disabled={busy && !holding}
        onPointerDown={(e) => {
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          input.pressAction()
        }}
        onPointerUp={() => input.releaseAction()}
        onPointerCancel={() => input.releaseAction()}
        onLostPointerCapture={() => input.releaseAction()}
      >
        {holding && (
          <svg className="hold-ring" viewBox="0 0 100 100" aria-hidden>
            <rect x="3" y="3" width="94" height="94" rx="22" pathLength={1} style={{ strokeDashoffset: 1 - k }} />
          </svg>
        )}
        {o.needed && !holding && <span className="needed-tag">有人需要</span>}
        {holding && <span className="needed-tag hold-tag">按住……</span>}
        <span className="action-label">{o.label}</span>
        {o.cost > 0 && <span className="action-cost">陰氣 {o.cost}</span>}
        {o.option && HOLD_HINT.has(o.option.action) && !holding && <span className="action-hint-hold">長按</span>}
        <span className="action-key">E</span>
      </button>
    </div>
  )
}

const HOLD_HINT = new Set(['tuck', 'temp', 'water', 'coil', 'nightlight', 'window', 'pat', 'lullaby', 'deliver', 'retrieve'])

/** 今天的事（DESIGN §28.2）：小翰的紙條＋鄰居的委託 */
function TodayList() {
  const reqs = useStore((s) => s.meta.requests)
  const phase = useStore((s) => s.phase)
  const [open, setOpen] = useState(() => innerHeight > 620)
  if (!reqs.length || phase === 'dawn') return null
  const left = reqs.filter((r) => !r.done).length
  return (
    <div className="today">
      <button className="today-head" onClick={() => setOpen(!open)}>
        今天的事 <span className="muted">{left ? `還有 ${left} 件` : '都做完了'}</span> {open ? '▾' : '▸'}
      </button>
      {open && (
        <ul>
          {reqs.map((r) => {
            const d = requestById(r.id)
            if (!d) return null
            return (
              <li key={r.id} className={r.done ? 'done' : ''}>
                <span className="tick">{r.done ? '✓' : d.note ? '📝' : '○'}</span>
                <span className="today-text">
                  <b>{d.who}</b>：{d.text}
                  {!r.done && <small>{d.where}</small>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** 陰陽眼、念力、回憶相簿 */
function PowerButtons() {
  const vision = useStore((s) => s.vision)
  const tk = useStore((s) => s.tk)
  const canTK = useStore((s) => s.meta.skills.includes('telekinesis') && s.phase === 'night' && s.scene === 'home')
  const mem = useStore((s) => s.meta.memories.length)
  const toggleVision = useStore((s) => s.toggleVision)
  const toggleTK = useStore((s) => s.toggleTK)
  const openPanel = useStore((s) => s.openPanel)
  return (
    <div className="status-row power">
      <button className={`chip ${vision ? 'on-vision' : ''}`} onClick={toggleVision} title="陰陽眼（V）">
        👁 陰陽眼
      </button>
      {canTK && (
        <button className={`chip ${tk ? 'on-tk' : ''}`} onClick={toggleTK} title="念力（T）">
          ✋ 念力
        </button>
      )}
      <button className="chip" onClick={() => openPanel('album')} title="回憶相簿">
        📖 {mem}/{MEMORIES.length}
      </button>
    </div>
  )
}

/** 陰陽眼開著：畫面變青、四周暗下來 */
function VisionOverlay() {
  const vision = useStore((s) => s.vision)
  const tk = useStore((s) => s.tk)
  return (
    <>
      {vision && <div className="vision-overlay" />}
      {tk && <div className="tk-overlay">念力：直接拖發光的東西（拖太快會有聲音）</div>}
    </>
  )
}

/** 躲起來的時候：畫面只剩一條縫 */
function HideView() {
  const hidden = useStore((s) => s.hidden)
  if (!hidden) return null
  return (
    <div className="hide-view">
      <div className="hide-slit" />
      <div className="hide-text">躲著……誰都看不到妳。推搖桿或按 E 出來</div>
    </div>
  )
}

/** 附身在動物身上 */
function PossessBadge() {
  const possess = useStore((s) => s.possess)
  if (!possess) return null
  const name = { cat: '🐈 附身阿咪中', dog: '🐕 附身小黑中', gecko: '🦎 附身壁虎中' }[possess]
  return <div className="possess-badge">{name}（陰氣一直在扣）</div>
}

function KeyHint() {
  const [show, setShow] = useState(() => !matchMedia('(pointer: coarse)').matches)
  useEffect(() => {
    if (!show) return
    const t = window.setTimeout(() => setShow(false), 14000)
    return () => window.clearTimeout(t)
  }, [show])
  if (!show) return null
  return (
    <div className="key-hint">
      <b>WASD</b> 移動　<b>連點方向</b>／<b>Shift</b> 快飄　<b>E</b> 互動　<b>Q</b> 換動作
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
