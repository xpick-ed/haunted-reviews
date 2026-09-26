import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio'
import { sfx } from '../../audio/sfx'
import type { MinigameProps, ZongziResult } from './types'
import './zongzi.css'

// 包粽子（中元普渡，廟埕的石拜桌，DESIGN §26.1）：跟阿桑們一起包三顆。
// 每一顆三個步驟：
//   摺葉：兩片竹葉捲成漏斗，指針擺到綠色的地方按下去
//   填料：照順序放 米 → 香菇 → 蛋黃 → 肉 → 米（放錯會扣分）
//   綁繩：繩子繞著粽子轉，轉到結的位置按下去，綁三圈
// 品質 = 摺葉 30% ＋ 填料 35% ＋ 綁繩 35%，三顆平均。

const COUNT = 3
const ORDER = ['rice', 'mushroom', 'yolk', 'pork', 'rice'] as const
type Filling = 'rice' | 'mushroom' | 'yolk' | 'pork'
const FILL: Record<Filling, { name: string; color: string; dark: string }> = {
  rice: { name: '糯米', color: '#f6f0dc', dark: '#c8bc98' },
  mushroom: { name: '香菇', color: '#8a5a3a', dark: '#4a2a18' },
  yolk: { name: '鹹蛋黃', color: '#f2a83a', dark: '#b8661a' },
  pork: { name: '滷肉', color: '#a8482a', dark: '#5a1e10' },
}
const BOWLS: Filling[] = ['rice', 'mushroom', 'yolk', 'pork']

/** 摺葉：指針 0..1 來回擺，綠區中心 */
const FOLD_ZONE = { c: 0.72, half: 0.1 }
/** 綁繩：結的位置（弧度）與容許範圍 */
const KNOT = { a: -Math.PI / 2, half: 0.42 }
const WRAPS = 3
const FILL_TIME = 9

type Step = 'intro' | 'fold' | 'fill' | 'tie' | 'next' | 'done'

interface Made {
  fold: number
  fill: number
  tie: number
}

const quality = (m: Made) => m.fold * 0.3 + m.fill * 0.35 + m.tie * 0.35

