import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio'
import type { MinigameProps } from './types'
import { DRAWERS, RX, SCALE_MAX, herbsResult, swing, weighScore, type Herb, type HerbsParams, type HerbsResult } from './herbs.logic'
import './herbs.css'

// 抓藥（DESIGN §30，和春中藥行）：先看藥單記起來 → 在百子櫃找到那四味 → 用戥子秤（秤錘自己來回滑，按「放」停住）。
// 60 秒內抓完四味；再看一眼藥單要多花 4 秒，拉錯抽屜多花 2 秒。
// 鍵盤：Tab／方向鍵選、E／空白鍵按，Esc 放棄。

const LIMIT = 60

// ---------------------------------------------------------------------------
// 合成音效：拉抽屜、拉錯、秤錘碰到
// ---------------------------------------------------------------------------

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.35), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}
const herbSfx = {
  drawer() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const n = ctx.createBufferSource()
    n.buffer = noiseBuf(ctx)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(700, t)
    bp.frequency.linearRampToValueAtTime(1300, t + 0.18)
    bp.Q.value = 1.2
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
    n.connect(bp).connect(g).connect(audio.bus.sfx)
    n.start(t)
    n.stop(t + 0.26)
  },
  wrong() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(180, t)
    o.frequency.exponentialRampToValueAtTime(120, t + 0.2)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
    o.connect(g).connect(audio.bus.sfx)
    o.start(t)
    o.stop(t + 0.26)
  },
  tick(ok: boolean) {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(ok ? 1320 : 880, t)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    o.connect(g).connect(audio.bus.sfx)
    o.start(t)
    o.stop(t + 0.36)
  },
}

type Phase = 'read' | 'pick' | 'weigh' | 'wrap'

/** 秤完的評語 */
function weighNote(target: number, got: number) {
  const d = got - target
  if (Math.abs(d) < 0.2) return '剛剛好！'
  if (Math.abs(d) < 0.6) return d > 0 ? '多了一點點，還可以。' : '少了一點點，還可以。'
  return d > 0 ? '太多了……藥會太苦。' : '太少了……藥效不夠。'
}

