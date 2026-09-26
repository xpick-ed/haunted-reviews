import { useEffect, useRef, useState } from 'react'
import type { CrabResult, MinigameProps } from './types'
import { caughtChime, emptyRock, pinch, rockThud, skitter, waves } from './crab.sound'
import './crab.css'

// 抓螃蟹（海邊的潮間帶，退潮才能玩）：
//   點石頭把它掀開 → 底下有螃蟹的話，牠會愣一下，然後橫著跑去躲到別顆石頭下面；
//   在牠躲好之前點牠就抓到了。螃蟹跑一跑會停下來舉起大螯——這時候抓會被夾！
//   40 秒後潮水回來。抓到幾隻就是幾份「螃蟹」食材。

const TIME = 40
const ROCKS = 9
const HIT = 0.075 // 點到螃蟹的範圍（畫面寬度的比例）
const LIFT = 2.6 // 石頭掀開多久
const SPEED = 0.26 // 螃蟹跑的速度（畫面寬度／秒）

type Phase = 'intro' | 'play' | 'done'
type CrabState = 'surprise' | 'run' | 'angry' | 'caught'

interface Rock {
  x: number
  y: number
  r: number
  shape: number[]
  crab: boolean
  lifted: number
  /** 掀開時滾到哪一邊 */
  side: number
  tint: number
}
interface Crab {
  x: number
  y: number
  target: number
  state: CrabState
  t: number
  /** 下一次停下來舉螯的時間 */
  angryAt: number
  claws: number
  size: number
  hue: number
}
interface Fly {
  x: number
  y: number
  t: number
  size: number
  hue: number
}
interface Pop {
  x: number
  y: number
  t: number
  icon: string
}

function makeRocks(): Rock[] {
  const rocks: Rock[] = []
  let guard = 0
  while (rocks.length < ROCKS && guard++ < 500) {
    const x = 0.1 + Math.random() * 0.8
    const y = 0.16 + Math.random() * 0.68
    const r = 0.055 + Math.random() * 0.03
    // 中間偏左是潮池，不放石頭
    if ((x - 0.34) ** 2 / 0.03 + (y - 0.55) ** 2 / 0.02 < 1) continue
    // 右下角是水桶
    if (x > 0.78 && y > 0.78) continue
    if (rocks.some((o) => Math.hypot(o.x - x, (o.y - y) * 1.05) < o.r + r + 0.07)) continue
    rocks.push({ x, y, r, shape: Array.from({ length: 9 }, () => 0.8 + Math.random() * 0.35), crab: false, lifted: 0, side: Math.random() < 0.5 ? -1 : 1, tint: Math.random() })
  }
  // 一開始有四顆石頭底下藏著螃蟹
  const idx = rocks.map((_, i) => i).sort(() => Math.random() - 0.5)
  idx.slice(0, 4).forEach((i) => (rocks[i].crab = true))
  return rocks
}

