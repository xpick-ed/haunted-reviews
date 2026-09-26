import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { audio } from '../../audio'
import { MELODY, opera, schedulePhrase } from './rhythm.sound'
import type { MinigameProps, RhythmResult } from './types'
import './rhythm.css'

// 歌仔戲・後場鑼鼓（廟埕野台戲，DESIGN §26.1）：打鼓的阿明喝醉了，阿嬤上後場幫忙。
// 三條軌道（鑼／鼓／鈸），音符從上面落到打擊線，對準拍子敲下去。
// 殼仔弦的七字調一直在走（合成），打中的樂器才會響。約 45 秒。
// 準確度 = 每個音符的分數平均（讚 1、好 0.7、還可以 0.4、漏拍 0）。

const BPM = 96
const BEAT = 60 / BPM
/** 開場先數四拍（板） */
const COUNT_IN = 4
/** 判定窗（秒） */
const WIN = { perfect: 0.06, good: 0.12, ok: 0.18 }
/** 音符從出現到打擊線的時間（秒） */
const LEAD = 1.7

type Lane = 0 | 1 | 2
const LANES = [
  { name: '鑼', key: 'J', color: '#f2c14e', dark: '#8a5a12' },
  { name: '鼓', key: 'K', color: '#e8563a', dark: '#6e1a10' },
  { name: '鈸', key: 'L', color: '#8fd6e8', dark: '#1c5a6a' },
] as const
const KEYS: Record<string, Lane> = { j: 0, a: 0, arrowleft: 0, k: 1, s: 1, arrowdown: 1, ' ': 1, l: 2, d: 2, arrowright: 2 }

type Grade = 'perfect' | 'good' | 'ok' | 'miss'
const GRADE: Record<Grade, { text: string; score: number; color: string }> = {
  perfect: { text: '讚！', score: 1, color: '#ffe27a' },
  good: { text: '好！', score: 0.7, color: '#bff8ee' },
  ok: { text: '還可以', score: 0.4, color: '#e8d8c0' },
  miss: { text: '漏拍', score: 0, color: '#ff8a7a' },
}

interface Note {
  lane: Lane
  /** 第幾拍（從開場數完之後算） */
  beat: number
  grade: Grade | null
}

/** 每一句（8 拍）的鑼鼓：由簡單到熱鬧，最後一句收尾 */
const PATTERNS: { gong: number[]; drum: number[]; cym: number[] }[] = [
  { drum: [0, 2, 4, 6], cym: [], gong: [7] },
  { drum: [0, 2, 4, 6], cym: [1, 3, 5], gong: [7] },
  { drum: [0, 1, 2, 4, 5, 6], cym: [3], gong: [7] },
  { drum: [0, 2, 3.5, 4, 6], cym: [1, 5], gong: [7] },
  { drum: [0, 0.5, 1, 2, 4, 4.5, 5, 6], cym: [3], gong: [7] },
  { drum: [0, 2, 4, 6], cym: [1, 3, 5, 7], gong: [0] },
  { drum: [0, 0.5, 1, 1.5, 2, 4, 4.5, 5, 5.5, 6], cym: [], gong: [3, 7] },
  { drum: [0, 1, 2, 3], cym: [4, 5], gong: [6, 7] },
]

function buildChart(): Note[] {
  const notes: Note[] = []
  PATTERNS.forEach((p, i) => {
    const b0 = i * 8
    for (const b of p.gong) notes.push({ lane: 0, beat: b0 + b, grade: null })
    for (const b of p.drum) notes.push({ lane: 1, beat: b0 + b, grade: null })
    for (const b of p.cym) notes.push({ lane: 2, beat: b0 + b, grade: null })
  })
  return notes.sort((a, b) => a.beat - b.beat)
}

const TOTAL_BEATS = PATTERNS.length * 8

/** 遊戲時鐘：有 AudioContext 就跟音樂對齊，沒有就用畫面時間 */
function clock() {
  return audio.ctx ? audio.ctx.currentTime : performance.now() / 1000
}

function hitSound(lane: Lane, vol = 1) {
  const t = clock()
  if (lane === 0) opera.gong(t, 0.55 * vol)
  else if (lane === 1) opera.drum(t, 0.75 * vol)
  else opera.cymbal(t, 0.5 * vol)
}

interface Pop {
  lane: Lane
  grade: Grade
  t: number
}