function blip(freq: number, dur = 0.08, vol = 0.18, type: OscillatorType = 'triangle') {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export default function Zongzi({ done }: MinigameProps<unknown, ZongziResult>) {
  const [step, setStep] = useState<Step>('intro')
  const [idx, setIdx] = useState(0)
  const [fillAt, setFillAt] = useState(0)
  const [shake, setShake] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const g = useRef({
    step: 'intro' as Step,
    t: 0,
    needle: 0,
    foldScore: 0,
    folded: 0,
    fillMistakes: 0,
    fillT: 0,
    layers: [] as Filling[],
    angle: 0,
    wraps: [] as number[],
    made: [] as Made[],
    flash: 0,
  })

  const go = (s: Step) => {
    g.current.step = s
    g.current.t = 0
    setStep(s)
  }

  const result = (): ZongziResult => {
    const made = g.current.made
    if (!made.length) return { count: 0, quality: 0 }
    return { count: made.length, quality: made.reduce((a, m) => a + quality(m), 0) / made.length }
  }

  const toast = (text: string) => {
    setMsg(text)
    window.setTimeout(() => setMsg((m) => (m === text ? null : m)), 700)
  }

  const startOne = () => {
    const s = g.current
    s.needle = 0
    s.folded = 0
    s.foldScore = 0
    s.fillMistakes = 0
    s.fillT = 0
    s.layers = []
    s.angle = Math.PI / 2
    s.wraps = []
    setFillAt(0)
    go('fold')
  }

  const begin = () => {
    audio.init()
    startOne()
  }

  /** 主動作（摺葉、綁繩）：點畫面、空白鍵、E */
  const act = () => {
    const s = g.current
    if (s.step === 'fold') {
      if (s.folded) return
      const d = Math.abs(s.needle - FOLD_ZONE.c)
      s.foldScore = Math.max(0, 1 - Math.max(0, d - 0.02) / (FOLD_ZONE.half * 2.2))
      s.folded = 1
      sfx.play('cloth', { volume: 0.5 })
      toast(s.foldScore > 0.8 ? '摺得漂亮！' : s.foldScore > 0.45 ? '還可以' : '有點鬆……')
      window.setTimeout(() => {
        if (g.current.step === 'fold') {
          g.current.t = 0
          go('fill')
        }
      }, 450)
    } else if (s.step === 'tie') {
      if (s.wraps.length >= WRAPS) return
      // 繩頭跟結的角度差（-π..π）
      const diff = ((((s.angle - KNOT.a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI
      const d = Math.abs(diff)
      const score = Math.max(0, 1 - d / (KNOT.half * 1.6))
      s.wraps.push(score)
      s.flash = performance.now()
      blip(score > 0.5 ? 660 + s.wraps.length * 110 : 220, 0.1, 0.2)
      if (s.wraps.length >= WRAPS) {
        const tie = s.wraps.reduce((a, b) => a + b, 0) / WRAPS
        const fill = Math.max(0, 1 - s.fillMistakes * 0.25)
        s.made.push({ fold: s.foldScore, fill, tie })
        const q = quality(s.made[s.made.length - 1])
        toast(q > 0.8 ? '一顆漂亮的粽子！' : q > 0.5 ? '包好了！' : '歪歪的……也是粽子')
        sfx.play('pickup', { volume: 0.5 })
        window.setTimeout(() => {
          if (g.current.made.length >= COUNT) go('done')
          else {
            setIdx(g.current.made.length)
            go('next')
          }
        }, 650)
      }
    }
  }

  const pickFilling = (f: Filling) => {
    const s = g.current
    if (s.step !== 'fill') return
    const want = ORDER[s.layers.length]
    if (f !== want) {
      s.fillMistakes++
      setShake(true)
      window.setTimeout(() => setShake(false), 300)
      blip(160, 0.14, 0.2, 'square')
      toast(`不對，先放${FILL[want].name}`)
      return
    }
    s.layers.push(f)
    setFillAt(s.layers.length)
    blip(440 + s.layers.length * 90, 0.07, 0.16)
    if (s.layers.length >= ORDER.length) window.setTimeout(() => g.current.step === 'fill' && go('tie'), 350)
  }

  // 主迴圈
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = g.current
      s.t += dt
      if (s.step === 'fold' && !s.folded) {
        // 指針來回擺（越來越快一點）
        const speed = 0.9 + g.current.made.length * 0.18
        s.needle = 0.5 - 0.5 * Math.cos(s.t * speed * Math.PI)
      }
      if (s.step === 'fill') {
        s.fillT += dt
        if (s.fillT > FILL_TIME) {
          // 時間到：阿桑幫妳放完，扣分
          s.fillMistakes += ORDER.length - s.layers.length
          s.layers = [...ORDER]
          setFillAt(ORDER.length)
          toast('阿桑幫妳放好了')
          go('tie')
        }
      }
      if (s.step === 'tie') s.angle += dt * (3.0 + g.current.made.length * 0.5)
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 鍵盤
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const s = g.current
      if (k === 'escape') {
        e.preventDefault()
        e.stopPropagation()
        done(s.step === 'done' ? result() : { count: 0, quality: 0 })
        return
      }
      if (e.repeat) return
      const main = k === ' ' || k === 'e' || k === 'enter'
      if (s.step === 'intro' && main) begin()
      else if (s.step === 'next' && main) startOne()
      else if (s.step === 'done' && main) done(result())
      else if ((s.step === 'fold' || s.step === 'tie') && main) act()
      else if (s.step === 'fill' && k >= '1' && k <= '4') pickFilling(BOWLS[Number(k) - 1])
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', down, true)
    return () => window.removeEventListener('keydown', down, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 畫布大小
  useEffect(() => {
    const c = canvas.current
    const w = wrap.current
    if (!c || !w) return
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = w.clientWidth
      const ch = Math.min(Math.round(cw * 0.78), Math.round(window.innerHeight * 0.42))
      c.width = Math.round(cw * dpr)
      c.height = Math.round(ch * dpr)
      c.style.width = `${cw}px`
      c.style.height = `${ch}px`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  function draw() {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const u = Math.min(W, H * 1.3) / 100
    const s = g.current
    // 桌面：木頭
    const wood = ctx.createLinearGradient(0, 0, 0, H)
    wood.addColorStop(0, '#6a4428')
    wood.addColorStop(1, '#4a2c18')
    ctx.fillStyle = wood
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 0.12
    for (let y = 0; y < H; y += 3.2 * u) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, y, W, 0.25 * u)
    }
    ctx.globalAlpha = 1
    // 旁邊的一籃竹葉、包好的粽子
    drawLeafPile(ctx, W * 0.1, H * 0.78, u)
    s.made.forEach((m, i) => drawDone(ctx, W * 0.86 - i * 9 * u, H * 0.8, u * 0.7, quality(m)))

    const cx = W / 2
    const cy = H * 0.52
    if (s.step === 'intro' || s.step === 'done') {
      drawLeaves(ctx, cx, cy, u, 0)
      return
    }
    if (s.step === 'fold' || s.step === 'next') {
      const k = s.step === 'next' ? 0 : s.folded ? 1 : s.needle * 0.85
      drawLeaves(ctx, cx, cy, u, k)
      if (s.step === 'fold') drawGauge(ctx, cx, H * 0.1, u, s.needle, s.folded > 0)
      return
    }
    // 填料、綁繩：漏斗（粽子）
    drawCone(ctx, cx, cy, u, s.layers, s.step === 'tie')
    if (s.step === 'fill') {
      // 時間條
      const left = Math.max(0, 1 - s.fillT / FILL_TIME)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(cx - 22 * u, H * 0.06, 44 * u, 2.2 * u)
      ctx.fillStyle = left < 0.3 ? '#ff7a5a' : '#9be8a4'
      ctx.fillRect(cx - 22 * u, H * 0.06, 44 * u * left, 2.2 * u)
    }
    if (s.step === 'tie') {
      // 繩子繞圈：結的位置（金色弧）、繩頭（轉動的點）
      const R = 27 * u
      ctx.strokeStyle = 'rgba(255,226,122,0.5)'
      ctx.lineWidth = 3.4 * u
      ctx.beginPath()
      ctx.arc(cx, cy - 2 * u, R, KNOT.a - KNOT.half, KNOT.a + KNOT.half)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 0.6 * u
      ctx.beginPath()
      ctx.arc(cx, cy - 2 * u, R, 0, Math.PI * 2)
      ctx.stroke()
      const hx = cx + Math.cos(s.angle) * R
      const hy = cy - 2 * u + Math.sin(s.angle) * R
      const fl = performance.now() - s.flash < 160
      ctx.fillStyle = fl ? '#fff4c0' : '#d8b27a'
      ctx.beginPath()
      ctx.arc(hx, hy, (fl ? 2.8 : 2.1) * u, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#5a3a1a'
      ctx.lineWidth = 0.5 * u
      ctx.stroke()
      // 已經綁的圈
      s.wraps.forEach((w, i) => {
        ctx.strokeStyle = w > 0.5 ? '#c8a064' : '#8a6a44'
        ctx.lineWidth = 1.1 * u
        const y = cy - 10 * u + i * 7 * u
        ctx.beginPath()
        ctx.moveTo(cx - 17 * u + i * 3.5 * u, y)
        ctx.lineTo(cx + 17 * u - i * 3.5 * u, y + 2 * u)
        ctx.stroke()
      })
    }
  }

  const progress = step === 'intro' ? 0 : Math.min(COUNT, g.current.made.length + (step === 'done' ? 0 : 1))
  const res = step === 'done' ? result() : null

  return (
    <div className="zz-card" onPointerDown={(e) => e.stopPropagation()}>
      <button className="zz-leave" onClick={() => done(step === 'done' ? result() : { count: 0, quality: 0 })}>
        離開
      </button>
      <div className="zz-head">
        <span className="zz-title">🍙 包粽子</span>
        <span className="zz-stat">
          第 <b>{progress}</b> / {COUNT} 顆
        </span>
      </div>
      <div className="zz-steps">
        {(['fold', 'fill', 'tie'] as const).map((k, i) => (
          <span key={k} className={`zz-chip ${step === k ? 'on' : ''}`}>
            {['摺葉', '填料', '綁繩'][i]}
          </span>
        ))}
      </div>
      <div className={`zz-stage ${shake ? 'shake' : ''}`} ref={wrap}>
        <canvas
          ref={canvas}
          className="zz-canvas"
          onPointerDown={() => {
            if (step === 'fold' || step === 'tie') act()
          }}
        />
        {msg && <div className="zz-toast">{msg}</div>}
        {step === 'intro' && (
          <div className="zz-overlay">
            <p className="zz-story">中元普渡，阿桑們在拜桌邊包粽子。阿嬤也來包三顆！</p>
            <p>
              <b>摺葉</b>：指針擺到綠色時按下去
              <br />
              <b>填料</b>：照順序放 糯米 → 香菇 → 鹹蛋黃 → 滷肉 → 糯米
              <br />
              <b>綁繩</b>：繩頭轉到金色的地方按下去，綁三圈
            </p>
            <p className="muted">電腦：空白鍵／E；填料按 1–4</p>
            <button className="btn primary big" onClick={begin}>
              開始包
            </button>
          </div>
        )}
        {step === 'next' && (
          <div className="zz-overlay light">
            <button className="btn primary big" onClick={startOne}>
              包第 {idx + 1} 顆
            </button>
          </div>
        )}
        {step === 'done' && res && (
          <div className="zz-overlay">
            <div className="zz-result">
              包好 <b>{res.count}</b> 顆粽子
            </div>
            <div className="zz-quality">{res.quality >= 0.8 ? '顆顆漂亮，阿桑都誇妳' : res.quality >= 0.5 ? '有模有樣' : '形狀有點特別……'}</div>
            <p className="muted">粽子帶回家，可以蒸給客人當宵夜</p>
            <button className="btn primary big" onClick={() => done(res)}>
              收下
            </button>
          </div>
        )}
      </div>
      {step === 'fill' && (
        <div className="zz-bowls">
          {BOWLS.map((f, i) => (
            <button
              key={f}
              className={`zz-bowl ${ORDER[fillAt] === f ? 'hint' : ''}`}
              onPointerDown={(e) => {
                e.stopPropagation()
                pickFilling(f)
              }}
            >
              <i style={{ background: `radial-gradient(circle at 35% 30%, #fff, ${FILL[f].color} 45%, ${FILL[f].dark})` }} />
              <span>
                {i + 1}. {FILL[f].name}
              </span>
            </button>
          ))}
        </div>
      )}
      {(step === 'fold' || step === 'tie') && (
        <button
          className="btn primary big zz-act"
          onPointerDown={(e) => {
            e.stopPropagation()
            act()
          }}
        >
          {step === 'fold' ? '摺！' : '綁！'}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 畫圖
// ---------------------------------------------------------------------------

function leafPath(ctx: CanvasRenderingContext2D, len: number, wid: number) {
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(wid, len * 0.35, 0, len)
  ctx.quadraticCurveTo(-wid, len * 0.35, 0, 0)
  ctx.closePath()
}

function fillLeaf(ctx: CanvasRenderingContext2D, len: number, wid: number, u: number) {
  leafPath(ctx, len, wid)
  const lg = ctx.createLinearGradient(-wid, 0, wid, 0)
  lg.addColorStop(0, '#3f7a34')
  lg.addColorStop(0.5, '#7fb85a')
  lg.addColorStop(1, '#3a6a2e')
  ctx.fillStyle = lg
  ctx.fill()
  ctx.strokeStyle = '#1e3a16'
  ctx.lineWidth = 0.5 * u
  ctx.stroke()
  ctx.strokeStyle = 'rgba(220,240,180,0.45)'
  ctx.lineWidth = 0.35 * u
  ctx.beginPath()
  ctx.moveTo(0, len * 0.05)
  ctx.lineTo(0, len * 0.95)
  ctx.stroke()
}

/** 兩片竹葉，k = 0 攤平、1 捲成漏斗 */
function drawLeaves(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number, k: number) {
  const len = 56 * u
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(cx + side * (8 - k * 6) * u, cy - len * 0.45)
    ctx.rotate(side * (0.55 - k * 0.45))
    ctx.scale(1 - k * 0.35 * (side > 0 ? 1 : 0.8), 1)
    fillLeaf(ctx, len, 9 * u, u)
    ctx.restore()
  }
  if (k > 0.3) {
    // 捲起來的漏斗口
    ctx.globalAlpha = Math.min(1, (k - 0.3) / 0.5)
    ctx.fillStyle = '#2e5a26'
    ctx.beginPath()
    ctx.ellipse(cx, cy - 12 * u, 10 * u, 3.2 * u, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

function drawGauge(ctx: CanvasRenderingContext2D, cx: number, y: number, u: number, v: number, locked: boolean) {
  const w = 60 * u
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(cx - w / 2, y, w, 3 * u)
  ctx.fillStyle = 'rgba(155,232,164,0.85)'
  ctx.fillRect(cx - w / 2 + (FOLD_ZONE.c - FOLD_ZONE.half) * w, y, FOLD_ZONE.half * 2 * w, 3 * u)
  ctx.fillStyle = locked ? '#fff4c0' : '#ffffff'
  ctx.fillRect(cx - w / 2 + v * w - 0.5 * u, y - 1.2 * u, 1 * u, 5.4 * u)
  ctx.fillStyle = 'rgba(255,240,210,0.75)'
  ctx.font = `600 ${2.6 * u}px "Noto Sans TC", sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText('攤平', cx - w / 2, y + 7 * u)
  ctx.textAlign = 'right'
  ctx.fillText('捲太緊', cx + w / 2, y + 7 * u)
}

/** 漏斗（粽子）：側面看是一個倒三角，裡面一層一層的料 */
function drawCone(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number, layers: Filling[], closed: boolean) {
  const top = cy - 21 * u
  const bot = cy + 22 * u
  const half = 19 * u
  // 料（從下往上疊）
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - half, top)
  ctx.lineTo(cx + half, top)
  ctx.lineTo(cx, bot)
  ctx.closePath()
  ctx.clip()
  const layerH = (bot - top) / ORDER.length
  layers.forEach((f, i) => {
    const y1 = bot - i * layerH
    const y0 = y1 - layerH
    const lg = ctx.createLinearGradient(0, y0, 0, y1)
    lg.addColorStop(0, FILL[f].color)
    lg.addColorStop(1, FILL[f].dark)
    ctx.fillStyle = lg
    ctx.fillRect(cx - half, y0, half * 2, layerH + 0.5)
    if (f === 'rice') {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      for (let k = 0; k < 14; k++) ctx.fillRect(cx - half + ((k * 37) % 28) * u, y0 + ((k * 13) % 7) * 0.2 * layerH, 1.1 * u, 0.6 * u)
    }
  })
  ctx.restore()
  // 葉子外殼
  ctx.strokeStyle = '#1e3a16'
  ctx.lineWidth = 0.8 * u
  const lg = ctx.createLinearGradient(cx - half, 0, cx + half, 0)
  lg.addColorStop(0, 'rgba(63,122,52,0.55)')
  lg.addColorStop(0.5, 'rgba(127,184,90,0.18)')
  lg.addColorStop(1, 'rgba(58,106,46,0.55)')
  ctx.fillStyle = lg
  ctx.beginPath()
  ctx.moveTo(cx - half, top)
  ctx.lineTo(cx + half, top)
  ctx.lineTo(cx, bot)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  if (closed) {
    // 蓋起來的葉子
    ctx.fillStyle = '#4f8a3e'
    ctx.beginPath()
    ctx.moveTo(cx - half - 1 * u, top + 1 * u)
    ctx.quadraticCurveTo(cx, top - 10 * u, cx + half + 1 * u, top + 1 * u)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

function drawLeafPile(ctx: CanvasRenderingContext2D, x: number, y: number, u: number) {
  ctx.fillStyle = '#8a6a3a'
  ctx.beginPath()
  ctx.ellipse(x, y, 11 * u, 5 * u, 0, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 5; i++) {
    ctx.save()
    ctx.translate(x - 6 * u + i * 3 * u, y - 3 * u)
    ctx.rotate(-1.2 + i * 0.25)
    fillLeaf(ctx, 16 * u, 3.5 * u, u)
    ctx.restore()
  }
}

/** 包好的粽子（掛成一串）：品質越好越漂亮 */
function drawDone(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, q: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((1 - q) * 0.4 * (x % 2 ? 1 : -1))
  ctx.fillStyle = '#4f8a3e'
  ctx.strokeStyle = '#1e3a16'
  ctx.lineWidth = 0.6 * u
  ctx.beginPath()
  ctx.moveTo(-8 * u, -5 * u)
  ctx.lineTo(8 * u, -5 * u)
  ctx.lineTo(0, 9 * u)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = '#c8a064'
  ctx.lineWidth = 0.9 * u
  ctx.beginPath()
  ctx.moveTo(-6 * u, -1 * u)
  ctx.lineTo(6 * u, 0)
  ctx.moveTo(0, -5 * u)
  ctx.lineTo(0, -12 * u)
  ctx.stroke()
  ctx.restore()
}
