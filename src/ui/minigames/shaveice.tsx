import { useEffect, useRef, useState } from 'react'
import type { MinigameProps, ShaveIceResult } from './types'
import { osSfx } from './oldstreet.sound'
import './shaveice.css'

// 冰果室剉冰（老街・阿桃）：好兄弟排隊點冰。按住剉冰（冰要剛好在綠色那段）、照順序加配料、上桌。
// 做錯客人會等不及；60 秒內做對幾碗 → 功德（1–2 碗 1、3–4 碗 2、5 碗以上 3）。

const TIME = 60
const FILL_OK: [number, number] = [0.62, 1.0]
const FILL_RATE = 0.5

type Topping = 'bean' | 'mango' | 'milk' | 'pearl' | 'taro'
const TOPS: { id: Topping; name: string; color: string; key: string }[] = [
  { id: 'bean', name: '紅豆', color: '#7a2a22', key: '1' },
  { id: 'mango', name: '芒果', color: '#f2a22a', key: '2' },
  { id: 'milk', name: '煉乳', color: '#f4efe0', key: '3' },
  { id: 'pearl', name: '粉圓', color: '#2a2220', key: '4' },
  { id: 'taro', name: '芋圓', color: '#b48ac8', key: '5' },
]
const TOP = Object.fromEntries(TOPS.map((t) => [t.id, t])) as Record<Topping, (typeof TOPS)[number]>

const NAMES = ['阿兵哥', '小學生', '賣菜阿婆', '老師', '新娘', '討海人', '車掌小姐', '戲班小生', '收驚阿伯', '郵差']

interface Customer {
  id: number
  name: string
  hue: number
  order: Topping[]
  patience: number
  left: number
  mood: 'wait' | 'happy' | 'sad'
  gone: number
}

type Phase = 'intro' | 'play' | 'done'

const meritFor = (n: number) => (n >= 5 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0)
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