type Phase = 'intro' | 'play' | 'done'

export default function Rhythm({ done }: MinigameProps<unknown, RhythmResult>) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [combo, setCombo] = useState(0)
  const [acc, setAcc] = useState(1)
  const [final, setFinal] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const g = useRef({
    notes: buildChart(),
    start: 0,
    pops: [] as Pop[],
    press: [0, 0, 0] as number[],
    combo: 0,
    best: 0,
    hype: 0.3,
    over: false,
    scheduled: 0,
  })

  const accuracy = () => {
    const judged = g.current.notes.filter((n) => n.grade)
    if (!judged.length) return 0
    return judged.reduce((a, n) => a + GRADE[n.grade!].score, 0) / g.current.notes.length
  }
  /** 目前打過的音符的平均（顯示用） */
  const runningAcc = () => {
    const judged = g.current.notes.filter((n) => n.grade)
    return judged.length ? judged.reduce((a, n) => a + GRADE[n.grade!].score, 0) / judged.length : 1
  }

  const begin = () => {
    audio.init()
    const s = g.current
    s.start = clock() + 0.35 + COUNT_IN * BEAT
    s.scheduled = 0
    // 數四拍
    for (let i = 0; i < COUNT_IN; i++) opera.clap(s.start - (COUNT_IN - i) * BEAT, i === COUNT_IN - 1 ? 0.45 : 0.3, opera.sfx)
    setPhase('play')
  }

  const judge = (lane: Lane) => {
    const s = g.current
    const now = clock()
    s.press[lane] = performance.now()
    let best: Note | null = null
    let bestD = Infinity
    for (const n of s.notes) {
      if (n.grade || n.lane !== lane) continue
      const d = Math.abs(s.start + n.beat * BEAT - now)
      if (d < bestD) {
        best = n
        bestD = d
      }
    }
    if (!best || bestD > WIN.ok) {
      // 空敲：一樣會響（小聲），連擊斷掉
      hitSound(lane, 0.45)
      s.combo = 0
      setCombo(0)
      s.hype = Math.max(0, s.hype - 0.03)
      return
    }
    const grade: Grade = bestD <= WIN.perfect ? 'perfect' : bestD <= WIN.good ? 'good' : 'ok'
    best.grade = grade
    hitSound(lane)
    s.pops.push({ lane, grade, t: performance.now() })
    s.combo++
    s.best = Math.max(s.best, s.combo)
    s.hype = Math.min(1, s.hype + (grade === 'perfect' ? 0.05 : 0.03))
    setCombo(s.combo)
    setAcc(runningAcc())
  }

  const finishGame = () => {
    const s = g.current
    if (s.over) return
    s.over = true
    const a = accuracy()
    setFinal(a)
    setPhase('done')
    // 謝幕：一陣鑼鼓
    const t = clock() + 0.1
    opera.drum(t, 0.6)
    opera.drum(t + 0.15, 0.6)
    opera.gong(t + 0.3, 0.6)
    opera.cymbal(t + 0.3, 0.5)
  }

  // 主迴圈：排旋律、判漏拍、畫畫面
  useEffect(() => {
    if (phase !== 'play') return
    let raf = 0
    const loop = () => {
      const s = g.current
      const now = clock()
      // 旋律提早 0.5 秒排進去（一句一句排）
      while (s.scheduled < MELODY.length && s.start + s.scheduled * 8 * BEAT < now + 0.6) {
        const t0 = s.start + s.scheduled * 8 * BEAT
        schedulePhrase(t0, MELODY[s.scheduled], BEAT, 0.09, opera.sfx)
        // 板：每拍輕輕一下，幫忙抓拍子
        for (let b = 0; b < 8; b++) opera.clap(t0 + b * BEAT, b % 4 === 0 ? 0.16 : 0.08, opera.sfx)
        s.scheduled++
      }
      // 漏拍
      let missed = false
      for (const n of s.notes) {
        if (!n.grade && now - (s.start + n.beat * BEAT) > WIN.ok) {
          n.grade = 'miss'
          s.pops.push({ lane: n.lane, grade: 'miss', t: performance.now() })
          missed = true
        }
      }
      if (missed) {
        s.combo = 0
        s.hype = Math.max(0, s.hype - 0.06)
        setCombo(0)
        setAcc(runningAcc())
      }
      draw()
      if (now > s.start + TOTAL_BEATS * BEAT + 1.2) finishGame()
      if (!s.over) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // 鍵盤
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        e.stopPropagation()
        done({ accuracy: phase === 'done' ? final : 0 })
        return
      }
      if (phase === 'intro' && (k === 'e' || k === 'enter' || k === ' ')) {
        e.preventDefault()
        e.stopPropagation()
        begin()
        return
      }
      if (phase === 'done' && (k === 'e' || k === 'enter' || k === ' ')) {
        e.preventDefault()
        e.stopPropagation()
        done({ accuracy: final })
        return
      }
      if (phase !== 'play' || e.repeat) return
      const lane = KEYS[k]
      if (lane === undefined) return
      e.preventDefault()
      e.stopPropagation()
      judge(lane)
    }
    window.addEventListener('keydown', down, true)
    return () => window.removeEventListener('keydown', down, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, final])

  // 畫布大小跟著容器
  useEffect(() => {
    const c = canvas.current
    const w = wrap.current
    if (!c || !w) return
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = w.clientWidth
      const ch = Math.min(Math.round(cw * 1.15), Math.round(window.innerHeight * 0.58))
      c.width = Math.round(cw * dpr)
      c.height = Math.round(ch * dpr)
      c.style.width = `${cw}px`
      c.style.height = `${ch}px`
      draw()
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function draw() {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const s = g.current
    const now = s.start ? clock() : 0
    const u = W / 100
    // 背景：戲台紅幕
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#2a0a0c')
    bg.addColorStop(0.55, '#4a1216')
    bg.addColorStop(1, '#1a0808')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    // 幕的直紋
    ctx.globalAlpha = 0.18
    for (let x = 0; x < W; x += 7 * u) {
      ctx.fillStyle = '#000'
      ctx.fillRect(x, 0, 2.2 * u, H)
    }
    ctx.globalAlpha = 1
    // 上方的彩燈
    for (let i = 0; i < 14; i++) {
      const x = (i + 0.5) * (W / 14)
      const on = Math.floor(performance.now() / 220 + i) % 3
      ctx.fillStyle = ['#ff5a7a', '#ffd45a', '#5ae0ff'][on]
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.arc(x, 2.6 * u, 1.3 * u, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    const laneW = W / 3
    const hitY = H - 17 * u
    const top = 7 * u
    const speed = (hitY - top) / LEAD
    // 軌道
    for (let l = 0; l < 3; l++) {
      const x0 = l * laneW
      const pressed = performance.now() - s.press[l] < 120
      const lg = ctx.createLinearGradient(0, top, 0, hitY)
      lg.addColorStop(0, 'rgba(255,255,255,0)')
      lg.addColorStop(1, pressed ? `${LANES[l].color}55` : 'rgba(255,255,255,0.06)')
      ctx.fillStyle = lg
      ctx.fillRect(x0 + 1.2 * u, top, laneW - 2.4 * u, hitY - top)
      ctx.strokeStyle = 'rgba(255,220,160,0.12)'
      ctx.lineWidth = 0.4 * u
      ctx.beginPath()
      ctx.moveTo(x0 + laneW, top)
      ctx.lineTo(x0 + laneW, H)
      if (l < 2) ctx.stroke()
    }
    // 拍線（每一拍一條淡線，四拍一條亮一點）
    if (s.start) {
      const b0 = Math.ceil((now - s.start) / BEAT)
      for (let b = b0; b < b0 + Math.ceil(LEAD / BEAT) + 1; b++) {
        const y = hitY - (s.start + b * BEAT - now) * speed
        if (y < top || y > hitY) continue
        ctx.strokeStyle = b % 4 === 0 ? 'rgba(255,220,160,0.22)' : 'rgba(255,220,160,0.08)'
        ctx.lineWidth = (b % 4 === 0 ? 0.5 : 0.3) * u
        ctx.beginPath()
        ctx.moveTo(1.5 * u, y)
        ctx.lineTo(W - 1.5 * u, y)
        ctx.stroke()
      }
    }
    // 打擊線
    ctx.strokeStyle = 'rgba(255,226,122,0.9)'
    ctx.lineWidth = 0.8 * u
    ctx.shadowColor = '#ffcf5a'
    ctx.shadowBlur = 3 * u
    ctx.beginPath()
    ctx.moveTo(1.5 * u, hitY)
    ctx.lineTo(W - 1.5 * u, hitY)
    ctx.stroke()
    ctx.shadowBlur = 0
    // 音符
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const n of s.notes) {
      if (n.grade && n.grade !== 'miss') continue
      const t = s.start + n.beat * BEAT
      const y = hitY - (t - now) * speed
      if (y < top - 6 * u || y > H + 6 * u) continue
      const cx = (n.lane + 0.5) * laneW
      const r = 6.2 * u
      ctx.globalAlpha = n.grade === 'miss' ? 0.3 : 1
      const lane = LANES[n.lane]
      const rg = ctx.createRadialGradient(cx - r * 0.3, y - r * 0.3, r * 0.1, cx, y, r)
      rg.addColorStop(0, '#fff8e0')
      rg.addColorStop(0.35, lane.color)
      rg.addColorStop(1, lane.dark)
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.arc(cx, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(40,10,4,0.8)'
      ctx.lineWidth = 0.6 * u
      ctx.stroke()
      ctx.fillStyle = '#2a0a04'
      ctx.font = `700 ${5.4 * u}px "LXGW WenKai TC", "Noto Serif TC", serif`
      ctx.fillText(lane.name, cx, y + 0.3 * u)
      ctx.globalAlpha = 1
    }
    // 下面的樂器（打擊墊）
    for (let l = 0; l < 3; l++) {
      const cx = (l + 0.5) * laneW
      const cy = hitY + 8.5 * u
      const pressed = performance.now() - s.press[l] < 120
      const k = pressed ? 0.92 : 1
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(k, k)
      drawInstrument(ctx, l as Lane, u)
      ctx.restore()
      ctx.fillStyle = 'rgba(255,240,210,0.55)'
      ctx.font = `600 ${3 * u}px "Noto Sans TC", sans-serif`
      ctx.fillText(LANES[l].key, cx + 10 * u, cy + 4.5 * u)
    }
    // 判定字
    const tNow = performance.now()
    s.pops = s.pops.filter((p) => tNow - p.t < 650)
    for (const p of s.pops) {
      const k = (tNow - p.t) / 650
      const info = GRADE[p.grade]
      ctx.globalAlpha = 1 - k
      ctx.fillStyle = info.color
      ctx.font = `800 ${(p.grade === 'perfect' ? 7 : 5.6) * u * (1 + (1 - k) * 0.15)}px "LXGW WenKai TC", "Noto Serif TC", serif`
      ctx.strokeStyle = 'rgba(30,6,4,0.8)'
      ctx.lineWidth = 0.9 * u
      const x = (p.lane + 0.5) * laneW
      const y = hitY - 12 * u - k * 8 * u
      ctx.strokeText(info.text, x, y)
      ctx.fillText(info.text, x, y)
    }
    ctx.globalAlpha = 1
    // 台下的反應（左上角）
    const hype = s.hype
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(2 * u, 5.5 * u, 30 * u, 3 * u)
    const hg = ctx.createLinearGradient(2 * u, 0, 32 * u, 0)
    hg.addColorStop(0, '#ff8a5a')
    hg.addColorStop(1, '#ffe27a')
    ctx.fillStyle = hg
    ctx.fillRect(2 * u, 5.5 * u, 30 * u * hype, 3 * u)
    ctx.fillStyle = 'rgba(255,240,210,0.8)'
    ctx.font = `600 ${2.6 * u}px "Noto Sans TC", sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('台下反應', 33.5 * u, 7.1 * u)
    // 數拍子
    if (s.start && now < s.start) {
      const n = Math.ceil((s.start - now) / BEAT)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffe27a'
      ctx.font = `800 ${16 * u}px "LXGW WenKai TC", "Noto Serif TC", serif`
      ctx.fillText(n > 0 ? String(n) : '開！', W / 2, H * 0.42)
    }
  }

  const onPad = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'play') return
    const r = e.currentTarget.getBoundingClientRect()
    const lane = Math.max(0, Math.min(2, Math.floor(((e.clientX - r.left) / r.width) * 3))) as Lane
    judge(lane)
  }

  const grade = final >= 0.85 ? '滿堂彩！' : final >= 0.6 ? '有模有樣' : final >= 0.3 ? '勉強撐住' : '拍子亂了……'
  const merit = final >= 0.85 ? 3 : final >= 0.6 ? 2 : final >= 0.3 ? 1 : 0

  return (
    <div className="rg-card" onPointerDown={(e) => e.stopPropagation()}>
      <button className="rg-leave" onClick={() => done({ accuracy: phase === 'done' ? final : 0 })}>
        離開
      </button>
      <div className="rg-head">
        <span className="rg-title">🥁 後場・鑼鼓</span>
        <span className="rg-stat">
          連擊 <b>{combo}</b>
        </span>
        <span className="rg-stat">
          準確 <b>{Math.round(acc * 100)}</b>%
        </span>
      </div>
      <div className="rg-stage" ref={wrap}>
        <canvas ref={canvas} className="rg-canvas" onPointerDown={onPad} />
        {phase === 'intro' && (
          <div className="rg-overlay">
            <p className="rg-story">打鼓的阿明喝醉了……今晚的鑼鼓，阿嬤來打！</p>
            <p>
              音符落到<b>金線</b>時，敲對應的樂器：
              <br />
              <span className="rg-chip gong">鑼</span>
              <span className="rg-chip drum">鼓</span>
              <span className="rg-chip cym">鈸</span>
            </p>
            <p className="muted">手機：點下面三個樂器　電腦：J K L（或 A S D）</p>
            <button className="btn primary big" onClick={begin}>
              開鑼！
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="rg-overlay">
            <div className="rg-grade">{grade}</div>
            <div className="rg-result">
              準確度 <b>{Math.round(final * 100)}</b>%　最高連擊 <b>{g.current.best}</b>
            </div>
            {merit > 0 && <div className="rg-merit">功德 +{merit}</div>}
            <button className="btn primary big" onClick={() => done({ accuracy: final })}>
              謝幕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** 打擊墊：鑼（掛著的銅盤）、鼓（紅色堂鼓）、鈸（兩片） */
function drawInstrument(ctx: CanvasRenderingContext2D, lane: Lane, u: number) {
  if (lane === 0) {
    ctx.strokeStyle = '#6a4a2a'
    ctx.lineWidth = 0.6 * u
    ctx.beginPath()
    ctx.moveTo(-5 * u, -6.5 * u)
    ctx.lineTo(0, -5.2 * u)
    ctx.lineTo(5 * u, -6.5 * u)
    ctx.stroke()
    const gg = ctx.createRadialGradient(-1.5 * u, -1.5 * u, 0.5 * u, 0, 0, 5.5 * u)
    gg.addColorStop(0, '#fff2b0')
    gg.addColorStop(0.5, '#e0a83a')
    gg.addColorStop(1, '#7a5212')
    ctx.fillStyle = gg
    ctx.beginPath()
    ctx.arc(0, 0, 5.3 * u, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#5a3a0a'
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, 1.8 * u, 0, Math.PI * 2)
    ctx.stroke()
  } else if (lane === 1) {
    ctx.fillStyle = '#5a2a14'
    ctx.fillRect(-6 * u, -1 * u, 12 * u, 5 * u)
    const dg = ctx.createRadialGradient(-1.5 * u, -2.2 * u, 0.5 * u, 0, -1 * u, 6.5 * u)
    dg.addColorStop(0, '#fbf1dc')
    dg.addColorStop(1, '#c8b08a')
    ctx.fillStyle = dg
    ctx.beginPath()
    ctx.ellipse(0, -1 * u, 6 * u, 2.6 * u, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c8302a'
    ctx.fillRect(-6 * u, 0.2 * u, 12 * u, 1.4 * u)
    ctx.fillStyle = '#e8c066'
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.arc(i * 2.4 * u, 0.9 * u, 0.4 * u, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    for (const s of [-1, 1]) {
      const cg = ctx.createRadialGradient(s * 2.4 * u - u, -1 * u, 0.3 * u, s * 2.4 * u, 0, 4.2 * u)
      cg.addColorStop(0, '#fff6d0')
      cg.addColorStop(0.6, '#c9a24a')
      cg.addColorStop(1, '#6a5018')
      ctx.fillStyle = cg
      ctx.beginPath()
      ctx.ellipse(s * 2.4 * u, 0, 4.2 * u, 3.2 * u, s * 0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#5a4010'
      ctx.beginPath()
      ctx.arc(s * 2.4 * u, 0, 0.9 * u, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
