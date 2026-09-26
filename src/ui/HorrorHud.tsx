import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { audio } from '../audio'
import { adultOn, horrorStrong } from '../settings'
import { HORROR_INFO, horrorState, type HorrorKind, type HorrorStatus } from '../world/night/horror'
import { incidentState } from '../world/night/incidents'
import './HorrorHud.css'

// 大人的恐怖的 HUD（DESIGN §29，成人內容）：
//   橫幅：鬼新娘／敲牆聲現在該做什麼；化解了或失敗了顯示結果幾秒（凶宅夜附上求助專線）。
//   恐怖加強：被客人看到的那一瞬間（store.horror 跳到 1），一張鬼臉閃一下（最多 0.4 秒、只閃一次）＋低沉的一聲。
//   prefers-reduced-motion：不出現鬼臉，只有畫面暗一下。普通模式什麼都不加。

interface View {
  kind: HorrorKind
  status: HorrorStatus
  hint: string
  outcome: string
  outcomeT: number
  stacked: boolean
}

export function HorrorHud() {
  return (
    <>
      <HorrorBanner />
      <ScareFlash />
    </>
  )
}

function HorrorBanner() {
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
      const c = horrorState.current
      if (!c || c.status === 'waiting' || !adultOn()) {
        setV((p) => (p ? null : p))
        return
      }
      // 突發事件的橫幅也在的時候，往下排一格
      const inc = incidentState.current
      const stacked = !!inc && (inc.status === 'active' || inc.outcomeT > 0)
      const next: View = { kind: c.kind, status: c.status, hint: c.hint(useStore.getState().vision), outcome: c.outcome, outcomeT: c.outcomeT, stacked }
      setV((p) =>
        p && p.status === next.status && p.hint === next.hint && p.outcome === next.outcome && p.stacked === next.stacked && p.outcomeT > 0 === next.outcomeT > 0 ? p : next,
      )
    }, 250)
    return () => window.clearInterval(id)
  }, [phase])
  if (!v || hidden) return null
  const active = v.status === 'active'
  if (!active && v.outcomeT <= 0) return null
  const info = HORROR_INFO[v.kind]
  const away = active && scene !== 'home'
  return (
    <div className={`horror-hud ${active ? 'on' : v.status === 'resolved' ? 'ok' : 'bad'} ${v.stacked ? 'stacked' : ''}`}>
      <span className="horror-icon">{info.icon}</span>
      <div className="horror-body">
        <div className="horror-title">{away ? `家裡出事了：${info.title}` : active ? info.title : (v.status === 'resolved' ? '✓ ' : '✗ ') + v.outcome}</div>
        {active && <div className="horror-hint">{away ? '快回家看看！' : v.hint}</div>}
        {!active && v.kind === 'haunt' && <div className="horror-help">心裡難受的時候，可以找人說說：安心專線 1925（24 小時）</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 恐怖加強：被看到的一瞬間
// ---------------------------------------------------------------------------

/** 閃多久（毫秒）：不超過 0.4 秒 */
const FLASH_MS = 380
/** 兩次之間至少隔多久（毫秒）：不會連續閃 */
const COOLDOWN_MS = 6000

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** 很低的一聲「咚——」：往下掉的正弦波＋悶住的雜訊 */
function boom() {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(72, t)
  o.frequency.exponentialRampToValueAtTime(24, t + 0.9)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.7, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + 1.25)
  const len = Math.floor(ctx.sampleRate * 0.5)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2
  const n = ctx.createBufferSource()
  n.buffer = buf
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 180
  const ng = ctx.createGain()
  ng.gain.value = 0.55
  n.connect(lp).connect(ng).connect(audio.bus.sfx)
  n.start(t)
}

function ScareFlash() {
  const [flash, setFlash] = useState<{ id: number; calm: boolean } | null>(null)
  const last = useRef(-Infinity)
  useEffect(() => {
    let timer = 0
    const unsub = useStore.subscribe((s, prev) => {
      if (!(s.horror >= 0.99 && prev.horror < 0.9)) return
      if (s.phase !== 'night' || !adultOn() || !horrorStrong()) return
      const now = performance.now()
      if (now - last.current < COOLDOWN_MS) return
      last.current = now
      boom()
      setFlash({ id: now, calm: reducedMotion() })
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setFlash(null), FLASH_MS)
    })
    return () => {
      unsub()
      window.clearTimeout(timer)
    }
  }, [])
  if (!flash) return null
  return (
    <div key={flash.id} className={`horror-scare ${flash.calm ? 'calm' : ''}`} aria-hidden>
      {!flash.calm && <ScareFace />}
    </div>
  )
}

/** 鬼臉：蒼白的臉、長頭髮蓋下來、兩個黑洞洞的眼睛 */
function ScareFace() {
  return (
    <svg className="horror-face" viewBox="0 0 200 260">
      <defs>
        <radialGradient id="hf-skin" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#e4e0dc" />
          <stop offset="70%" stopColor="#a9a6a6" />
          <stop offset="100%" stopColor="#4a4648" />
        </radialGradient>
        <radialGradient id="hf-eye" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" />
          <stop offset="70%" stopColor="#0a0406" />
          <stop offset="100%" stopColor="#3a2a2e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="128" rx="62" ry="82" fill="url(#hf-skin)" />
      <ellipse cx="76" cy="118" rx="15" ry="19" fill="url(#hf-eye)" />
      <ellipse cx="124" cy="120" rx="15" ry="19" fill="url(#hf-eye)" />
      <circle cx="78" cy="120" r="1.6" fill="#d8d0c8" />
      <circle cx="122" cy="122" r="1.6" fill="#d8d0c8" />
      <path d="M84 176 Q100 186 116 176 Q100 196 84 176 Z" fill="#140a0c" />
      {/* 頭髮：從頭頂一束一束垂下來，中間分開一點點，蓋住半張臉 */}
      <path d="M36 110 Q40 30 100 26 Q160 30 164 110 L170 250 L150 250 L140 120 Q130 70 106 60 L104 200 L96 200 L94 60 Q70 70 60 120 L50 250 L30 250 Z" fill="#050305" />
      <path d="M94 60 Q86 110 88 150 L82 150 Q80 100 94 60 Z" fill="#050305" />
    </svg>
  )
}
