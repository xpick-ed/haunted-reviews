import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio'
import type { HopscotchResult, MinigameProps } from './types'
import './hopscotch.css'

// 跳房子（DESIGN §26.1，廢棄國小）：粉筆畫的格子 1、2、3、4|5、6、7|8、天。
// 1. 丟石頭：一個記號在格子上來回跑，按下去石頭就落在那一格（目標格會標出來）。
// 2. 跳格子：跟著節拍按，一拍跳一格；石頭在的那一格要「跳過」——那一拍不能按（踩到就犯規）。
// 分數 = 丟得準（35%）＋跳得準（65%）。點畫面／E／空白鍵；ESC 離開（不算玩過）。

const CELLS = ['1', '2', '3', '4|5', '6', '7|8', '天']
const BEAT = 0.62 // 秒
const WINDOW = 0.17 // 按的時間差在這之內算有跳到
const PERFECT = 0.07

type Phase = 'intro' | 'throw' | 'landed' | 'hop' | 'done'

interface Beat {
  /** 第幾格（CELLS 的 index） */
  cell: number
  /** 石頭那一格：不能按 */
  rest: boolean
  /** 拍子的時間（秒，相對 hopStart） */
  t: number
  /** 結果：null 還沒到、'perfect' | 'good' | 'miss' | 'foul'（石頭格按了） */
  res: null | 'perfect' | 'good' | 'miss' | 'foul' | 'skip'
}

/** 遊戲進行中的狀態（放在 ref 裡，每幀改） */
interface HopState {
  phase: Phase
  /** 要丟到哪一格（CELLS 的 index） */
  target: number
  /** 丟石頭的記號位置 0..1、方向 */
  meter: number
  meterDir: number
  /** 石頭落在哪一格（-1＝還沒丟） */
  stone: number
  throwScore: number
  landedAt: number
  hopStart: number
  beats: Beat[]
  /** 阿嬤現在站在哪一格（-1＝起點） */
  at: number
  hopAt: number
  wobble: number
  finished: boolean
  lastTick: number
}

const newState = (): HopState => ({
  phase: 'intro',
  target: 2 + Math.floor(Math.random() * 4), // 丟到 3、4|5、6、7|8（index 2..5）
  meter: 0,
  meterDir: 1,
  stone: -1,
  throwScore: 0,
  landedAt: 0,
  hopStart: 0,
  beats: [],
  at: -1,
  hopAt: 0,
  wobble: 0,
  finished: false,
  lastTick: -99,
})

const now = () => performance.now() / 1000

// ---------------------------------------------------------------------------
// 聲音（WebAudio 現場合成）
// ---------------------------------------------------------------------------

function tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime + when
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + dur + 0.02)
}
const sfx = {
  tick: (strong: boolean) => tone(strong ? 1320 : 990, 0.05, 'square', strong ? 0.05 : 0.03),
  hop: () => {
    tone(160, 0.12, 'sine', 0.18)
    tone(90, 0.1, 'triangle', 0.1)
  },
  stone: () => {
    tone(900, 0.04, 'square', 0.06)
    tone(620, 0.05, 'square', 0.05, 0.06)
  },
  bad: () => tone(180, 0.25, 'sawtooth', 0.06),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, i * 0.1)),
}

// ---------------------------------------------------------------------------

