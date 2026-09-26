import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio'
import type { LanternResult, MinigameProps } from './types'
import './lantern.css'

// 放水燈（中元節，溪邊）：先點三下做好一盞蓮花水燈（摺花瓣、放蠟燭、點火），
// 再把它輕輕送下溪：左右拖（或方向鍵）引著燈，避開石頭和岸邊。
// 撞到石頭三次燈就熄了。漂得越遠、越穩，分數越高（0..1）。最後看著很多盞燈一起漂走。

const DRIFT = 18 // 秒
const SPEED = 0.26 // 每秒往前漂多遠（畫面寬 = 1）
const TOTAL = DRIFT * SPEED
const LANTERN_R = 0.045

type Phase = 'fold' | 'drift' | 'end'

interface Rock {
  x: number
  y: number
  r: number
}
interface Floater {
  x: number
  y: number
  sp: number
  ph: number
  s: number
}

// ---------------------------------------------------------------------------
// 小音效
// ---------------------------------------------------------------------------

let noiseBuf: AudioBuffer | null = null
function noiseOf(ctx: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

function rustle(vol = 0.15) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseOf(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2400
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
  src.connect(hp).connect(g).connect(audio.bus.sfx)
  src.start(t)
  src.stop(t + 0.3)
}

function tone(freq: number, len = 0.5, vol = 0.14, type: OscillatorType = 'sine', delay = 0) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime + delay
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + len + 0.05)
}

function thud() {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(180, t)
  o.frequency.exponentialRampToValueAtTime(60, t + 0.15)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.25, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + 0.22)
}

// ---------------------------------------------------------------------------

const bankL = (y: number) => 0.13 + Math.sin(y * 1.3 + 1) * 0.07 + Math.sin(y * 2.9) * 0.035
const bankR = (y: number) => 0.87 + Math.sin(y * 1.1 + 2.4) * 0.07 + Math.sin(y * 3.3 + 1) * 0.03

function makeRocks(): Rock[] {
  const rocks: Rock[] = []
  for (let y = 0.9; y < TOTAL + 1; y += 0.4 + Math.random() * 0.25) {
    const l = bankL(y) + 0.1
    const r = bankR(y) - 0.1
    const n = Math.random() < 0.2 ? 2 : 1
    for (let k = 0; k < n; k++) rocks.push({ x: l + Math.random() * (r - l), y: y + k * 0.08, r: 0.035 + Math.random() * 0.04 })
  }
  return rocks
}

