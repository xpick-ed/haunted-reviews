import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio'
import type { FishingResult, MinigameProps } from './types'
import './fishing.css'

// 釣溪哥（溪邊）：月光下的溪面，竹釣竿。一共甩三次竿：
//   甩竿 → 等浮標：小小點一下是魚在試吃（這時拉會把魚嚇跑），整個沉下去才是咬到 → 馬上拉！
//   拉魚：按住收線（拉力上升），放開放線（拉力下降）。拉力留在綠色區才會把魚拉近；
//   魚會突然衝一下，拉力太滿線會斷，太鬆魚會跑掉。
// 釣到幾尾就是幾份「溪哥」食材（0–3）。

const CASTS = 3
const SAFETY = 45 // 秒：無論如何最後都會結束
const GREEN = [0.36, 0.74] as const

type Phase = 'intro' | 'play' | 'done'
type Step = 'ready' | 'flying' | 'wait' | 'bite' | 'reel' | 'result'

interface Ripple {
  x: number
  y: number
  t: number
  big: boolean
}
interface Drop {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}
interface Firefly {
  x: number
  y: number
  ph: number
  sp: number
}

// ---------------------------------------------------------------------------
// 小音效（Web Audio 現場合成）
// ---------------------------------------------------------------------------

let noiseBuf: AudioBuffer | null = null
function noise(ctx: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

function plop(vol = 0.3, freq = 700, len = 0.25) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(freq, t)
  bp.frequency.exponentialRampToValueAtTime(freq * 0.35, t + len)
  bp.Q.value = 1.2
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + len)
  src.connect(bp).connect(g).connect(audio.bus.sfx)
  src.start(t)
  src.stop(t + len + 0.05)
}

/** 咕嘟：一個往下滑的低音 */
function bloop(vol = 0.25) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(420, t)
  o.frequency.exponentialRampToValueAtTime(120, t + 0.18)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + 0.25)
}

/** 捲線器喀喀聲 */
function tick(vol = 0.08) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'square'
  o.frequency.setValueAtTime(1900 + Math.random() * 300, t)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + 0.04)
}

function chime(good: boolean) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const notes = good ? [660, 880, 1175] : [440, 330]
  notes.forEach((f, i) => {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const g = ctx.createGain()
    const t0 = t + i * 0.09
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35)
    o.connect(g).connect(audio.bus.sfx)
    o.start(t0)
    o.stop(t0 + 0.4)
  })
}

// ---------------------------------------------------------------------------

