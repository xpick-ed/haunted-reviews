import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio'
import type { MinigameProps, TrainResult } from './types'
import './train.css'

// 五分車（小火車站）：阿嬤坐在甘蔗車的車頂上，火車穿過夜裡的甘蔗田。
//   點一下（空白鍵／E／↑）跳起來；在空中再點一下，會像鬼一樣飄一下（下降變慢）。
//   低低的樹枝、號誌牌要跳過去；高高的電線不要跳（跳上去會撞到）。
//   天上的燈籠要跳起來拿（+10），低低的火金姑直接吃（+2）。撞到三次就下車。
// 45 秒，分數換功德 0–3。

const W = 520
const H = 300
const ROOF = H * 0.7 // 車頂的高度（阿嬤坐的地方）
const GX = W * 0.24 // 阿嬤的 x
const DURATION = 45
const JUMP = 360
const GRAV = 980
const GLIDE_GRAV = 260
const LIVES = 3

type Phase = 'intro' | 'play' | 'done'
type Kind = 'branch' | 'sign' | 'wire' | 'lantern' | 'firefly'

interface Thing {
  kind: Kind
  x: number
  /** 離車頂的高度（往上為正） */
  y: number
  hit: boolean
  ph: number
}
interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

export function meritFor(score: number) {
  return score >= 150 ? 3 : score >= 90 ? 2 : score >= 40 ? 1 : 0
}

// ---------------------------------------------------------------------------
// 聲音：火車的咚咚、跳、撿到、撞到
// ---------------------------------------------------------------------------

let noiseBuf: AudioBuffer | null = null
function noise(ctx: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

function chug(vol: number, hi: boolean) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = hi ? 900 : 420
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  src.connect(lp).connect(g).connect(audio.bus.sfx)
  src.start(t)
  src.stop(t + 0.14)
}

function tone(freq: number, len: number, type: OscillatorType, vol: number, slide = 1) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(freq * slide, t + len)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + len + 0.02)
}

const PENTA = [523, 587, 659, 784, 880, 1047]

// ---------------------------------------------------------------------------
// 畫面：夜空、遠山與糖廠煙囪、甘蔗田（三層視差）、電線桿、火車、阿嬤
// ---------------------------------------------------------------------------

function drawSky(c: CanvasRenderingContext2D, t: number, stars: [number, number, number][]) {
  const g = c.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0b1230')
  g.addColorStop(0.6, '#23264d')
  g.addColorStop(1, '#3b2f4a')
  c.fillStyle = g
  c.fillRect(0, 0, W, H)
  for (const [x, y, p] of stars) {
    c.fillStyle = `rgba(255,250,230,${0.35 + Math.sin(t * 2 + p) * 0.25})`
    c.fillRect(x, y, 1.6, 1.6)
  }
  // 月亮
  const mg = c.createRadialGradient(W * 0.8, 52, 6, W * 0.8, 52, 60)
  mg.addColorStop(0, 'rgba(255,245,210,0.55)')
  mg.addColorStop(1, 'rgba(255,245,210,0)')
  c.fillStyle = mg
  c.fillRect(W * 0.8 - 60, 0, 120, 120)
  c.fillStyle = '#fff4d4'
  c.beginPath()
  c.arc(W * 0.8, 52, 17, 0, Math.PI * 2)
  c.fill()
}

function drawFar(c: CanvasRenderingContext2D, off: number) {
  // 遠山
  c.fillStyle = '#1c2140'
  c.beginPath()
  c.moveTo(0, H * 0.55)
  for (let x = 0; x <= W + 40; x += 20) {
    const wx = x + off
    c.lineTo(x, H * 0.5 - Math.sin(wx * 0.011) * 18 - Math.sin(wx * 0.027 + 1) * 9)
  }
  c.lineTo(W, H)
  c.lineTo(0, H)
  c.fill()
  // 糖廠的煙囪（每 900 單位出現一次）
  const cx = ((-off % 900) + 900) % 900
  c.fillStyle = '#151a33'
  c.fillRect(cx + 60, H * 0.32, 12, H * 0.25)
  c.fillRect(cx + 20, H * 0.46, 90, H * 0.12)
  c.fillStyle = 'rgba(180,180,210,0.12)'
  for (let i = 0; i < 4; i++) {
    c.beginPath()
    c.arc(cx + 66 + i * 12, H * 0.3 - i * 12, 9 + i * 4, 0, Math.PI * 2)
    c.fill()
  }
}

