import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio'
import type { MinigameProps } from './types'
import './sew.css'

// 踩裁縫車（DESIGN §30，錦繡布莊）：幫錦繡姨把孫女的旗袍做完。
// 按住「踩」布就往上走（越踩越快）；左右移動布，讓針一直走在粉土線上。踩滿 target 針、而且七成在線上才算好；有時間限制。
// 粉土線在針的下面（還沒車到的那一段），看得到前面怎麼彎；彎的地方少踩一點。
// 鍵盤：空白鍵／↑／W 踩，←→／A D 移布，Esc 放棄。手機：按住下面的踏板，手指在布上左右拖。
//
// 手感測試（人類模型：手機拖布、反應 0.2 秒、手越快越不準）：原本整條線幾乎是直的、四秒就踩完、準不準都算成功；
// 改成線一開始就彎、一針 18px、要七成在線上、時間只夠「平均踩到四成快」：拖布的新手約六成五、熟手幾乎都過。
// 只用方向鍵比較難（新手約一成五），所以提示寫「滑鼠也可以拖」。

export interface SewParams {
  /** 要踩幾針 */
  target?: number
}
/** done：踩完了沒；accuracy：走在線上的針佔幾成（0..1） */
export interface SewResult {
  done: boolean
  accuracy: number
}

const W = 320
const H = 380
const NEEDLE_Y = 118
/** 一針走多遠（px）：原本 12，整條線太短、四秒就踩完 */
const STEP = 18
const MAX_SPEED = 150
/** 離粉土線多近算「在線上」（px） */
const GOOD = 9
/** 在線上的針要幾成才算做好 */
export const SEW_PASS = 0.7
/** 時間：整條線用最快速度的四成踩得完，再多兩秒 */
const limitFor = (target: number) => Math.ceil((target * STEP) / (MAX_SPEED * 0.4) + 2)
/** 鍵盤移布的速度（px/s）與跟手的程度 */
const KEY_SPEED = 130
const KEY_GRIP = 12

/** 粉土線：頭一小段直的，很快就彎起來（旗袍的弧線） */
function lineX(s: number) {
  const k = Math.min(1, Math.max(0, (s - 24) / 100))
  return k * (46 * Math.sin(s * 0.0105) + 18 * Math.sin(s * 0.027 + 1.3))
}

function click(fast: boolean) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'square'
  o.frequency.setValueAtTime(fast ? 1400 : 1100, t)
  o.frequency.exponentialRampToValueAtTime(300, t + 0.02)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + 0.04)
}