export default function Lantern({ done }: MinigameProps<unknown, LanternResult>) {
  const [phase, setPhase] = useState<Phase>('fold')
  const [fold, setFold] = useState(0)
  const [hits, setHits] = useState(0)
  const [dist, setDist] = useState(0)
  const [score, setScore] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const g = useRef({
    t: 0,
    foldT: [0, 0, 0] as number[],
    fold: 0,
    x: 0.5,
    vx: 0,
    target: 0.5,
    d: 0,
    hits: 0,
    bank: 0,
    jerk: 0,
    wobble: 0,
    out: false,
    rocks: makeRocks(),
    floaters: [] as Floater[],
    keys: new Set<string>(),
    endT: 0,
    over: false,
  })

  const finish = (sc: number) => done({ score: sc })

  const tapFold = () => {
    const s = g.current
    if (s.fold >= 3) return
    s.foldT[s.fold] = s.t
    s.fold++
    setFold(s.fold)
    if (s.fold === 1) rustle(0.2)
    if (s.fold === 2) tone(880, 0.15, 0.08, 'triangle')
    if (s.fold === 3) {
      rustle(0.1)
      tone(523, 0.9, 0.1)
      tone(784, 0.9, 0.08, 'sine', 0.12)
      window.setTimeout(() => {
        if (g.current.over) return
        tone(330, 0.4, 0.1)
        setPhase('drift')
      }, 1300)
    }
  }

  // 鍵盤
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        g.current.over = true
        finish(0)
        return
      }
      if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) {
        e.preventDefault()
        e.stopPropagation()
        g.current.keys.add(k)
      }
      if (k === 'e' || k === ' ' || k === 'enter') {
        e.preventDefault()
        e.stopPropagation()
        if (e.repeat) return
        if (phase === 'fold') tapFold()
        else if (phase === 'end') finish(score)
      }
    }
    const up = (e: KeyboardEvent) => g.current.keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, score])

  // 主迴圈（三個階段共用一個畫布）
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const s = g.current
    if (phase === 'drift') {
      s.x = 0.5
      s.target = 0.5
      s.vx = 0
      s.d = 0
    }
    if (phase === 'end') {
      s.endT = 0
      // 一開始就有一些燈在畫面裡，其他的從下面陸續漂上來
      s.floaters = Array.from({ length: 26 }, (_, i) => ({ x: 0.18 + Math.random() * 0.64, y: 0.15 + i * 0.06 + Math.random() * 0.04, sp: 0.045 + Math.random() * 0.03, ph: Math.random() * 6, s: 0.5 + Math.random() * 0.3 }))
    }
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      s.t += dt
      if (phase === 'drift' && !s.out) {
        // 鍵盤：往左往右推目標
        if (s.keys.has('arrowleft') || s.keys.has('a')) s.target -= dt * 0.9
        if (s.keys.has('arrowright') || s.keys.has('d')) s.target += dt * 0.9
        s.target = Math.max(0.05, Math.min(0.95, s.target))
        // 燈往目標漂（有一點慢，水上的東西推不快），水流也會把燈往中間帶
        const y = s.d
        const mid = (bankL(y) + bankR(y)) / 2
        const ax = (s.target - s.x) * 5 - s.vx * 2.6 + (mid - s.x) * 0.6
        s.jerk += Math.abs(ax) * dt * 0.004
        s.vx += ax * dt
        s.x += s.vx * dt
        s.d += SPEED * dt
        s.wobble = Math.max(0, s.wobble - dt * 1.5)
        // 岸邊
        const l = bankL(y) + LANTERN_R
        const r = bankR(y) - LANTERN_R
        if (s.x < l || s.x > r) {
          s.x = Math.max(l, Math.min(r, s.x))
          s.vx *= -0.4
          if (s.wobble < 0.2) {
            s.bank++
            s.wobble = 0.5
            thud()
          }
        }
        // 石頭
        for (const rk of s.rocks) {
          const dy = rk.y - s.d
          if (dy < -0.15 || dy > 0.15) continue
          const dx = s.x - rk.x
          const dd = Math.hypot(dx, dy)
          if (dd < rk.r + LANTERN_R) {
            s.x = rk.x + (dx / (dd || 1)) * (rk.r + LANTERN_R + 0.005)
            s.vx = (dx >= 0 ? 1 : -1) * 0.35
            if (s.wobble < 0.3) {
              s.hits++
              s.wobble = 1
              setHits(s.hits)
              thud()
              if (s.hits >= 3) s.out = true
            }
          }
        }
        setDist(Math.min(1, s.d / TOTAL))
        if (s.d >= TOTAL || s.out) {
          const distK = Math.min(1, s.d / TOTAL)
          const steady = Math.max(0, 1 - s.hits * 0.28 - s.bank * 0.08 - Math.min(0.3, s.jerk))
          const sc = Math.round((0.6 * distK + 0.4 * steady) * (s.out ? 0.7 : 1) * 100) / 100
          setScore(sc)
          if (!s.out) {
            tone(659, 1.2, 0.1)
            tone(880, 1.4, 0.08, 'sine', 0.2)
          } else tone(220, 0.8, 0.1)
          window.setTimeout(() => !s.over && setPhase('end'), s.out ? 1200 : 400)
          s.out = true
        }
      }
      if (phase === 'end') s.endT += dt
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ---- 畫 ----
  const draw = () => {
    const c = canvas.current
    const w = wrap.current
    if (!c || !w) return
    const W = w.clientWidth
    const H = Math.min(W * 1.2, window.innerHeight * 0.58)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr)
      c.height = Math.round(H * dpr)
      c.style.width = `${W}px`
      c.style.height = `${H}px`
    }
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const s = g.current
    const t = s.t
    const LY = H * 0.78 // 燈在畫面上的高度
    // 世界座標 y（往前漂的距離）→ 畫面 y：前面的在上面
    const sy = (wy: number) => LY - (wy - s.d) * W
    // 水
    ctx.fillStyle = '#0c1c24'
    ctx.fillRect(0, 0, W, H)
    // 兩岸（芒草叢的剪影）
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#16241a'
      ctx.beginPath()
      ctx.moveTo(side < 0 ? 0 : W, 0)
      for (let py = 0; py <= H; py += 6) {
        const wy = s.d + (LY - py) / W
        const bx = (side < 0 ? bankL(wy) : bankR(wy)) * W
        ctx.lineTo(bx, py)
      }
      ctx.lineTo(side < 0 ? 0 : W, H)
      ctx.fill()
      // 岸邊一叢一叢的芒草穗
      for (let k = 0; k < 14; k++) {
        const wy = Math.floor(s.d * 4) / 4 + k * 0.25 - 1
        const py = sy(wy)
        if (py < -20 || py > H + 20) continue
        const bx = (side < 0 ? bankL(wy) - 0.03 : bankR(wy) + 0.03) * W
        ctx.fillStyle = 'rgba(200,196,178,0.35)'
        ctx.beginPath()
        ctx.ellipse(bx, py, 6, 14, side * 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // 水流的線條
    ctx.strokeStyle = 'rgba(150,190,210,0.09)'
    ctx.lineWidth = 1.2
    for (let i = 0; i < 26; i++) {
      const wy = Math.floor(s.d * 6) / 6 + (i % 13) * 0.16 - 0.4
      const py = sy(wy) + ((t * 30 + i * 13) % 12)
      const x0 = (bankL(wy) + 0.05 + ((i * 0.37) % 0.6)) * W
      ctx.beginPath()
      ctx.moveTo(x0, py)
      ctx.lineTo(x0 + 3, py - 18)
      ctx.stroke()
    }
    // 月光
    const mg = ctx.createLinearGradient(W * 0.3, 0, W * 0.7, 0)
    mg.addColorStop(0, 'rgba(200,220,255,0)')
    mg.addColorStop(0.5, 'rgba(200,220,255,0.06)')
    mg.addColorStop(1, 'rgba(200,220,255,0)')
    ctx.fillStyle = mg
    ctx.fillRect(0, 0, W, H)
    // 石頭
    if (phase === 'drift') {
      for (const rk of s.rocks) {
        const py = sy(rk.y)
        if (py < -40 || py > H + 40) continue
        const px = rk.x * W
        const rr = rk.r * W
        // 水流過石頭的白色水花
        ctx.strokeStyle = 'rgba(220,240,255,0.25)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(px, py + rr * 0.3, rr * 1.25, Math.PI * 0.1, Math.PI * 0.9)
        ctx.stroke()
        const gr = ctx.createRadialGradient(px - rr * 0.3, py - rr * 0.3, rr * 0.1, px, py, rr)
        gr.addColorStop(0, '#6d6c66')
        gr.addColorStop(1, '#2c2b28')
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.ellipse(px, py, rr, rr * 0.85, 0.3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // 螢火蟲
    for (let i = 0; i < 14; i++) {
      const x = ((Math.sin(i * 7.3 + t * 0.2) * 0.5 + 0.5) * 0.9 + 0.05) * W
      const y = ((i * 0.13 + t * 0.01) % 1) * H
      const a = Math.max(0, Math.sin(t * (1 + (i % 3) * 0.4) + i))
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 7)
      gr.addColorStop(0, `rgba(230,255,150,${0.8 * a})`)
      gr.addColorStop(1, 'rgba(200,255,120,0)')
      ctx.fillStyle = gr
      ctx.fillRect(x - 7, y - 7, 14, 14)
    }

    if (phase === 'fold') {
      // 做水燈：畫面中間放大的蓮花燈
      const cx = W / 2
      const cy = H * 0.48
      const k = (i: number) => (s.fold > i ? Math.min(1, (t - s.foldT[i]) / 0.5) : 0)
      // 紙
      if (s.fold === 0) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(0.2 + Math.sin(t * 1.2) * 0.03)
        ctx.fillStyle = '#f7c9d4'
        ctx.fillRect(-60, -60, 120, 120)
        ctx.strokeStyle = 'rgba(200,120,140,0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(-60, -60)
        ctx.lineTo(60, 60)
        ctx.moveTo(60, -60)
        ctx.lineTo(-60, 60)
        ctx.stroke()
        ctx.restore()
      } else drawLotus(ctx, cx, cy, 2.3 * (0.6 + 0.4 * k(0)), k(0), s.fold >= 3 ? k(2) : 0, t, s.fold >= 2 ? k(1) : 0)
      if (s.fold === 3) {
        // 點火的火星
        const kk = k(2)
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + t
          const rr = 20 + kk * 40
          ctx.fillStyle = `rgba(255,220,140,${(1 - kk) * 0.8})`
          ctx.fillRect(cx + Math.cos(a) * rr, cy - 30 + Math.sin(a) * rr * 0.6, 3, 3)
        }
      }
    } else if (phase === 'drift') {
      // 我的燈
      const wob = Math.sin(t * 9) * s.wobble * 0.3
      drawLotus(ctx, s.x * W, LY, 0.95, 1, s.hits >= 3 ? 0 : 1 - s.hits * 0.15, t, 1, wob)
    } else {
      // 很多盞燈一起往遠方漂
      const k = Math.min(1, s.endT / 2)
      // 越上面越遠、越小（遠遠漂走的燈）
      const list = s.floaters
        .map((f) => ({ f, y: (f.y - s.endT * f.sp) * H }))
        .filter((o) => o.y > -30 && o.y < H + 30)
        .sort((a, b) => a.y - b.y)
      for (const { f, y } of list) {
        const depth = 0.35 + 0.65 * Math.max(0, Math.min(1, y / H))
        drawLotus(ctx, (f.x + Math.sin(s.endT * 0.4 + f.ph) * 0.03) * W, y, f.s * depth, 1, 1, t + f.ph, 1)
      }
      ctx.fillStyle = `rgba(6,12,16,${0.25 * k})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  const onMove = (e: React.PointerEvent) => {
    const w = wrap.current
    if (!w || phase !== 'drift') return
    const r = w.getBoundingClientRect()
    g.current.target = Math.max(0.05, Math.min(0.95, (e.clientX - r.left) / r.width))
  }

  const verdict = score >= 0.8 ? '燈漂得好遠好穩' : score >= 0.5 ? '燈有漂出去' : '燈沒漂多遠……心意到了就好'

  return (
    <div className="ln-card" onPointerDown={(e) => e.stopPropagation()}>
      <div className="ln-head">
        <span className="ln-title">🪷 放水燈</span>
        {phase === 'drift' && (
          <span className="ln-stat">
            {[0, 1, 2].map((i) => (
              <i key={i} className={`ln-flame ${i < 3 - hits ? 'on' : ''}`} />
            ))}
          </span>
        )}
      </div>
      <div
        className="ln-stage"
        ref={wrap}
        onPointerDown={(e) => {
          if (phase === 'fold') tapFold()
          else if (phase === 'drift') {
            try {
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            } catch {
              // 抓不到指標也沒關係
            }
            onMove(e)
          }
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === 'mouse') onMove(e)
        }}
      >
        <canvas ref={canvas} className="ln-canvas" />
        {phase === 'fold' && (
          <div className="ln-hint">
            {fold === 0 && '點一下：摺蓮花'}
            {fold === 1 && '點一下：放蠟燭'}
            {fold === 2 && '點一下：點火'}
            {fold === 3 && '好了，放到溪裡……'}
          </div>
        )}
        {phase === 'drift' && <div className="ln-hint small">左右拖（或方向鍵）引著燈，別撞到石頭</div>}
        {phase === 'end' && (
          <div className="ln-overlay">
            <p className="ln-poem">
              <span>願迷路的人，</span>
              <span>都找得到回家的路。</span>
            </p>
            <div className="ln-sub">{verdict}</div>
            <div className="ln-merit">🪷 功德 +{Math.round(score * 3)}</div>
            <button className="btn primary big" onClick={() => finish(score)}>
              合掌
            </button>
          </div>
        )}
      </div>
      {phase === 'drift' && (
        <div className="ln-progress">
          <span>漂了</span>
          <div className="meter warm">
            <i style={{ width: `${dist * 100}%` }} />
          </div>
        </div>
      )}
      <button
        className="ln-leave"
        onClick={() => {
          g.current.over = true
          finish(phase === 'end' ? score : 0)
        }}
      >
        離開
      </button>
    </div>
  )
}

/**
 * 蓮花水燈：粉紅的花瓣一層一層，中間一根蠟燭。
 * open 花瓣張開的程度、flame 火的大小、candle 蠟燭放上去的程度、wob 搖晃（弧度）
 */
function drawLotus(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, open: number, flame: number, t: number, candle: number, wob = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(wob)
  // 水面上的暖光倒影
  if (flame > 0.05) {
    const gl = ctx.createRadialGradient(0, 6 * s, 0, 0, 6 * s, 46 * s)
    gl.addColorStop(0, `rgba(255,190,110,${0.35 * flame})`)
    gl.addColorStop(1, 'rgba(255,170,90,0)')
    ctx.fillStyle = gl
    ctx.beginPath()
    ctx.ellipse(0, 6 * s, 46 * s, 30 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // 花瓣：外圈、內圈
  const rings = [
    { n: 8, len: 22, w: 9, col: '#f3a9bd', edge: '#e07a96', lift: 0 },
    { n: 6, len: 16, w: 7.5, col: '#fbd3dd', edge: '#ee98ae', lift: 4 },
  ]
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + (ring.lift ? 0.3 : 0)
      const len = ring.len * s * (0.5 + 0.5 * open)
      ctx.save()
      ctx.rotate(a)
      ctx.translate(0, -ring.lift * s * 0.3)
      ctx.fillStyle = ring.col
      ctx.strokeStyle = ring.edge
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(0, -len * 0.55, ring.w * s * (0.6 + 0.4 * open), len * 0.6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  }
  // 蠟燭
  if (candle > 0) {
    const drop = (1 - candle) * 30 * s
    ctx.fillStyle = '#d8342a'
    ctx.fillRect(-3 * s, -8 * s - drop, 6 * s, 9 * s)
    ctx.fillStyle = '#f2e6c8'
    ctx.fillRect(-3 * s, -9 * s - drop, 6 * s, 1.5 * s)
  }
  // 火
  if (flame > 0.02) {
    const f = flame * (0.9 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.1) * 0.06)
    const gl = ctx.createRadialGradient(0, -14 * s, 0, 0, -14 * s, 22 * s * f)
    gl.addColorStop(0, 'rgba(255,230,160,0.9)')
    gl.addColorStop(0.4, 'rgba(255,170,80,0.35)')
    gl.addColorStop(1, 'rgba(255,150,60,0)')
    ctx.fillStyle = gl
    ctx.fillRect(-24 * s, -38 * s, 48 * s, 48 * s)
    ctx.fillStyle = '#fff4c8'
    ctx.beginPath()
    ctx.ellipse(0, -14 * s, 2.4 * s * f, 5 * s * f, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