export default function Hopscotch({ done }: MinigameProps<unknown, HopscotchResult | null>) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [msg, setMsg] = useState('')
  const [score, setScore] = useState<number | null>(null)
  const st = useRef<HopState>(newState())

  const setP = (p: Phase) => {
    st.current.phase = p
    setPhase(p)
  }

  const finish = (s: number) => {
    const r = st.current
    if (r.finished) return
    r.finished = true
    window.setTimeout(() => done({ score: s }), 1700)
  }

  const endGame = () => {
    const r = st.current
    if (r.phase === 'done') return
    const taps = r.beats.filter((b) => !b.rest)
    const hopScore = taps.reduce((a, b) => a + (b.res === 'perfect' ? 1 : b.res === 'good' ? 0.7 : 0), 0) / Math.max(1, taps.length)
    const fouls = r.beats.filter((b) => b.res === 'foul').length
    const s = Math.max(0, Math.min(1, 0.35 * r.throwScore + 0.65 * hopScore - fouls * 0.25))
    setScore(s)
    setMsg(s >= 0.8 ? '跳得真漂亮！' : s >= 0.45 ? '還不錯！' : '腳打結了……')
    if (s >= 0.8) sfx.win()
    setP('done')
    finish(s)
  }

  /** 按一下（點畫面、E、空白鍵） */
  const press = () => {
    const r = st.current
    const t = now()
    if (r.phase === 'intro') {
      setP('throw')
      return
    }
    if (r.phase === 'throw') {
      // 石頭落在記號所在的那一格
      const cell = Math.max(0, Math.min(5, Math.floor(r.meter * 6)))
      r.stone = cell
      r.throwScore = cell === r.target ? 1 : Math.abs(cell - r.target) === 1 ? 0.5 : 0
      r.landedAt = t
      sfx.stone()
      setMsg(cell === r.target ? '丟得真準！' : Math.abs(cell - r.target) === 1 ? '差一點點' : '丟歪了……')
      setP('landed')
      return
    }
    if (r.phase === 'hop') {
      const rel = t - r.hopStart
      // 最近的一拍
      let best: Beat | null = null
      let bd = Infinity
      for (const b of r.beats) {
        if (b.res) continue
        const d = Math.abs(rel - b.t)
        if (d < bd) {
          bd = d
          best = b
        }
      }
      if (!best || bd > WINDOW) {
        // 亂按：晃一下
        r.wobble = 1
        return
      }
      if (best.rest) {
        best.res = 'foul'
        r.wobble = 1
        sfx.bad()
        setMsg('踩到石頭那一格了！')
        return
      }
      best.res = bd < PERFECT ? 'perfect' : 'good'
      r.at = best.cell
      r.hopAt = t
      sfx.hop()
    }
  }
  const pressRef = useRef(press)
  pressRef.current = press

  // 按鍵
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        if (!st.current.finished) {
          st.current.finished = true
          done(null)
        }
        return
      }
      if (e.repeat) return
      if (k === 'e' || k === ' ' || k === 'enter') {
        e.preventDefault()
        e.stopPropagation()
        pressRef.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [done])

  // 畫面與時間
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
      const r = st.current
      const t = now()
      const dt = Math.min(0.1, t - last)
      last = t
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = box.clientWidth
      const H = box.clientHeight
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr)
        cv.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // ---- 更新 ----
      if (r.phase === 'throw') {
        // 記號在 1–6 號格之間來回跑（越來越快一點點）
        r.meter += dt * r.meterDir * 0.62
        if (r.meter > 1) {
          r.meter = 2 - r.meter
          r.meterDir = -1
        } else if (r.meter < 0) {
          r.meter = -r.meter
          r.meterDir = 1
        }
      }
      if (r.phase === 'landed' && t - r.landedAt > 1.0) {
        // 準備跳：兩拍預備，然後一格一拍
        r.hopStart = t + BEAT * 2
        r.beats = CELLS.map((_, i) => ({ cell: i, rest: i === r.stone, t: BEAT * i, res: null }))
        r.lastTick = -99
        setMsg('跟著拍子跳！石頭那一格不要按')
        setP('hop')
      }
      if (r.phase === 'hop') {
        const rel = t - r.hopStart
        // 節拍器
        const bi = Math.floor(rel / BEAT + 0.001)
        if (bi !== r.lastTick && bi >= -2 && bi < CELLS.length) {
          r.lastTick = bi
          sfx.tick(bi < 0)
        }
        for (const b of r.beats) {
          if (b.res || rel < b.t + WINDOW) continue
          if (b.rest) {
            // 石頭格：沒按＝跳過了（自動跳到下一格）
            b.res = 'skip'
            r.at = b.cell
            r.hopAt = t
          } else {
            b.res = 'miss'
            r.wobble = 1
            sfx.bad()
            r.at = b.cell
            r.hopAt = t
          }
        }
        if (rel > r.beats[r.beats.length - 1].t + WINDOW + 0.1) endGame()
      }
      r.wobble = Math.max(0, r.wobble - dt * 2.2)

      // ---- 畫 ----
      draw(ctx, W, H, r, t)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const r = st.current
  const hint =
    phase === 'intro'
      ? '先丟石頭，再跟著拍子跳格子'
      : phase === 'throw'
        ? `丟到「${CELLS[r.target]}」號格：記號跑到那格時按下去`
        : msg

  return (
    <div className="hop-panel">
      <div className="hop-head">
        <span className="hop-title">跳房子</span>
        <span className="hop-step">{phase === 'throw' || phase === 'intro' ? '① 丟石頭' : phase === 'done' ? '跳完了' : '② 跳格子'}</span>
        <button
          className="hop-close"
          aria-label="離開"
          onClick={() => {
            if (!st.current.finished) {
              st.current.finished = true
              done(null)
            }
          }}
        >
          ✕
        </button>
      </div>
      <div
        ref={wrap}
        className="hop-stage"
        onPointerDown={(e) => {
          e.preventDefault()
          pressRef.current()
        }}
      >
        <canvas ref={canvas} />
        {phase === 'intro' && (
          <div className="hop-card">
            <div className="hop-card-title">阿妹仔：「阿嬤，我們來跳房子！」</div>
            <div className="hop-card-sub">點畫面或按 E 開始</div>
          </div>
        )}
        {phase === 'done' && score !== null && (
          <div className="hop-card">
            <div className="hop-card-title">{msg}</div>
            <div className="hop-bar">
              <i style={{ width: `${Math.round(score * 100)}%` }} />
            </div>
          </div>
        )}
      </div>
      <div className="hop-hint">{hint}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 畫：柏油地上的粉筆格子（直的，下面是起點、上面是天）、石頭、阿嬤、下面的節拍軌
// ---------------------------------------------------------------------------

/** 每一格的矩形（畫布座標）；pair 的格子左右各半 */
function cellRects(W: number, H: number) {
  const laneH = 64
  // 上面留位置給「天」的半圓
  const top = 64
  const bottom = H - laneH - 40
  const cw = Math.min(118, W * 0.3)
  const ch = (bottom - top) / (CELLS.length + 0.2)
  const cx = W / 2
  return {
    cw,
    ch,
    cx,
    laneY: H - laneH - 8,
    laneH,
    startY: bottom + 26,
    rect: (i: number) => {
      const y = bottom - (i + 1) * ch
      const pair = CELLS[i].includes('|')
      return { x: cx - (pair ? cw : cw / 2), y, w: pair ? cw * 2 : cw, h: ch, pair }
    },
  }
}

function draw(ctx: CanvasRenderingContext2D, W: number, H: number, r: HopState, t: number) {
  // 柏油地（夜晚的水泥地、月光）
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#2b2f36')
  bg.addColorStop(1, '#1b1e24')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const G = cellRects(W, H)
  // 粉筆格子
  ctx.lineWidth = 3.5
  ctx.strokeStyle = 'rgba(240,236,224,0.88)'
  ctx.fillStyle = 'rgba(240,236,224,0.9)'
  ctx.font = '700 26px "LXGW WenKai TC", "Noto Serif TC", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  CELLS.forEach((c, i) => {
    const q = G.rect(i)
    const target = r.phase === 'throw' && i === r.target
    if (target) {
      ctx.fillStyle = `rgba(255,213,138,${0.22 + Math.sin(t * 8) * 0.08})`
      ctx.fillRect(q.x, q.y, q.w, q.h)
      ctx.fillStyle = 'rgba(240,236,224,0.9)'
    }
    if (c === '天') {
      ctx.beginPath()
      ctx.arc(G.cx, q.y + q.h, Math.min(q.w * 0.9, q.h * 1.15), Math.PI, 0)
      ctx.stroke()
      ctx.fillText('天', G.cx, q.y + q.h * 0.45)
    } else if (q.pair) {
      const [a, b] = c.split('|')
      ctx.strokeRect(q.x, q.y, q.w / 2, q.h)
      ctx.strokeRect(q.x + q.w / 2, q.y, q.w / 2, q.h)
      ctx.fillText(a, q.x + q.w / 4, q.y + q.h / 2)
      ctx.fillText(b, q.x + (q.w * 3) / 4, q.y + q.h / 2)
    } else {
      ctx.strokeRect(q.x, q.y, q.w, q.h)
      ctx.fillText(c, G.cx, q.y + q.h / 2)
    }
  })
  // 起點線
  ctx.beginPath()
  ctx.moveTo(G.cx - G.cw, G.startY - 14)
  ctx.lineTo(G.cx + G.cw, G.startY - 14)
  ctx.stroke()

  // 丟石頭的記號
  if (r.phase === 'throw') {
    const i = Math.max(0, Math.min(5, Math.floor(r.meter * 6)))
    const q = G.rect(i)
    const y = q.y + q.h / 2
    ctx.fillStyle = '#ffd58a'
    ctx.beginPath()
    ctx.moveTo(q.x - 22, y)
    ctx.lineTo(q.x - 8, y - 9)
    ctx.lineTo(q.x - 8, y + 9)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(q.x + q.w + 22, y)
    ctx.lineTo(q.x + q.w + 8, y - 9)
    ctx.lineTo(q.x + q.w + 8, y + 9)
    ctx.closePath()
    ctx.fill()
  }
  // 石頭
  if (r.stone >= 0) {
    const q = G.rect(r.stone)
    const drop = r.phase === 'landed' ? Math.max(0, 1 - (t - r.landedAt) / 0.35) : 0
    const sx = G.cx + (q.pair ? q.w / 4 : 0)
    const sy = q.y + q.h / 2 - drop * 60
    ctx.fillStyle = '#9a9186'
    ctx.beginPath()
    ctx.ellipse(sx, sy, 11, 8, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.ellipse(sx - 3, sy - 3, 4, 2.5, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
  // 阿嬤（青白色的小鬼魂）：跳到哪一格
  {
    const hopK = Math.min(1, (t - r.hopAt) / 0.22)
    const q = r.at >= 0 ? G.rect(r.at) : null
    const gx = G.cx + (r.wobble > 0 ? Math.sin(t * 40) * 6 * r.wobble : 0)
    const gy = q ? q.y + q.h / 2 : G.startY
    const lift = Math.sin(hopK * Math.PI) * 18
    const y = gy - lift - 8
    const glow = ctx.createRadialGradient(gx, y, 2, gx, y, 34)
    glow.addColorStop(0, 'rgba(143,244,255,0.55)')
    glow.addColorStop(1, 'rgba(143,244,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(gx - 40, y - 40, 80, 80)
    ctx.fillStyle = '#dff9ff'
    ctx.beginPath()
    ctx.arc(gx, y - 10, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#b7a4d8'
    ctx.beginPath()
    ctx.moveTo(gx - 12, y + 18)
    ctx.quadraticCurveTo(gx, y - 6, gx + 12, y + 18)
    ctx.fill()
    ctx.fillStyle = '#eef2f5'
    ctx.beginPath()
    ctx.arc(gx, y - 20, 7, 0, Math.PI * 2)
    ctx.fill()
  }

  // 節拍軌：拍子從右邊往判定線（左邊）移動；「跳」是圓點、石頭格是 ✕
  if (r.phase === 'hop' || r.phase === 'done') {
    const ly = G.laneY
    const lh = G.laneH
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(12, ly, W - 24, lh)
    const hitX = 64
    ctx.strokeStyle = 'rgba(255,213,138,0.9)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(hitX, ly + 6)
    ctx.lineTo(hitX, ly + lh - 6)
    ctx.stroke()
    const rel = t - r.hopStart
    const pxPerSec = (W - hitX - 30) / (BEAT * 3.2)
    for (const b of r.beats) {
      const x = hitX + (b.t - rel) * pxPerSec
      if (x < 4 || x > W - 10) continue
      const y = ly + lh / 2
      ctx.globalAlpha = b.res && b.res !== 'skip' ? 0.35 : 1
      if (b.rest) {
        ctx.strokeStyle = b.res === 'foul' ? '#ff6a5a' : '#ff9a8a'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(x - 10, y - 10)
        ctx.lineTo(x + 10, y + 10)
        ctx.moveTo(x + 10, y - 10)
        ctx.lineTo(x - 10, y + 10)
        ctx.stroke()
      } else {
        ctx.fillStyle = b.res === 'perfect' ? '#9be8a4' : b.res === 'good' ? '#ffe08a' : b.res === 'miss' ? '#ff7a6a' : '#8ff4ff'
        ctx.beginPath()
        ctx.arc(x, y, 13, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#10202a'
        ctx.font = '700 14px "Noto Sans TC", sans-serif'
        ctx.fillText(CELLS[b.cell] === '天' ? '天' : '跳', x, y + 1)
      }
      ctx.globalAlpha = 1
    }
    // 預備拍
    if (rel < 0) {
      ctx.fillStyle = '#ffe6a0'
      ctx.font = '700 22px "LXGW WenKai TC", serif'
      ctx.fillText(rel < -BEAT ? '預備——' : '跳！', W / 2, 30)
    }
  }
}
