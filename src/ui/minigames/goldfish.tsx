import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio'
import { sfx } from '../../audio/sfx'
import type { MinigameProps, PrizeResult } from './types'
import './goldfish.css'

// 撈金魚（鬼夜市・金魚伯）：紙網泡在水裡會越來越軟，動太快會破。
// 按住＝網子下水，放開＝撈起來；網子裡的魚就撈到了。20 秒或網子破掉就結束。
// 撈到 1–2 隻 → 功德 1、3–4 隻 → 2、5 隻以上 → 3。

const TIME = 20
const NET_R = 0.105 // 網子半徑（水盆座標，水盆寬 1）
const TUB = { cx: 0.5, cy: 0.5, rx: 0.46, ry: 0.4 }

type Phase = 'intro' | 'play' | 'done'

interface Fish {
  x: number
  y: number
  a: number
  v: number
  size: number
  color: string
  spots: boolean
  wig: number
  turn: number
}

interface Flying {
  fish: Fish
  t: number
  x0: number
  y0: number
}

interface Drop {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

interface Ripple {
  x: number
  y: number
  t: number
}

const COLORS = ['#ff6a1a', '#ff4a1a', '#ff8a2a', '#e8301a', '#1c1c20', '#f4efe6', '#ff6a1a', '#ff9a3a', '#e8401a', '#1c1c20']

const meritFor = (n: number) => (n >= 5 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0)

// ---------------------------------------------------------------------------
// 小音效（直接用 Web Audio 合成）
// ---------------------------------------------------------------------------

let noise: AudioBuffer | null = null
function splash(vol = 0.25, freq = 900) {
  const ctx = audio.ctx
  if (!ctx) return
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noise
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(freq, t)
  bp.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.25)
  bp.Q.value = 0.9
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
  src.connect(bp).connect(g).connect(audio.bus.sfx)
  src.start(t)
  src.stop(t + 0.35)
}

function rip() {
  for (let i = 0; i < 3; i++) window.setTimeout(() => splash(0.18, 2600 - i * 500), i * 45)
}

// ---------------------------------------------------------------------------

