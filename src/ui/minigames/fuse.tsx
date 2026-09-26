import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio'
import type { FuseResult, MinigameProps } from './types'
import './fuse.css'

// 修保險絲（DESIGN §27.2 半夜突發事件）：左護龍前面牆上的老電箱。
// 1 拉下主開關（沒關就碰保險絲會被電到）→ 2 拔出燒黑的保險絲座 → 3 換上對的保險絲線
// （門上貼著阿公的字條：「用細的」）→ 4 插回去 → 5 推上主開關，燈亮。30 秒內修好。
// 鍵盤：Tab／方向鍵選、E／空白鍵／Enter 按，Esc 放棄。

const LIMIT = 30

type Wire = 'thin' | 'thick' | 'iron'
const WIRES: { id: Wire; name: string; note: string }[] = [
  { id: 'thick', name: '粗銅線', note: '太粗了——這種燒不斷，會燒房子！' },
  { id: 'thin', name: '細銅線', note: '' },
  { id: 'iron', name: '鐵絲', note: '鐵絲？阿公說過絕對不行。' },
]

type Step = 'main-off' | 'pull' | 'wire' | 'insert' | 'main-on' | 'done'
const STEP_TEXT: Record<Step, string> = {
  'main-off': '先把主開關拉下來（不然會被電到）',
  pull: '把燒黑的保險絲座拔出來',
  wire: '換上保險絲線：阿公的字條說要用哪一種？',
  insert: '把保險絲座插回去',
  'main-on': '把主開關推上去',
  done: '燈亮了！',
}

// ---------------------------------------------------------------------------
// 合成音效：扳開關、電到、拔插座
// ---------------------------------------------------------------------------

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.4), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}
const fuseSfx = {
  clunk() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(60, t + 0.09)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    o.connect(lp).connect(g).connect(audio.bus.sfx)
    o.start(t)
    o.stop(t + 0.14)
  },
  zap() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const n = ctx.createBufferSource()
    n.buffer = noiseBuf(ctx)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 3200
    bp.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    for (let i = 0; i < 6; i++) {
      g.gain.setValueAtTime(0.4, t + i * 0.045)
      g.gain.setValueAtTime(0.02, t + i * 0.045 + 0.02)
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34)
    n.connect(bp).connect(g).connect(audio.bus.sfx)
    n.start(t)
    n.stop(t + 0.36)
  },
  pop() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(520, t)
    o.frequency.exponentialRampToValueAtTime(260, t + 0.08)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    o.connect(g).connect(audio.bus.sfx)
    o.start(t)
    o.stop(t + 0.12)
  },
}

// ---------------------------------------------------------------------------