export default function Fishing({ done }: MinigameProps<unknown, FishingResult>) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [caught, setCaught] = useState(0)
  const [cast, setCast] = useState(0)
  const [msg, setMsg] = useState<{ text: string; kind: 'good' | 'bad' | 'hint'; id: number } | null>(null)
  const [tension, setTension] = useState(0)
  const [progress, setProgress] = useState(0)
  const [reeling, setReeling] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const held = useRef(false)
  const pressed = useRef(false)
  const g = useRef({
    step: 'ready' as Step,
    stepT: 0,
    waitFor: 3,
    nibbles: [] as number[],
    nibbleT: -1,
    biteT: 0,
    float: { x: 0.55, y: 0.45, sx: 0.2, sy: 1.0, dip: 0 },
    tension: 0,
    progress: 0,
    slackT: 0,
    surge: 0,
    surgeT: 2,
    fishX: 0,
    ripples: [] as Ripple[],
    drops: [] as Drop[],
    flies: [] as Firefly[],
    jump: null as null | { t: number; x: number; y: number },
    caught: 0,
    cast: 0,
    t: 0,
    tickT: 0,
    over: false,
  })

  const finish = (fish: number) => done({ fish })
  const say = (text: string, kind: 'good' | 'bad' | 'hint') => setMsg({ text, kind, id: performance.now() })

  // 螢火蟲
  useEffect(() => {
    g.current.flies = Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random() * 0.4, ph: Math.random() * 6, sp: 0.2 + Math.random() * 0.4 }))
  }, [])

  // 輸入：按下／放開（E、空白、滑鼠、手指）
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish(0)
        return
      }
      const k = e.key.toLowerCase()
      if (k === 'e' || k === ' ' || k === 'enter') {
        e.preventDefault()
        e.stopPropagation()
        if (e.repeat) return
        if (phase === 'intro') setPhase('play')
        else if (phase === 'done') finish(g.current.caught)
        else press()
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'e' || k === ' ' || k === 'enter') held.current = false
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const press = () => {
    held.current = true
    pressed.current = true
  }

  // 主迴圈
  useEffect(() => {
    if (phase !== 'play') return
    let raf = 0
    let last = performance.now()
    const s = g.current
    const startCast = () => {
      s.step = 'ready'
      s.stepT = 0
      s.tension = 0
      s.progress = 0
      s.slackT = 0
      setTension(0)
      setProgress(0)
      setReeling(false)
    }
    startCast()
    say('點一下（或按 E）甩竿', 'hint')
    const endCast = (ok: boolean, text: string) => {
      s.step = 'result'
      s.stepT = 0
      setReeling(false)
      if (ok) {
        s.caught++
        setCaught(s.caught)
        s.jump = { t: 0, x: s.float.x, y: s.float.y }
        plop(0.4, 1400, 0.3)
        chime(true)
      } else chime(false)
      say(text, ok ? 'good' : 'bad')
    }
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      s.t += dt
      s.stepT += dt
      const f = s.float
      const tap = pressed.current
      pressed.current = false

      switch (s.step) {
        case 'ready':
          if (tap) {
            s.step = 'flying'
            s.stepT = 0
            f.sx = 0.12
            f.sy = 0.95
            f.x = 0.42 + Math.random() * 0.34
            f.y = 0.36 + Math.random() * 0.2
            s.waitFor = 1.8 + Math.random() * 3.4
            // 在真的咬之前，會有 0–2 次試吃
            s.nibbles = Array.from({ length: Math.floor(Math.random() * 3) }, () => 0.5 + Math.random() * (s.waitFor - 0.9)).sort((a, b) => a - b)
            s.nibbleT = -1
            setMsg(null)
          }
          break
        case 'flying':
          if (s.stepT > 0.55) {
            s.step = 'wait'
            s.stepT = 0
            plop(0.25, 900, 0.22)
            s.ripples.push({ x: f.x, y: f.y, t: 0, big: false })
          }
          break
        case 'wait': {
          if (s.nibbles.length && s.stepT > s.nibbles[0]) {
            s.nibbles.shift()
            s.nibbleT = 0
            bloop(0.08)
            s.ripples.push({ x: f.x, y: f.y, t: 0, big: false })
          }
          if (s.nibbleT >= 0) s.nibbleT += dt
          if (tap) {
            // 太早拉：魚嚇跑了
            endCast(false, s.nibbleT >= 0 && s.nibbleT < 0.4 ? '太早了！那只是在試吃' : '還沒咬餌啦')
            break
          }
          if (s.stepT > s.waitFor) {
            s.step = 'bite'
            s.stepT = 0
            s.biteT = 0.7
            bloop(0.3)
            plop(0.2, 500, 0.3)
            s.ripples.push({ x: f.x, y: f.y, t: 0, big: true })
            say('咬到了！', 'hint')
          }
          break
        }
        case 'bite':
          if (tap) {
            s.step = 'reel'
            s.stepT = 0
            s.tension = 0.45
            s.progress = 0.08
            s.surgeT = 0.8 + Math.random() * 1.2
            s.fishX = f.x
            setReeling(true)
            say('按住收線！拉力留在綠色區', 'hint')
          } else if (s.stepT > s.biteT) endCast(false, '魚跑掉了……')
          break
        case 'reel': {
          // 魚偶爾用力一衝
          s.surgeT -= dt
          if (s.surgeT <= 0) {
            s.surge = 0.35
            s.surgeT = 1.1 + Math.random() * 1.6
            plop(0.12, 1100, 0.15)
          }
          const surge = s.surge > 0 ? 0.85 : 0
          s.surge = Math.max(0, s.surge - dt)
          const pull = held.current ? 0.75 : -0.7
          s.tension = Math.max(0, Math.min(1.05, s.tension + (pull + surge) * dt))
          const inGreen = s.tension >= GREEN[0] && s.tension <= GREEN[1]
          s.progress = Math.max(0, Math.min(1, s.progress + (inGreen ? 0.3 : s.tension > GREEN[1] ? 0.1 : -0.05) * dt))
          if (held.current) {
            s.tickT -= dt
            if (s.tickT <= 0) {
              s.tickT = 0.09
              tick()
            }
          }
          s.slackT = s.tension < 0.08 ? s.slackT + dt : 0
          // 魚在水面下左右跑，浮標被拖著走
          s.fishX = 0.5 + Math.sin(s.t * 1.7) * 0.18 + Math.sin(s.t * 3.1) * 0.05
          f.x += (s.fishX - f.x) * Math.min(1, dt * 2)
          f.y += (0.3 + s.progress * 0.38 - f.y) * Math.min(1, dt * 1.5)
          if (Math.random() < dt * 6) s.drops.push({ x: f.x, y: f.y, vx: (Math.random() - 0.5) * 0.2, vy: -0.25 - Math.random() * 0.2, life: 0.6 })
          setTension(s.tension)
          setProgress(s.progress)
          if (s.tension >= 1) endCast(false, '線斷了！拉太用力了')
          else if (s.slackT > 1.3) endCast(false, '線太鬆，魚跑掉了')
          else if (s.progress >= 1) endCast(true, '釣到一尾溪哥！')
          break
        }
        case 'result':
          if (s.stepT > 1.5) {
            s.cast++
            setCast(s.cast)
            if (s.cast >= CASTS) {
              s.over = true
              setPhase('done')
              return
            }
            startCast()
            say(`第 ${s.cast + 1} 竿：點一下甩竿`, 'hint')
          }
          break
      }
      if (s.t > SAFETY && !s.over) {
        s.over = true
        setPhase('done')
        return
      }
      // 波紋、水滴
      s.ripples = s.ripples.filter((r) => (r.t += dt) < (r.big ? 1.6 : 1.1))
      s.drops = s.drops.filter((d) => {
        d.vy += 0.9 * dt
        d.x += d.vx * dt
        d.y += d.vy * dt
        return (d.life -= dt) > 0
      })
      if (s.jump) {
        s.jump.t += dt
        if (s.jump.t > 1.2) s.jump = null
      }
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
    const H = Math.min(W * 1.15, window.innerHeight * 0.56)
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
    // 水面（上面遠、下面近）
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#0b1a22')
    bg.addColorStop(0.55, '#10262f')
    bg.addColorStop(1, '#0a161c')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    // 對岸的竹林剪影
    ctx.fillStyle = '#060d0f'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H * 0.12 + Math.sin(x * 0.07) * 6 + Math.sin(x * 0.19) * 4)
    ctx.lineTo(W, 0)
    ctx.fill()
    ctx.strokeStyle = '#08130f'
    ctx.lineWidth = 3
    for (let i = 0; i < 14; i++) {
      const x = (i / 14) * W + Math.sin(i * 3.1) * 10
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.quadraticCurveTo(x + 8 + Math.sin(t * 0.6 + i) * 3, H * 0.08, x + 4, H * 0.16)
      ctx.stroke()
    }
    // 月光倒影（中間一條亮帶，隨水紋閃）
    for (let y = H * 0.18; y < H; y += 7) {
      const k = 1 - (y - H * 0.18) / (H * 0.9)
      const len = W * (0.08 + 0.12 * k) * (0.6 + 0.4 * Math.sin(y * 0.3 + t * 2.2))
      ctx.fillStyle = `rgba(210,225,255,${0.05 + 0.12 * k})`
      ctx.fillRect(W * 0.68 - len / 2 + Math.sin(y * 0.05 + t) * 6, y, len, 2)
    }
    // 流動的水紋
    ctx.strokeStyle = 'rgba(160,200,220,0.08)'
    ctx.lineWidth = 1
    for (let i = 0; i < 18; i++) {
      const y = H * (0.18 + (i / 18) * 0.82)
      const off = (t * 22 + i * 37) % (W + 80)
      ctx.beginPath()
      ctx.moveTo(off - 80, y)
      ctx.quadraticCurveTo(off - 40, y - 3, off, y)
      ctx.stroke()
    }
    // 螢火蟲
    for (const f of s.flies) {
      const x = ((f.x + Math.sin(t * f.sp + f.ph) * 0.03) * W) % W
      const y = (0.05 + f.y + Math.cos(t * f.sp * 1.3 + f.ph) * 0.02) * H
      const a = Math.max(0, Math.sin(t * (1 + f.sp) + f.ph))
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 7)
      gr.addColorStop(0, `rgba(230,255,150,${0.9 * a})`)
      gr.addColorStop(1, 'rgba(200,255,120,0)')
      ctx.fillStyle = gr
      ctx.fillRect(x - 7, y - 7, 14, 14)
    }
    // 波紋
    for (const r of s.ripples) {
      const k = r.t / (r.big ? 1.6 : 1.1)
      ctx.strokeStyle = `rgba(210,235,255,${(1 - k) * 0.55})`
      ctx.lineWidth = r.big ? 2 : 1.3
      ctx.beginPath()
      ctx.ellipse(r.x * W, r.y * H, (0.02 + k * (r.big ? 0.16 : 0.09)) * W, (0.008 + k * (r.big ? 0.05 : 0.03)) * W, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    // 釣竿：從右下角伸出去，拉力越大越彎
    const f = s.float
    const baseX = W * 0.98
    const baseY = H * 1.02
    const bend = s.step === 'reel' ? s.tension : 0.05
    const tipX = W * (0.6 - bend * 0.05)
    const tipY = H * (0.22 + bend * 0.14)
    ctx.strokeStyle = '#b8955a'
    ctx.lineCap = 'round'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(baseX, baseY)
    ctx.quadraticCurveTo(W * 0.78, H * (0.45 + bend * 0.15), tipX, tipY)
    ctx.stroke()
    ctx.strokeStyle = '#d8b878'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(baseX - 2, baseY)
    ctx.quadraticCurveTo(W * 0.78 - 2, H * (0.45 + bend * 0.15), tipX, tipY)
    ctx.stroke()
    // 竹節
    ctx.fillStyle = '#8a6a38'
    for (let i = 1; i < 5; i++) {
      const k = i / 5
      const x = (1 - k) * (1 - k) * baseX + 2 * (1 - k) * k * W * 0.78 + k * k * tipX
      const y = (1 - k) * (1 - k) * baseY + 2 * (1 - k) * k * H * (0.45 + bend * 0.15) + k * k * tipY
      ctx.fillRect(x - 3, y - 1.5, 6, 3)
    }
    // 浮標位置（甩竿時飛出去）
    let fx = f.x * W
    let fy = f.y * H
    if (s.step === 'ready') {
      fx = tipX - 4
      fy = tipY + 26
    } else if (s.step === 'flying') {
      const k = Math.min(1, s.stepT / 0.55)
      fx = tipX + (f.x * W - tipX) * k
      fy = tipY + 26 + (f.y * H - tipY - 26) * k - Math.sin(k * Math.PI) * H * 0.18
    }
    // 浮標的上下：平常輕輕晃，試吃點一下，咬到整個沉下去
    let sink = Math.sin(t * 2.4) * 1.5
    if (s.step === 'wait' && s.nibbleT >= 0 && s.nibbleT < 0.35) sink += Math.sin((s.nibbleT / 0.35) * Math.PI) * 6
    if (s.step === 'bite') sink += 14
    if (s.step === 'reel') sink += 8 + Math.sin(t * 20) * 2 * s.tension
    // 釣線
    ctx.strokeStyle = `rgba(235,235,225,${s.step === 'reel' ? 0.9 : 0.6})`
    ctx.lineWidth = s.step === 'reel' ? 1.4 : 1
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    if (s.step === 'reel') ctx.lineTo(fx, fy + sink * 0.3)
    else ctx.quadraticCurveTo((tipX + fx) / 2, Math.max(tipY, fy) + 18, fx, fy + sink * 0.3 - 6)
    ctx.stroke()
    // 浮標：紅白兩色
    if (s.step !== 'result' || !s.jump) {
      const under = s.step === 'bite' || s.step === 'reel'
      ctx.save()
      ctx.translate(fx, fy + sink * 0.4)
      if (!under || s.step === 'reel') {
        ctx.fillStyle = '#f4efe6'
        ctx.beginPath()
        ctx.ellipse(0, 0, 4, 7, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#e8402a'
        ctx.beginPath()
        ctx.ellipse(0, -5, 3.5, 5, 0, Math.PI, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      // 水面上浮標周圍一圈亮光（夜裡看得到）
      const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, 16)
      glow.addColorStop(0, 'rgba(255,240,200,0.18)')
      glow.addColorStop(1, 'rgba(255,240,200,0)')
      ctx.fillStyle = glow
      ctx.fillRect(fx - 16, fy - 16, 32, 32)
    }
    // 咬到：浮標上面跳一個「！」
    if (s.step === 'bite') {
      ctx.fillStyle = '#ffe08a'
      ctx.font = '900 26px "Noto Sans TC", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('！', fx, fy - 22 - Math.sin(s.stepT * 20) * 3)
    }
    // 水花
    ctx.fillStyle = 'rgba(220,240,255,0.8)'
    for (const d of s.drops) {
      ctx.beginPath()
      ctx.arc(d.x * W, d.y * H, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    // 釣上來的溪哥：跳出水面、在空中翻一下
    if (s.jump) {
      const k = s.jump.t / 1.2
      const x = s.jump.x * W + (W * 0.85 - s.jump.x * W) * k
      const y = s.jump.y * H - Math.sin(k * Math.PI) * H * 0.35 + (H * 0.12 - s.jump.y * H) * k * k
      drawFish(ctx, x, y, k * Math.PI * 3, 26)
    }
  }

  // 還沒開始：先畫一張靜止的溪面當背景
  useEffect(() => {
    if (phase !== 'intro') return
    const id = requestAnimationFrame(() => draw())
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const retry = () => {
    if (phase === 'play') press()
  }

  return (
    <div className="fs-card" onPointerDown={(e) => e.stopPropagation()}>
      <div className="fs-head">
        <span className="fs-title">🎣 釣溪哥</span>
        <span className="fs-stat">
          第 <b>{Math.min(cast + 1, CASTS)}</b>/{CASTS} 竿
        </span>
        <span className="fs-stat">
          🐟 <b>{caught}</b>
        </span>
      </div>
      <div
        className="fs-stage"
        ref={wrap}
        onPointerDown={(e) => {
          if (phase !== 'play') return
          e.preventDefault()
          try {
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          } catch {
            // 抓不到指標（例如合成的事件）也沒關係
          }
          retry()
        }}
        onPointerUp={() => (held.current = false)}
        onPointerCancel={() => (held.current = false)}
      >
        <canvas ref={canvas} className="fs-canvas" />
        {msg && phase === 'play' && (
          <div key={msg.id} className={`fs-msg ${msg.kind}`}>
            {msg.text}
          </div>
        )}
        {phase === 'intro' && (
          <div className="fs-overlay">
            <p>
              <b>點一下</b>甩竿，盯著浮標。
              <br />
              浮標<b>輕輕點一下</b>是魚在試吃，<b>整個沉下去</b>才拉！
              <br />
              拉魚時<b>按住收線、放開放線</b>，讓拉力停在綠色區。
            </p>
            <p className="muted">電腦：E／空白鍵</p>
            <button className="btn primary big" onClick={() => setPhase('play')}>
              開始釣
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="fs-overlay">
            <div className="fs-result">
              釣到 <b>{caught}</b> 尾溪哥
            </div>
            <div className="fs-sub">{caught > 0 ? `🐟 溪哥 +${caught}（可以煮溪哥湯）` : '今天溪哥不吃餌……'}</div>
            <button className="btn primary big" onClick={() => finish(caught)}>
              收下
            </button>
          </div>
        )}
      </div>
      <div className={`fs-meters ${reeling ? 'on' : ''}`}>
        <div className="fs-meter-row">
          <span>拉力</span>
          <div className="fs-tension">
            <i className="zone" style={{ left: `${GREEN[0] * 100}%`, width: `${(GREEN[1] - GREEN[0]) * 100}%` }} />
            <i className={`needle ${tension > GREEN[1] ? 'hot' : ''}`} style={{ left: `${Math.min(100, tension * 100)}%` }} />
          </div>
        </div>
        <div className="fs-meter-row">
          <span>拉近</span>
          <div className="meter warm">
            <i style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>
      <button className="fs-leave" onClick={() => finish(phase === 'done' ? caught : 0)}>
        離開
      </button>
    </div>
  )
}

/** 溪哥：銀色身體，雄魚有粉紅與藍綠的橫紋 */
function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, len: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a)
  ctx.fillStyle = '#9fb3bd'
  ctx.beginPath()
  ctx.moveTo(-len * 0.55, 0)
  ctx.lineTo(-len * 0.9, -len * 0.28)
  ctx.lineTo(-len * 0.9, len * 0.28)
  ctx.closePath()
  ctx.fill()
  const body = ctx.createLinearGradient(0, -len * 0.25, 0, len * 0.25)
  body.addColorStop(0, '#7e9aa8')
  body.addColorStop(0.5, '#e8eef0')
  body.addColorStop(1, '#c9d4d8')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(0, 0, len * 0.6, len * 0.24, 0, 0, Math.PI * 2)
  ctx.fill()
  // 橫紋
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(90,180,190,0.7)' : 'rgba(240,120,150,0.7)'
    ctx.fillRect(-len * 0.35 + i * len * 0.14, -len * 0.18, len * 0.06, len * 0.36)
  }
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(len * 0.4, -len * 0.05, len * 0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
