import { useEffect, useRef, useState } from 'react'
import { swatSfx } from './swat.sound'
import type { MinigameProps, SwatParams, SwatResult } from './types'
import './swat.css'

// 打蚊子（DESIGN §25.2）：半夜的客房，蚊子在熟睡的客人頭上飛。點蚊子拍下去；
// 拍空會「啪」一聲（遊戲會把拍空當成吵到人）。時間到或全部打完就結束。
// 鍵盤：方向鍵／WASD 移動準星，E／空白鍵拍。

interface Mosquito {
  x: number
  y: number
  vx: number
  vy: number
  /** 下一次亂轉的時間 */
  turn: number
  alive: boolean
  wing: number
}

interface Mark {
  x: number
  y: number
  t: number
  hit: boolean
}

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const now = () => performance.now() / 1000

export default function Swat({ params, done }: MinigameProps<SwatParams, SwatResult>) {
  const count = Math.max(1, params?.count ?? 6)
  const seconds = Math.max(3, params?.seconds ?? 8)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const timeBar = useRef<HTMLDivElement>(null)
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const [over, setOver] = useState(false)
  const st = useRef({
    started: 0,
    bugs: [] as Mosquito[],
    marks: [] as Mark[],
    hits: 0,
    misses: 0,
    shake: 0,
    cursor: { x: 0, y: 0, on: false },
    keys: new Set<string>(),
    over: false,
    finished: false,
  })

  const finish = () => {
    const s = st.current
    if (s.finished) return
    s.finished = true
    swatSfx.stopBuzz()
    done({ hits: s.hits, misses: s.misses })
  }

  const end = () => {
    const s = st.current
    if (s.over) return
    s.over = true
    setOver(true)
    swatSfx.stopBuzz()
    window.setTimeout(finish, 1500)
  }

  /** 在 (x, y) 拍一下（畫布座標，CSS px） */
  const slap = (x: number, y: number) => {
    const s = st.current
    if (s.over) return
    let best: Mosquito | null = null
    let bestD = 38
    for (const m of s.bugs) {
      if (!m.alive) continue
      const d = Math.hypot(m.x - x, m.y - y)
      if (d < bestD) {
        bestD = d
        best = m
      }
    }
    if (best) {
      best.alive = false
      s.hits++
      s.marks.push({ x: best.x, y: best.y, t: now(), hit: true })
      setHits(s.hits)
      swatSfx.slap(true)
      if (s.bugs.every((m) => !m.alive)) end()
    } else {
      s.misses++
      s.marks.push({ x, y, t: now(), hit: false })
      s.shake = 1
      setMisses(s.misses)
      swatSfx.slap(false)
    }
  }
  const slapRef = useRef(slap)
  slapRef.current = slap

  useEffect(() => {
    const cv = canvas.current
    const box = wrap.current
    if (!cv || !box) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const s = st.current
    s.started = now()
    const W0 = box.clientWidth
    const H0 = box.clientHeight
    s.cursor = { x: W0 / 2, y: H0 * 0.45, on: false }
    s.bugs = Array.from({ length: count }, () => ({
      x: W0 * (0.15 + Math.random() * 0.7),
      y: H0 * (0.15 + Math.random() * 0.55),
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      turn: 0,
      alive: true,
      wing: Math.random() * 10,
    }))
    swatSfx.startBuzz()
    let raf = 0
    let last = now()
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const tn = now()
      const dt = Math.min(0.05, tn - last)
      last = tn
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = box.clientWidth
      const H = box.clientHeight
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr)
        cv.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const left = seconds - (tn - s.started)
      if (timeBar.current) timeBar.current.style.width = `${Math.max(0, left / seconds) * 100}%`
      if (left <= 0 && !s.over) end()

      // 鍵盤準星
      const kx = (s.keys.has('arrowright') || s.keys.has('d') ? 1 : 0) - (s.keys.has('arrowleft') || s.keys.has('a') ? 1 : 0)
      const ky = (s.keys.has('arrowdown') || s.keys.has('s') ? 1 : 0) - (s.keys.has('arrowup') || s.keys.has('w') ? 1 : 0)
      if (kx || ky) {
        s.cursor.on = true
        s.cursor.x = Math.max(0, Math.min(W, s.cursor.x + kx * 380 * dt))
        s.cursor.y = Math.max(0, Math.min(H, s.cursor.y + ky * 380 * dt))
      }

      // 蚊子：亂飛、偶爾衝一下、碰到邊彈回來
      let alive = 0
      for (const m of s.bugs) {
        if (!m.alive) continue
        alive++
        if (tn > m.turn) {
          const dash = Math.random() < 0.25
          const a = Math.random() * Math.PI * 2
          const sp = dash ? 260 + Math.random() * 120 : 90 + Math.random() * 110
          m.vx = Math.cos(a) * sp
          m.vy = Math.sin(a) * sp
          m.turn = tn + (dash ? 0.25 : 0.35 + Math.random() * 0.6)
        }
        m.vx += (Math.random() - 0.5) * 900 * dt
        m.vy += (Math.random() - 0.5) * 900 * dt
        m.x += m.vx * dt
        m.y += m.vy * dt
        if (m.x < 16 || m.x > W - 16) {
          m.vx *= -1
          m.x = Math.max(16, Math.min(W - 16, m.x))
        }
        if (m.y < 16 || m.y > H * 0.86) {
          m.vy *= -1
          m.y = Math.max(16, Math.min(H * 0.86, m.y))
        }
        m.wing += dt * 60
      }
      swatSfx.buzzLevel(s.over ? 0 : alive / count)
      s.shake = Math.max(0, s.shake - dt * 5)

      draw(ctx, W, H, s, tn)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      swatSfx.stopBuzz()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const s = st.current
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        s.over = true
        finish()
        return
      }
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault()
        s.keys.add(k)
      }
      if ((k === 'e' || k === ' ' || k === 'enter') && !e.repeat) {
        e.preventDefault()
        if (s.over) {
          finish()
          return
        }
        s.cursor.on = true
        slapRef.current(s.cursor.x, s.cursor.y)
      }
    }
    const up = (e: KeyboardEvent) => s.keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pos = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const left = count - hits
  return (
    <div className="swat-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="swat-head">
        <span className="swat-title">打蚊子</span>
        <span className="swat-count">
          🦟 <b>{left}</b> 隻
        </span>
        {misses > 0 && <span className="swat-miss">拍空 {misses}</span>}
      </div>
      <div className="swat-time">
        <i ref={timeBar} />
      </div>
      <div
        ref={wrap}
        className="swat-stage"
        onPointerDown={(e) => {
          e.preventDefault()
          if (st.current.over) {
            finish()
            return
          }
          const p = pos(e)
          st.current.cursor = { ...p, on: e.pointerType === 'mouse' }
          slap(p.x, p.y)
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return
          const p = pos(e)
          st.current.cursor = { ...p, on: true }
        }}
        onPointerLeave={() => {
          st.current.cursor.on = false
        }}
      >
        <canvas ref={canvas} />
        {over && (
          <div className="swat-end">
            <div className="swat-end-title">{hits >= count ? '全部打完了！' : hits >= Math.ceil(count * 0.66) ? `打到 ${hits} 隻` : `只打到 ${hits} 隻……`}</div>
            <div className="swat-end-line">{misses === 0 ? '一聲都沒吵到。' : misses <= 2 ? '拍空了幾下，客人翻了個身。' : '啪啪啪的，客人好像要醒了。'}</div>
          </div>
        )}
      </div>
      <p className="swat-hint">
        點蚊子拍下去，拍空會吵到人<span className="swat-keys">　·　方向鍵移動、E 拍</span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 畫：月光照進來的客房、熟睡的客人、蚊子、手掌、血跡
// ---------------------------------------------------------------------------

type State = {
  bugs: Mosquito[]
  marks: Mark[]
  shake: number
  cursor: { x: number; y: number; on: boolean }
}

function draw(ctx: CanvasRenderingContext2D, W: number, H: number, s: State, tn: number) {
  ctx.clearRect(0, 0, W, H)
  ctx.save()
  if (s.shake > 0 && !reduceMotion) ctx.translate((Math.random() - 0.5) * 10 * s.shake, (Math.random() - 0.5) * 8 * s.shake)

  // 牆
  const wall = ctx.createLinearGradient(0, 0, 0, H)
  wall.addColorStop(0, '#141c33')
  wall.addColorStop(1, '#0b1020')
  ctx.fillStyle = wall
  ctx.fillRect(-10, -10, W + 20, H + 20)
  // 窗與月光
  const wx = W * 0.62
  const wy = H * 0.08
  const ww = Math.min(W * 0.26, 150)
  const wh = ww * 1.1
  const beam = ctx.createLinearGradient(wx, wy, wx - ww * 0.8, H)
  beam.addColorStop(0, 'rgba(170,200,255,0.16)')
  beam.addColorStop(1, 'rgba(170,200,255,0)')
  ctx.fillStyle = beam
  ctx.beginPath()
  ctx.moveTo(wx, wy)
  ctx.lineTo(wx + ww, wy)
  ctx.lineTo(wx + ww * 0.2, H)
  ctx.lineTo(wx - ww * 1.4, H)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#9fb6e6'
  ctx.globalAlpha = 0.55
  ctx.fillRect(wx, wy, ww, wh)
  ctx.globalAlpha = 1
  ctx.strokeStyle = '#2a2018'
  ctx.lineWidth = 5
  ctx.strokeRect(wx, wy, ww, wh)
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(wx + ww / 2, wy)
  ctx.lineTo(wx + ww / 2, wy + wh)
  ctx.moveTo(wx, wy + wh / 2)
  ctx.lineTo(wx + ww, wy + wh / 2)
  ctx.stroke()
  // 鐵窗花
  ctx.strokeStyle = 'rgba(40,30,20,0.6)'
  ctx.lineWidth = 1.5
  for (let i = 1; i < 4; i++) {
    ctx.beginPath()
    ctx.arc(wx + ww / 2, wy + wh / 2, (ww / 8) * i, 0, Math.PI * 2)
    ctx.stroke()
  }

  // 枕頭與熟睡的客人
  const by = H * 0.8
  ctx.fillStyle = '#e8e2d4'
  roundRect(ctx, W * 0.08, by - 34, W * 0.3, 44, 18)
  ctx.fill()
  ctx.fillStyle = '#2a1f1a'
  ctx.beginPath()
  ctx.ellipse(W * 0.23, by - 14, 40, 26, -0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f0c9a8'
  ctx.beginPath()
  ctx.ellipse(W * 0.26, by - 4, 26, 18, -0.1, 0, Math.PI)
  ctx.fill()
  // zzz
  ctx.fillStyle = 'rgba(143,244,255,0.55)'
  ctx.font = '700 16px "Noto Sans TC", sans-serif'
  const zk = (tn * 0.6) % 1
  ctx.globalAlpha = Math.sin(zk * Math.PI)
  ctx.fillText('z', W * 0.32 + zk * 18, by - 44 - zk * 30)
  ctx.globalAlpha = 1

  // 花布被子
  ctx.fillStyle = '#b8323a'
  ctx.beginPath()
  ctx.moveTo(0, by)
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, by + Math.sin(x * 0.03 + 1) * 5 + Math.sin(tn * 1.3) * 1.5)
  ctx.lineTo(W, H)
  ctx.lineTo(0, H)
  ctx.closePath()
  ctx.fill()
  for (let i = 0; i < 26; i++) {
    const x = ((i * 97) % 100) / 100
    const y = ((i * 53) % 100) / 100
    const px = x * W
    const py = by + 14 + y * (H - by - 10)
    ctx.fillStyle = i % 3 === 0 ? '#f2c14e' : i % 3 === 1 ? '#f7e7d0' : '#2f7a55'
    flower(ctx, px, py, 5 + (i % 3) * 2)
  }

  // 血跡、拍空的「啪」
  for (let i = s.marks.length - 1; i >= 0; i--) {
    const m = s.marks[i]
    const k = tn - m.t
    if (m.hit) {
      ctx.fillStyle = `rgba(120,10,20,${Math.max(0, 0.8 - k * 0.12)})`
      ctx.beginPath()
      ctx.ellipse(m.x, m.y, 7, 4, 0.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgba(20,20,20,${Math.max(0, 0.9 - k * 0.12)})`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(m.x - 6, m.y - 3)
      ctx.lineTo(m.x + 5, m.y + 2)
      ctx.moveTo(m.x - 2, m.y + 4)
      ctx.lineTo(m.x + 3, m.y - 5)
      ctx.stroke()
    } else if (k < 0.7) {
      ctx.save()
      ctx.globalAlpha = 1 - k / 0.7
      ctx.font = `900 ${Math.round(22 + k * 16)}px "LXGW WenKai TC", "Noto Sans TC", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffd58a'
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = 6
      ctx.fillText('啪！', m.x, m.y - 24 - k * 20)
      ctx.restore()
    }
    // 手掌：拍下去 0.18 秒
    if (k < 0.22) {
      const pop = k < 0.06 ? 1.25 - k * 4 : 1
      hand(ctx, m.x, m.y, pop, 1 - Math.max(0, k - 0.12) / 0.1)
    }
    if (!m.hit && k > 0.8) s.marks.splice(i, 1)
  }

  // 蚊子
  for (const m of s.bugs) {
    if (!m.alive) continue
    mosquito(ctx, m.x, m.y, m.wing, m.vx)
  }

  // 準星（滑鼠／鍵盤）
  if (s.cursor.on) {
    ctx.strokeStyle = 'rgba(255,213,138,0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(s.cursor.x, s.cursor.y, 16, 0, Math.PI * 2)
    ctx.moveTo(s.cursor.x - 24, s.cursor.y)
    ctx.lineTo(s.cursor.x - 10, s.cursor.y)
    ctx.moveTo(s.cursor.x + 10, s.cursor.y)
    ctx.lineTo(s.cursor.x + 24, s.cursor.y)
    ctx.moveTo(s.cursor.x, s.cursor.y - 24)
    ctx.lineTo(s.cursor.x, s.cursor.y - 10)
    ctx.moveTo(s.cursor.x, s.cursor.y + 10)
    ctx.lineTo(s.cursor.x, s.cursor.y + 24)
    ctx.stroke()
  }
  ctx.restore()
}

function mosquito(ctx: CanvasRenderingContext2D, x: number, y: number, wing: number, vx: number) {
  const dir = vx >= 0 ? 1 : -1
  // 淡淡的光暈，暗房間裡才看得到
  const halo = ctx.createRadialGradient(x, y, 1, x, y, 16)
  halo.addColorStop(0, 'rgba(220,230,255,0.28)')
  halo.addColorStop(1, 'rgba(220,230,255,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(x, y, 16, 0, Math.PI * 2)
  ctx.fill()
  // 翅膀（快速拍動）
  const w = Math.abs(Math.sin(wing)) * 7 + 2
  ctx.fillStyle = 'rgba(210,225,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(x - dir * 1, y - 4, 7, w * 0.6, -dir * 0.6, 0, Math.PI * 2)
  ctx.ellipse(x + dir * 2, y - 4, 6, w * 0.5, dir * 0.5, 0, Math.PI * 2)
  ctx.fill()
  // 身體
  ctx.fillStyle = '#1a1a1e'
  ctx.strokeStyle = '#c8cedc'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.ellipse(x, y, 6, 2.4, dir * 0.25, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + dir * 6, y - 1, 2, 0, Math.PI * 2)
  ctx.fill()
  // 嘴、腳
  ctx.strokeStyle = '#d0d4de'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(x + dir * 8, y - 1)
  ctx.lineTo(x + dir * 13, y + 1)
  for (let i = -1; i <= 1; i++) {
    ctx.moveTo(x + i * 2.5, y + 1.5)
    ctx.lineTo(x + i * 4, y + 7)
  }
  ctx.stroke()
}

function hand(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, alpha: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.9
  // 阿嬤的手：半透明、發青光
  ctx.fillStyle = 'rgba(190,245,255,0.85)'
  ctx.strokeStyle = 'rgba(90,200,220,0.9)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(0, 6, 17, 19, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  const fingers = [
    [-12, -14, 5, 13],
    [-4, -19, 5, 15],
    [4, -19, 5, 15],
    [12, -14, 5, 13],
  ]
  for (const [fx, fy, rx, ry] of fingers) {
    ctx.beginPath()
    ctx.ellipse(fx, fy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.ellipse(-19, 10, 5, 11, 0.9, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