export default function SewGame({ params, done }: MinigameProps<SewParams, SewResult | null>) {
  const target = params?.target ?? 34
  const LIMIT = limitFor(target)
  const canvas = useRef<HTMLCanvasElement>(null)
  const st = useRef({
    feed: 0,
    speed: 0,
    off: 0,
    vel: 0,
    pedal: false,
    left: false,
    right: false,
    stitches: [] as { s: number; x: number; good: boolean }[],
    nextStitch: STEP,
    t0: performance.now(),
    over: false,
    drag: null as { id: number; x: number } | null,
  })
  const [hud, setHud] = useState({ n: 0, good: 0, left: LIMIT })
  const [end, setEnd] = useState<null | 'ok' | 'late' | 'crooked'>(null)
  const finished = useRef(false)
  const finish = (r: SewResult | null) => {
    if (finished.current) return
    finished.current = true
    done(r)
  }

  // 鍵盤
  useEffect(() => {
    const set = (e: KeyboardEvent, on: boolean) => {
      const k = e.key.toLowerCase()
      const s = st.current
      if (k === ' ' || k === 'arrowup' || k === 'w') s.pedal = on
      else if (k === 'arrowleft' || k === 'a') s.left = on
      else if (k === 'arrowright' || k === 'd') s.right = on
      else if (k === 'escape' && on) finish(null)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    const down = (e: KeyboardEvent) => set(e, true)
    const up = (e: KeyboardEvent) => set(e, false)
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 主迴圈
  useEffect(() => {
    // 手感測試（dev）：機器人讀布走到哪裡
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__sew = st.current
    const cv = canvas.current!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = W * dpr
    cv.height = H * dpr
    const ctx = cv.getContext('2d')!
    ctx.scale(dpr, dpr)
    let raf = 0
    let last = performance.now()
    const cx = W / 2
    const draw = (t: number) => {
      const s = st.current
      ctx.clearRect(0, 0, W, H)
      // 布：紅色的緞，隱隱的花紋，跟著 feed 往下走
      const g = ctx.createLinearGradient(0, 0, W, 0)
      g.addColorStop(0, '#8e1820')
      g.addColorStop(0.5, '#b8242c')
      g.addColorStop(1, '#8e1820')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(255,210,140,0.08)'
      for (let i = -2; i < 12; i++) {
        const y = ((((i * 44 - s.feed) % 440) + 440) % 440) - 20
        for (let j = 0; j < 6; j++) {
          ctx.beginPath()
          ctx.arc(((j * 61 + i * 23 + s.off) % (W + 40)) - 20, y, 9, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      // 粉土線：針下面是還沒車到的（看得到前面怎麼彎），布往上走
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.setLineDash([7, 6])
      ctx.lineWidth = 2.2
      ctx.beginPath()
      for (let y = NEEDLE_Y - 12; y <= H + 10; y += 6) {
        const fs = s.feed + (y - NEEDLE_Y)
        const x = cx + lineX(fs) + s.off
        if (y === NEEDLE_Y - 12) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      // 已經車過的粉土線（淡淡的，往上走到機頭下面）
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.beginPath()
      for (let y = NEEDLE_Y; y >= -10; y -= 6) {
        const fs = s.feed - (NEEDLE_Y - y)
        const x = cx + lineX(fs) + s.off
        if (y === NEEDLE_Y) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
      // 針腳
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      for (let i = s.stitches.length - 1; i >= 0; i--) {
        const k = s.stitches[i]
        const y = NEEDLE_Y - (s.feed - k.s)
        if (y < -10) break
        const x = cx + k.x + s.off
        ctx.strokeStyle = k.good ? '#f6d57a' : '#2a1010'
        ctx.beginPath()
        ctx.moveTo(x, y - 4)
        ctx.lineTo(x, y + 4)
        ctx.stroke()
      }
      // 壓布腳＋針
      const bob = s.speed > 5 ? Math.sin(s.feed * 0.52) * 5 : 0
      ctx.fillStyle = 'rgba(40,40,46,0.9)'
      ctx.fillRect(cx - 16, NEEDLE_Y - 4, 32, 10)
      ctx.fillStyle = '#c8ccd0'
      ctx.fillRect(cx - 1.5, NEEDLE_Y - 64 + bob, 3, 62)
      ctx.fillStyle = '#1c1c20'
      ctx.fillRect(cx - 22, 0, 44, NEEDLE_Y - 58 + bob)
      ctx.fillStyle = '#c8a050'
      ctx.fillRect(cx - 22, NEEDLE_Y - 66 + bob, 44, 3)
      // 對準的提示：針下面的粉土線離多遠
      const err = Math.abs(lineX(s.feed) + s.off)
      ctx.fillStyle = err < GOOD ? 'rgba(140,255,170,0.9)' : err < GOOD * 2.2 ? 'rgba(255,220,120,0.9)' : 'rgba(255,120,110,0.9)'
      ctx.beginPath()
      ctx.arc(cx, NEEDLE_Y + 18, 4, 0, Math.PI * 2)
      ctx.fill()
      void t
    }
    const tick = (now: number) => {
      // 第一幀的 rAF 時間可能比 performance.now() 早一點：不要讓 dt 變負的
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      const s = st.current
      if (!s.over) {
        // 踏板：按住越踩越快，放開慢慢停
        s.speed += ((s.pedal ? MAX_SPEED : 0) - s.speed) * Math.min(1, dt * (s.pedal ? 2.2 : 5))
        // 移布（鍵盤）：有一點慣性
        const want = (s.right ? 1 : 0) - (s.left ? 1 : 0)
        s.vel += (want * KEY_SPEED - s.vel) * Math.min(1, dt * KEY_GRIP)
        s.off = Math.max(-150, Math.min(150, s.off + s.vel * dt))
        s.feed += s.speed * dt
        while (s.feed >= s.nextStitch) {
          const x = -s.off
          const good = Math.abs(lineX(s.nextStitch) - x) < GOOD
          s.stitches.push({ s: s.nextStitch, x, good })
          s.nextStitch += STEP
          click(s.speed > 100)
        }
        const n = s.stitches.length
        const goodN = s.stitches.filter((k) => k.good).length
        const left = Math.max(0, LIMIT - (now - s.t0) / 1000)
        setHud((p) => (p.n === n && p.good === goodN && Math.ceil(p.left) === Math.ceil(left) ? p : { n, good: goodN, left }))
        if (n >= target) {
          s.over = true
          s.speed = 0
          // 踩完了，但歪太多：拆掉重來
          const ok = goodN / n >= SEW_PASS
          setEnd(ok ? 'ok' : 'crooked')
          if (ok) audio.chime()
          window.setTimeout(() => finish({ done: ok, accuracy: goodN / n }), 1300)
        } else if (left <= 0) {
          s.over = true
          s.speed = 0
          setEnd('late')
          window.setTimeout(() => finish({ done: false, accuracy: n ? goodN / n : 0 }), 1300)
        }
      }
      draw(now)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 手指在布上左右拖
  const onDown = (e: React.PointerEvent) => {
    st.current.drag = { id: e.pointerId, x: e.clientX }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = st.current.drag
    if (!d || d.id !== e.pointerId) return
    const rect = canvas.current!.getBoundingClientRect()
    const k = W / rect.width
    st.current.off = Math.max(-150, Math.min(150, st.current.off + (e.clientX - d.x) * k))
    d.x = e.clientX
  }
  const onUp = (e: React.PointerEvent) => {
    if (st.current.drag?.id === e.pointerId) st.current.drag = null
  }
  const pedal = (on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault()
    st.current.pedal = on
  }

  const pct = Math.min(1, hud.n / target)
  const acc = hud.n ? Math.round((hud.good / hud.n) * 100) : 100
  const pass = Math.round(SEW_PASS * 100)
  return (
    <div className="sew-panel" role="dialog" aria-label="踩裁縫車">
      <div className="sew-head">
        <div className="sew-title">踩裁縫車</div>
        <div className={`sew-time ${hud.left < Math.max(3, LIMIT * 0.3) ? 'low' : ''}`}>{Math.ceil(hud.left)}</div>
        <button className="sew-x" onClick={() => finish(null)} aria-label="不做了">
          ✕
        </button>
      </div>
      <div className="sew-bar">
        <i style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="sew-stats">
        <span>
          {hud.n} / {target} 針
        </span>
        <span className={acc < pass ? 'low' : ''}>
          在線上 {acc}%（要 {pass}%）
        </span>
      </div>
      <div className="sew-cloth">
        <canvas ref={canvas} className="sew-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        {end && <div className={`sew-end ${end}`}>{end === 'ok' ? '好了！' : end === 'crooked' ? '歪掉了……拆掉重來' : '來不及了……'}</div>}
      </div>
      <div className="sew-foot">
        <button className="sew-pedal" onPointerDown={pedal(true)} onPointerUp={pedal(false)} onPointerLeave={pedal(false)} onPointerCancel={pedal(false)}>
          踩
        </button>
        <div className="sew-hint">按住「踩」（空白鍵）車布；手指或滑鼠在布上左右拖（或 ←→），讓針走在粉土線上。彎的地方少踩一點。</div>
      </div>
    </div>
  )
}
