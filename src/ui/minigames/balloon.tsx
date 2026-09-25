import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio'
import { sfx } from '../../audio/sfx'
import type { MinigameProps, PrizeResult } from './types'
import './goldfish.css'
import './balloon.css'

// 射氣球（鬼夜市）：5 支飛鏢。阿嬤的手會抖，準星自己晃，抓準時機再丟。
// 中 1–2 顆 → 功德 1、3–4 顆 → 2、5 顆全中 → 3。

const DARTS = 5
const COLS = 6
const ROWS = 4
const R = 0.052 // 氣球半徑（板子座標，寬 1）
const ASPECT = 0.78

type Phase = 'intro' | 'play' | 'done'

interface Balloon {
  x: number
  y: number
  color: string
  ghost: boolean
  popped: number // 0 = 還在；> 0 = 破掉後經過的秒數
  phase: number
}

interface Dart {
  x0: number
  y0: number
  x: number
  y: number
  t: number
  hit: boolean | null
}

interface Bit {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
  rot: number
}

const COLORS = ['#e8302a', '#f2c42a', '#2a7ae8', '#3ab85a', '#f27ab8', '#a86ae8']

const meritFor = (hits: number) => (hits >= 5 ? 3 : hits >= 3 ? 2 : hits >= 1 ? 1 : 0)

let noise: AudioBuffer | null = null
function pop() {
  const ctx = audio.ctx
  if (!ctx) return
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noise
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 900
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.5, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  src.connect(hp).connect(g).connect(audio.bus.sfx)
  src.start(t)
  src.stop(t + 0.15)
  // 低低的一聲「砰」
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(180, t)
  o.frequency.exponentialRampToValueAtTime(60, t + 0.1)
  const og = ctx.createGain()
  og.gain.setValueAtTime(0.35, t)
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
  o.connect(og).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + 0.16)
}