interface Flake {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export default function ShaveIce({ done }: MinigameProps<unknown, ShaveIceResult>) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [left, setLeft] = useState(TIME)
  const [served, setServed] = useState(0)
  const [queue, setQueue] = useState<Customer[]>([])
  const [tops, setTops] = useState<Topping[]>([])
  const [fill, setFill] = useState(0)
  const [toast, setToast] = useState<{ text: string; good: boolean; id: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const g = useRef({
    t: 0,
    fill: 0,
    tops: [] as Topping[],
    holding: false,
    wheel: 0,
    flakes: [] as Flake[],
    spill: 0,
    queue: [] as Customer[],
    nextId: 1,
    spawnT: 0,
    served: 0,
    over: false,
    shake: 0,
  })

  const finish = () => {
    osSfx.grindStop()
    const n = g.current.served
    done({ served: n, merit: meritFor(n) })
  }

  const say = (text: string, good: boolean) => setToast({ text, good, id: Math.random() })

  // 客人：一開始點簡單的，做越多越難
  const newCustomer = (): Customer => {
    const s = g.current
    const n = s.served
    const count = n < 2 ? 1 + (Math.random() < 0.3 ? 1 : 0) : n < 4 ? 2 : 2 + (Math.random() < 0.5 ? 1 : 0)
    const pool = [...TOPS.map((t) => t.id)]
    const order: Topping[] = []
    while (order.length < count) order.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    const patience = 15 + Math.random() * 5 - Math.min(4, n * 0.5)
    return { id: s.nextId++, name: NAMES[Math.floor(Math.random() * NAMES.length)], hue: Math.floor(Math.random() * 360), order, patience, left: patience, mood: 'wait', gone: 0 }
  }

  const syncQueue = () => setQueue(g.current.queue.map((c) => ({ ...c })))

  const resetBowl = () => {
    g.current.fill = 0
    g.current.tops = []
    g.current.spill = 0
    setFill(0)
    setTops([])
  }

  const addTop = (id: Topping) => {
    const s = g.current
    if (phase !== 'play' || s.over) return
    if (s.fill < 0.3) {
      osSfx.buzz()
      say('先剉冰啦！', false)
      return
    }
    if (s.tops.length >= 4) return
    s.tops = [...s.tops, id]
    setTops(s.tops)
    if (id === 'milk') osSfx.drizzle()
    else osSfx.plop(0.8 + s.tops.length * 0.15)
  }

  const serve = () => {
    const s = g.current
    if (phase !== 'play' || s.over) return
    const c = s.queue.find((q) => q.mood === 'wait')
    if (!c) return
    if (s.fill < 0.3) {
      osSfx.buzz()
      say('碗是空的！', false)
      return
    }
    let err: string | null = null
    if (s.fill > FILL_OK[1]) err = '冰太滿，灑得到處都是！'
    else if (s.fill < FILL_OK[0]) err = '冰太少了啦～'
    else if (s.tops.length !== c.order.length || s.tops.some((t, i) => t !== c.order[i])) {
      const sameSet = s.tops.length === c.order.length && c.order.every((t) => s.tops.includes(t))
      err = sameSet ? '順序不對！' : '我點的不是這個……'
    }
    if (err) {
      osSfx.buzz()
      say(err, false)
      c.left = Math.max(0.5, c.left - 5)
      s.shake = 0.3
      resetBowl()
      syncQueue()
      return
    }
    osSfx.ding()
    c.mood = 'happy'
    c.gone = 1.1
    s.served++
    setServed(s.served)
    say(['好吃！', '讚啦！', '就是這個味道！', '阿桃的冰最讚！'][Math.floor(Math.random() * 4)], true)
    resetBowl()
    syncQueue()
  }

  const dump = () => {
    if (phase !== 'play') return
    osSfx.whoosh()
    resetBowl()
  }

  const setHold = (on: boolean) => {
    const s = g.current
    if (phase !== 'play' || s.over) on = false
    if (on === s.holding) return
    s.holding = on
    if (on) osSfx.grindStart()
    else osSfx.grindStop()
  }

  // 開始：先來三個客人
  useEffect(() => {
    if (phase !== 'play') return
    const s = g.current
    s.queue = [newCustomer(), newCustomer()]
    syncQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // 主迴圈
  useEffect(() => {
    if (phase !== 'play') return
    let raf = 0
    let last = performance.now()
    let sec = TIME
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      step(dt)
      draw()
      const s = g.current
      const l = Math.max(0, TIME - s.t)
      if (Math.ceil(l) !== sec) {
        sec = Math.ceil(l)
        setLeft(sec)
      }
      if (l <= 0 && !s.over) {
        s.over = true
        setHold(false)
        setPhase('done')
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // 結束時停掉磨冰聲
  useEffect(() => () => osSfx.grindStop(), [])

  const step = (dt: number) => {
    const s = g.current
    s.t += dt
    s.shake = Math.max(0, s.shake - dt)
    if (s.holding) {
      s.fill = Math.min(1.25, s.fill + FILL_RATE * dt)
      s.wheel += dt * 9
      for (let i = 0; i < 3; i++) s.flakes.push({ x: 0.5 + (Math.random() - 0.5) * 0.05, y: 0.36, vx: (Math.random() - 0.5) * 0.25, vy: 0.2 + Math.random() * 0.4, life: 0.5 })
      if (s.fill > 1.02) s.spill = Math.min(1, s.spill + dt * 0.8)
      setFill(s.fill)
    }
    s.flakes = s.flakes.filter((f) => {
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.vy += 1.2 * dt
      f.life -= dt
      return f.life > 0
    })
    // 客人等不及就走了；笑著的、生氣的都會飄走
    let changed = false
    for (const c of s.queue) {
      if (c.mood === 'wait') {
        c.left -= dt
        if (c.left <= 0) {
          c.mood = 'sad'
          c.gone = 1.1
          osSfx.whoosh()
          say(`${c.name}等不及，飄走了……`, false)
          changed = true
        }
      } else {
        c.gone -= dt
        if (c.gone <= 0) changed = true
      }
    }
    const before = s.queue.length
    s.queue = s.queue.filter((c) => c.mood === 'wait' || c.gone > 0)
    if (s.queue.length !== before) changed = true
    s.spawnT -= dt
    if (s.queue.filter((c) => c.mood === 'wait').length < 3 && s.spawnT <= 0) {
      s.queue.push(newCustomer())
      s.spawnT = 2.5 + Math.random() * 2
      changed = true
    }
    if (changed || Math.floor(s.t * 4) !== Math.floor((s.t - dt) * 4)) syncQueue()
  }

  // 畫布：鑄鐵剉冰機、碗、冰山、配料、飛散的冰屑
  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const s = g.current
    ctx.save()
    if (s.shake > 0 && !reduceMotion) ctx.translate((Math.random() - 0.5) * 8 * s.shake, 0)
    // 背景：冰果室的磁磚牆＋木頭櫃台
    ctx.fillStyle = '#f2dcd4'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(180,140,130,0.35)'
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += W / 14) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H * 0.72)
      ctx.stroke()
    }
    for (let y = 0; y < H * 0.72; y += W / 14) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    const counterY = H * 0.72
    const grad = ctx.createLinearGradient(0, counterY, 0, H)
    grad.addColorStop(0, '#8a5a34')
    grad.addColorStop(1, '#5a3a22')
    ctx.fillStyle = grad
    ctx.fillRect(0, counterY, W, H - counterY)
    // 灑出來的冰
    if (s.spill > 0) {
      ctx.fillStyle = `rgba(250,252,255,${0.4 + s.spill * 0.5})`
      ctx.beginPath()
      ctx.ellipse(W * 0.5, counterY + 6, W * (0.14 + s.spill * 0.12), 8 + s.spill * 6, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // 剉冰機（藍色鑄鐵）
    const mx = W * 0.5
    const iron = '#2f5a8a'
    ctx.fillStyle = iron
    ctx.fillRect(mx - W * 0.2, H * 0.08, W * 0.06, H * 0.64)
    ctx.fillRect(mx - W * 0.2, H * 0.08, W * 0.36, H * 0.07)
    ctx.fillRect(mx - W * 0.22, counterY - H * 0.04, W * 0.44, H * 0.04)
    // 冰塊
    ctx.fillStyle = 'rgba(214,240,255,0.9)'
    ctx.fillRect(mx - W * 0.05, H * 0.15, W * 0.1, H * 0.12)
    ctx.strokeStyle = 'rgba(160,200,230,0.9)'
    ctx.strokeRect(mx - W * 0.05, H * 0.15, W * 0.1, H * 0.12)
    // 轉輪
    ctx.save()
    ctx.translate(mx + W * 0.13, H * 0.115)
    ctx.rotate(s.wheel)
    ctx.strokeStyle = iron
    ctx.lineWidth = Math.max(3, W * 0.008)
    ctx.beginPath()
    ctx.arc(0, 0, H * 0.09, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI / 3)
      ctx.beginPath()
      ctx.moveTo(-H * 0.09, 0)
      ctx.lineTo(H * 0.09, 0)
      ctx.stroke()
    }
    ctx.fillStyle = '#8a5a2a'
    ctx.beginPath()
    ctx.arc(H * 0.09, 0, H * 0.018, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    // 碗
    const bw = W * 0.22
    const by = counterY - H * 0.04
    const bowlTop = by - H * 0.1
    ctx.fillStyle = '#f7f4ec'
    ctx.beginPath()
    ctx.moveTo(mx - bw / 2, bowlTop)
    ctx.quadraticCurveTo(mx - bw / 2 + 4, by, mx - bw * 0.25, by)
    ctx.lineTo(mx + bw * 0.25, by)
    ctx.quadraticCurveTo(mx + bw / 2 - 4, by, mx + bw / 2, bowlTop)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#2e6fb5'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(mx - bw * 0.47, bowlTop + 6)
    ctx.lineTo(mx + bw * 0.47, bowlTop + 6)
    ctx.stroke()
    // 冰山
    const f = Math.min(1.1, s.fill)
    if (f > 0.01) {
      const mh = H * 0.3 * f
      const mw = bw * (0.42 + 0.12 * Math.min(1, f))
      const iceGrad = ctx.createLinearGradient(0, bowlTop - mh, 0, bowlTop)
      iceGrad.addColorStop(0, '#ffffff')
      iceGrad.addColorStop(1, '#dcecf6')
      ctx.fillStyle = iceGrad
      ctx.beginPath()
      ctx.moveTo(mx - mw, bowlTop + 2)
      ctx.quadraticCurveTo(mx - mw * 0.6, bowlTop - mh * 1.2, mx, bowlTop - mh)
      ctx.quadraticCurveTo(mx + mw * 0.6, bowlTop - mh * 1.2, mx + mw, bowlTop + 2)
      ctx.closePath()
      ctx.fill()
      // 配料一層一層
      s.tops.forEach((t, i) => {
        const col = TOP[t].color
        const yTop = bowlTop - mh * (0.95 - i * 0.12)
        if (t === 'milk') {
          ctx.strokeStyle = 'rgba(250,244,220,0.95)'
          ctx.lineWidth = 4
          ctx.beginPath()
          for (let k = -3; k <= 3; k++) {
            const x = mx + k * mw * 0.2
            ctx.moveTo(x, yTop + Math.abs(k) * 3)
            ctx.quadraticCurveTo(x + 6, yTop + 16 + Math.abs(k) * 4, x - 2, yTop + 28 + Math.abs(k) * 5)
          }
          ctx.stroke()
          return
        }
        ctx.fillStyle = col
        const n = 9
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI - Math.PI
          const rx = Math.cos(a) * mw * (0.55 - i * 0.08)
          const ry = Math.sin(a) * mh * 0.35
          const x = mx + rx + ((k * 13) % 7) - 3
          const y = yTop - ry * 0.4 + ((k * 7) % 5)
          if (t === 'mango') ctx.fillRect(x - 5, y - 5, 10, 10)
          else {
            ctx.beginPath()
            ctx.arc(x, y, t === 'bean' ? 4 : 6, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      })
    }
    // 冰屑
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    for (const fl of s.flakes) {
      ctx.globalAlpha = Math.max(0, fl.life * 2)
      ctx.fillRect(fl.x * W, fl.y * H, 3, 3)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // 畫布大小
  useEffect(() => {
    const c = canvas.current
    const w = wrap.current
    if (!c || !w) return
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = w.clientWidth
      const ch = Math.round(cw * 0.5)
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

  // 鍵盤：空白／E 按住剉冰、1–5 配料、Enter 上桌、Backspace 倒掉、Esc 離開
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish()
        return
      }
      if (phase === 'intro' && (k === ' ' || k === 'e' || k === 'enter')) {
        e.preventDefault()
        setPhase('play')
        return
      }
      if (phase === 'done' && (k === ' ' || k === 'e' || k === 'enter')) {
        e.preventDefault()
        finish()
        return
      }
      if (phase !== 'play') return
      if (k === ' ' || k === 'e') {
        e.preventDefault()
        if (!e.repeat) setHold(true)
        return
      }
      const t = TOPS.find((x) => x.key === k)
      if (t) {
        e.preventDefault()
        addTop(t.id)
        return
      }
      if (k === 'enter' || k === 's') {
        e.preventDefault()
        serve()
        return
      }
      if (k === 'backspace' || k === 'x') {
        e.preventDefault()
        dump()
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === ' ' || k === 'e') setHold(false)
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const cur = queue.find((c) => c.mood === 'wait')
  const fillPct = Math.min(100, (fill / 1.25) * 100)
  return (
    <div className="si-card" onPointerDown={(e) => e.stopPropagation()}>
      <div className="si-head">
        <span className="si-title">🍧 阿桃冰果室</span>
        <span className="si-stat">
          做好 <b>{served}</b> 碗
        </span>
        <span className={`si-stat ${left <= 10 && phase === 'play' ? 'hurry' : ''}`}>⏱ {left}s</span>
        <button className="si-close" onClick={finish} aria-label="離開">
          ✕
        </button>
      </div>
      <div className="si-queue">
        {[0, 1, 2].map((i) => {
          const c = queue[i]
          if (!c) return <div key={`e${i}`} className="si-cust empty" />
          return (
            <div key={c.id} className={`si-cust ${c.mood} ${c === cur ? 'now' : ''}`}>
              <div className="si-ghost" style={{ ['--h' as string]: `${c.hue}` }}>
                <i />
                <i />
                <b className="si-mouth" />
              </div>
              <div className="si-name">{c.mood === 'happy' ? '好吃！' : c.mood === 'sad' ? '哼……' : c.name}</div>
              <div className="si-order">
                {c.order.map((t, k) => (
                  <span key={k} className="si-chip" style={{ ['--c' as string]: TOP[t].color }}>
                    {k + 1}.{TOP[t].name}
                  </span>
                ))}
              </div>
              {c.mood === 'wait' && (
                <div className="si-patience">
                  <i style={{ width: `${Math.max(0, (c.left / c.patience) * 100)}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="si-stage" ref={wrap}>
        <canvas ref={canvas} className="si-canvas" />
        {toast && (
          <div key={toast.id} className={`si-toast ${toast.good ? 'good' : 'bad'}`}>
            {toast.text}
          </div>
        )}
        <div className="si-meter" aria-label="冰的份量">
          <div className="si-zone" style={{ left: `${(FILL_OK[0] / 1.25) * 100}%`, width: `${((FILL_OK[1] - FILL_OK[0]) / 1.25) * 100}%` }} />
          <i style={{ width: `${fillPct}%` }} className={fill > FILL_OK[1] ? 'over' : fill >= FILL_OK[0] ? 'ok' : ''} />
        </div>
        {phase === 'intro' && (
          <div className="si-overlay">
            <p>
              晚上的客人都是好兄弟。
              <br />
              <b>按住「剉冰」</b>，冰要剛好停在<b className="g">綠色</b>那段；
              <br />
              再照客人點的<b>順序</b>加配料，<b>上桌</b>！
            </p>
            <p className="si-keys">電腦：空白鍵按住剉冰、1–5 配料、Enter 上桌、Backspace 倒掉</p>
            <button className="btn primary" onClick={() => setPhase('play')}>
              開店！
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="si-overlay">
            <p className="si-big">收攤了！做好 {served} 碗</p>
            <p>{served >= 5 ? '阿桃笑得合不攏嘴：「妳明天還要來喔！」' : served >= 3 ? '好兄弟吃得很開心。' : served >= 1 ? '還可以啦，冰塊比較會融而已。' : '冰全融了……'}</p>
            <p className="si-merit">功德 +{meritFor(served)}</p>
            <button className="btn primary" onClick={finish}>
              收下
            </button>
          </div>
        )}
      </div>
      <div className="si-controls">
        <button
          className={`si-shave ${phase !== 'play' ? 'off' : ''}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setHold(true)
          }}
          onPointerUp={() => setHold(false)}
          onPointerCancel={() => setHold(false)}
          onLostPointerCapture={() => setHold(false)}
        >
          按住剉冰
        </button>
        <div className="si-tops">
          {TOPS.map((t) => (
            <button key={t.id} className="si-top" style={{ ['--c' as string]: t.color }} onClick={() => addTop(t.id)} disabled={phase !== 'play'}>
              <span className="si-dot" />
              {t.name}
              <kbd>{t.key}</kbd>
            </button>
          ))}
        </div>
        <div className="si-actions">
          <button className="si-dump" onClick={dump} disabled={phase !== 'play'}>
            倒掉
          </button>
          <button className="si-serve" onClick={serve} disabled={phase !== 'play'}>
            上桌！
          </button>
        </div>
        <div className="si-bowl-tops">
          碗裡：{tops.length ? tops.map((t) => TOP[t].name).join(' → ') : '（還沒加料）'}
        </div>
      </div>
    </div>
  )
}