export default function Goldfish({ done }: MinigameProps<unknown, PrizeResult>) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [caught, setCaught] = useState(0)
  const [left, setLeft] = useState(TIME)
  const [paper, setPaper] = useState(1)
  const [torn, setTorn] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  // 遊戲狀態放 ref：每幀更新，不觸發 React 重畫
  const g = useRef({
    fish: [] as Fish[],
    flying: [] as Flying[],
    drops: [] as Drop[],
    ripples: [] as Ripple[],
    net: { x: 0.5, y: 0.62, tx: 0.5, ty: 0.62, dipped: false, dipT: 0, paper: 1, torn: false, tornT: 0 },
    keys: new Set<string>(),
    caught: 0,
    t: 0,
    over: false,
    bowl: [] as Fish[],
  })

  const finish = (merit: number) => done({ merit })

  // 初始化魚
  useEffect(() => {
    const fish: Fish[] = []
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * 0.8
      fish.push({
        x: TUB.cx + Math.cos(a) * TUB.rx * r,
        y: TUB.cy + Math.sin(a) * TUB.ry * r,
        a: Math.random() * Math.PI * 2,
        v: 0.07 + Math.random() * 0.08,
        size: i === 0 ? 1.55 : 0.75 + Math.random() * 0.5, // 一隻特別大的「魚王」
        color: COLORS[i],
        spots: i % 4 === 3,
        wig: Math.random() * 6,
        turn: 0,
      })
    }
    g.current.fish = fish
  }, [])

  // 主迴圈
  useEffect(() => {
    if (phase !== 'play') return
    let raf = 0
    let last = performance.now()
    let sec = TIME
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      step(dt)
      draw()
      const s = g.current
      const l = Math.max(0, TIME - s.t)
      if (Math.ceil(l) !== sec) {
        sec = Math.ceil(l)
        setLeft(sec)
      }
      if (!s.over) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // 鍵盤
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish(phase === 'done' ? meritFor(g.current.caught) : 0)
        return
      }
      if (phase === 'intro' && (k === ' ' || k === 'e' || k === 'enter')) {
        e.preventDefault()
        setPhase('play')
        return
      }
      if (phase === 'done' && (k === ' ' || k === 'e' || k === 'enter')) {
        e.preventDefault()
        finish(meritFor(g.current.caught))
        return
      }
      if (phase !== 'play') return
      if (k === ' ' || k === 'e') {
        e.preventDefault()
        if (!e.repeat) dip(true)
      }
      g.current.keys.add(k)
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (phase === 'play' && (k === ' ' || k === 'e')) dip(false)
      g.current.keys.delete(k)
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // 畫布大小跟著容器
  useEffect(() => {
    const c = canvas.current
    const w = wrap.current
    if (!c || !w) return
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = w.clientWidth
      const ch = Math.round(cw * 0.8)
      c.style.width = `${cw}px`
      c.style.height = `${ch}px`
      c.width = Math.round(cw * dpr)
      c.height = Math.round(ch * dpr)
      draw()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(w)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------

  function dip(on: boolean) {
    const s = g.current
    const n = s.net
    if (s.over || n.torn) return
    if (on && !n.dipped) {
      n.dipped = true
      n.dipT = 0
      s.ripples.push({ x: n.x, y: n.y, t: 0 })
      splash(0.14, 700)
    } else if (!on && n.dipped) {
      n.dipped = false
      lift()
    }
  }

  function lift() {
    const s = g.current
    const n = s.net
    splash(0.2, 1300)
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      s.drops.push({ x: n.x + Math.cos(a) * NET_R * 0.6, y: n.y + Math.sin(a) * NET_R * 0.6, vx: Math.cos(a) * 0.25, vy: -0.3 - Math.random() * 0.4, life: 0.6 })
    }
    if (n.dipT < 0.12) return
    // 網子裡的魚：大魚要網子夠硬，不然直接破
    const inNet = s.fish.filter((f) => Math.hypot(f.x - n.x, (f.y - n.y) * 1.1) < NET_R * 0.95)
    let got = 0
    for (const f of inNet.slice(0, 2)) {
      if (f.size > 1.2 && n.paper < 0.45) {
        tear()
        break
      }
      n.paper -= f.size * 0.12
      s.fish = s.fish.filter((x) => x !== f)
      s.flying.push({ fish: f, t: 0, x0: f.x, y0: f.y })
      got++
    }
    if (got) {
      s.caught += got
      setCaught(s.caught)
      sfx.play('pickup', { volume: 0.7, rate: 1.2 })
    }
    if (n.paper <= 0) tear()
    setPaper(Math.max(0, n.paper))
  }

  function tear() {
    const s = g.current
    const n = s.net
    if (n.torn) return
    n.torn = true
    n.dipped = false
    n.paper = 0
    setTorn(true)
    setPaper(0)
    rip()
  }

  function end() {
    const s = g.current
    if (s.over) return
    s.over = true
    audio.chime()
    window.setTimeout(() => setPhase('done'), 500)
  }

  function step(dt: number) {
    const s = g.current
    if (s.over) return
    s.t += dt
    const n = s.net
    // 鍵盤移動網子
    const kx = (s.keys.has('arrowright') || s.keys.has('d') ? 1 : 0) - (s.keys.has('arrowleft') || s.keys.has('a') ? 1 : 0)
    const ky = (s.keys.has('arrowdown') || s.keys.has('s') ? 1 : 0) - (s.keys.has('arrowup') || s.keys.has('w') ? 1 : 0)
    if (kx || ky) {
      n.tx = Math.min(0.95, Math.max(0.05, n.tx + kx * dt * 0.55))
      n.ty = Math.min(0.92, Math.max(0.08, n.ty + ky * dt * 0.55))
    }
    const px = n.x
    const py = n.y
    const follow = 1 - Math.exp(-(n.dipped ? 9 : 16) * dt)
    n.x += (n.tx - n.x) * follow
    n.y += (n.ty - n.y) * follow
    const speed = Math.hypot(n.x - px, n.y - py) / Math.max(dt, 1e-4)
    // 泡水的紙網：時間 + 在水裡移動的速度都會讓它變軟
    if (n.dipped && !n.torn) {
      n.dipT += dt
      n.paper -= dt * (0.07 + Math.max(0, speed - 0.25) * 0.55)
      if (n.paper <= 0) tear()
      if (Math.random() < dt * 6) s.ripples.push({ x: n.x, y: n.y, t: 0 })
    }
    if (n.torn) n.tornT += dt

    // 魚：隨意游、避開盆邊，網子下水時會躲
    for (const f of s.fish) {
      f.wig += dt * (6 + f.v * 30)
      f.turn += (Math.random() - 0.5) * dt * 3
      f.turn *= 0.97
      f.a += f.turn * dt * 2
      let vx = Math.cos(f.a)
      let vy = Math.sin(f.a)
      const ex = (f.x - TUB.cx) / TUB.rx
      const ey = (f.y - TUB.cy) / TUB.ry
      const e = Math.hypot(ex, ey)
      if (e > 0.78) {
        // 轉回中間
        const want = Math.atan2(-ey * TUB.ry, -ex * TUB.rx)
        f.a += angleDiff(want, f.a) * Math.min(1, dt * 3)
      }
      let sp = f.v
      if (n.dipped) {
        const dx = f.x - n.x
        const dy = f.y - n.y
        const d = Math.hypot(dx, dy)
        if (d < NET_R * 2.2) {
          const flee = Math.atan2(dy, dx)
          f.a += angleDiff(flee, f.a) * Math.min(1, dt * 2.2)
          sp *= 1.8
        }
      }
      vx = Math.cos(f.a)
      vy = Math.sin(f.a)
      f.x += vx * sp * dt
      f.y += vy * sp * dt * 0.9
    }
    // 飛到碗裡的魚
    for (const fl of s.flying) fl.t += dt
    const landed = s.flying.filter((fl) => fl.t >= 0.6)
    if (landed.length) {
      s.bowl.push(...landed.map((l) => l.fish))
      s.flying = s.flying.filter((fl) => fl.t < 0.6)
      splash(0.1, 1600)
    }
    for (const d of s.drops) {
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.vy += 1.4 * dt
      d.life -= dt
    }
    s.drops = s.drops.filter((d) => d.life > 0)
    for (const r of s.ripples) r.t += dt
    s.ripples = s.ripples.filter((r) => r.t < 1)
    if (Math.random() < dt * 4) setPaper(Math.max(0, n.paper))

    if (s.t >= TIME || (n.torn && n.tornT > 1) || s.fish.length === 0) end()
  }

  function draw() {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const s = g.current
    const t = s.t
    const X = (x: number) => x * W
    const Y = (y: number) => y * H
    ctx.clearRect(0, 0, W, H)

    // 木桌
    ctx.fillStyle = '#2a1a12'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    for (let i = 0; i < 12; i++) ctx.fillRect(0, (i / 12) * H, W, 2)

    // 水盆：藍色塑膠邊
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(X(TUB.cx), Y(TUB.cy), X(TUB.rx) + W * 0.025, Y(TUB.ry) + W * 0.025, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#2f7fc4'
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(X(TUB.cx), Y(TUB.cy), X(TUB.rx), Y(TUB.ry), 0, 0, Math.PI * 2)
    ctx.clip()
    const water = ctx.createRadialGradient(X(0.45), Y(0.4), W * 0.05, X(0.5), Y(0.5), W * 0.55)
    water.addColorStop(0, '#3a9ac8')
    water.addColorStop(1, '#16506e')
    ctx.fillStyle = water
    ctx.fillRect(0, 0, W, H)
    // 水底的光紋
    ctx.globalAlpha = 0.12
    ctx.strokeStyle = '#bff4ff'
    ctx.lineWidth = W * 0.004
    for (let i = 0; i < 9; i++) {
      ctx.beginPath()
      const y0 = (i / 9) * H
      for (let x = 0; x <= W; x += W / 24) {
        const y = y0 + Math.sin(x / (W * 0.08) + t * 1.4 + i) * H * 0.02
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    // 魚
    for (const f of s.fish) drawFish(ctx, X(f.x), Y(f.y), f.a, f.size * W * 0.034, f, 1)
    // 漣漪
    for (const r of s.ripples) {
      ctx.strokeStyle = `rgba(220,248,255,${(1 - r.t) * 0.5})`
      ctx.lineWidth = W * 0.004
      ctx.beginPath()
      ctx.ellipse(X(r.x), Y(r.y), W * (NET_R + r.t * 0.12), W * (NET_R + r.t * 0.12) * 0.8, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    // 盆邊的反光
    ctx.restore()
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = W * 0.006
    ctx.beginPath()
    ctx.ellipse(X(TUB.cx), Y(TUB.cy), X(TUB.rx) + W * 0.012, Y(TUB.ry) + W * 0.012, 0, Math.PI * 1.1, Math.PI * 1.5)
    ctx.stroke()

    // 碗（右下角）：撈到的魚
    const bx = X(0.9)
    const by = Y(0.88)
    const br = W * 0.07
    ctx.fillStyle = 'rgba(200,230,255,0.25)'
    ctx.strokeStyle = 'rgba(230,245,255,0.7)'
    ctx.lineWidth = W * 0.004
    ctx.beginPath()
    ctx.ellipse(bx, by, br, br * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    s.bowl.forEach((f, i) => {
      const a = t * 1.5 + i * 2.1
      drawFish(ctx, bx + Math.cos(a) * br * 0.45, by + Math.sin(a) * br * 0.35, a + Math.PI / 2, W * 0.018, f, 1)
    })
    // 飛在空中的魚
    for (const fl of s.flying) {
      const k = fl.t / 0.6
      const x = fl.x0 + (0.9 - fl.x0) * k
      const y = fl.y0 + (0.88 - fl.y0) * k - Math.sin(k * Math.PI) * 0.25
      drawFish(ctx, X(x), Y(y), t * 12, fl.fish.size * W * 0.03, fl.fish, 1)
    }
    // 水珠
    ctx.fillStyle = 'rgba(210,240,255,0.85)'
    for (const d of s.drops) {
      ctx.beginPath()
      ctx.arc(X(d.x), Y(d.y), W * 0.005, 0, Math.PI * 2)
      ctx.fill()
    }

    // 紙網
    drawNet(ctx, X(s.net.x), Y(s.net.y), W * NET_R, s.net.paper, s.net.dipped, s.net.torn, t)
  }

  // ---------------------------------------------------------------------------

  const toTub = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }

  return (
    <div className="mk-card" onPointerDown={(e) => e.stopPropagation()}>
      <div className="mk-head">
        <span className="mk-title">🐟 撈金魚</span>
        <span className="mk-stat">
          撈到 <b>{caught}</b> 隻
        </span>
        <span className={`mk-stat ${left <= 5 ? 'hurry' : ''}`}>⏱ {left}s</span>
      </div>
      <div className="gf-paper">
        <span>紙網</span>
        <div className="meter">
          <i style={{ width: `${paper * 100}%`, background: paper < 0.3 ? 'linear-gradient(90deg,#a13a6a,#ff5a5a)' : undefined }} />
        </div>
        {torn && <span className="gf-torn">破了！</span>}
      </div>
      <div className="mk-stage" ref={wrap}>
        <canvas
          ref={canvas}
          className="mk-canvas"
          onPointerDown={(e) => {
            if (phase !== 'play') return
            e.currentTarget.setPointerCapture(e.pointerId)
            const p = toTub(e)
            const n = g.current.net
            n.tx = p.x
            n.ty = p.y
            if (e.pointerType !== 'mouse') {
              // 手指點下去：網子直接到手指下
              n.x = p.x
              n.y = p.y
            }
            dip(true)
          }}
          onPointerMove={(e) => {
            const p = toTub(e)
            g.current.net.tx = p.x
            g.current.net.ty = p.y
            if (phase !== 'play') draw()
          }}
          onPointerUp={() => phase === 'play' && dip(false)}
          onPointerCancel={() => phase === 'play' && dip(false)}
        />
        {phase === 'intro' && (
          <div className="mk-overlay">
            <p>
              <b>按住</b>讓紙網下水，移到魚底下，<b>放開</b>撈起來。
              <br />
              紙網泡久會軟，<b>在水裡動太快會破</b>。大魚王要網子夠硬才撈得起來。
            </p>
            <p className="muted">電腦：方向鍵移動，按住空白鍵下水</p>
            <button className="btn primary big" onClick={() => setPhase('play')}>
              開始撈
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="mk-overlay">
            <div className="mk-result">
              撈到 <b>{caught}</b> 隻金魚
            </div>
            <div className="mk-merit">🪷 功德 +{meritFor(caught)}</div>
            <button className="btn primary big" onClick={() => finish(meritFor(caught))}>
              收下
            </button>
          </div>
        )}
      </div>
      <button className="mk-leave" onClick={() => finish(phase === 'done' ? meritFor(caught) : 0)}>
        離開
      </button>
    </div>
  )
}

function angleDiff(a: number, b: number) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, f: Fish, alpha: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a)
  ctx.globalAlpha = alpha
  const wig = Math.sin(f.wig) * 0.35
  // 尾巴（輕飄飄的金魚尾）
  ctx.fillStyle = f.color
  ctx.globalAlpha = alpha * 0.8
  ctx.beginPath()
  ctx.moveTo(-len * 0.7, 0)
  ctx.quadraticCurveTo(-len * 1.3, -len * (0.7 + wig), -len * 1.6, -len * 0.5 + wig * len)
  ctx.quadraticCurveTo(-len * 1.2, wig * len * 0.3, -len * 1.6, len * 0.5 + wig * len)
  ctx.quadraticCurveTo(-len * 1.3, len * (0.7 - wig), -len * 0.7, 0)
  ctx.fill()
  ctx.globalAlpha = alpha
  // 身體
  const body = ctx.createLinearGradient(0, -len * 0.4, 0, len * 0.4)
  body.addColorStop(0, f.color)
  body.addColorStop(1, shade(f.color))
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(0, 0, len * 0.85, len * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()
  if (f.spots) {
    ctx.fillStyle = '#1c1c20'
    ctx.beginPath()
    ctx.arc(len * 0.1, -len * 0.12, len * 0.16, 0, Math.PI * 2)
    ctx.arc(-len * 0.3, len * 0.1, len * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  // 眼睛
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(len * 0.5, -len * 0.16, len * 0.08, 0, Math.PI * 2)
  ctx.arc(len * 0.5, len * 0.16, len * 0.08, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * 0.7)
  const g = Math.round(((n >> 8) & 255) * 0.7)
  const b = Math.round((n & 255) * 0.7)
  return `rgb(${r},${g},${b})`
}

function drawNet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, paper: number, dipped: boolean, torn: boolean, t: number) {
  ctx.save()
  ctx.translate(x, y)
  // 影子
  if (!dipped) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.beginPath()
    ctx.ellipse(r * 0.25, r * 0.35, r, r * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  const lift = dipped ? 0 : -r * 0.2
  ctx.translate(0, lift)
  // 紙：泡水後變透明、變灰
  if (!torn) {
    ctx.fillStyle = dipped ? `rgba(235,240,245,${0.22 + paper * 0.18})` : `rgba(255,255,250,${0.5 + paper * 0.35})`
    ctx.beginPath()
    ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2)
    ctx.fill()
    // 越軟皺紋越多
    ctx.strokeStyle = `rgba(120,130,140,${(1 - paper) * 0.6})`
    ctx.lineWidth = r * 0.03
    for (let i = 0; i < Math.round((1 - paper) * 6); i++) {
      const a = i * 1.7 + 0.4
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2)
      ctx.lineTo(Math.cos(a + 0.3) * r * 0.8, Math.sin(a + 0.3) * r * 0.7)
      ctx.stroke()
    }
  } else {
    // 破掉：剩下邊緣的碎紙
    ctx.fillStyle = 'rgba(235,240,245,0.4)'
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.sin(t + i) * 0.05
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.85)
      ctx.lineTo(Math.cos(a + 0.35) * r * 0.62, Math.sin(a + 0.35) * r * 0.55)
      ctx.lineTo(Math.cos(a + 0.7) * r, Math.sin(a + 0.7) * r * 0.85)
      ctx.fill()
    }
  }
  // 塑膠框＋握把
  ctx.strokeStyle = '#e8402a'
  ctx.lineWidth = r * 0.14
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineCap = 'round'
  ctx.lineWidth = r * 0.2
  ctx.beginPath()
  ctx.moveTo(r * 0.7, r * 0.6)
  ctx.lineTo(r * 1.6, r * 1.55)
  ctx.stroke()
  ctx.restore()
}