export default function Balloon({ done }: MinigameProps<unknown, PrizeResult>) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [hits, setHits] = useState(0)
  const [left, setLeft] = useState(DARTS)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const g = useRef({
    balloons: [] as Balloon[],
    darts: [] as Dart[],
    stuck: [] as { x: number; y: number; a: number }[],
    bits: [] as Bit[],
    aim: { x: 0.5, y: 0.45 },
    keys: new Set<string>(),
    touch: false,
    t: 0,
    thrown: 0,
    hits: 0,
    over: false,
    flash: 0,
  })

  const finish = (merit: number) => done({ merit })

  useEffect(() => {
    const out: Balloon[] = []
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        out.push({
          x: 0.14 + (c / (COLS - 1)) * 0.72 + (r % 2 ? 0.035 : -0.035),
          y: 0.16 + r * 0.155,
          color: COLORS[(r * 3 + c * 5) % COLORS.length],
          ghost: (r * COLS + c) % 7 === 3,
          popped: 0,
          phase: Math.random() * 6.28,
        })
      }
    g.current.balloons = out
  }, [])

  // 準星的位置：瞄準點＋手抖（慢慢畫圈＋一點點急抖）
  const sway = (t: number) => ({
    x: Math.sin(t * 1.3) * 0.045 + Math.sin(t * 3.7 + 1) * 0.014,
    y: Math.cos(t * 1.7 + 0.5) * 0.036 + Math.sin(t * 4.3) * 0.012,
  })
  const cross = () => {
    const s = g.current
    const w = sway(s.t)
    return { x: s.aim.x + w.x, y: s.aim.y + w.y }
  }
  // 每一排會左右慢慢飄
  const balloonPos = (b: Balloon, t: number) => {
    const row = Math.round((b.y - 0.16) / 0.155)
    return { x: b.x + Math.sin(t * (0.6 + row * 0.15) + row) * 0.03, y: b.y + Math.sin(t * 2 + b.phase) * 0.006 }
  }

  function throwDart() {
    const s = g.current
    if (s.over || s.thrown >= DARTS) return
    const c = cross()
    s.thrown++
    setLeft(DARTS - s.thrown)
    s.darts.push({ x0: 0.5, y0: 1.1, x: c.x, y: c.y, t: 0, hit: null })
    sfx.play('whoosh', { volume: 0.35, rate: 1.6 })
  }

  function step(dt: number) {
    const s = g.current
    s.t += dt
    const kx = (s.keys.has('arrowright') || s.keys.has('d') ? 1 : 0) - (s.keys.has('arrowleft') || s.keys.has('a') ? 1 : 0)
    const ky = (s.keys.has('arrowdown') || s.keys.has('s') ? 1 : 0) - (s.keys.has('arrowup') || s.keys.has('w') ? 1 : 0)
    if (kx || ky) {
      s.aim.x = Math.min(0.95, Math.max(0.05, s.aim.x + kx * dt * 0.5))
      s.aim.y = Math.min(0.9, Math.max(0.05, s.aim.y + ky * dt * 0.5))
    }
    for (const d of s.darts) {
      d.t += dt
      if (d.t >= 0.22 && d.hit === null) {
        // 到了：看有沒有射中
        const hit = s.balloons.find((b) => {
          if (b.popped) return false
          const p = balloonPos(b, s.t)
          return Math.hypot(p.x - d.x, (p.y - d.y) * 0.9) < R * 1.05
        })
        d.hit = !!hit
        if (hit) {
          hit.popped = 0.001
          s.hits++
          setHits(s.hits)
          pop()
          s.flash = 1
          const p = balloonPos(hit, s.t)
          for (let i = 0; i < 16; i++) {
            const a = Math.random() * Math.PI * 2
            const v = 0.3 + Math.random() * 0.5
            s.bits.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.2, life: 0.8, color: i % 3 ? hit.color : '#fff6c0', rot: Math.random() * 6 })
          }
        } else {
          s.stuck.push({ x: d.x, y: d.y, a: (Math.random() - 0.5) * 0.4 })
          sfx.play('knock', { volume: 0.25, rate: 1.8 })
        }
      }
    }
    s.darts = s.darts.filter((d) => d.t < 0.22 || d.hit === null)
    for (const b of s.balloons) if (b.popped) b.popped += dt
    for (const p of s.bits) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 1.2 * dt
      p.rot += dt * 8
      p.life -= dt
    }
    s.bits = s.bits.filter((p) => p.life > 0)
    s.flash = Math.max(0, s.flash - dt * 4)
    if (!s.over && s.thrown >= DARTS && s.darts.length === 0) {
      s.over = true
      if (s.hits >= 3) audio.chime()
      window.setTimeout(() => setPhase('done'), 700)
    }
  }

  function draw() {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const s = g.current
    const X = (x: number) => x * W
    const Y = (y: number) => y * H
    // 板子：木頭＋布
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#5a3a24')
    bg.addColorStop(1, '#3a2416')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    for (let i = 0; i < 10; i++) ctx.fillRect((i / 10) * W, 0, 2, H)
    // 頂上一排小燈泡
    for (let i = 0; i < 14; i++) {
      const on = Math.sin(s.t * 4 + i) > -0.2
      ctx.fillStyle = on ? '#ffd66a' : '#6a5230'
      ctx.beginPath()
      ctx.arc(X(0.04 + i * 0.07), Y(0.035), W * 0.009, 0, Math.PI * 2)
      ctx.fill()
    }
    // 釘在板子上的飛鏢
    for (const d of s.stuck) drawDart(ctx, X(d.x), Y(d.y), W * 0.06, d.a, 1)
    // 氣球
    for (const b of s.balloons) {
      const p = balloonPos(b, s.t)
      if (b.popped) {
        if (b.popped < 0.25) {
          // 破掉的一瞬間：碎片圈
          ctx.strokeStyle = b.color
          ctx.lineWidth = W * 0.006
          ctx.beginPath()
          ctx.arc(X(p.x), Y(p.y), W * R * (1 + b.popped * 5), 0, Math.PI * 2)
          ctx.stroke()
        }
        // 剩一小片破皮掛在釘子上
        ctx.fillStyle = b.color
        ctx.beginPath()
        ctx.moveTo(X(p.x) - W * 0.012, Y(p.y + R * 1.05))
        ctx.lineTo(X(p.x) + W * 0.012, Y(p.y + R * 1.05))
        ctx.lineTo(X(p.x), Y(p.y + R * 1.5))
        ctx.fill()
        continue
      }
      drawBalloon(ctx, X(p.x), Y(p.y), W * R, b)
    }
    // 碎片
    for (const bit of s.bits) {
      ctx.save()
      ctx.translate(X(bit.x), Y(bit.y))
      ctx.rotate(bit.rot)
      ctx.globalAlpha = Math.min(1, bit.life * 2)
      ctx.fillStyle = bit.color
      ctx.fillRect(-W * 0.007, -W * 0.004, W * 0.014, W * 0.008)
      ctx.restore()
    }
    // 飛行中的飛鏢
    for (const d of s.darts) {
      const k = Math.min(1, d.t / 0.22)
      const x = d.x0 + (d.x - d.x0) * k
      const y = d.y0 + (d.y - d.y0) * k - Math.sin(k * Math.PI) * 0.08
      drawDart(ctx, X(x), Y(y), W * (0.12 - k * 0.06), Math.atan2(d.x - d.x0, -(d.y - d.y0)) * 0.3, 1)
    }
    // 準星
    if (phase === 'play' && !s.over) {
      const c2 = cross()
      const cx = X(c2.x)
      const cy = Y(c2.y)
      const r = W * 0.035
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'
      ctx.lineWidth = W * 0.005
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.moveTo(cx - r * 1.6, cy)
      ctx.lineTo(cx - r * 0.5, cy)
      ctx.moveTo(cx + r * 0.5, cy)
      ctx.lineTo(cx + r * 1.6, cy)
      ctx.moveTo(cx, cy - r * 1.6)
      ctx.lineTo(cx, cy - r * 0.5)
      ctx.moveTo(cx, cy + r * 0.5)
      ctx.lineTo(cx, cy + r * 1.6)
      ctx.stroke()
      ctx.fillStyle = '#ff3a2a'
      ctx.beginPath()
      ctx.arc(cx, cy, W * 0.006, 0, Math.PI * 2)
      ctx.fill()
      // 瞄準點（手想瞄的地方）
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.setLineDash([W * 0.01, W * 0.01])
      ctx.beginPath()
      ctx.arc(X(s.aim.x), Y(s.aim.y), W * 0.06, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,240,200,${s.flash * 0.12})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  // 主迴圈（開場畫面也要畫，讓人看得到氣球）
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (phase === 'play') step(dt)
      else g.current.t += dt
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish(phase === 'done' ? meritFor(g.current.hits) : 0)
        return
      }
      if (k === ' ' || k === 'e' || k === 'enter') {
        e.preventDefault()
        if (e.repeat) return
        if (phase === 'intro') setPhase('play')
        else if (phase === 'play') throwDart()
        else finish(meritFor(g.current.hits))
        return
      }
      g.current.keys.add(k)
    }
    const up = (e: KeyboardEvent) => g.current.keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    const c = canvas.current
    const w = wrap.current
    if (!c || !w) return
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = w.clientWidth
      const ch = Math.round(cw * ASPECT)
      c.style.width = `${cw}px`
      c.style.height = `${ch}px`
      c.width = Math.round(cw * dpr)
      c.height = Math.round(ch * dpr)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(w)
    return () => ro.disconnect()
  }, [])

  const toBoard = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    // 手指會擋住：用手指的時候準星在手指上方一點
    const up = e.pointerType === 'touch' ? 0.1 : 0
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height - up }
  }

  return (
    <div className="mk-card" onPointerDown={(e) => e.stopPropagation()}>
      <div className="mk-head">
        <span className="mk-title">🎈 射氣球</span>
        <span className="mk-stat">
          中 <b>{hits}</b> 顆
        </span>
        <span className="bl-darts" aria-label={`剩 ${left} 支`}>
          {Array.from({ length: DARTS }, (_, i) => (
            <i key={i} className={i < left ? 'on' : ''} />
          ))}
        </span>
      </div>
      <div className="mk-stage" ref={wrap}>
        <canvas
          ref={canvas}
          className="mk-canvas"
          onPointerDown={(e) => {
            if (phase !== 'play') return
            const p = toBoard(e)
            g.current.aim = p
            if (e.pointerType === 'mouse') throwDart()
            else e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const p = toBoard(e)
            g.current.aim = { x: Math.min(0.97, Math.max(0.03, p.x)), y: Math.min(0.95, Math.max(0.03, p.y)) }
          }}
          onPointerUp={(e) => {
            // 手機：按住瞄準、放開丟
            if (phase === 'play' && e.pointerType !== 'mouse') throwDart()
          }}
        />
        {phase === 'intro' && (
          <div className="mk-overlay">
            <p>
              五支飛鏢，射破越多顆越好。
              <br />
              阿嬤的手會抖，<b>準星自己會晃</b>，等它晃到氣球上再丟。
            </p>
            <p className="muted">電腦：滑鼠瞄準點一下；手機：按住瞄準、放開丟</p>
            <button className="btn primary big" onClick={() => setPhase('play')}>
              開始
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="mk-overlay">
            <div className="mk-result">
              射中 <b>{hits}</b> 顆
            </div>
            <div className="mk-merit">🪷 功德 +{meritFor(hits)}</div>
            <button className="btn primary big" onClick={() => finish(meritFor(hits))}>
              收下
            </button>
          </div>
        )}
      </div>
      <button className="mk-leave" onClick={() => finish(phase === 'done' ? meritFor(hits) : 0)}>
        離開
      </button>
    </div>
  )
}

