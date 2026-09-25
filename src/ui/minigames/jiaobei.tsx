import { useEffect, useRef, useState } from 'react'
import { FORTUNES, type Fortune } from '../../world/night/items'
import { sfx } from '../../audio/sfx'
import { jiaobeiSfx } from './jiaobei.sound'
import type { JiaobeiParams, JiaobeiResult, MinigameProps } from './types'
import './jiaobei.css'

// 擲筊（DESIGN §25.2）：在土地公前面擲兩個紅色的筊杯。
// 聖筊（一平一凸）50%：土地公答應了 → 今晚的運勢；笑筊（兩平面朝上）25%、陰筊（兩凸面朝上）25%：再問一次。
// 一天三次。E／空白鍵／點畫面擲，ESC 離開。

type Face = 'flat' | 'round'
type Outcome = 'sheng' | 'xiao' | 'yin'

const OUTCOME: Record<Outcome, { name: string; line: string }> = {
  sheng: { name: '聖筊', line: '土地公答應了！' },
  xiao: { name: '笑筊', line: '土地公笑一笑……再問一次看看。' },
  yin: { name: '陰筊', line: '土地公不同意。' },
}

function roll(): { outcome: Outcome; faces: [Face, Face] } {
  const r = Math.random()
  if (r < 0.5) return { outcome: 'sheng', faces: Math.random() < 0.5 ? ['flat', 'round'] : ['round', 'flat'] }
  if (r < 0.75) return { outcome: 'xiao', faces: ['flat', 'flat'] }
  return { outcome: 'yin', faces: ['round', 'round'] }
}

interface Block {
  /** 起點、落點（畫布 CSS px） */
  x0: number
  x1: number
  /** 最後的轉角（2D）與翻面角（0＝平面朝上、π＝凸面朝上） */
  rot1: number
  flip1: number
  spin: number
}

/** 飛多久、彈多久 */
const FLY = 1.05
const BOUNCE = 0.45

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const now = () => performance.now() / 1000
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3)