export default function CrabGame({ done }: MinigameProps<unknown, CrabResult>) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [caught, setCaught] = useState(0)
  const [left, setLeft] = useState(TIME)
  const [msg, setMsg] = useState<{ text: string; kind: 'good' | 'bad' | 'hint'; id: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const size = useRef({ w: 400, h: 420 })
  const g = useRef({
    rocks: makeRocks(),
    crabs: [] as Crab[],
    flies: [] as Fly[],
    pops: [] as Pop[],
    caught: 0,
    t: 0,
    stun: 0,
    spawned: 0,
    cursor: { x: 0.5, y: 0.5, on: false },
    keys: new Set<string>(),
    tap: null as null | { x: number; y: number },
    skitT: 0,
    over: false,
  })

  const finish = (crabs: number) => done({ crabs })
  const say = (text: string, kind: 'good' | 'bad' | 'hint') => setMsg({ text, kind, id: performance.now() })

  // 畫布大小跟著外框
  useEffect(() => {
    const resize = () => {
      const el = wrap.current
      const c = canvas.current
      if (!el || !c) return
      const w = el.clientWidth
      const h = Math.round(w * 1.02)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      c.style.width = `${w}px`
      c.style.height = `${h}px`
      c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
      size.current = { w, h }
      bg.current = null
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // 鍵盤：方向鍵移動手、E／空白掀石頭或抓；ESC 離開
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish(phase === 'done' ? g.current.caught : 0)
        return
      }
      if (k === 'e' || k === ' ' || k === 'enter') {
        e.preventDefault()
        e.stopPropagation()
        if (e.repeat) return
        if (phase === 'intro') setPhase('play')
        else if (phase === 'done') finish(g.current.caught)
        else {
          const c = g.current.cursor
          c.on = true
          g.current.tap = { x: c.x, y: c.y }
        }
        return
      }
      if (k.startsWith('arrow') || 'wasd'.includes(k)) {
        e.preventDefault()
        e.stopPropagation()
        g.current.keys.add(k)
        g.current.cursor.on = true
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
  }, [phase])

  // 浪聲（玩的時候）
  useEffect(() => {
    if (phase !== 'play') return
    return waves()
  }, [phase])

  const bg = useRef<HTMLCanvasElement | null>(null)

  // 主迴圈
  useEffect(() => {
    if (phase !== 'play' && phase !== 'intro') return
    let raf = 0
    let last = performance.now()
    const s = g.current
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (phase === 'play' && !s.over) step(dt)
      draw(now / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const step = (dt: number) => {
    const s = g.current
    s.t += dt
    s.stun = Math.max(0, s.stun - dt)
    const remain = Math.max(0, TIME - s.t)
    setLeft((v) => (Math.ceil(remain) !== Math.ceil(v) ? remain : v))
    // 鍵盤移動手
    const kx = (s.keys.has('arrowright') || s.keys.has('d') ? 1 : 0) - (s.keys.has('arrowleft') || s.keys.has('a') ? 1 : 0)
    const ky = (s.keys.has('arrowdown') || s.keys.has('s') ? 1 : 0) - (s.keys.has('arrowup') || s.keys.has('w') ? 1 : 0)
    s.cursor.x = Math.min(0.97, Math.max(0.03, s.cursor.x + kx * dt * 0.7))
    s.cursor.y = Math.min(0.97, Math.max(0.03, s.cursor.y + ky * dt * 0.7))
    // 後來又有螃蟹從潮池爬出來躲進石頭
    if ((s.spawned === 0 && s.t > 14) || (s.spawned === 1 && s.t > 26)) {
      const free = s.rocks.map((r, i) => ({ r, i })).filter(({ r }) => !r.crab && r.lifted <= 0)
      if (free.length) free[Math.floor(Math.random() * free.length)].r.crab = true
      s.spawned++
    }
    // 石頭慢慢蓋回去
    for (const r of s.rocks) r.lifted = Math.max(0, r.lifted - dt)
    // 點下去
    const tap = s.tap
    s.tap = null
    if (tap && s.stun <= 0) handleTap(tap.x, tap.y)
    // 螃蟹
    for (const c of s.crabs) {
      c.t += dt
      if (c.state === 'caught') continue
      if (c.state === 'surprise') {
        c.claws = Math.min(1, c.claws + dt * 4)
        if (c.t > 0.42) {
          c.state = 'run'
          c.t = 0
          c.target = pickTarget(c)
        }
        continue
      }
      if (c.state === 'angry') {
        c.claws = Math.min(1, c.claws + dt * 6)
        if (c.t > 0.75) {
          c.state = 'run'
          c.t = 0
          c.angryAt = 0.9 + Math.random() * 1.2
          c.target = pickTarget(c)
        }
        continue
      }
      // 跑：往目標石頭，左右橫著走、走得一抖一抖
      c.claws = Math.max(0, c.claws - dt * 3)
      const r = s.rocks[c.target]
      if (!r || r.lifted > 0) c.target = pickTarget(c)
      const tr = s.rocks[c.target]
      if (!tr) continue
      const dx = tr.x - c.x
      const dy = tr.y - c.y
      const d = Math.hypot(dx, dy)
      if (d < 0.02) {
        tr.crab = true
        c.state = 'caught'
        c.x = -1
        continue
      }
      const sp = SPEED * (0.85 + 0.3 * Math.sin(c.t * 17))
      c.x += (dx / d) * sp * dt
      c.y += (dy / d) * sp * dt * 0.8
      s.skitT -= dt
      if (s.skitT <= 0) {
        s.skitT = 0.22
        skitter()
      }
      if (c.t > c.angryAt && d > 0.12) {
        c.state = 'angry'
        c.t = 0
      }
    }
    s.crabs = s.crabs.filter((c) => !(c.state === 'caught' && c.x < 0))
    for (const f of s.flies) f.t += dt
    s.flies = s.flies.filter((f) => f.t < 0.8)
    for (const p of s.pops) p.t += dt
    s.pops = s.pops.filter((p) => p.t < 1)
    if (s.t >= TIME) {
      s.over = true
      setLeft(0)
      window.setTimeout(() => setPhase('done'), 500)
    }
  }

  const pickTarget = (c: Crab) => {
    const s = g.current
    let best = -1
    let bd = Infinity
    s.rocks.forEach((r, i) => {
      if (r.lifted > 0 || r.crab) return
      // 最近、但不要是剛剛那顆
      const d = Math.hypot(r.x - c.x, r.y - c.y) + (i === c.target ? 0.2 : 0) + Math.random() * 0.05
      if (d < bd) {
        bd = d
        best = i
      }
    })
    return best
  }

  const handleTap = (x: number, y: number) => {
    const s = g.current
    // 先看有沒有點到螃蟹
    const hit = s.crabs.find((c) => c.state !== 'caught' && Math.hypot(c.x - x, (c.y - y) * 0.9) < HIT)
    if (hit) {
      if (hit.state === 'angry' && hit.claws > 0.6) {
        s.stun = 0.8
        pinch()
        say('唉唷！被夾到了！', 'bad')
        return
      }
      hit.state = 'caught'
      s.flies.push({ x: hit.x, y: hit.y, t: 0, size: hit.size, hue: hit.hue })
      hit.x = -1
      s.caught++
      setCaught(s.caught)
      caughtChime()
      say(s.caught >= 3 ? '好多螃蟹！' : '抓到了！', 'good')
      return
    }
    // 再看點到哪顆石頭
    const rock = s.rocks.find((r) => r.lifted <= 0 && Math.hypot(r.x - x, (r.y - y) * 1.05) < r.r * 1.15)
    if (!rock) return
    rock.lifted = LIFT
    rockThud()
    if (rock.crab) {
      rock.crab = false
      s.crabs.push({ x: rock.x, y: rock.y, target: -1, state: 'surprise', t: 0, angryAt: 0.8 + Math.random() * 0.9, claws: 0, size: 0.8 + Math.random() * 0.4, hue: Math.random() })
    } else {
      emptyRock()
      s.pops.push({ x: rock.x, y: rock.y, t: 0, icon: ['🐚', '⭐', '🦐', '·'][Math.floor(Math.random() * 4)] })
    }
  }

  const onPointer = (e: React.PointerEvent) => {
    if (phase !== 'play') return
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    g.current.cursor.on = false
    g.current.tap = { x, y }
  }

  // -------------------------------------------------------------------------
  // 畫
  // -------------------------------------------------------------------------

  const makeBg = (w: number, h: number) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    const sand = ctx.createLinearGradient(0, 0, 0, h)
    sand.addColorStop(0, '#5d5446')
    sand.addColorStop(1, '#7c6c55')
    ctx.fillStyle = sand
    ctx.fillRect(0, 0, w, h)
    // 小石子與貝殼碎片
    for (let i = 0; i < 520; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const r = Math.random() * 2.2 + 0.4
      const l = 30 + Math.random() * 40
      ctx.fillStyle = `hsla(${30 + Math.random() * 20}, 12%, ${l}%, ${0.35 + Math.random() * 0.4})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // 退潮留下的波紋沙痕
    ctx.strokeStyle = 'rgba(255,240,210,0.07)'
    ctx.lineWidth = 2
    for (let y = 10; y < h; y += 14) {
      ctx.beginPath()
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 3)
      ctx.stroke()
    }
    // 潮池
    const px = w * 0.34
    const py = h * 0.55
    const pool = ctx.createRadialGradient(px, py, 4, px, py, w * 0.18)
    pool.addColorStop(0, '#2d5a6a')
    pool.addColorStop(0.8, '#244754')
    pool.addColorStop(1, '#3a4c48')
    ctx.fillStyle = pool
    ctx.beginPath()
    ctx.ellipse(px, py, w * 0.17, h * 0.13, 0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(120,150,110,0.6)'
    ctx.lineWidth = 3
    ctx.stroke()
    // 右下角的水桶
    const bx = w * 0.87
    const by = h * 0.87
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(bx + 4, by + 10, w * 0.075, h * 0.03, 0, 0, Math.PI * 2)
    ctx.fill()
    return c
  }

  const drawRock = (ctx: CanvasRenderingContext2D, r: Rock, w: number, h: number, lift: number) => {
    const x = r.x * w + r.side * lift * r.r * w * 0.9
    const y = r.y * h - lift * r.r * w * 0.6
    const rad = r.r * w * (1 + lift * 0.08)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(r.side * lift * 0.5)
    // 影子
    ctx.fillStyle = `rgba(0,0,0,${0.35 + lift * 0.1})`
    ctx.beginPath()
    ctx.ellipse(4 + lift * 6, 6 + lift * 8, rad * 1.05, rad * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
    const grad = ctx.createLinearGradient(-rad, -rad, rad, rad)
    const l = 42 + r.tint * 14
    grad.addColorStop(0, `hsl(35, 8%, ${l + 14}%)`)
    grad.addColorStop(1, `hsl(30, 10%, ${l - 12}%)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    r.shape.forEach((k, i) => {
      const a = (i / r.shape.length) * Math.PI * 2
      const px = Math.cos(a) * rad * k
      const py = Math.sin(a) * rad * k * 0.8
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.fill()
    // 藤壺、海藻
    ctx.fillStyle = 'rgba(235,230,215,0.6)'
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(Math.cos(i * 2.3 + r.tint * 6) * rad * 0.45, Math.sin(i * 1.7) * rad * 0.3, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(80,120,60,0.55)'
    ctx.beginPath()
    ctx.ellipse(-rad * 0.4, rad * 0.35, rad * 0.35, rad * 0.14, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const drawCrab = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, claws: number, running: boolean, hue: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    const legT = running ? Math.sin(t * 30) * 0.35 : 0
    ctx.strokeStyle = `hsl(${12 + hue * 12}, 60%, 32%)`
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const a = (i - 1) * 0.45 + (i % 2 ? legT : -legT)
        ctx.beginPath()
        ctx.moveTo(side * 9, -2 + i * 4)
        ctx.lineTo(side * 17, -4 + i * 6 + a * 6)
        ctx.lineTo(side * 21, 2 + i * 6 + a * 8)
        ctx.stroke()
      }
    }
    // 大螯：生氣時舉高張開
    for (const side of [-1, 1]) {
      const up = claws
      ctx.save()
      ctx.translate(side * 8, -8)
      ctx.rotate(side * (0.5 - up * 0.9))
      ctx.fillStyle = `hsl(${10 + hue * 12}, 72%, ${44 + up * 6}%)`
      ctx.beginPath()
      ctx.ellipse(side * 3, -6 - up * 4, 5 + up * 1.5, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      if (up > 0.4) {
        ctx.strokeStyle = '#3a1a10'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(side * 3, -9 - up * 4)
        ctx.lineTo(side * 3, -4 - up * 4)
        ctx.stroke()
      }
      ctx.restore()
    }
    // 身體
    const body = ctx.createRadialGradient(-3, -4, 1, 0, 0, 13)
    body.addColorStop(0, `hsl(${18 + hue * 10}, 80%, 62%)`)
    body.addColorStop(1, `hsl(${8 + hue * 10}, 70%, 38%)`)
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    // 眼睛
    ctx.fillStyle = '#1a1010'
    for (const side of [-1, 1]) {
      ctx.fillRect(side * 3.5 - 0.8, -12, 1.6, 4)
      ctx.beginPath()
      ctx.arc(side * 3.5, -12.5, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  const draw = (time: number) => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const { w, h } = size.current
    const s = g.current
    if (!bg.current) bg.current = makeBg(w, h)
    ctx.drawImage(bg.current, 0, 0, w, h)
    // 潮池的水光
    ctx.strokeStyle = `rgba(200,230,255,${0.12 + Math.sin(time * 2) * 0.05})`
    ctx.lineWidth = 1.5
    for (let i = 0; i < 3; i++) {
      const k = ((time * 0.3 + i / 3) % 1)
      ctx.beginPath()
      ctx.ellipse(w * 0.34, h * 0.55, w * 0.17 * k, h * 0.13 * k, 0.15, 0, Math.PI * 2)
      ctx.stroke()
    }
    // 掀開的石頭底下：一塊濕濕的深色
    for (const r of s.rocks) {
      if (r.lifted <= 0) continue
      ctx.fillStyle = 'rgba(40,34,26,0.55)'
      ctx.beginPath()
      ctx.ellipse(r.x * w, r.y * h, r.r * w * 0.95, r.r * w * 0.72, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // 螃蟹（在石頭下面的看不到）
    for (const cb of s.crabs) {
      if (cb.state === 'caught') continue
      drawCrab(ctx, cb.x * w, cb.y * h, (w / 400) * cb.size, time, cb.claws, cb.state === 'run', cb.hue)
      if (cb.state === 'angry' && cb.claws > 0.6) {
        ctx.fillStyle = '#ffd24a'
        ctx.font = `700 ${Math.round(w * 0.045)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('！', cb.x * w, cb.y * h - w * 0.07)
      }
    }
    // 石頭
    for (const r of s.rocks) {
      const lift = r.lifted > 0 ? Math.min(1, (LIFT - r.lifted) / 0.12, r.lifted / 0.3) : 0
      drawRock(ctx, r, w, h, lift)
    }
    // 空石頭底下的小東西
    for (const p of s.pops) {
      ctx.globalAlpha = 1 - p.t
      ctx.font = `${Math.round(w * 0.06)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(p.icon, p.x * w, p.y * h - p.t * w * 0.05)
      ctx.globalAlpha = 1
    }
    // 水桶
    const bx = w * 0.87
    const by = h * 0.87
    ctx.fillStyle = '#2f6fb8'
    ctx.beginPath()
    ctx.moveTo(bx - w * 0.07, by - h * 0.05)
    ctx.lineTo(bx + w * 0.07, by - h * 0.05)
    ctx.lineTo(bx + w * 0.055, by + h * 0.05)
    ctx.lineTo(bx - w * 0.055, by + h * 0.05)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#1d4f8a'
    ctx.beginPath()
    ctx.ellipse(bx, by - h * 0.05, w * 0.07, h * 0.018, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${Math.round(w * 0.045)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${s.caught}`, bx, by + h * 0.01)
    // 抓到的螃蟹飛進水桶
    for (const f of s.flies) {
      const k = Math.min(1, f.t / 0.7)
      const x = f.x * w + (bx - f.x * w) * k
      const y = f.y * h + (by - h * 0.06 - f.y * h) * k - Math.sin(k * Math.PI) * h * 0.18
      drawCrab(ctx, x, y, (w / 400) * f.size * (1 - k * 0.4), time, 1, true, f.hue)
    }
    // 潮水回來了：最後 15 秒從上面慢慢漫進來
    const rise = Math.max(0, (s.t - (TIME - 15)) / 15)
    if (rise > 0) {
      const edge = h * rise * 0.38
      const water = ctx.createLinearGradient(0, 0, 0, edge + 20)
      water.addColorStop(0, 'rgba(40,90,110,0.85)')
      water.addColorStop(1, 'rgba(40,90,110,0)')
      ctx.fillStyle = water
      ctx.fillRect(0, 0, w, edge + 20)
      ctx.strokeStyle = 'rgba(230,245,255,0.7)'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      for (let x = 0; x <= w; x += 6) ctx.lineTo(x, edge + Math.sin(x * 0.06 + time * 3) * 4)
      ctx.stroke()
    }
    // 鍵盤的手
    if (s.cursor.on && phase === 'play') {
      ctx.font = `${Math.round(w * 0.07)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('✋', s.cursor.x * w, s.cursor.y * h)
    }
    // 被夾：畫面邊緣紅一下
    if (s.stun > 0) {
      ctx.fillStyle = `rgba(220,40,40,${s.stun * 0.35})`
      ctx.fillRect(0, 0, w, h)
    }
  }

  return (
    <div className="cb-card" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cb-head">
        <span className="cb-title">🦀 抓螃蟹</span>
        <span className="cb-stat">
          🦀 <b>{caught}</b>
        </span>
        <span className="cb-stat">
          ⏱ <b>{Math.ceil(left)}</b>
        </span>
      </div>
      <div className="cb-stage" ref={wrap} onPointerDown={onPointer}>
        <canvas ref={canvas} className="cb-canvas" />
        {msg && phase === 'play' && (
          <div key={msg.id} className={`cb-msg ${msg.kind}`}>
            {msg.text}
          </div>
        )}
        {phase === 'intro' && (
          <div className="cb-overlay">
            <p>
              <b>點石頭</b>把它掀開，底下可能躲著螃蟹。
              <br />
              螃蟹會<b>橫著跑</b>去躲別顆石頭，躲好之前<b>點牠</b>就抓到了。
              <br />
              牠停下來<b>舉起大螯</b>的時候別抓——會被夾！
            </p>
            <p className="muted">潮水 40 秒後回來。電腦：方向鍵移動手、E 掀／抓</p>
            <button className="btn primary big" onClick={() => setPhase('play')}>
              開始抓
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="cb-overlay">
            <div className="cb-result">
              抓到 <b>{caught}</b> 隻螃蟹
            </div>
            <div className="cb-sub">{caught > 0 ? `🦀 螃蟹 +${caught}（可以煮螃蟹粥）` : '潮水回來了，螃蟹都躲起來了……'}</div>
            <button className="btn primary big" onClick={() => finish(caught)}>
              收下
            </button>
          </div>
        )}
      </div>
      <div className="cb-tide">
        <span>潮水</span>
        <div className="cb-tide-bar">
          <i style={{ width: `${(1 - left / TIME) * 100}%` }} />
        </div>
      </div>
      <button className="cb-leave" onClick={() => finish(phase === 'done' ? caught : 0)}>
        離開
      </button>
    </div>
  )
}
