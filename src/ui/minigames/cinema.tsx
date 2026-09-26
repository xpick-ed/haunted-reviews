import { useEffect, useMemo, useRef, useState } from 'react'
import { MEMORIES, type Memory } from '../../world/memories'
import type { CinemaParams, CinemaResult, MinigameProps } from './types'
import { osSfx } from './oldstreet.sound'
import './cinema.css'

// 老戲院放映機（老街・放映師）：把收集到的回憶當成膠捲放出來。
// 選一卷 → 放映機暖機（倒數片頭）→ 老照片色調的默片：片名卡、一句一句的字幕卡、畫面、劇終。

type Phase = 'pick' | 'warm' | 'film' | 'end'

const FONT = `"LXGW WenKai TC", "Noto Serif TC", "PingFang TC", serif`
const WARM = 3.6
const TITLE = 3.2
const SHOT = 1.3
const CARD = 3.4
const FIN = 2.6

/** 民國年 */
const roc = (y: number) => (y > 1911 ? `民國${y - 1911}年` : `${y}年`)

/** 字幕卡：一句一句（太長的句子再切一次） */
function splitText(text: string) {
  const parts = text.split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  for (const p of parts) {
    if (p.length <= 30) out.push(p)
    else {
      const i = p.indexOf('，', Math.floor(p.length / 2) - 6)
      if (i > 0) out.push(p.slice(0, i + 1), p.slice(i + 1))
      else out.push(p)
    }
  }
  return out.slice(0, 5)
}

// 一段溫柔的音樂盒旋律（五聲音階）
const MELODY = [523, 587, 659, 784, 659, 587, 523, 440, 523, 587, 659, 587, 523, 440, 392, 440]