export default function FuseGame({ done }: MinigameProps<unknown, FuseResult>) {
  const [step, setStep] = useState<Step>('main-off')
  const [main, setMain] = useState(true)
  /** 燒掉的那個座：in（插著、燒黑的）→ out（拔出來了）→ wired（換好線）→ in-ok */
  const [holder, setHolder] = useState<'burnt' | 'out' | 'wired' | 'ok'>('burnt')
  const [msg, setMsg] = useState<string | null>(null)
  const [zap, setZap] = useState(0)
  const [left, setLeft] = useState(LIMIT)
  const started = useRef(performance.now())
  const penalty = useRef(0)
  const finished = useRef(false)

  const elapsed = () => (performance.now() - started.current) / 1000 + penalty.current
  const finish = (fixed: boolean, secs?: number) => {
    if (finished.current) return
    finished.current = true
    done({ fixed, seconds: Math.round((secs ?? elapsed()) * 10) / 10 })
  }

  // 倒數（修好了就停）
  const timeUp = useRef(false)
  useEffect(() => {
    if (step === 'done') return
    const id = window.setInterval(() => {
      if (finished.current || timeUp.current) return
      const l = Math.max(0, LIMIT - elapsed())
      setLeft(l)
      if (l <= 0) {
        timeUp.current = true
        setMsg('時間到了……電還是沒來。')
        window.setTimeout(() => finish(false, LIMIT), 1200)
      }
    }, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // 鍵盤：E／空白鍵按下目前選到的按鈕，Esc 放棄
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish(false, 0)
      } else if (k === 'e') {
        const el = document.activeElement as HTMLElement | null
        if (el && el.closest('.fuse-panel') && el.tagName === 'BUTTON') {
          e.preventDefault()
          el.click()
        }
      } else if (k === 'arrowright' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowup') {
        const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('.fuse-panel button:not(:disabled)'))
        if (!btns.length) return
        e.preventDefault()
        const i = btns.indexOf(document.activeElement as HTMLButtonElement)
        const d = k === 'arrowright' || k === 'arrowdown' ? 1 : -1
        btns[(i + d + btns.length) % btns.length].focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const say = (m: string | null) => setMsg(m)
  const shock = (m: string) => {
    fuseSfx.zap()
    penalty.current += 3
    setZap((z) => z + 1)
    say(m)
  }

  const onMain = () => {
    if (step === 'done' || timeUp.current) return
    fuseSfx.clunk()
    if (main) {
      setMain(false)
      if (step === 'main-off') {
        setStep('pull')
        say(null)
      }
      return
    }
    // 推上去
    if (holder !== 'ok') {
      setMain(true)
      shock('啪！保險絲還沒換好就送電……先拉下來。')
      setStep('main-off')
      return
    }
    setMain(true)
    setStep('done')
    say(null)
    audio.chime()
    window.setTimeout(() => finish(true), 1300)
  }

  const onHolder = () => {
    if (step === 'done' || timeUp.current) return
    if (main) {
      shock('唉唷！被電到了！先把主開關拉下來！')
      return
    }
    fuseSfx.pop()
    if (holder === 'burnt') {
      setHolder('out')
      setStep('wire')
      say(null)
    } else if (holder === 'wired') {
      setHolder('ok')
      setStep('main-on')
    }
  }

  const onWire = (w: Wire) => {
    if (timeUp.current) return
    if (holder !== 'out') {
      say(holder === 'burnt' ? '先把燒黑的保險絲座拔出來。' : '已經換好了。')
      return
    }
    const info = WIRES.find((x) => x.id === w)!
    if (w !== 'thin') {
      fuseSfx.zap()
      penalty.current += 2
      setZap((z) => z + 1)
      say(info.note)
      return
    }
    fuseSfx.pop()
    setHolder('wired')
    setStep('insert')
    say(null)
  }

  const pct = Math.max(0, Math.min(1, left / LIMIT))
  const lit = step === 'done'
  return (
    <div className={`fuse-panel ${lit ? 'lit' : ''}`}>
      <div className="fuse-head">
        <span className="fuse-title">修保險絲</span>
        <span className={`fuse-time ${left < 8 ? 'low' : ''}`}>{Math.ceil(left)}</span>
        <button className="fuse-x" onClick={() => finish(false, 0)} aria-label="放棄">
          ✕
        </button>
      </div>
      <div className="fuse-bar">
        <i style={{ width: `${pct * 100}%` }} />
      </div>

      {/* key 換了就重播被電到的抖動（裡面沒有狀態，重掛沒關係） */}
      <div className={`fuse-box ${zap ? 'zapped' : ''}`} key={zap}>
        {/* 門內側貼著阿公寫的字條 */}
        <div className="fuse-note">
          <span>保險絲</span>
          <span>用細的</span>
          <small>—— 添福</small>
        </div>

        <div className="fuse-main">
          <button className={`fuse-lever ${main ? 'up' : 'down'}`} onClick={onMain} aria-label={main ? '拉下主開關' : '推上主開關'}>
            <span className="lever-on">ON</span>
            <span className="lever-off">OFF</span>
            <span className="lever-handle" />
          </button>
          <span className="fuse-label">主開關</span>
          <span className={`fuse-lamp ${main && lit ? 'on' : ''}`} />
        </div>

        <div className="fuse-holders">
          <div className="holder ok">
            <span className="holder-body" />
            <span className="fuse-label">灶腳</span>
          </div>
          <button
            className={`holder ${holder === 'burnt' ? 'burnt' : holder === 'out' || holder === 'wired' ? 'out' : 'ok'} ${step === 'pull' || step === 'insert' ? 'next' : ''}`}
            onClick={onHolder}
            aria-label="客房的保險絲座"
          >
            <span className="holder-body">{holder === 'wired' && <span className="holder-wire" />}</span>
            {holder === 'burnt' && <span className="smoke" />}
            <span className="fuse-label">客房</span>
          </button>
          <div className="holder ok">
            <span className="holder-body" />
            <span className="fuse-label">埕燈</span>
          </div>
        </div>

        <div className="fuse-wires">
          {WIRES.map((w) => (
            <button key={w.id} className={`wire wire-${w.id} ${step === 'wire' ? 'next' : ''}`} onClick={() => onWire(w.id)} disabled={holder === 'wired' || holder === 'ok'}>
              <svg viewBox="0 0 80 24" aria-hidden>
                <path d="M4 12 C 20 2, 30 22, 44 12 S 66 4, 76 12" />
              </svg>
              <span>{w.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="fuse-step">{msg ?? STEP_TEXT[step]}</div>
    </div>
  )
}