function drawBalloon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, b: Balloon) {
  // 繩子
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = r * 0.06
  ctx.beginPath()
  ctx.moveTo(x, y + r * 1.1)
  ctx.quadraticCurveTo(x + r * 0.3, y + r * 1.5, x, y + r * 1.9)
  ctx.stroke()
  // 本體
  const fill = b.ghost ? '#f4f2ee' : b.color
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.2)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.25, fill)
  grad.addColorStop(1, shade(fill))
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(x, y, r * 0.9, r * 1.05, 0, 0, Math.PI * 2)
  ctx.fill()
  // 打結
  ctx.fillStyle = shade(fill)
  ctx.beginPath()
  ctx.moveTo(x - r * 0.12, y + r * 1.12)
  ctx.lineTo(x + r * 0.12, y + r * 1.12)
  ctx.lineTo(x, y + r * 0.98)
  ctx.fill()
  if (b.ghost) {
    // 小鬼臉氣球
    ctx.fillStyle = '#222'
    ctx.beginPath()
    ctx.ellipse(x - r * 0.3, y - r * 0.1, r * 0.1, r * 0.16, 0, 0, Math.PI * 2)
    ctx.ellipse(x + r * 0.3, y - r * 0.1, r * 0.1, r * 0.16, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(x, y + r * 0.35, r * 0.14, r * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawDart(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, a: number, alpha: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a)
  ctx.globalAlpha = alpha
  // 尖端在 (0,0)，尾巴往下
  ctx.strokeStyle = '#d8d8dc'
  ctx.lineWidth = len * 0.06
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, len * 0.55)
  ctx.stroke()
  ctx.fillStyle = '#c8302a'
  ctx.fillRect(-len * 0.05, len * 0.35, len * 0.1, len * 0.35)
  ctx.fillStyle = '#f2c42a'
  ctx.beginPath()
  ctx.moveTo(0, len * 0.6)
  ctx.lineTo(-len * 0.18, len)
  ctx.lineTo(0, len * 0.88)
  ctx.lineTo(len * 0.18, len)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * 0.62)
  const g = Math.round(((n >> 8) & 255) * 0.62)
  const b = Math.round((n & 255) * 0.62)
  return `rgb(${r},${g},${b})`
}