export default function Cinema({ params, done }: MinigameProps<CinemaParams, CinemaResult>) {
  const reels = useMemo(() => MEMORIES.filter((m) => params?.reels?.includes(m.id)).sort((a, b) => a.year - b.year), [params])
  const [phase, setPhase] = useState<Phase>('pick')
  const [reel, setReel] = useState<Memory | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const t0 = useRef(0)
  const cards = useMemo(() => (reel ? splitText(reel.text) : []), [reel])
  const total = TITLE + cards.length * (SHOT + CARD) + FIN

  const finish = (watched: string | null) => {
    osSfx.clatterStop()
    done({ watched })
  }

  const start = (m: Memory) => {
    setReel(m)
    setPhase('warm')
    osSfx.projectorOn()
    osSfx.clatterStart(0.08)
    t0.current = performance.now()
    // 片子用的字型先載好（中文字型是分片下載的）
    if (document.fonts) void document.fonts.load(`700 40px ${FONT}`, m.title + m.text + '劇終民國年')
  }

  // 放映：畫布每幀重畫
  useEffect(() => {
    if (phase !== 'warm' && phase !== 'film') return
    let raf = 0
    let noteT = 0
    let noteI = 0
    const loop = (now: number) => {
      const t = (now - t0.current) / 1000
      if (phase === 'warm' && t >= WARM) {
        t0.current = now
        setPhase('film')
        return
      }
      if (phase === 'film') {
        // 音樂盒：一拍一個音
        if (t >= noteT) {
          osSfx.note(MELODY[noteI % MELODY.length])
          noteI++
          noteT += 0.75
        }
        if (t >= total) {
          osSfx.clatterStop()
          setPhase('end')
          return
        }
      }
      draw(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reel])

  useEffect(() => () => osSfx.clatterStop(), [])

  // 畫布大小
  useEffect(() => {
    const c = canvas.current
    const w = wrap.current
    if (!c || !w) return
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = w.clientWidth
      const ch = Math.round(cw * 0.66)
      c.style.width = `${cw}px`
      c.style.height = `${ch}px`
      c.width = Math.round(cw * dpr)
      c.height = Math.round(ch * dpr)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(w)
    return () => ro.disconnect()
  }, [phase])

  // 鍵盤：Esc 離開、Enter 在選片時放第一卷
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish(phase === 'pick' ? null : (reel?.id ?? null))
        return
      }
      if ((k === 'enter' || k === ' ' || k === 'e') && phase === 'end') {
        e.preventDefault()
        finish(reel?.id ?? null)
        return
      }
      if ((k === 'enter' || k === ' ' || k === 'e') && phase === 'pick' && reels.length) {
        e.preventDefault()
        start(reels[reels.length - 1])
      }
    }
    window.addEventListener('keydown', down, true)
    return () => window.removeEventListener('keydown', down, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reel, reels])

  // -------------------------------------------------------------------------
  // 畫：片頭倒數、片名、畫面、字幕卡、劇終；再疊上老底片的顆粒、刮痕、閃爍、暗角
  // -------------------------------------------------------------------------

  const draw = (t: number) => {
    const c = canvas.current
    if (!c || !reel) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    ctx.save()
    // 片門晃動
    ctx.translate((Math.random() - 0.5) * W * 0.004, (Math.random() - 0.5) * H * 0.006)
    if (phase === 'warm') drawLeader(ctx, W, H, t)
    else {
      if (t < TITLE) drawTitle(ctx, W, H, reel, t)
      else if (t >= total - FIN) drawFin(ctx, W, H, t - (total - FIN))
      else {
        const u = t - TITLE
        const i = Math.floor(u / (SHOT + CARD))
        const within = u - i * (SHOT + CARD)
        if (within < SHOT) drawShot(ctx, W, H, reel, t, i)
        else drawCard(ctx, W, H, cards[i] ?? '', within - SHOT)
      }
    }
    ctx.restore()
    filmLook(ctx, W, H, t)
  }

  const cardClass = phase === 'pick' ? 'cn-card pick' : 'cn-card'
  return (
    <div className={cardClass} onPointerDown={(e) => e.stopPropagation()}>
      <div className="cn-head">
        <span className="cn-title">🎞 光華戲院・放映室</span>
        <button className="cn-close" onClick={() => finish(phase === 'pick' ? null : (reel?.id ?? null))} aria-label="離開">
          ✕
        </button>
      </div>
      {phase === 'pick' && (
        <div className="cn-pick">
          {reels.length === 0 ? (
            <p className="cn-empty">沒有膠捲可以放。開陰陽眼，老東西上面有阿嬤的回憶。</p>
          ) : (
            <>
              <p className="cn-hint">放映師把回憶做成了膠捲。要看哪一卷？</p>
              <div className="cn-reels">
                {reels.map((m) => (
                  <button key={m.id} className="cn-reel" onClick={() => start(m)}>
                    <span className="cn-can">
                      <span className="cn-icon">{m.icon}</span>
                    </span>
                    <span className="cn-year">{m.year}</span>
                    <span className="cn-name">{m.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {phase !== 'pick' && (
        <div className="cn-theater">
          <div className="cn-beam" />
          <div className="cn-screen" ref={wrap}>
            <canvas ref={canvas} className="cn-canvas" />
          </div>
          <div className="cn-seats" />
          {phase === 'end' && (
            <div className="cn-end">
              <p>燈亮了。放映師在後面輕輕拍手。</p>
              <button className="btn primary" onClick={() => finish(reel?.id ?? null)}>
                散場
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 各種畫面
// ---------------------------------------------------------------------------

const SEPIA_BG = ['#d8c3a0', '#a88a62', '#4a3826']

function paper(ctx: CanvasRenderingContext2D, W: number, H: number, dark = false) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.75)
  g.addColorStop(0, dark ? '#3a2c1e' : SEPIA_BG[0])
  g.addColorStop(0.7, dark ? '#221810' : SEPIA_BG[1])
  g.addColorStop(1, dark ? '#120c08' : SEPIA_BG[2])
  ctx.fillStyle = g
  ctx.fillRect(-10, -10, W + 20, H + 20)
}

/** 片頭倒數（Academy leader）：圓圈、掃過的扇形、數字 3 2 1 */
function drawLeader(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  paper(ctx, W, H, true)
  const n = Math.max(1, 3 - Math.floor((t / WARM) * 3))
  const frac = ((t / WARM) * 3) % 1
  const cx = W / 2
  const cy = H / 2
  const r = H * 0.36
  ctx.fillStyle = 'rgba(200,180,150,0.25)'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, r * 1.4, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#d8c3a0'
  ctx.lineWidth = Math.max(2, W * 0.004)
  for (const k of [1, 0.82]) {
    ctx.beginPath()
    ctx.arc(cx, cy, r * k, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(0, cy)
  ctx.lineTo(W, cy)
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, H)
  ctx.stroke()
  ctx.fillStyle = '#f0e0c0'
  ctx.font = `700 ${Math.round(H * 0.42)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), cx, cy + H * 0.02)
}

function drawTitle(ctx: CanvasRenderingContext2D, W: number, H: number, m: Memory, t: number) {
  paper(ctx, W, H, true)
  frame(ctx, W, H)
  const a = Math.min(1, t / 0.8)
  ctx.globalAlpha = a
  ctx.fillStyle = '#f0e2c4'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(H * 0.1)}px ${FONT}`
  ctx.fillText(`〈${m.title}〉`, W / 2, H * 0.46)
  ctx.font = `500 ${Math.round(H * 0.055)}px ${FONT}`
  ctx.fillStyle = '#c9b48c'
  ctx.fillText(`${roc(m.year)}　阿春的回憶`, W / 2, H * 0.62)
  ctx.globalAlpha = 1
}

/** 字幕卡：深色底、花邊框、一個字一個字打出來 */
function drawCard(ctx: CanvasRenderingContext2D, W: number, H: number, text: string, t: number) {
  paper(ctx, W, H, true)
  frame(ctx, W, H)
  const shown = text.slice(0, Math.floor(t * 14))
  const size = Math.round(H * 0.075)
  ctx.font = `600 ${size}px ${FONT}`
  ctx.fillStyle = '#f0e2c4'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 自動換行（最多三行）
  const maxW = W * 0.78
  const lines: string[] = []
  let cur = ''
  for (const ch of shown) {
    if (ctx.measureText(cur + ch).width > maxW) {
      lines.push(cur)
      cur = ch
    } else cur += ch
  }
  if (cur) lines.push(cur)
  const lh = size * 1.5
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh))
}

/** 一個「畫面」：依回憶發生的地方畫一個背景，前面是大大的圖示（慢慢推近），下面兩個人的剪影 */
function drawShot(ctx: CanvasRenderingContext2D, W: number, H: number, m: Memory, t: number, i: number) {
  paper(ctx, W, H)
  const ink = 'rgba(58,40,24,0.85)'
  ctx.fillStyle = ink
  ctx.strokeStyle = ink
  const ground = H * 0.78
  ctx.fillRect(-10, ground, W + 20, H)
  ctx.lineWidth = Math.max(2, W * 0.004)
  switch (m.scene) {
    case 'river':
      for (let k = 0; k < 6; k++) {
        ctx.beginPath()
        for (let x = 0; x <= W; x += 10) ctx.lineTo(x, ground - 20 - k * 12 + Math.sin(x * 0.03 + t * 2 + k) * 4)
        ctx.stroke()
      }
      for (let k = 0; k < 5; k++) {
        ctx.beginPath()
        ctx.ellipse(W * (0.15 + k * 0.18), ground - 8, W * 0.05, H * 0.03, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    case 'school':
      ctx.fillRect(W * 0.1, H * 0.3, W * 0.8, H * 0.05)
      for (let k = 0; k < 4; k++) ctx.strokeRect(W * (0.14 + k * 0.19), H * 0.4, W * 0.14, H * 0.22)
      break
    case 'hill':
      for (let k = 0; k < 4; k++) {
        ctx.beginPath()
        ctx.arc(W * (0.18 + k * 0.22), ground, H * 0.1, Math.PI, 0)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.moveTo(W * 0.85, ground)
      ctx.lineTo(W * 0.85, H * 0.3)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(W * 0.85, H * 0.28, H * 0.12, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'temple':
    case 'home':
      ctx.beginPath()
      ctx.moveTo(W * 0.12, H * 0.42)
      ctx.quadraticCurveTo(W * 0.5, H * 0.34, W * 0.88, H * 0.42)
      ctx.lineTo(W * 0.82, H * 0.48)
      ctx.lineTo(W * 0.18, H * 0.48)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(W * 0.2, H * 0.48, W * 0.6, H * 0.3)
      ctx.fillStyle = SEPIA_BG[0]
      ctx.fillRect(W * 0.44, H * 0.56, W * 0.12, H * 0.22)
      ctx.fillStyle = ink
      break
    case 'garden':
      for (let k = 0; k < 7; k++) {
        ctx.beginPath()
        ctx.moveTo(0, ground - k * H * 0.04)
        ctx.lineTo(W, ground - k * H * 0.04 - H * 0.02)
        ctx.stroke()
      }
      break
    default:
      ctx.fillRect(W * 0.15, H * 0.38, W * 0.7, H * 0.4)
      ctx.fillStyle = SEPIA_BG[0]
      ctx.fillRect(W * 0.2, H * 0.5, W * 0.6, H * 0.2)
      ctx.fillStyle = ink
  }
  // 兩個人的剪影（年輕的阿春和阿公），慢慢走
  const walk = (x: number, s: number, bun: boolean) => {
    const y = ground
    ctx.beginPath()
    ctx.arc(x, y - H * 0.28 * s, H * 0.045 * s, 0, Math.PI * 2)
    ctx.fill()
    if (bun) {
      ctx.beginPath()
      ctx.arc(x - H * 0.035 * s, y - H * 0.31 * s, H * 0.022 * s, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.moveTo(x - H * 0.05 * s, y)
    ctx.lineTo(x - H * 0.035 * s, y - H * 0.22 * s)
    ctx.lineTo(x + H * 0.035 * s, y - H * 0.22 * s)
    ctx.lineTo(x + H * 0.05 * s, y)
    ctx.closePath()
    ctx.fill()
  }
  const drift = ((t * 0.02 + i * 0.1) % 0.2) * W
  walk(W * 0.34 + drift, 1, true)
  walk(W * 0.44 + drift, 1.1, false)
  // 大大的圖示（慢慢推近）
  const k = 1 + ((t % 10) / 10) * 0.12
  ctx.save()
  ctx.globalAlpha = 0.9
  ctx.translate(W * 0.72, H * 0.3)
  ctx.scale(k, k)
  ctx.font = `${Math.round(H * 0.22)}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.filter = 'grayscale(1) sepia(1)'
  ctx.fillText(m.icon, 0, 0)
  ctx.restore()
}

function drawFin(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  paper(ctx, W, H, true)
  frame(ctx, W, H)
  ctx.globalAlpha = Math.min(1, t / 0.6) * Math.max(0, 1 - Math.max(0, t - FIN + 0.6) / 0.6)
  ctx.fillStyle = '#f0e2c4'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(H * 0.13)}px ${FONT}`
  ctx.fillText('劇　終', W / 2, H / 2)
  ctx.globalAlpha = 1
}

/** 字幕卡的花邊框 */
function frame(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.strokeStyle = 'rgba(210,190,150,0.7)'
  ctx.lineWidth = Math.max(2, W * 0.004)
  const m = W * 0.05
  ctx.strokeRect(m, m, W - m * 2, H - m * 2)
  ctx.strokeRect(m + 8, m + 8, W - m * 2 - 16, H - m * 2 - 16)
  for (const [x, y] of [
    [m, m],
    [W - m, m],
    [m, H - m],
    [W - m, H - m],
  ]) {
    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2)
    ctx.stroke()
  }
}

/** 老底片：閃爍、顆粒、刮痕、灰塵、暗角 */
function filmLook(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  // 閃爍
  const flick = 0.06 + Math.random() * 0.08
  ctx.fillStyle = `rgba(20,12,4,${flick})`
  ctx.fillRect(0, 0, W, H)
  // 顆粒
  const n = Math.round((W * H) / 900)
  for (let i = 0; i < n; i++) {
    const v = Math.random() < 0.5 ? 255 : 0
    ctx.fillStyle = `rgba(${v},${v * 0.9},${v * 0.75},${Math.random() * 0.12})`
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2)
  }
  // 刮痕（直的細線，一閃一閃）
  ctx.strokeStyle = 'rgba(240,230,210,0.35)'
  ctx.lineWidth = 1
  const sc = Math.floor(t * 7) % 5
  for (let i = 0; i < 2; i++) {
    if ((sc + i) % 3 === 0) continue
    const x = ((Math.sin(t * 3 + i * 7) + 1) / 2) * W
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + (Math.random() - 0.5) * 6, H)
    ctx.stroke()
  }
  // 灰塵
  ctx.fillStyle = 'rgba(20,14,8,0.55)'
  for (let i = 0; i < 4; i++) {
    if (Math.random() < 0.6) continue
    ctx.beginPath()
    ctx.arc(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  // 暗角
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.72)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.65)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}
