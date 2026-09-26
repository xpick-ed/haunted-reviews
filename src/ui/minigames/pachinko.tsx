import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio'
import { BALL_R, H, LANE_TOP, LANE_X, PINS, PIN_R, POCKETS, START, launch, meritFor, stepBall, type Ball } from './pachinko.physics'
import { pachinkoSfx } from './pachinko.sound'
import type { MinigameProps, PachinkoResult } from './types'
import './pachinko.css'

// 彈珠台（鬼夜市）：按住拉桿蓄力、放開把彈珠打上去，沿著圓頂滑下來穿過釘子，掉進杯子得分。
// 十顆彈珠；分數換功德（見 pachinko.physics.ts 的 meritFor）。

type Phase = 'intro' | 'play' | 'done'

const BALLS = 10
const CHARGE_TIME = 1.1
/** 畫面左右各留一點給木框 */
const PAD = 0.05

interface Popup {
  x: number
  y: number
  text: string
  t: number
}

export default function Pachinko({ done }: MinigameProps<unknown, PachinkoResult>) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [left, setLeft] = useState(BALLS)
  const [points, setPoints] = useState(0)
  const [charging, setCharging] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLElement>(null)
  const g = useRef({
    ball: null as Ball | null,
    trail: [] as { x: number; y: number }[],
    charging: false,
    power: 0,
    left: BALLS,
    points: 0,
    popups: [] as Popup[],
    lights: 0,
    t: 0,
    over: false,
    phase: 'intro' as Phase,
    lastPocket: null as number | null,
    lastPocketT: 0,
  })
  g.current.phase = phase

  const finish = (merit: number) => done({ merit })

  // ---------------------------------------------------------------------------
  // 主迴圈
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      step(dt)
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function step(dt: number) {
    const s = g.current
    s.t += dt
    s.lights = Math.max(0, s.lights - dt)
    s.popups = s.popups.filter((p) => (p.t += dt) < 1.2)
    if (s.charging) s.power = Math.min(1, s.power + dt / CHARGE_TIME)
    if (bar.current) bar.current.style.width = `${s.power * 100}%`
    const b = s.ball
    if (!b) return
    const r = stepBall(b, dt)
    s.trail.push({ x: b.x, y: b.y })
    if (s.trail.length > 8) s.trail.shift()
    for (const e of r.events) {
      if (e.t === 'pin') pachinkoSfx.pin(e.speed)
      else if (e.t === 'wall') pachinkoSfx.wall()
      else if (e.t === 'pocket') {
        s.points += e.pocket.points
        setPoints(s.points)
        s.popups.push({ x: e.pocket.x, y: e.pocket.y - 0.05, text: `+${e.pocket.points}`, t: 0 })
        s.lights = e.pocket.points >= 50 ? 2.2 : 1.1
        s.lastPocket = POCKETS.indexOf(e.pocket)
        s.lastPocketT = s.t
        pachinkoSfx.pocket(e.pocket.points)
      } else if (e.t === 'out') pachinkoSfx.out()
      else if (e.t === 'back') {
        // 力道不夠掉回來：彈珠還給妳，再打一次
        s.popups.push({ x: START.x - 0.08, y: START.y - 0.12, text: '力道不夠', t: 0 })
        s.left += 1
        setLeft(s.left)
      }
    }
    if (r.done) {
      s.ball = null
      s.trail = []
      if (s.left <= 0 && !s.over) {
        s.over = true
        audio.chime()
        window.setTimeout(() => setPhase('done'), 700)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 拉桿
  // ---------------------------------------------------------------------------

  const pull = () => {
    const s = g.current
    if (s.phase !== 'play' || s.ball || s.left <= 0 || s.charging) return
    s.charging = true
    s.power = 0
    setCharging(true)
  }
  const release = () => {
    const s = g.current
    if (!s.charging) return
    s.charging = false
    setCharging(false)
    if (s.phase !== 'play' || s.ball || s.left <= 0) return
    s.ball = launch(s.power)
    pachinkoSfx.launch(s.power)
    s.left -= 1
    setLeft(s.left)
    s.power = 0
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish(phase === 'done' ? meritFor(g.current.points) : 0)
        return
      }
      if (k !== ' ' && k !== 'e' && k !== 'enter') return
      e.preventDefault()
      if (phase === 'intro') setPhase('play')
      else if (phase === 'done') finish(meritFor(g.current.points))
      else if (!e.repeat) pull()
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === ' ' || k === 'e' || k === 'enter') release()
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ---------------------------------------------------------------------------
  // 畫面
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const c = canvas.current
    const w = wrap.current
    if (!c || !w) return
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = w.clientWidth
      const ch = Math.round(cw * ((H + PAD * 2) / (1 + PAD * 2)))
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

  function draw() {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const s = g.current
    const S = c.width / (1 + PAD * 2)
    const X = (x: number) => (x + PAD) * S
    const Y = (y: number) => (y + PAD) * S
    const t = s.t
    // 木框
    ctx.fillStyle = '#3a1d10'
    ctx.fillRect(0, 0, c.width, c.height)
    const wood = ctx.createLinearGradient(0, 0, c.width, 0)
    wood.addColorStop(0, '#5a2c14')
    wood.addColorStop(0.5, '#7a3e1c')
    wood.addColorStop(1, '#5a2c14')
    ctx.fillStyle = wood
    ctx.fillRect(S * 0.01, S * 0.01, c.width - S * 0.02, c.height - S * 0.02)

    // 盤面（圓頂＋長方形）
    ctx.save()
    ctx.beginPath()
    ctx.arc(X(0.5), Y(0.5), 0.46 * S, Math.PI, 0)
    ctx.lineTo(X(0.96), Y(H))
    ctx.lineTo(X(0.04), Y(H))
    ctx.closePath()
    ctx.clip()
    const bg = ctx.createLinearGradient(0, Y(0), 0, Y(H))
    bg.addColorStop(0, '#16504e')
    bg.addColorStop(0.55, '#2a1f4a')
    bg.addColorStop(1, '#3a1430')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, c.width, c.height)
    // 背板上畫的東西：月亮、燈籠、招牌
    ctx.fillStyle = 'rgba(255,240,190,0.9)'
    ctx.beginPath()
    ctx.arc(X(0.25), Y(0.22), 0.05 * S, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#16504e'
    ctx.beginPath()
    ctx.arc(X(0.27), Y(0.21), 0.045 * S, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 5; i++) {
      const lx = 0.38 + i * 0.09
      const ly = 0.16 + Math.sin(i * 1.7) * 0.02
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = S * 0.002
      ctx.beginPath()
      ctx.moveTo(X(lx), Y(ly - 0.04))
      ctx.lineTo(X(lx), Y(ly - 0.02))
      ctx.stroke()
      ctx.fillStyle = i % 2 ? 'rgba(143,244,224,0.85)' : 'rgba(255,120,90,0.9)'
      ctx.beginPath()
      ctx.ellipse(X(lx), Y(ly), 0.022 * S, 0.028 * S, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(255,215,140,0.95)'
    ctx.font = `700 ${0.075 * S}px 'LXGW WenKai TC', 'Noto Serif TC', serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('陰間彈珠台', X(0.46), Y(0.36))
    // 發射道的隔板
    ctx.fillStyle = '#c9a15a'
    ctx.fillRect(X(LANE_X) - S * 0.004, Y(LANE_TOP), S * 0.008, Y(H) - Y(LANE_TOP))
    // 杯子：鬱金香形狀的塑膠杯（福是金色的大獎）
    POCKETS.forEach((p, i) => {
      const hot = s.lastPocket === i && t - s.lastPocketT < 0.8
      const big = p.points >= 50
      const hw = p.w / 2 + 0.016
      const cx = X(p.x)
      const top = Y(p.y - 0.014)
      const bot = Y(p.y + 0.04)
      if (big || hot) {
        const glow = ctx.createRadialGradient(cx, Y(p.y + 0.01), 1, cx, Y(p.y + 0.01), 0.09 * S)
        glow.addColorStop(0, hot ? 'rgba(255,246,190,0.8)' : 'rgba(255,200,90,0.35)')
        glow.addColorStop(1, 'rgba(255,200,90,0)')
        ctx.fillStyle = glow
        ctx.fillRect(cx - 0.1 * S, Y(p.y - 0.09), 0.2 * S, 0.2 * S)
      }
      // 兩邊的花瓣
      ctx.fillStyle = hot ? '#fff6c0' : big ? '#f7c35a' : '#ff6a4a'
      for (const sd of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(cx, bot)
        ctx.quadraticCurveTo(cx + sd * (hw + 0.02) * S, Y(p.y + 0.02), cx + sd * (hw + 0.01) * S, top - 0.012 * S)
        ctx.lineTo(cx + sd * hw * 0.5 * S, Y(p.y + 0.01))
        ctx.closePath()
        ctx.fill()
      }
      // 杯身
      ctx.fillStyle = hot ? '#fffbe0' : big ? '#e8a030' : '#e8402a'
      ctx.beginPath()
      ctx.moveTo(cx - hw * S, top)
      ctx.quadraticCurveTo(cx - hw * S, bot, cx, bot)
      ctx.quadraticCurveTo(cx + hw * S, bot, cx + hw * S, top)
      ctx.closePath()
      ctx.fill()
      // 杯口（暗的洞）
      ctx.fillStyle = 'rgba(30,10,10,0.75)'
      ctx.beginPath()
      ctx.ellipse(cx, top, hw * S * 0.92, 0.008 * S, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = big ? '#7a1010' : '#fff4e0'
      ctx.font = `900 ${(big ? 0.042 : 0.03) * S}px 'Noto Sans TC', sans-serif`
      ctx.fillText(p.label, cx, Y(p.y + 0.017))
    })
    // 釘子
    for (const p of PINS) {
      ctx.fillStyle = '#d9b36a'
      ctx.beginPath()
      ctx.arc(X(p.x), Y(p.y), PIN_R * S, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.arc(X(p.x) - PIN_R * S * 0.3, Y(p.y) - PIN_R * S * 0.3, PIN_R * S * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }
    // 彈珠（拖一點尾巴）
    s.trail.forEach((p, i) => {
      ctx.fillStyle = `rgba(220,240,255,${(i / s.trail.length) * 0.25})`
      ctx.beginPath()
      ctx.arc(X(p.x), Y(p.y), BALL_R * S * 0.8, 0, Math.PI * 2)
      ctx.fill()
    })
    const b = s.ball
    const bx = b ? b.x : START.x
    const by = b ? b.y : START.y + s.power * 0.05
    if (b || (s.phase === 'play' && s.left > 0)) drawMarble(ctx, X(bx), Y(by), BALL_R * S)
    // 拉桿（發射道底下的彈簧）
    const comp = s.power * 0.05
    ctx.strokeStyle = '#d0d0d0'
    ctx.lineWidth = S * 0.004
    ctx.beginPath()
    const y0 = START.y + BALL_R + comp
    const y1 = H - 0.005
    for (let i = 0; i <= 10; i++) {
      const yy = y0 + ((y1 - y0) * i) / 10
      const xx = 0.92 + (i % 2 ? 0.018 : -0.018)
      if (i === 0) ctx.moveTo(X(0.92), Y(yy))
      else ctx.lineTo(X(xx), Y(yy))
    }
    ctx.stroke()
    // 分數飄字
    for (const p of s.popups) {
      ctx.fillStyle = `rgba(255,236,160,${1 - p.t / 1.2})`
      ctx.font = `700 ${0.05 * S}px 'Noto Sans TC', sans-serif`
      ctx.fillText(p.text, X(p.x), Y(p.y - p.t * 0.08))
    }
    ctx.restore()

    // 外框一圈的小燈泡：平常慢慢跑，得分時一直閃
    const n = 26
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1)
      const px = k < 0.5 ? 0.02 : 0.98
      const py = 0.2 + ((k < 0.5 ? k : k - 0.5) * 2) * (H - 0.25)
      const on = s.lights > 0 ? Math.floor(t * 14 + i) % 2 === 0 : Math.floor(t * 3 - i) % 5 === 0
      ctx.fillStyle = on ? (i % 3 ? '#ffe28a' : '#ff8ab8') : 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.arc(X(px), Y(py), 0.011 * S, 0, Math.PI * 2)
      ctx.fill()
    }
    // 圓頂的金邊
    ctx.strokeStyle = '#e8c070'
    ctx.lineWidth = S * 0.01
    ctx.beginPath()
    ctx.arc(X(0.5), Y(0.5), 0.465 * S, Math.PI, 0)
    ctx.stroke()
  }

  const merit = meritFor(points)

  return (
    <div className="pc-card">
      <div className="pc-head">
        <span className="pc-title">🎯 彈珠台</span>
        <span className="pc-stat">
          彈珠 <b>{left}</b>
        </span>
        <span className="pc-stat">
          分數 <b>{points}</b>
        </span>
      </div>
      <button className="pc-leave" onClick={() => finish(phase === 'done' ? merit : 0)}>
        離開
      </button>
      <div className="pc-stage" ref={wrap}>
        <canvas ref={canvas} className="pc-canvas" onPointerDown={pull} onPointerUp={release} onPointerCancel={release} onPointerLeave={release} />
        {phase === 'intro' && (
          <div className="pc-overlay">
            <p>
              <b>按住拉桿</b>蓄力，放開把彈珠打上去。
              <br />
              力道太小會掉回來，太大會直直衝到底——找到剛剛好的力道。
              <br />
              十顆彈珠，進杯子得分：<b>福</b> 50、30、20、10。
            </p>
            <button className="btn primary" onClick={() => setPhase('play')}>
              投十顆彈珠
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="pc-overlay">
            <p className="pc-result">
              分數 <b>{points}</b>
            </p>
            <p className="pc-merit">{merit > 0 ? `功德 +${merit}` : '沒有功德……再接再厲'}</p>
            <button className="btn primary" onClick={() => finish(merit)}>
              收下
            </button>
          </div>
        )}
      </div>
      {phase === 'play' && (
        <div className="pc-controls">
          <div className="pc-power">
            <i ref={bar} className={charging ? 'on' : ''} />
          </div>
          <button
            className={`pc-pull ${charging ? 'on' : ''}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              pull()
            }}
            onPointerUp={release}
            onPointerCancel={release}
          >
            {charging ? '放開！' : '按住拉桿'}
            <span className="action-key small">E</span>
          </button>
        </div>
      )}
    </div>
  )
}

function drawMarble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
  gr.addColorStop(0, '#ffffff')
  gr.addColorStop(0.4, '#c8d4dc')
  gr.addColorStop(1, '#5c6a74')
  ctx.fillStyle = gr
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}