export default function HerbsGame({ params, done }: MinigameProps<HerbsParams, HerbsResult | null>) {
  const rx = RX[params?.rx ?? 'cough']
  const [phase, setPhase] = useState<Phase>('read')
  const [peek, setPeek] = useState(false)
  /** 每味藥的分數（null 還沒抓） */
  const [scores, setScores] = useState<(number | null)[]>(() => rx.items.map(() => null))
  const [open, setOpen] = useState<Herb | null>(null)
  const [shake, setShake] = useState<{ herb: Herb; n: number } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [left, setLeft] = useState(LIMIT)
  const [pos, setPos] = useState(0)
  const started = useRef(0)
  const penalty = useRef(0)
  const swingT0 = useRef(0)
  const finished = useRef(false)
  const scoresRef = useRef(scores)
  scoresRef.current = scores

  const elapsed = () => (started.current ? (performance.now() - started.current) / 1000 : 0) + penalty.current
  const finish = (res: HerbsResult | null) => {
    if (finished.current) return
    finished.current = true
    done(res)
  }

  // 倒數（開始抓以後才算）
  useEffect(() => {
    if (phase === 'read' || phase === 'wrap') return
    const id = window.setInterval(() => {
      if (finished.current) return
      const l = Math.max(0, LIMIT - elapsed())
      setLeft(l)
      if (l <= 0) {
        setPhase('wrap')
        setMsg('時間到了……先包起來吧。')
        window.setTimeout(() => finish(herbsResult(scoresRef.current)), 1500)
      }
    }, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // 秤錘來回滑
  useEffect(() => {
    if (phase !== 'weigh') return
    let raf = 0
    const round = scoresRef.current.filter((x) => x !== null).length
    const tick = () => {
      setPos(swing((performance.now() - swingT0.current) / 1000, round))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // 鍵盤
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish(null)
      } else if (k === 'e' || k === ' ') {
        const el = document.activeElement as HTMLElement | null
        if (el && el.closest('.herbs-panel') && el.tagName === 'BUTTON') {
          e.preventDefault()
          el.click()
          return
        }
        const main = document.querySelector<HTMLButtonElement>('.herbs-panel .herbs-main')
        if (main) {
          e.preventDefault()
          main.click()
        }
      } else if (k.startsWith('arrow')) {
        const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('.herbs-panel button:not(:disabled)'))
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

  const begin = () => {
    if (phase === 'read' && !started.current) {
      started.current = performance.now()
      setPhase('pick')
      setMsg('照藥單，一格一格找。')
      return
    }
    setPeek(false)
  }

  const onPeek = () => {
    if (phase !== 'pick') return
    penalty.current += 4
    setPeek(true)
  }

  const onDrawer = (herb: Herb) => {
    if (phase !== 'pick') return
    const i = rx.items.findIndex((it) => it.herb === herb)
    if (i < 0) {
      herbSfx.wrong()
      penalty.current += 2
      setShake((p) => ({ herb, n: (p?.n ?? 0) + 1 }))
      setMsg(`${herb}？藥單上沒有這一味。`)
      return
    }
    if (scores[i] !== null) {
      setMsg(`${herb}已經秤好了。`)
      return
    }
    herbSfx.drawer()
    setOpen(herb)
    setMsg(`${herb}要幾錢？看好秤錘，按「放」。`)
    swingT0.current = performance.now()
    setPhase('weigh')
  }

  const onWeigh = () => {
    if (phase !== 'weigh' || !open) return
    const i = rx.items.findIndex((it) => it.herb === open)
    const target = rx.items[i].qian
    // 秤錘停在最近的半錢。用按下去那一刻的真正位置（不是上一幀畫出來的）：手機掉幀時才不會吃虧
    const round = scores.filter((x) => x !== null).length
    const now = swing((performance.now() - swingT0.current) / 1000, round)
    const got = Math.round(now * 2) / 2
    const sc = weighScore(target, got)
    herbSfx.tick(sc >= 0.75)
    const next = scores.map((x, j) => (j === i ? sc : x))
    setScores(next)
    setPos(got)
    setMsg(`${open} ${got} 錢——${weighNote(target, got)}`)
    setOpen(null)
    if (next.every((x) => x !== null)) {
      setPhase('wrap')
      const res = herbsResult(next)
      if (res.merit >= 2) audio.chime()
      window.setTimeout(() => finish(res), 1600)
      return
    }
    setPhase('pick')
  }

  const pct = Math.max(0, Math.min(1, left / LIMIT))
  const paperOpen = phase === 'read' || peek
  const got = scores.filter((x) => x !== null).length
  return (
    <div className="herbs-panel">
      <div className="herbs-head">
        <span className="herbs-title">抓藥</span>
        <span className="herbs-who">{rx.who}</span>
        {phase !== 'read' && <span className={`herbs-time ${left < 12 ? 'low' : ''}`}>{Math.ceil(left)}</span>}
        <button className="herbs-x" onClick={() => finish(null)} aria-label="放棄">
          ✕
        </button>
      </div>
      {phase !== 'read' && (
        <div className="herbs-bar">
          <i style={{ width: `${pct * 100}%` }} />
        </div>
      )}

      {/* 藥單：一開始攤開，記好了就摺起來（再看一眼要花時間） */}
      {paperOpen ? (
        <div className="herbs-paper">
          <div className="herbs-paper-title">{rx.title}</div>
          <ol>
            {rx.items.map((it) => (
              <li key={it.herb}>
                <b>{it.herb}</b>
                <span>{it.qian} 錢</span>
              </li>
            ))}
          </ol>
          <small>和春中藥行</small>
          <button className="herbs-main" onClick={begin}>
            {phase === 'read' ? '記好了，開始抓' : '收起來'}
          </button>
        </div>
      ) : (
        <div className="herbs-folded">
          <span>
            藥單（{rx.title}）・已抓 {got}/4
          </span>
          <button onClick={onPeek} disabled={phase !== 'pick'}>
            再看一眼（+4 秒）
          </button>
        </div>
      )}

      {phase === 'weigh' && open ? (
        <div className="herbs-scale">
          <div className="herbs-scale-name">秤 {open}</div>
          <div className="herbs-beam">
            {Array.from({ length: SCALE_MAX * 2 + 1 }, (_, i) => (
              <span key={i} className={`tick ${i % 2 ? 'half' : ''}`} style={{ left: `${(i / (SCALE_MAX * 2)) * 100}%` }}>
                {i % 2 ? '' : i / 2}
              </span>
            ))}
            <span className="herbs-pan" />
            <span className="herbs-weight" style={{ left: `${(pos / SCALE_MAX) * 100}%` }} />
          </div>
          <button className="herbs-main herbs-drop" onClick={onWeigh} autoFocus>
            放！
          </button>
        </div>
      ) : (
        !paperOpen && (
          <div className="herbs-cabinet">
            {DRAWERS.map((h) => {
              const i = rx.items.findIndex((it) => it.herb === h)
              const doneHere = i >= 0 && scores[i] !== null
              return (
                <button key={h} className={`herbs-drawer ${doneHere ? 'done' : ''} ${shake?.herb === h ? 'shake' : ''}`} onClick={() => onDrawer(h)} disabled={phase !== 'pick'}>
                  <span key={shake?.herb === h ? shake.n : 0} className="herbs-label">
                    {h}
                  </span>
                  <span className="herbs-knob" />
                </button>
              )
            })}
          </div>
        )
      )}

      <div className="herbs-msg">{msg ?? (phase === 'read' ? '先把藥單記起來：四味藥、各幾錢。' : '')}</div>
    </div>
  )
}