function drawCane(c: CanvasRenderingContext2D, off: number, baseY: number, height: number, color: string, tip: string, spacing: number, t: number) {
  c.fillStyle = color
  c.fillRect(0, baseY, W, H - baseY)
  const start = Math.floor(off / spacing) * spacing
  for (let wx = start; wx < off + W + spacing; wx += spacing) {
    const x = wx - off
    const h = height * (0.75 + ((Math.sin(wx * 12.9898) * 43758.5) % 1 + 1) % 1 * 0.35)
    const sway = Math.sin(t * 1.6 + wx * 0.05) * 3
    c.strokeStyle = color
    c.lineWidth = 3
    c.beginPath()
    c.moveTo(x, baseY)
    c.lineTo(x + sway, baseY - h)
    c.stroke()
    // 葉子
    c.strokeStyle = tip
    c.lineWidth = 2
    for (const s of [-1, 1]) {
      c.beginPath()
      c.moveTo(x + sway, baseY - h + 4)
      c.quadraticCurveTo(x + sway + s * 10, baseY - h - 8, x + sway + s * 20, baseY - h + 6)
      c.stroke()
    }
  }
}

function drawTrain(c: CanvasRenderingContext2D, t: number, dist: number) {
  const wheelA = dist * 0.06
  // 三節甘蔗車＋火車頭（火車頭在右邊）
  const cars = [GX - 70, GX + 58, GX + 186]
  for (const x0 of cars) {
    c.fillStyle = '#2b2622'
    c.fillRect(x0 - 58, ROOF + 6, 116, 10)
    // 甘蔗堆
    c.fillStyle = '#8a7a4a'
    c.beginPath()
    c.moveTo(x0 - 56, ROOF + 6)
    c.quadraticCurveTo(x0, ROOF - 12, x0 + 56, ROOF + 6)
    c.fill()
    c.strokeStyle = 'rgba(60,50,30,0.5)'
    c.lineWidth = 1
    for (let i = -50; i < 50; i += 8) {
      c.beginPath()
      c.moveTo(x0 + i, ROOF + 4)
      c.lineTo(x0 + i + 6, ROOF - 4)
      c.stroke()
    }
    // 輪子
    for (const wx of [-36, 36]) {
      c.fillStyle = '#1a1614'
      c.beginPath()
      c.arc(x0 + wx, ROOF + 20, 7, 0, Math.PI * 2)
      c.fill()
      c.strokeStyle = '#6a605a'
      c.lineWidth = 1.5
      c.beginPath()
      c.moveTo(x0 + wx, ROOF + 20)
      c.lineTo(x0 + wx + Math.cos(wheelA) * 6, ROOF + 20 + Math.sin(wheelA) * 6)
      c.stroke()
    }
  }
  // 火車頭
  const lx = GX + 300
  c.fillStyle = '#e38a2a'
  c.fillRect(lx - 30, ROOF - 18, 62, 34)
  c.fillRect(lx - 64, ROOF - 34, 36, 50)
  c.fillStyle = '#2d2a28'
  c.fillRect(lx - 68, ROOF - 38, 44, 5)
  c.fillStyle = '#ffe7a0'
  c.fillRect(lx - 56, ROOF - 26, 20, 12)
  c.fillRect(lx + 18, ROOF - 30, 5, 12)
  // 車頭燈的光
  const g = c.createLinearGradient(lx + 32, 0, W, 0)
  g.addColorStop(0, 'rgba(255,240,190,0.35)')
  g.addColorStop(1, 'rgba(255,240,190,0)')
  c.fillStyle = g
  c.beginPath()
  c.moveTo(lx + 32, ROOF - 4)
  c.lineTo(W, ROOF - 40)
  c.lineTo(W, ROOF + 26)
  c.fill()
  // 煙
  c.fillStyle = 'rgba(200,200,220,0.18)'
  for (let i = 0; i < 5; i++) {
    const k = (t * 1.5 + i * 0.2) % 1
    c.beginPath()
    c.arc(lx + 4 - k * 80, ROOF - 28 - k * 30, 5 + k * 12, 0, Math.PI * 2)
    c.fill()
  }
  // 鐵軌
  c.fillStyle = '#16131a'
  c.fillRect(0, ROOF + 26, W, H - ROOF - 26)
  c.fillStyle = '#4a4550'
  c.fillRect(0, ROOF + 27, W, 2)
  const so = dist % 24
  c.fillStyle = '#2a2420'
  for (let x = -so; x < W; x += 24) c.fillRect(x, ROOF + 30, 12, 4)
}

