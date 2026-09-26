import { useEffect, useRef, useState } from 'react'
import { CHUTE, HOME, PRIZE_INFO, inChute, makePrizes, slipOnLift, slipPerSecond, tryGrab, type Prize, type PrizeKind } from './claw.logic'
import { clawSfx, makeMotor } from './claw.sound'
import type { ClawResult, MinigameProps } from './types'
import './claw.css'

// 夾娃娃機（柑仔店門口）：一次投一枚硬幣，15 秒內把爪子移到娃娃上面（看地上的影子對準前後），按「下爪」。
// 爪子很弱：夾起來、拉上去、搬到出獎口的路上都可能掉。夾到一個就結束；硬幣用完也結束。
// params.coins：這次可以投幾枚（錢不夠時會少於 3）；回傳用掉幾枚，外面依此扣錢。

type Phase = 'intro' | 'play' | 'win' | 'lose'
type Stage = 'aim' | 'drop' | 'grab' | 'lift' | 'carry' | 'release' | 'wait'

const AIM_TIME = 15
const MOVE = 0.5
const CANVAS_ASPECT = 1.08

interface Falling {
  prize: Prize
  x: number
  d: number
  /** 離地面的高度（畫面比例） */
  y: number
  vy: number
  chute: boolean
}

export default function Claw({ params, done }: MinigameProps<{ coins?: number } | undefined, ClawResult>) {
  const maxCoins = Math.max(1, Math.min(3, params?.coins ?? 3))
  const [phase, setPhase] = useState<Phase>('intro')
  const [coins, setCoins] = useState(maxCoins)
  const [left, setLeft] = useState(AIM_TIME)
  const [aiming, setAiming] = useState(false)
  const [won, setWon] = useState<PrizeKind | null>(null)
  const [msg, setMsg] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const motor = useRef<ReturnType<typeof makeMotor> | null>(null)
  const g = useRef({
    prizes: makePrizes(),
    x: HOME.x,
    d: HOME.d,
    tx: HOME.x,
    td: HOME.d,
    pointer: false,
    keys: new Set<string>(),
    stage: 'wait' as Stage,
    st: 0,
    h: 0,
    open: 1,
    swing: 0,
    swingV: 0,
    held: null as { prize: Prize; aim: number } | null,
    falling: [] as Falling[],
    coins: maxCoins,
    used: 0,
    timer: AIM_TIME,
    t: 0,
    lastVx: 0,
    won: null as PrizeKind | null,
  })

  const finish = () => {
    motor.current?.stop()
    const s = g.current
    done({ prize: s.won, coins: s.used })
  }

  // ---------------------------------------------------------------------------
  // 流程
  // ---------------------------------------------------------------------------

  const insertCoin = () => {
    const s = g.current
    s.coins -= 1
    s.used += 1
    setCoins(s.coins)
    s.stage = 'aim'
    s.st = 0
    s.timer = AIM_TIME
    s.tx = s.x
    s.td = s.d
    setLeft(AIM_TIME)
    setAiming(true)
    setMsg('')
    clawSfx.coin()
  }

  const start = () => {
    motor.current = makeMotor()
    setPhase('play')
    insertCoin()
  }

  const dropClaw = () => {
    const s = g.current
    if (s.stage !== 'aim') return
    s.stage = 'drop'
    s.st = 0
    setAiming(false)
    clawSfx.drop()
  }

  const afterTry = (win: boolean) => {
    const s = g.current
    if (win) {
      s.stage = 'wait'
      clawSfx.win()
      window.setTimeout(() => setPhase('win'), 700)
      return
    }
    if (s.coins > 0) {
      window.setTimeout(insertCoin, 900)
      s.stage = 'wait'
    } else {
      s.stage = 'wait'
      clawSfx.lose()
      window.setTimeout(() => setPhase('lose'), 800)
    }
  }

  // ---------------------------------------------------------------------------
  // 每幀
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let sec = AIM_TIME
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      step(dt)
      draw()
      const s = g.current
      if (s.stage === 'aim' && Math.ceil(s.timer) !== sec) {
        sec = Math.ceil(s.timer)
        setLeft(Math.max(0, sec))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => motor.current?.stop(), [])

  function moveToward(tx: number, td: number, dt: number, speed: number) {
    const s = g.current
    const dx = tx - s.x
    const dd = td - s.d
    const dist = Math.hypot(dx, dd)
    const stepLen = Math.min(dist, speed * dt)
    if (dist > 1e-4) {
      s.x += (dx / dist) * stepLen
      s.d += (dd / dist) * stepLen
    }
    return dist - stepLen
  }

  function step(dt: number) {
    const s = g.current
    s.t += dt
    s.st += dt
    const px = s.x
    const pd = s.d
    // 掉下來的娃娃
    for (const f of s.falling) {
      f.vy -= 3.2 * dt
      f.y = Math.max(0, f.y + f.vy * dt)
    }
    const landed = s.falling.filter((f) => f.y <= 0)
    if (landed.length) {
      for (const f of landed) {
        if (f.chute) continue
        f.prize.x = Math.min(0.95, Math.max(0.24, f.x))
        f.prize.d = Math.min(0.92, Math.max(0.06, f.d))
        s.prizes.push(f.prize)
        clawSfx.thud()
      }
      s.falling = s.falling.filter((f) => f.y > 0)
    }

    switch (s.stage) {
      case 'aim': {
        s.timer -= dt
        const kx = (s.keys.has('arrowright') || s.keys.has('d') ? 1 : 0) - (s.keys.has('arrowleft') || s.keys.has('a') ? 1 : 0)
        const kd = (s.keys.has('arrowdown') || s.keys.has('s') ? 1 : 0) - (s.keys.has('arrowup') || s.keys.has('w') ? 1 : 0)
        if (kx || kd) {
          s.tx = clamp(s.x + kx * 0.2, 0.04, 0.96)
          s.td = clamp(s.d + kd * 0.2, 0.04, 0.96)
        }
        moveToward(clamp(s.tx, 0.04, 0.96), clamp(s.td, 0.04, 0.96), dt, MOVE)
        if (s.timer <= 0) dropClaw()
        break
      }
      case 'drop':
        s.h = Math.min(1, s.h + dt / 1.0)
        s.open = Math.min(1, s.open + dt * 3)
        if (s.h >= 1) {
          s.stage = 'grab'
          s.st = 0
        }
        break
      case 'grab':
        s.open = Math.max(0, 1 - s.st / 0.45)
        if (s.st >= 0.45) {
          const r = tryGrab(s.prizes, s.x, s.d)
          clawSfx.grab()
          if (r.prize) {
            s.held = { prize: r.prize, aim: r.aim }
            s.prizes = s.prizes.filter((p) => p !== r.prize)
          }
          s.stage = 'lift'
          s.st = 0
        }
        break
      case 'lift':
        s.h = Math.max(0, 1 - s.st / 0.9)
        if (s.h <= 0) {
          if (s.held && slipOnLift(s.held.prize, s.held.aim)) {
            drop(false)
            setMsg('啊，滑掉了……')
          }
          s.stage = 'carry'
          s.st = 0
        }
        break
      case 'carry': {
        const rest = moveToward(HOME.x, HOME.d, dt, 0.45)
        if (s.held && Math.random() < slipPerSecond(s.held.prize, s.swing) * dt) {
          const lucky = inChute(s.x, s.d)
          drop(lucky)
          if (!lucky) setMsg('差一點點！')
        }
        if (rest <= 1e-3) {
          s.stage = 'release'
          s.st = 0
        }
        break
      }
      case 'release':
        s.open = Math.min(1, s.st / 0.35)
        if (s.st >= 0.35) {
          const win = !!s.held || !!s.won
          if (s.held) drop(true)
          s.held = null
          s.stage = 'wait'
          s.st = 0
          if (!win) setMsg((m) => m || '沒夾到……')
          afterTry(win)
        }
        break
      case 'wait':
        break
    }
    // 爪子晃：車子一加速、一停，爪子就往反方向盪
    const vx = (s.x - px) / Math.max(dt, 1e-4)
    const vd = (s.d - pd) / Math.max(dt, 1e-4)
    s.swingV += -(vx - s.lastVx) * 0.9 - s.swing * 14 * dt
    s.swingV *= Math.exp(-2.2 * dt)
    s.swing += s.swingV * dt
    s.lastVx = vx
    motor.current?.set(Math.min(1, Math.hypot(vx, vd) / MOVE) + (s.stage === 'drop' || s.stage === 'lift' ? 0.5 : 0))
  }

  /** 爪子裡的娃娃掉下去；chute＝掉進出獎口（夾到了） */
  function drop(chute: boolean) {
    const s = g.current
    if (!s.held) return
    const p = s.held.prize
    s.held = null
    s.falling.push({ prize: p, x: s.x, d: s.d, y: 0.45 - s.h * 0.2, vy: 0, chute })
    if (chute) {
      s.won = p.kind
      setWon(p.kind)
    }
  }

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
      const ch = Math.round(cw * CANVAS_ASPECT)
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

  // 透視：娃娃坑的 (x, d) → 畫面
  const geo = (W: number, Hh: number) => {
    const yb = 0.58 * Hh
    const yf = 0.84 * Hh
    // 地板：後面窄、前面寬
    const floor = (x: number, d: number) => {
      const y = yb + (yf - yb) * d
      const x0 = W * (0.17 + (0.08 - 0.17) * d)
      const x1 = W * (0.83 + (0.92 - 0.83) * d)
      return { x: x0 + x * (x1 - x0), y, k: 0.8 + 0.35 * d }
    }
    const top = (x: number, d: number) => {
      const f = floor(x, d)
      return { x: f.x, y: Hh * (0.16 + 0.05 * d), k: f.k }
    }
    return { floor, top }
  }

  function draw() {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const s = g.current
    const W = c.width
    const Hh = c.height
    const { floor, top } = geo(W, Hh)
    const t = s.t
    // 機台外殼
    ctx.fillStyle = '#2a0f1c'
    ctx.fillRect(0, 0, W, Hh)
    const body = ctx.createLinearGradient(0, 0, W, 0)
    body.addColorStop(0, '#e8558c')
    body.addColorStop(0.5, '#ff8ab8')
    body.addColorStop(1, '#e8558c')
    ctx.fillStyle = body
    roundRect(ctx, W * 0.01, Hh * 0.01, W * 0.98, Hh * 0.98, W * 0.05)
    ctx.fill()
    // 招牌（霓虹會閃）
    const flick = Math.sin(t * 17) > 0.96 ? 0.5 : 1
    ctx.fillStyle = '#3a0a22'
    roundRect(ctx, W * 0.14, Hh * 0.02, W * 0.72, Hh * 0.085, W * 0.04)
    ctx.fill()
    ctx.fillStyle = `rgba(255,236,120,${flick})`
    ctx.font = `700 ${W * 0.07}px 'LXGW WenKai TC', 'Noto Serif TC', serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(255,200,80,0.9)'
    ctx.shadowBlur = W * 0.03 * flick
    ctx.fillText('夾 娃 娃', W * 0.5, Hh * 0.064)
    ctx.shadowBlur = 0
    // 玻璃裡面
    ctx.save()
    roundRect(ctx, W * 0.05, Hh * 0.12, W * 0.9, Hh * 0.76, W * 0.02)
    ctx.clip()
    const back = ctx.createLinearGradient(0, Hh * 0.12, 0, Hh * 0.6)
    back.addColorStop(0, '#ffd6e8')
    back.addColorStop(1, '#f7a8c8')
    ctx.fillStyle = back
    ctx.fillRect(0, 0, W, Hh)
    // 背板上的星星
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    for (let i = 0; i < 14; i++) {
      const sx = W * (0.1 + ((i * 0.618) % 0.8))
      const sy = Hh * (0.18 + ((i * 0.37) % 0.35))
      star(ctx, sx, sy, W * 0.012 * (0.6 + 0.4 * Math.sin(t * 2 + i)))
    }
    // 地板（娃娃坑）
    const a = floor(0, 0)
    const b = floor(1, 0)
    const cc = floor(1, 1)
    const dd = floor(0, 1)
    ctx.fillStyle = '#c85a8a'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(cc.x, Hh)
    ctx.lineTo(dd.x, Hh)
    ctx.closePath()
    ctx.fill()
    // 出獎口（左前角，透明壓克力）
    const c0 = floor(0, CHUTE.d0)
    const c1 = floor(CHUTE.x1, CHUTE.d0)
    const c2 = floor(CHUTE.x1, 1)
    const c3 = floor(0, 1)
    ctx.fillStyle = 'rgba(40,10,30,0.55)'
    ctx.beginPath()
    ctx.moveTo(c0.x, c0.y)
    ctx.lineTo(c1.x, c1.y)
    ctx.lineTo(c2.x, c2.y)
    ctx.lineTo(c3.x, c3.y)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = W * 0.004
    ctx.strokeRect(c0.x, c0.y - Hh * 0.06, c1.x - c0.x, Hh * 0.06)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = `700 ${W * 0.028}px 'Noto Sans TC', sans-serif`
    ctx.fillText('出口', (c0.x + c1.x) / 2, c0.y - Hh * 0.03)

    // 爪子的位置與影子
    const cf = floor(s.x, s.d)
    const ct = top(s.x, s.d)
    const restY = ct.y + Hh * 0.06
    const lowY = cf.y - W * 0.06 * cf.k
    const clawY = restY + (lowY - restY) * s.h
    ctx.fillStyle = 'rgba(80,10,40,0.35)'
    ctx.beginPath()
    ctx.ellipse(cf.x, cf.y, W * 0.05 * cf.k, W * 0.016 * cf.k, 0, 0, Math.PI * 2)
    ctx.fill()
    // 瞄準的光（對準時很有用）
    if (s.stage === 'aim') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.setLineDash([W * 0.01, W * 0.012])
      ctx.lineWidth = W * 0.003
      ctx.beginPath()
      ctx.moveTo(cf.x, clawY)
      ctx.lineTo(cf.x, cf.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
    // 娃娃（後面的先畫）＋爪子插在中間
    const sorted = [...s.prizes].sort((p, q) => p.d - q.d)
    const drawPrizeAt = (p: Prize, x: number, d: number, lift = 0) => {
      const f = floor(x, d)
      drawPrize(ctx, p.kind, f.x, f.y - lift, W * PRIZE_INFO[p.kind].r * 1.25 * f.k, p.tilt, t)
    }
    for (const p of sorted) if (p.d <= s.d) drawPrizeAt(p, p.x, p.d)
    for (const f of s.falling) if (!f.chute) drawPrizeAt(f.prize, f.x, f.d, f.y * Hh * 0.5)
    // 爪子
    drawClaw(ctx, ct.x, ct.y, clawY, s.open, s.swing, ct.k, W, s.held?.prize.kind ?? null, t)
    for (const p of sorted) if (p.d > s.d) drawPrizeAt(p, p.x, p.d)
    // 掉進出口的
    for (const f of s.falling) if (f.chute) drawPrizeAt(f.prize, f.x, f.d, f.y * Hh * 0.5)
    ctx.restore()

    // 玻璃反光
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.beginPath()
    ctx.moveTo(W * 0.1, Hh * 0.13)
    ctx.lineTo(W * 0.22, Hh * 0.13)
    ctx.lineTo(W * 0.1, Hh * 0.5)
    ctx.closePath()
    ctx.fill()
    // 前面的面板
    ctx.fillStyle = '#b8386c'
    roundRect(ctx, W * 0.05, Hh * 0.885, W * 0.9, Hh * 0.1, W * 0.02)
    ctx.fill()
    // 投幣孔
    ctx.fillStyle = '#2a0f1c'
    roundRect(ctx, W * 0.75, Hh * 0.91, W * 0.1, Hh * 0.05, W * 0.01)
    ctx.fill()
    ctx.fillStyle = '#f2c14e'
    ctx.fillRect(W * 0.795, Hh * 0.92, W * 0.01, Hh * 0.03)
    // 搖桿
    ctx.fillStyle = '#2a0f1c'
    ctx.beginPath()
    ctx.ellipse(W * 0.22, Hh * 0.945, W * 0.06, Hh * 0.02, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#444'
    ctx.lineWidth = W * 0.012
    ctx.beginPath()
    ctx.moveTo(W * 0.22, Hh * 0.945)
    ctx.lineTo(W * 0.22 + s.swing * W * 0.3, Hh * 0.9)
    ctx.stroke()
    ctx.fillStyle = '#ff3b30'
    ctx.beginPath()
    ctx.arc(W * 0.22 + s.swing * W * 0.3, Hh * 0.9, W * 0.022, 0, Math.PI * 2)
    ctx.fill()
    // 周圍的小燈
    for (let i = 0; i < 12; i++) {
      const on = Math.floor(t * 4 + i) % 3 === 0
      ctx.fillStyle = on ? '#fff3a0' : 'rgba(255,255,255,0.3)'
      ctx.beginPath()
      ctx.arc(W * (0.03 + (i % 2) * 0.94), Hh * (0.18 + Math.floor(i / 2) * 0.12), W * 0.012, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ---------------------------------------------------------------------------
  // 操作
  // ---------------------------------------------------------------------------

  const toPit = (e: React.PointerEvent) => {
    const c = canvas.current!
    const r = c.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * c.width
    const py = ((e.clientY - r.top) / r.height) * c.height
    const { floor } = geo(c.width, c.height)
    const y0 = floor(0, 0).y
    const y1 = floor(0, 1).y
    const d = clamp((py - y0) / (y1 - y0), 0, 1)
    const a = floor(0, d)
    const b = floor(1, d)
    return { x: clamp((px - a.x) / (b.x - a.x), 0, 1), d }
  }
  const onDown = (e: React.PointerEvent) => {
    const s = g.current
    if (s.stage !== 'aim') return
    e.currentTarget.setPointerCapture(e.pointerId)
    s.pointer = true
    const p = toPit(e)
    s.tx = p.x
    s.td = p.d
  }
  const onMove = (e: React.PointerEvent) => {
    const s = g.current
    if (!s.pointer || s.stage !== 'aim') return
    const p = toPit(e)
    s.tx = p.x
    s.td = p.d
  }
  const onUp = () => {
    g.current.pointer = false
  }
  const hold = (k: string, on: boolean) => {
    if (on) g.current.keys.add(k)
    else g.current.keys.delete(k)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish()
        return
      }
      if (k === ' ' || k === 'e' || k === 'enter') {
        e.preventDefault()
        if (phase === 'intro') start()
        else if (phase === 'win' || phase === 'lose') finish()
        else dropClaw()
        return
      }
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault()
        g.current.keys.add(k)
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

  const pad = (k: string, label: string, cls: string) => (
    <button
      className={`cl-pad ${cls}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        hold(k, true)
      }}
      onPointerUp={() => hold(k, false)}
      onPointerCancel={() => hold(k, false)}
      aria-label={label}
    >
      {label}
    </button>
  )

  return (
    <div className="cl-card">
      <div className="cl-head">
        <span className="cl-title">夾娃娃機</span>
        <span className="cl-coins">
          {Array.from({ length: maxCoins }, (_, i) => (
            <i key={i} className={i < coins ? 'on' : ''} />
          ))}
        </span>
        {phase === 'play' && aiming && <span className={`cl-timer ${left <= 5 ? 'hurry' : ''}`}>{left}</span>}
      </div>
      <button className="cl-leave" onClick={finish}>
        離開
      </button>
      <div className="cl-stage" ref={wrap}>
        <canvas ref={canvas} className="cl-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        {msg && phase === 'play' && <div className="cl-msg">{msg}</div>}
        {phase === 'intro' && (
          <div className="cl-overlay">
            <p>
              一次 <b>$20</b>，這次可以投 <b>{maxCoins}</b> 枚。
              <br />
              移動爪子（看地上的<b>影子</b>對準前後），按<b>下爪</b>。
              <br />
              爪子很沒力，拉上去、搬過去的路上都可能掉……
            </p>
            <button className="btn primary" onClick={start}>
              投幣
            </button>
          </div>
        )}
        {phase === 'win' && won && (
          <div className="cl-overlay">
            <div className="cl-prize">{PRIZE_INFO[won].icon}</div>
            <p className="cl-result">
              夾到了！<b>{PRIZE_INFO[won].name}</b>
            </p>
            <button className="btn primary" onClick={finish}>
              收下
            </button>
          </div>
        )}
        {phase === 'lose' && (
          <div className="cl-overlay">
            <p className="cl-result">硬幣用完了……</p>
            <p>這台爪子真的很沒力。</p>
            <button className="btn primary" onClick={finish}>
              算了
            </button>
          </div>
        )}
      </div>
      {phase === 'play' && (
        <div className="cl-controls">
          <div className="cl-pads">
            {pad('arrowup', '▲', 'up')}
            {pad('arrowleft', '◀', 'left')}
            {pad('arrowright', '▶', 'right')}
            {pad('arrowdown', '▼', 'down')}
          </div>
          <button className="cl-drop" disabled={!aiming} onPointerDown={dropClaw}>
            下爪
            <span className="action-key small">E</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 小圖
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
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

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
}

function drawClaw(ctx: CanvasRenderingContext2D, x: number, railY: number, y: number, open: number, swing: number, k: number, W: number, held: PrizeKind | null, t: number) {
  // 軌道上的車
  ctx.fillStyle = '#d8d8d8'
  ctx.fillRect(x - W * 0.035 * k, railY - W * 0.012, W * 0.07 * k, W * 0.024)
  ctx.save()
  ctx.translate(x, railY)
  ctx.rotate(swing)
  const len = y - railY
  // 線
  ctx.strokeStyle = '#555'
  ctx.lineWidth = W * 0.003
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, len)
  ctx.stroke()
  // 抓到的娃娃（掛在爪子下面）
  if (held) drawPrize(ctx, held, 0, len + W * 0.07 * k, W * PRIZE_INFO[held].r * 1.25 * k, 0, t)
  // 爪子本體
  ctx.translate(0, len)
  ctx.fillStyle = '#c0c4c8'
  ctx.beginPath()
  ctx.ellipse(0, 0, W * 0.03 * k, W * 0.016 * k, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#9aa0a6'
  ctx.lineWidth = W * 0.008 * k
  ctx.lineCap = 'round'
  const spread = 0.25 + open * 0.55
  for (const side of [-1, 0, 1]) {
    const a = side * spread
    const L = W * 0.06 * k
    const bx = Math.sin(a) * L * 0.6
    const by = Math.cos(a) * L * 0.6
    ctx.beginPath()
    ctx.moveTo(side * W * 0.012 * k, W * 0.008 * k)
    ctx.lineTo(bx + side * W * 0.01 * k, by)
    ctx.lineTo(bx - side * W * 0.012 * k * (1 - open), by + L * 0.45)
    ctx.stroke()
  }
  ctx.restore()
}

function drawPrize(ctx: CanvasRenderingContext2D, kind: PrizeKind, x: number, y: number, r: number, tilt: number, t: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  // 影子
  ctx.fillStyle = 'rgba(80,10,40,0.25)'
  ctx.beginPath()
  ctx.ellipse(0, r * 0.05, r * 0.9, r * 0.25, 0, 0, Math.PI * 2)
  ctx.fill()
  const eye = (ex: number, ey: number, rr: number) => {
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.arc(ex, ey, rr, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(ex - rr * 0.3, ey - rr * 0.3, rr * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }
  if (kind === 'dino') {
    // 綠色恐龍：背上一排刺
    ctx.fillStyle = '#9be07a'
    for (let i = 0; i < 4; i++) {
      const a = -2.4 + i * 0.45
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r * 0.85, -r * 0.55 + Math.sin(a) * r * 0.55)
      ctx.lineTo(Math.cos(a) * r * 1.15, -r * 0.55 + Math.sin(a) * r * 0.85)
      ctx.lineTo(Math.cos(a + 0.25) * r * 0.85, -r * 0.55 + Math.sin(a + 0.25) * r * 0.55)
      ctx.fill()
    }
    ctx.fillStyle = '#4caf50'
    ctx.beginPath()
    ctx.ellipse(0, -r * 0.5, r * 0.85, r * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(r * 0.55, -r * 0.95, r * 0.42, r * 0.35, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c8f0b0'
    ctx.beginPath()
    ctx.ellipse(r * 0.1, -r * 0.35, r * 0.45, r * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()
    eye(r * 0.7, -r * 1.02, r * 0.09)
  } else if (kind === 'doll') {
    // 紅衫胖娃娃：白白的圓臉、黑頭髮、紅衣服
    ctx.fillStyle = '#d8312a'
    ctx.beginPath()
    ctx.ellipse(0, -r * 0.4, r * 0.7, r * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff2e4'
    ctx.beginPath()
    ctx.arc(0, -r * 1.05, r * 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.arc(0, -r * 1.12, r * 0.5, Math.PI * 1.05, Math.PI * 1.95)
    ctx.fill()
    eye(-r * 0.17, -r * 1.02, r * 0.07)
    eye(r * 0.17, -r * 1.02, r * 0.07)
    ctx.strokeStyle = '#b3261e'
    ctx.lineWidth = r * 0.06
    ctx.beginPath()
    ctx.arc(0, -r * 0.92, r * 0.14, 0.2, Math.PI - 0.2)
    ctx.stroke()
  } else if (kind === 'snack') {
    // 綠色零食包：上下有壓邊，中間一個黃色圓
    ctx.fillStyle = '#3aa655'
    ctx.beginPath()
    ctx.moveTo(-r * 0.55, -r * 1.3)
    for (let i = 0; i <= 6; i++) ctx.lineTo(-r * 0.55 + (i * r * 1.1) / 6, -r * 1.3 - (i % 2 ? r * 0.08 : 0))
    ctx.lineTo(r * 0.6, 0)
    for (let i = 6; i >= 0; i--) ctx.lineTo(-r * 0.55 + (i * r * 1.1) / 6 + r * 0.03, i % 2 ? r * 0.08 : 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ffd23f'
    ctx.beginPath()
    ctx.arc(0, -r * 0.65, r * 0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c62828'
    ctx.font = `900 ${r * 0.42}px 'Noto Sans TC', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('乖', 0, -r * 0.63)
  } else {
    // 粉紅兔：長耳朵
    const wob = Math.sin(t * 2 + x) * 0.05
    ctx.fillStyle = '#ffb3cf'
    for (const s of [-1, 1]) {
      ctx.save()
      ctx.translate(s * r * 0.2, -r * 1.3)
      ctx.rotate(s * 0.2 + wob)
      ctx.beginPath()
      ctx.ellipse(0, -r * 0.35, r * 0.14, r * 0.42, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.beginPath()
    ctx.ellipse(0, -r * 0.4, r * 0.62, r * 0.48, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, -r * 1.02, r * 0.42, 0, Math.PI * 2)
    ctx.fill()
    eye(-r * 0.15, -r * 1.03, r * 0.06)
    eye(r * 0.15, -r * 1.03, r * 0.06)
    ctx.fillStyle = '#e8558c'
    ctx.beginPath()
    ctx.arc(0, -r * 0.92, r * 0.05, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