export default function Jiaobei({ params, done }: MinigameProps<JiaobeiParams, JiaobeiResult>) {
  const total = Math.max(0, params?.throwsLeft ?? 3)
  const [used, setUsed] = useState(0)
  const [phase, setPhase] = useState<'ready' | 'flying' | 'result' | 'blessing'>('ready')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [fortune, setFortune] = useState<Fortune | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const finished = useRef(false)
  const toss = useRef<{ t0: number; blocks: Block[]; landed: number } | null>(null)
  const smoke = useRef<{ x: number; y: number; life: number; vx: number }[]>([])

  const left = total - used

  const finish = (r: JiaobeiResult) => {
    if (finished.current) return
    finished.current = true
    done(r)
  }

  const throwBlocks = () => {
    if (left <= 0 || phase === 'flying' || phase === 'blessing') return
    const W = wrap.current?.clientWidth ?? 400
    const res = roll()
    const blocks: Block[] = res.faces.map((f, i) => {
      const side = i === 0 ? -1 : 1
      const turns = 3 + Math.floor(Math.random() * 3)
      return {
        x0: W / 2 + side * 20,
        x1: W / 2 + side * (60 + Math.random() * 50),
        rot1: (Math.random() - 0.5) * 0.35 + (i === 0 ? 0.12 : -0.12),
        flip1: turns * Math.PI * 2 + (f === 'round' ? Math.PI : 0),
        spin: (Math.random() - 0.5) * 3,
      }
    })
    toss.current = { t0: now(), blocks, landed: 0 }
    setUsed((u) => u + 1)
    setOutcome(res.outcome)
    setPhase('flying')
    sfx.play('whoosh', { volume: 0.5 })
    window.setTimeout(() => {
      setPhase('result')
      if (res.outcome === 'sheng') {
        sfx.play('temple_bell', { volume: 0.8 })
        const keys = Object.keys(FORTUNES) as Fortune[]
        const f = keys[Math.floor(Math.random() * keys.length)]
        setFortune(f)
        window.setTimeout(() => setPhase((p) => (p === 'result' ? 'blessing' : p)), 1300)
      } else sfx.play('ui_cancel', { volume: 0.45 })
    }, (FLY + BOUNCE + 0.15) * 1000)
  }

  const act = () => {
    if (phase === 'blessing') {
      finish({ fortune, throws: used })
      return
    }
    if (phase === 'flying') return
    // 聖筊：直接看賜福（不要不小心又擲一次）
    if (phase === 'result' && outcome === 'sheng') {
      setPhase('blessing')
      return
    }
    if (left <= 0) {
      finish({ fortune: null, throws: used })
      return
    }
    throwBlocks()
  }
  const actRef = useRef(act)
  actRef.current = act

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish({ fortune: phase === 'blessing' || phase === 'result' ? fortune : null, throws: used })
        return
      }
      if ((k === 'e' || k === ' ' || k === 'enter') && !e.repeat) {
        e.preventDefault()
        actRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fortune, used])

  // 畫面迴圈
  useEffect(() => {
    const cv = canvas.current
    const box = wrap.current
    if (!cv || !box) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
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
      drawAltar(ctx, W, H, tn, dt, smoke.current)
      const tt = toss.current
      const floorY = H * 0.84
      if (tt) {
        const t = tn - tt.t0
        tt.blocks.forEach((b, i) => {
          let x: number
          let y: number
          let rot: number
          let flip: number
          if (t < FLY) {
            const k = t / FLY
            x = b.x0 + (b.x1 - b.x0) * k
            // 拋物線：往上拋到畫面上方再掉下來
            const peak = H * 0.62
            y = floorY - peak * 4 * k * (1 - k) - (1 - k) * H * 0.02
            // 空中轉幾圈，落地時剛好停在 rot1（接近平躺）
            rot = b.rot1 + b.spin * 4 * (1 - easeOut(k))
            flip = b.flip1 * easeOut(k) - Math.PI * 0.35 * (1 - easeOut(k))
          } else {
            const k = Math.min(1, (t - FLY) / BOUNCE)
            x = b.x1
            // 落地彈兩下
            const hop = Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) * 22
            y = floorY - hop
            rot = b.rot1 + Math.sin(k * 9) * (1 - k) * 0.15
            flip = b.flip1 + Math.sin(k * Math.PI * 2) * (1 - k) * 0.5
            // 第一次碰地、第二次碰地的聲音
            const hits = k > 0.5 ? 2 : k > 0 ? 1 : 0
            if (i === 1 && hits > tt.landed) {
              tt.landed = hits
              jiaobeiSfx.clack(hits === 1 ? 1 : 0.5)
            }
          }
          if (reduceMotion && t < FLY) {
            // 減少動態：不翻滾，只淡入落點
            x = b.x1
            y = floorY
            rot = b.rot1
            flip = b.flip1
            ctx.globalAlpha = Math.min(1, t / FLY)
          }
          drawBlock(ctx, x, y, rot, flip, Math.min(W, 520) / 520)
          ctx.globalAlpha = 1
        })
      } else {
        // 還沒擲：筊杯放在供桌前
        const s = Math.min(W, 520) / 520
        drawBlock(ctx, W / 2 - 62 * s, floorY, 0.12, Math.PI, s)
        drawBlock(ctx, W / 2 + 62 * s, floorY, -0.12, Math.PI, s)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const name = outcome ? OUTCOME[outcome] : null
  const fz = fortune ? FORTUNES[fortune] : null
  return (
    <div className="jb-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="jb-head">
        <span className="jb-title">擲筊</span>
        <span className="jb-left">
          {Array.from({ length: Math.max(total, 1) }, (_, i) => (
            <i key={i} className={i < left ? 'on' : ''} />
          ))}
          <em>還可以擲 {left} 次</em>
        </span>
        <button className="jb-close" aria-label="離開" onClick={() => finish({ fortune: phase === 'blessing' || phase === 'result' ? fortune : null, throws: used })}>
          ✕
        </button>
      </div>
      <div
        ref={wrap}
        className="jb-stage"
        onPointerDown={(e) => {
          e.preventDefault()
          act()
        }}
      >
        <canvas ref={canvas} />
        {phase === 'ready' && used === 0 && total > 0 && <div className="jb-ask">向土地公請示：今晚順不順？</div>}
        {total === 0 && <div className="jb-ask">今天已經擲過三次了，明天再來。</div>}
        {phase === 'result' && name && (
          <div className={`jb-outcome ${outcome}`} key={used}>
            <b>{name.name}</b>
            <span>{name.line}</span>
          </div>
        )}
        {phase === 'blessing' && fz && (
          <div className="jb-blessing">
            <div className="jb-bless-kicker">土地公賜福</div>
            <div className="jb-bless-name">{fz.name}</div>
            <div className="jb-bless-desc">{fz.desc}</div>
          </div>
        )}
      </div>
      <button
        className="jb-act"
        disabled={phase === 'flying'}
        onPointerDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
          act()
        }}
      >
        {phase === 'blessing' ? '謝謝土地公' : phase === 'result' && outcome === 'sheng' ? '收下福氣' : left <= 0 ? '今天就到這裡' : used === 0 ? '擲筊' : '再擲一次'}
        <span className="jb-key">E</span>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 畫：神龕的紅布、香爐與香煙、蠟燭、地上的筊杯
// ---------------------------------------------------------------------------

function drawAltar(ctx: CanvasRenderingContext2D, W: number, H: number, tn: number, dt: number, smoke: { x: number; y: number; life: number; vx: number }[]) {
  ctx.clearRect(0, 0, W, H)
  // 牆：深紅、燭光
  const wall = ctx.createRadialGradient(W / 2, H * 0.3, 10, W / 2, H * 0.3, Math.max(W, H) * 0.8)
  wall.addColorStop(0, '#5a1c14')
  wall.addColorStop(1, '#1a0806')
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, W, H)
  // 神龕：紅布簾（DESIGN §1.2 不畫神像）
  const nw = Math.min(W * 0.46, 220)
  const nx = W / 2 - nw / 2
  const ny = H * 0.06
  const nh = H * 0.34
  ctx.fillStyle = '#2a0f08'
  ctx.fillRect(nx - 10, ny - 10, nw + 20, nh + 16)
  const cloth = ctx.createLinearGradient(nx, ny, nx, ny + nh)
  cloth.addColorStop(0, '#b3261e')
  cloth.addColorStop(1, '#7a1410')
  ctx.fillStyle = cloth
  ctx.beginPath()
  ctx.moveTo(nx, ny)
  for (let i = 0; i <= 8; i++) {
    const x = nx + (nw / 8) * i
    ctx.lineTo(x, ny + nh + (i % 2 ? 6 : 0))
  }
  ctx.lineTo(nx + nw, ny)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  for (let i = 1; i < 8; i++) {
    ctx.beginPath()
    ctx.moveTo(nx + (nw / 8) * i, ny)
    ctx.lineTo(nx + (nw / 8) * i, ny + nh)
    ctx.stroke()
  }
  // 金色的「福德正神」匾
  ctx.fillStyle = '#d9a441'
  ctx.fillRect(nx + nw * 0.2, ny - 6, nw * 0.6, 22)
  ctx.fillStyle = '#5a1c14'
  ctx.font = `700 ${Math.round(14)}px "Noto Serif TC", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('福德正神', W / 2, ny + 5)

  // 供桌與桌裙
  const ty = H * 0.46
  ctx.fillStyle = '#3a1a0e'
  ctx.fillRect(W * 0.08, ty - 10, W * 0.84, 12)
  const skirt = ctx.createLinearGradient(0, ty, 0, H * 0.7)
  skirt.addColorStop(0, '#c0271f')
  skirt.addColorStop(1, '#8a1812')
  ctx.fillStyle = skirt
  ctx.fillRect(W * 0.1, ty + 2, W * 0.8, H * 0.24)
  ctx.strokeStyle = '#e8b64a'
  ctx.lineWidth = 3
  ctx.strokeRect(W * 0.13, ty + 10, W * 0.74, H * 0.18)
  // 桌裙上的金線雲紋
  ctx.lineWidth = 1.5
  for (let i = 0; i < 5; i++) {
    const cx = W * 0.2 + i * W * 0.15
    const cy = ty + H * 0.1
    ctx.beginPath()
    ctx.arc(cx, cy, 10, Math.PI, 0)
    ctx.arc(cx + 14, cy, 6, Math.PI, 0)
    ctx.stroke()
  }

  // 香爐＋三炷香
  const bx = W / 2
  const by = ty - 10
  ctx.fillStyle = '#8a6a2a'
  ctx.beginPath()
  ctx.ellipse(bx, by - 14, 34, 16, 0, 0, Math.PI)
  ctx.fill()
  ctx.fillStyle = '#b08a3a'
  ctx.beginPath()
  ctx.ellipse(bx, by - 16, 34, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  for (let i = -1; i <= 1; i++) {
    const x = bx + i * 9
    ctx.strokeStyle = '#6a2a14'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, by - 16)
    ctx.lineTo(x + i * 3, by - 70)
    ctx.stroke()
    ctx.fillStyle = `rgba(255,${120 + Math.sin(tn * 8 + i) * 40},40,1)`
    ctx.beginPath()
    ctx.arc(x + i * 3, by - 71, 2.2, 0, Math.PI * 2)
    ctx.fill()
    if (Math.random() < dt * 2.2) smoke.push({ x: x + i * 3, y: by - 72, life: 0, vx: (Math.random() - 0.5) * 6 })
  }
  // 香煙：往上飄、捲一捲
  for (let i = smoke.length - 1; i >= 0; i--) {
    const p = smoke[i]
    p.life += dt
    if (p.life > 3.2 || smoke.length > 90) {
      smoke.splice(i, 1)
      continue
    }
    p.y -= 22 * dt
    p.x += (p.vx + Math.sin(p.life * 2.2 + p.y * 0.05) * 10) * dt
    ctx.fillStyle = `rgba(230,225,215,${0.09 * (1 - p.life / 3.2)})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4 + p.life * 5, 0, Math.PI * 2)
    ctx.fill()
  }
  // 兩邊的紅蠟燭
  for (const s of [-1, 1]) {
    const cx = W / 2 + s * Math.min(W * 0.33, 170)
    ctx.fillStyle = '#c0271f'
    ctx.fillRect(cx - 6, ty - 58, 12, 48)
    const fl = 1 + Math.sin(tn * 13 + s) * 0.12
    const glow = ctx.createRadialGradient(cx, ty - 66, 1, cx, ty - 66, 40 * fl)
    glow.addColorStop(0, 'rgba(255,220,140,0.6)')
    glow.addColorStop(1, 'rgba(255,160,60,0)')
    ctx.fillStyle = glow
    ctx.fillRect(cx - 44, ty - 110, 88, 90)
    ctx.fillStyle = '#ffd58a'
    ctx.beginPath()
    ctx.ellipse(cx, ty - 66, 3.5, 7 * fl, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 地板（紅磚），筊杯落在這裡
  const fy = H * 0.7
  const floor = ctx.createLinearGradient(0, fy, 0, H)
  floor.addColorStop(0, '#6a2c1c')
  floor.addColorStop(1, '#3a160e')
  ctx.fillStyle = floor
  ctx.fillRect(0, fy, W, H - fy)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1
  for (let y = fy + 14; y < H; y += 16) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
}

/**
 * 一個筊杯：月牙形。flip 決定看到哪一面（cos ≥ 0：平面朝上，淺紅、有木紋；< 0：凸面朝上，深紅亮漆）。
 * 用 scaleY = |cos(flip)| 假裝在空中翻。
 */
function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, flip: number, s: number) {
  const c = Math.cos(flip)
  const flat = c >= 0
  const sy = Math.max(0.12, Math.abs(c))
  const w = 50 * s
  const h = 26 * s
  // 影子
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(x, y + 4, w * 0.9, 5 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.translate(x, y - h * 0.5)
  ctx.rotate(rot)
  ctx.scale(1, sy)
  // 月牙：外弧＋內弧
  ctx.beginPath()
  ctx.moveTo(-w, 0)
  ctx.quadraticCurveTo(0, -h * 2.2, w, 0)
  ctx.quadraticCurveTo(0, -h * 0.25, -w, 0)
  ctx.closePath()
  if (flat) {
    const g = ctx.createLinearGradient(0, -h * 1.6, 0, 0)
    g.addColorStop(0, '#e46a4a')
    g.addColorStop(1, '#c2432c')
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = 'rgba(120,30,10,0.5)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(-w * 0.8 + i * 4, -h * 0.2)
      ctx.quadraticCurveTo(0, -h * (0.7 + i * 0.25), w * 0.8 - i * 4, -h * 0.2)
      ctx.stroke()
    }
  } else {
    const g = ctx.createLinearGradient(0, -h * 1.6, 0, 0)
    g.addColorStop(0, '#c0241c')
    g.addColorStop(1, '#6a0c08')
    ctx.fillStyle = g
    ctx.fill()
    // 亮漆的反光
    ctx.strokeStyle = 'rgba(255,220,200,0.55)'
    ctx.lineWidth = 2 * s
    ctx.beginPath()
    ctx.moveTo(-w * 0.5, -h * 0.75)
    ctx.quadraticCurveTo(0, -h * 1.35, w * 0.45, -h * 0.75)
    ctx.stroke()
  }
  ctx.strokeStyle = '#3a0806'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-w, 0)
  ctx.quadraticCurveTo(0, -h * 2.2, w, 0)
  ctx.quadraticCurveTo(0, -h * 0.25, -w, 0)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}