function drawGrandma(c: CanvasRenderingContext2D, y: number, t: number, air: boolean, blink: boolean) {
  if (blink) return
  const cx = GX
  const cy = ROOF - 16 - y
  // 光暈
  const g = c.createRadialGradient(cx, cy - 6, 2, cx, cy - 6, 34)
  g.addColorStop(0, 'rgba(143,244,255,0.45)')
  g.addColorStop(1, 'rgba(143,244,255,0)')
  c.fillStyle = g
  c.fillRect(cx - 40, cy - 46, 80, 80)
  // 身體（紫色花衣）
  c.fillStyle = '#6b3fa0'
  c.beginPath()
  c.ellipse(cx, cy + 6, 11, 12, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#f2d9ff'
  for (const [dx, dy] of [
    [-4, 3],
    [4, 8],
    [0, 12],
    [5, 0],
  ])
    c.fillRect(cx + dx, cy + dy, 2, 2)
  // 手：飛起來時舉高
  c.strokeStyle = '#6b3fa0'
  c.lineWidth = 4
  c.lineCap = 'round'
  const up = air ? -12 : 2
  for (const s of [-1, 1]) {
    c.beginPath()
    c.moveTo(cx + s * 8, cy + 2)
    c.lineTo(cx + s * 16, cy + up + Math.sin(t * 10) * (air ? 3 : 0))
    c.stroke()
  }
  // 頭
  c.fillStyle = '#f3d8c0'
  c.beginPath()
  c.arc(cx, cy - 11, 10, 0, Math.PI * 2)
  c.fill()
  // 白頭髮、髮髻
  c.fillStyle = '#eef4f6'
  c.beginPath()
  c.arc(cx, cy - 14, 10, Math.PI, Math.PI * 2)
  c.fill()
  c.beginPath()
  c.arc(cx - 2, cy - 24, 5, 0, Math.PI * 2)
  c.fill()
  // 瞇瞇眼、笑
  c.strokeStyle = '#3a2a2a'
  c.lineWidth = 1.4
  for (const s of [-1, 1]) {
    c.beginPath()
    c.arc(cx + s * 4, cy - 10, 2, Math.PI * 1.1, Math.PI * 1.9)
    c.stroke()
  }
  c.beginPath()
  c.arc(cx, cy - 6, 3, 0.1 * Math.PI, 0.9 * Math.PI)
  c.stroke()
}

function drawThing(c: CanvasRenderingContext2D, th: Thing, t: number) {
  const x = th.x
  const y = ROOF - th.y
  if (th.kind === 'branch') {
    // 從上面垂下來的甘蔗葉／樹枝，擋在車頂高度
    c.strokeStyle = '#2f4a22'
    c.lineWidth = 5
    c.beginPath()
    c.moveTo(x + 20, 0)
    c.quadraticCurveTo(x - 10, y - 60, x, y)
    c.stroke()
    c.fillStyle = '#4a7a30'
    for (let i = 0; i < 5; i++) {
      c.beginPath()
      c.ellipse(x + (i - 2) * 6, y - 8 - i * 7, 10, 4, 0.6 * (i % 2 ? 1 : -1), 0, Math.PI * 2)
      c.fill()
    }
  } else if (th.kind === 'sign') {
    // 鐵道旁的號誌牌（低的）
    c.fillStyle = '#3a3a40'
    c.fillRect(x - 2, y - 26, 4, 30)
    c.fillStyle = '#f2eee4'
    c.fillRect(x - 13, y - 34, 26, 16)
    c.fillStyle = '#c62c24'
    c.fillRect(x - 13, y - 34, 26, 4)
  } else if (th.kind === 'wire') {
    // 兩根電線桿中間的電線（高的）
    c.strokeStyle = '#3a3a44'
    c.lineWidth = 5
    c.beginPath()
    c.moveTo(x - 60, 0)
    c.lineTo(x - 60, H)
    c.moveTo(x + 60, 0)
    c.lineTo(x + 60, H)
    c.stroke()
    c.strokeStyle = 'rgba(220,220,240,0.8)'
    c.lineWidth = 1.6
    for (const dy of [0, 7]) {
      c.beginPath()
      c.moveTo(x - 60, y - 6 + dy)
      c.quadraticCurveTo(x, y + 8 + dy, x + 60, y - 6 + dy)
      c.stroke()
    }
  } else if (th.kind === 'lantern') {
    const bob = Math.sin(t * 3 + th.ph) * 4
    const gg = c.createRadialGradient(x, y + bob, 2, x, y + bob, 22)
    gg.addColorStop(0, 'rgba(255,200,120,0.6)')
    gg.addColorStop(1, 'rgba(255,200,120,0)')
    c.fillStyle = gg
    c.fillRect(x - 22, y + bob - 22, 44, 44)
    c.fillStyle = '#e8422f'
    c.beginPath()
    c.ellipse(x, y + bob, 8, 10, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#f2c230'
    c.fillRect(x - 5, y + bob - 12, 10, 3)
    c.fillRect(x - 5, y + bob + 9, 10, 3)
  } else {
    // 火金姑：一小團會閃的綠光
    for (let i = 0; i < 4; i++) {
      const fx = x + Math.sin(t * 4 + th.ph + i * 1.7) * 9
      const fy = y + Math.cos(t * 3.1 + th.ph + i) * 7
      const a = 0.5 + Math.sin(t * 9 + i + th.ph) * 0.4
      c.fillStyle = `rgba(220,255,120,${a})`
      c.beginPath()
      c.arc(fx, fy, 2.4, 0, Math.PI * 2)
      c.fill()
    }
  }
}

// ---------------------------------------------------------------------------

export default function Train({ done }: MinigameProps<unknown, TrainResult>) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [left, setLeft] = useState(DURATION)
  const [flash, setFlash] = useState<{ text: string; good: boolean; id: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const tap = useRef(false)
  const g = useRef({
    t: 0,
    dist: 0,
    speed: 170,
    y: 0,
    vy: 0,
    air: false,
    glide: 0,
    glided: false,
    invuln: 0,
    lives: LIVES,
    score: 0,
    things: [] as Thing[],
    sparks: [] as Spark[],
    spawnT: 1.2,
    chugT: 0,
    chugHi: false,
    stars: [] as [number, number, number][],
    over: false,
  })

  const finish = (merit: number) => done({ merit })

  // 星星
  useEffect(() => {
    g.current.stars = Array.from({ length: 50 }, () => [Math.random() * W, Math.random() * H * 0.45, Math.random() * 6])
  }, [])

  // 輸入：空白、E、↑、點畫面 → 跳；ESC 離開
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish(0)
        return
      }
      const k = e.key.toLowerCase()
      if (k === ' ' || k === 'e' || k === 'enter' || k === 'arrowup' || k === 'w') {
        e.preventDefault()
        e.stopPropagation()
        if (e.repeat) return
        if (phase === 'intro') setPhase('play')
        else if (phase === 'done') finish(meritFor(g.current.score))
        else tap.current = true
      }
    }
    window.addEventListener('keydown', down, true)
    return () => window.removeEventListener('keydown', down, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // 主迴圈
  useEffect(() => {
    if (phase !== 'play') return
    const cv = canvas.current
    if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = W * dpr
    cv.height = H * dpr
    const c = cv.getContext('2d')!
    c.scale(dpr, dpr)
    const s = g.current
    let raf = 0
    let last = performance.now()
    let shownLeft = DURATION
    const say = (text: string, good: boolean) => setFlash({ text, good, id: performance.now() })

    const spawn = () => {
      const r = Math.random()
      const x = W + 40
      if (r < 0.3) s.things.push({ kind: Math.random() < 0.55 ? 'branch' : 'sign', x, y: 14, hit: false, ph: 0 })
      else if (r < 0.52) {
        s.things.push({ kind: 'wire', x: x + 40, y: 78, hit: false, ph: 0 })
        // 電線下面常常有火金姑（誘惑你不要跳）
        if (Math.random() < 0.6) s.things.push({ kind: 'firefly', x: x + 40, y: 22, hit: false, ph: Math.random() * 6 })
      } else if (r < 0.8) s.things.push({ kind: 'lantern', x, y: 70 + Math.random() * 30, hit: false, ph: Math.random() * 6 })
      else s.things.push({ kind: 'firefly', x, y: 18 + Math.random() * 20, hit: false, ph: Math.random() * 6 })
    }

    const burst = (x: number, y: number, color: string, n: number) => {
      for (let i = 0; i < n; i++) s.sparks.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.8) * 140, life: 0.5 + Math.random() * 0.4, color })
    }

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!s.over) {
        s.t += dt
        const k = Math.min(1, s.t / DURATION)
        s.speed = 170 + k * 150
        s.dist += s.speed * dt
        // 火車的咚咚聲：越快越密
        s.chugT -= dt
        if (s.chugT <= 0) {
          s.chugT = 18 / s.speed
          s.chugHi = !s.chugHi
          chug(0.07, s.chugHi)
        }
        // 跳、飄
        if (tap.current) {
          tap.current = false
          if (!s.air) {
            s.air = true
            s.vy = JUMP
            s.glided = false
            tone(380, 0.18, 'triangle', 0.08, 1.8)
          } else if (!s.glided) {
            s.glided = true
            s.glide = 0.5
            s.vy = Math.max(s.vy, 40)
            tone(660, 0.3, 'sine', 0.05, 1.3)
          }
        }
        if (s.air) {
          s.glide = Math.max(0, s.glide - dt)
          s.vy -= (s.glide > 0 ? GLIDE_GRAV : GRAV) * dt
          s.y += s.vy * dt
          if (s.y <= 0) {
            s.y = 0
            s.vy = 0
            s.air = false
          }
        }
        s.invuln = Math.max(0, s.invuln - dt)
        // 生成
        s.spawnT -= dt
        if (s.spawnT <= 0) {
          spawn()
          s.spawnT = (0.65 + Math.random() * 0.7) * (220 / s.speed)
        }
        // 移動與碰撞
        const gy = 16 + s.y // 阿嬤身體中心離車頂的高度
        for (const th of s.things) {
          th.x -= s.speed * dt
          if (th.hit) continue
          const dx = Math.abs(th.x - GX)
          if (th.kind === 'lantern' || th.kind === 'firefly') {
            if (dx < 18 && Math.abs(th.y - gy) < 20) {
              th.hit = true
              const pts = th.kind === 'lantern' ? 10 : 2
              s.score += pts
              setScore(s.score)
              tone(PENTA[Math.floor(Math.random() * PENTA.length)], 0.25, 'sine', 0.08)
              burst(th.x, ROOF - th.y, th.kind === 'lantern' ? '#ffcf6a' : '#d8ff7a', th.kind === 'lantern' ? 12 : 5)
              if (th.kind === 'lantern') say('+10', true)
            }
          } else if (dx < 16) {
            // 低的（樹枝、號誌牌）：沒跳夠高就撞到；高的（電線）：跳太高撞到
            const bad = th.kind === 'wire' ? gy > th.y - 18 : gy < th.y + 18
            if (bad && s.invuln <= 0) {
              th.hit = true
              s.lives--
              setLives(s.lives)
              s.invuln = 1.2
              tone(120, 0.3, 'square', 0.1, 0.5)
              burst(GX, ROOF - gy, '#8ff4ff', 14)
              say(th.kind === 'wire' ? '撞到電線了！' : '被樹枝打到！', false)
              if (s.lives <= 0) s.over = true
            } else if (!bad && dx < 4 && !th.hit) {
              th.hit = true
              s.score += 1
              setScore(s.score)
            }
          }
        }
        s.things = s.things.filter((th) => th.x > -80)
        if (s.t >= DURATION) s.over = true
        const l = Math.max(0, Math.ceil(DURATION - s.t))
        if (l !== shownLeft) {
          shownLeft = l
          setLeft(l)
        }
        if (s.over) {
          tone(s.lives > 0 ? 784 : 220, 0.6, 'triangle', 0.09, s.lives > 0 ? 1.5 : 0.6)
          window.setTimeout(() => setPhase('done'), 700)
        }
      }
      // 火花
      for (const p of s.sparks) {
        p.life -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 260 * dt
      }
      s.sparks = s.sparks.filter((p) => p.life > 0)

      // 畫
      drawSky(c, s.t, s.stars)
      drawFar(c, s.dist * 0.08)
      drawCane(c, s.dist * 0.35, H * 0.6, 34, '#1c2e22', '#2e4a2c', 14, s.t)
      for (const th of s.things) if (th.kind === 'wire' || th.kind === 'branch') drawThing(c, th, s.t)
      drawTrain(c, s.t, s.dist)
      for (const th of s.things) if (th.kind !== 'wire' && th.kind !== 'branch' && !th.hit) drawThing(c, th, s.t)
      drawGrandma(c, s.y, s.t, s.air, s.invuln > 0 && Math.floor(s.t * 12) % 2 === 0)
      for (const p of s.sparks) {
        c.globalAlpha = Math.max(0, p.life * 1.6)
        c.fillStyle = p.color
        c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
      }
      c.globalAlpha = 1
      // 最前面的甘蔗（很快地掠過，擋住下半）
      drawCane(c, s.dist * 1.4, H * 0.93, 26, '#0e1a12', '#1a2e1c', 22, s.t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const merit = meritFor(score)
  return (
    <div className="tr-card" onPointerDown={(e) => e.stopPropagation()}>
      <div className="tr-head">
        <span className="tr-title">🚂 五分車</span>
        <span className="tr-stat">
          分數 <b>{score}</b>
        </span>
        <span className="tr-lives" aria-label={`還有 ${lives} 次`}>
          {Array.from({ length: LIVES }, (_, i) => (
            <i key={i} className={i < lives ? 'on' : ''} />
          ))}
        </span>
        <button className="tr-close" onClick={() => finish(phase === 'done' ? merit : 0)} aria-label="離開">
          ✕
        </button>
      </div>
      <div className="tr-time">
        <i style={{ width: `${(left / DURATION) * 100}%` }} />
      </div>
      <div
        className="tr-stage"
        onPointerDown={(e) => {
          e.preventDefault()
          if (phase === 'intro') setPhase('play')
          else if (phase === 'play') tap.current = true
        }}
      >
        <canvas ref={canvas} className="tr-canvas" width={W} height={H} />
        {flash && (
          <div key={flash.id} className={`tr-flash ${flash.good ? 'good' : 'bad'}`}>
            {flash.text}
          </div>
        )}
        {phase === 'intro' && (
          <div className="tr-overlay">
            <h3>坐五分車穿過甘蔗田</h3>
            <p>
              點一下（空白鍵／E）跳起來，在空中再點一下可以<b>飄</b>一下。
              <br />
              低的樹枝、號誌牌要跳過；<b>高高的電線不要跳</b>。
              <br />
              跳起來拿燈籠 +10，火金姑 +2。
            </p>
            <button className="btn primary" onClick={() => setPhase('play')}>
              上車！
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="tr-overlay">
            <h3>{lives > 0 ? '到站了' : '被甩下車了'}</h3>
            <p className="tr-score">
              分數 <b>{score}</b>　功德 <b>+{merit}</b>
            </p>
            <button className="btn primary" onClick={() => finish(merit)}>
              下車
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
