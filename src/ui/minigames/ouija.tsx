import { useEffect, useRef, useState } from 'react'
import { voice } from '../../audio/voice'
import { useStore } from '../../store'
import { line } from '../../world/lines'
import { portraitDataUrl } from '../../art/portraits'
import { makeScrape, ouijaSfx } from './ouija.sound'
import type { MinigameProps, OuijaParams, OuijaResult } from './types'
import './ouija.css'

// 碟仙（DESIGN §26.2）：阿凱在房間開碟仙直播，阿嬤推碟子回答他的問題。
// 每題三個答案：安慰他（comfort）、嚇他（scare）、說出只有鬼才知道的事（secret，要一個字一個字拼）。
// 碟子推起來很重、會抖、慢半拍（鬼的力氣）；停在字上一下下才算。聊天室和觀看人數跟著反應。

type Kind = 'comfort' | 'scare' | 'secret'
type Phase = 'intro' | 'ask' | 'react' | 'done'

interface Answer {
  kind: Kind
  /** 要依序停過的字 */
  chars: string[]
}
interface Question {
  ask: string
  answers: Answer[]
  /** 各種答案之後阿凱的反應（台詞 id） */
  react: Record<Kind, string>
  /** 秘密被說中時聊天室的專屬留言 */
  secretChat: string[]
}

const QUESTIONS: Question[] = [
  {
    ask: 'akai.ouija.q1',
    answers: [
      { kind: 'comfort', chars: ['否'] },
      { kind: 'scare', chars: ['是'] },
      { kind: 'secret', chars: ['床', '下'] },
    ],
    react: { comfort: 'akai.ouija.r1.comfort', scare: 'akai.ouija.r1.scare', secret: 'akai.ouija.r1.secret' },
    secretChat: ['床下？？？', '耳機XDDD', '真的有東西！！', '他剛剛說找一整晚'],
  },
  {
    ask: 'akai.ouija.q2',
    answers: [
      { kind: 'comfort', chars: ['否'] },
      { kind: 'scare', chars: ['是'] },
      { kind: 'secret', chars: ['打', '電', '話'] },
    ],
    react: { comfort: 'akai.ouija.r2.comfort', scare: 'akai.ouija.r2.scare', secret: 'akai.ouija.r2.secret' },
    secretChat: ['碟仙叫你打給媽媽XD', '媽媽在看嗎', '快打啦', '這鬼好像我阿嬤'],
  },
  {
    ask: 'akai.ouija.q3',
    answers: [
      { kind: 'comfort', chars: ['否'] },
      { kind: 'scare', chars: ['是'] },
      { kind: 'secret', chars: ['左', '邊'] },
    ],
    react: { comfort: 'akai.ouija.r3.comfort', scare: 'akai.ouija.r3.scare', secret: 'akai.ouija.r3.secret' },
    secretChat: ['左邊！！！', '不要轉頭', '我看到了', '畫面左邊那是什麼'],
  },
  {
    ask: 'akai.ouija.q4',
    answers: [
      { kind: 'comfort', chars: ['否'] },
      { kind: 'scare', chars: ['是'] },
      { kind: 'secret', chars: ['阿', '翰'] },
    ],
    react: { comfort: 'akai.ouija.r4.comfort', scare: 'akai.ouija.r4.scare', secret: 'akai.ouija.r4.secret' },
    secretChat: ['阿翰是誰', '老闆的名字！？', '碟仙認識老闆', '這間民宿有故事'],
  },
  {
    ask: 'akai.ouija.q5',
    answers: [
      { kind: 'comfort', chars: ['早', '睡'] },
      { kind: 'scare', chars: ['快', '走'] },
      { kind: 'secret', chars: ['按', '讚'] },
    ],
    react: { comfort: 'akai.ouija.r5.comfort', scare: 'akai.ouija.r5.scare', secret: 'akai.ouija.r5.secret' },
    secretChat: ['碟仙叫大家按讚XDDD', '已按', '好啦好啦', '碟仙懂流量'],
  },
]

const KIND_INFO: Record<Kind, { tag: string; color: string }> = {
  comfort: { tag: '安慰他', color: '#ffd58a' },
  scare: { tag: '嚇他', color: '#ff6b6b' },
  secret: { tag: '只有鬼知道', color: '#8ff4e0' },
}

// ---------------------------------------------------------------------------
// 紙板：左上「是」、右上「否」，中間一圈字（相關的字故意拆開，要推比較遠）
// ---------------------------------------------------------------------------

const RING = ['鬼', '床', '你', '早', '心', '打', '走', '左', '家', '電', '讚', '生', '下', '阿', '睡', '按', '話', '門', '快', '死', '邊', '翰', '人', '好']
const CENTER = { x: 0.5, y: 0.56 }
const RING_R = 0.335
const CELLS: { ch: string; x: number; y: number }[] = [
  { ch: '是', x: 0.12, y: 0.1 },
  { ch: '否', x: 0.88, y: 0.1 },
  ...RING.map((ch, i) => {
    const a = (i / RING.length) * Math.PI * 2
    return { ch, x: CENTER.x + Math.sin(a) * RING_R, y: CENTER.y - Math.cos(a) * RING_R }
  }),
]
const cellOf = (ch: string) => CELLS.find((c) => c.ch === ch)!

const HIT_R = 0.05
const SAUCER_R = 0.055
const Q_TIME = 16

// ---------------------------------------------------------------------------
// 聊天室
// ---------------------------------------------------------------------------

const USERS = ['小胖', '夜貓子', '阿明', '糖糖', 'KK', '鹹酥雞', '阿宗', '米粉', '路過的', '怕黑的', '鬼故事控', 'Momo', '豆花', '熬夜仔', '小雨']
const USER_COLORS = ['#8fd3ff', '#ffb3d1', '#b8f28a', '#ffd58a', '#c9b3ff', '#8ff4e0']
const CHAT_IDLE = ['這間好陰喔', '阿凱你後面……', '開燈啦', '+1', '我不敢看了', '碟仙快動', '真的假的', '好冷', '主播手在抖', '有沒有人跟我一樣起雞皮疙瘩', '這是劇本吧', '蠟燭在晃', '三更半夜看這個', '我先去上廁所', '聲音好怪']
const CHAT_REACT: Record<Kind, string[]> = {
  comfort: ['好溫柔QQ', '碟仙人好好', '被療癒了', '感覺是個好鬼', '我哭了', '想被這個鬼照顧'],
  scare: ['啊啊啊啊', '快跑！！', '主播還好嗎', '我關掉了', '報警啦', '好刺激', '剪起來'],
  secret: ['？？？？？', '真的假的！！！', '起雞皮疙瘩', '訂閱了', '剪精華！！', '這不是劇本', '我全身發毛'],
}
const VIEW_GAIN: Record<Kind, number> = { comfort: 180, scare: 520, secret: 2400 }

interface Chat {
  id: number
  user: string
  color: string
  text: string
  big?: boolean
  donate?: boolean
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

// ---------------------------------------------------------------------------

export default function Ouija({ done }: MinigameProps<OuijaParams, OuijaResult>) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [qi, setQi] = useState(0)
  const [progress, setProgress] = useState<number[]>([0, 0, 0])
  const [locked, setLocked] = useState<Kind | null>(null)
  const [say, setSay] = useState('')
  const [chat, setChat] = useState<Chat[]>([])
  const [viewers, setViewers] = useState(1283)
  const [left, setLeft] = useState(Q_TIME)
  const [score, setScore] = useState({ comfort: 0, scare: 0, secret: 0 })
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const chatBox = useRef<HTMLDivElement>(null)
  const chatId = useRef(0)
  const s = useRef({
    x: CENTER.x,
    y: CENTER.y,
    vx: 0,
    vy: 0,
    tx: CENTER.x,
    ty: CENTER.y,
    dragging: false,
    pointerDown: false,
    keys: new Set<string>(),
    dwell: -1,
    dwellCh: '',
    dwellT: 0,
    speed: 0,
    t: 0,
    qt: 0,
    flash: 0,
    flashColor: '#fff',
    shake: 0,
    progress: [0, 0, 0],
    phase: 'intro' as Phase,
    qi: 0,
    score: { comfort: 0, scare: 0, secret: 0 },
  })
  const scrape = useRef<ReturnType<typeof makeScrape> | null>(null)

  s.current.phase = phase
  s.current.qi = qi

  const q = QUESTIONS[qi]

  // ---------------------------------------------------------------------------
  // 聊天室
  // ---------------------------------------------------------------------------

  const post = (text: string, opt: Partial<Chat> = {}) => {
    const c: Chat = { id: ++chatId.current, user: pick(USERS), color: pick(USER_COLORS), text, ...opt }
    setChat((xs) => [...xs.slice(-24), c])
    ouijaSfx.pop()
  }
  const burst = (lines: string[], n: number, big = false) => {
    for (let i = 0; i < n; i++) window.setTimeout(() => post(pick(lines), { big: big && i % 3 === 0 }), 90 + i * (big ? 110 : 260))
  }

  useEffect(() => {
    chatBox.current?.scrollTo({ top: chatBox.current.scrollHeight })
  }, [chat])

  // 平常的聊天、觀看人數飄動
  useEffect(() => {
    if (phase === 'done') return
    const id = window.setInterval(() => {
      if (Math.random() < 0.6) post(pick(CHAT_IDLE))
      if (Math.random() < 0.06) post('（斗內 $' + pick([50, 100, 168, 200]) + '）碟仙加油', { donate: true })
      setViewers((v) => Math.max(900, v + Math.round((Math.random() - 0.4) * 30)))
    }, 1500)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ---------------------------------------------------------------------------
  // 流程
  // ---------------------------------------------------------------------------

  const speak = (id: string) => {
    setSay(line(id).text)
    if (useStore.getState().voice) voice.play(id)
  }

  const startQuestion = (i: number) => {
    const st = s.current
    st.progress = [0, 0, 0]
    st.dwell = -1
    st.dwellCh = ''
    st.dwellT = 0
    st.qt = 0
    st.phase = 'ask'
    // 放開上一題的手：要重新推才算
    st.dragging = false
    st.pointerDown = false
    st.qi = i
    setProgress([0, 0, 0])
    setLocked(null)
    setQi(i)
    setLeft(Q_TIME)
    setPhase('ask')
    speak(QUESTIONS[i].ask)
  }

  const start = () => {
    scrape.current = makeScrape()
    post('阿凱開台了！', { big: true })
    startQuestion(0)
  }

  const next = () => {
    const st = s.current
    if (st.qi + 1 >= QUESTIONS.length) {
      st.phase = 'done'
      setPhase('done')
      speak('akai.ouija.end')
      scrape.current?.stop()
      return
    }
    startQuestion(st.qi + 1)
  }

  const lock = (kind: Kind) => {
    const st = s.current
    st.phase = 'react'
    st.score = { ...st.score, [kind]: st.score[kind] + 1 }
    setScore(st.score)
    setLocked(kind)
    setPhase('react')
    st.flash = 1
    st.flashColor = KIND_INFO[kind].color
    st.shake = kind === 'secret' ? 1 : kind === 'scare' ? 0.6 : 0
    ouijaSfx.lock(kind)
    speak(QUESTIONS[st.qi].react[kind])
    setViewers((v) => v + VIEW_GAIN[kind] + Math.round(Math.random() * 100))
    if (kind === 'secret') {
      burst([...QUESTIONS[st.qi].secretChat, ...CHAT_REACT.secret], 14, true)
      window.setTimeout(() => post('（斗內 $' + pick([500, 888, 1000]) + '）碟仙我愛妳', { donate: true, big: true }), 1200)
    } else burst(CHAT_REACT[kind], kind === 'scare' ? 7 : 4)
    window.setTimeout(next, kind === 'secret' ? 3600 : 2600)
  }

  const timeout = () => {
    s.current.phase = 'react'
    setPhase('react')
    setLocked(null)
    speak('akai.ouija.timeout')
    burst(['碟仙睡著了？', '沒反應……', '是不是騙人的', '換題啦'], 3)
    window.setTimeout(next, 2400)
  }

  const finish = (cancel = false) => {
    scrape.current?.stop()
    voice.stop()
    const sc = s.current.score
    const any = sc.comfort + sc.scare + sc.secret > 0
    done(cancel && !any ? null : sc)
  }

  // ---------------------------------------------------------------------------
  // 每幀：碟子的物理、停在字上的判定
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let sec = Q_TIME
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      step(dt)
      draw()
      const st = s.current
      if (st.phase === 'ask') {
        const l = Math.max(0, Q_TIME - st.qt)
        if (Math.ceil(l) !== sec) {
          sec = Math.ceil(l)
          setLeft(sec)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => scrape.current?.stop(), [])

  function step(dt: number) {
    const st = s.current
    st.t += dt
    st.flash = Math.max(0, st.flash - dt * 1.5)
    st.shake = Math.max(0, st.shake - dt * 1.2)
    // 鍵盤：移動「想推去的地方」
    const kx = (st.keys.has('arrowright') || st.keys.has('d') ? 1 : 0) - (st.keys.has('arrowleft') || st.keys.has('a') ? 1 : 0)
    const ky = (st.keys.has('arrowdown') || st.keys.has('s') ? 1 : 0) - (st.keys.has('arrowup') || st.keys.has('w') ? 1 : 0)
    if (kx || ky) {
      st.tx = clamp(st.tx + kx * dt * 0.42, 0.06, 0.94)
      st.ty = clamp(st.ty + ky * dt * 0.42, 0.06, 0.94)
      st.dragging = true
    } else if (st.keys.size === 0 && !st.pointerDown) st.dragging = false

    // 碟子：像彈簧一樣被拉過去，但很重（加速度有上限）、會抖
    const active = st.phase === 'ask' && st.dragging
    let ax = 0
    let ay = 0
    if (active) {
      ax = (st.tx - st.x) * 9 - st.vx * 4.2
      ay = (st.ty - st.y) * 9 - st.vy * 4.2
      const a = Math.hypot(ax, ay)
      const maxA = 2.2
      if (a > maxA) {
        ax = (ax / a) * maxA
        ay = (ay / a) * maxA
      }
    } else if (st.phase === 'react') {
      // 答完一題：碟子自己慢慢滑回中間的起點
      ax = (CENTER.x - st.x) * 3 - st.vx * 3
      ay = (CENTER.y - st.y) * 3 - st.vy * 3
    } else {
      // 沒在推：自己慢慢飄一點點（有東西在碰它）＋很快停下來
      ax = Math.sin(st.t * 1.3) * 0.04 - st.vx * 5
      ay = Math.cos(st.t * 1.1) * 0.04 - st.vy * 5
    }
    st.vx += ax * dt
    st.vy += ay * dt
    const v = Math.hypot(st.vx, st.vy)
    const maxV = 0.5
    if (v > maxV) {
      st.vx = (st.vx / v) * maxV
      st.vy = (st.vy / v) * maxV
    }
    // 抖：推得越用力越抖
    const tremble = active ? 0.0025 + Math.min(1, Math.hypot(st.tx - st.x, st.ty - st.y) * 4) * 0.004 : 0.0008
    st.x = clamp(st.x + st.vx * dt + (Math.random() - 0.5) * tremble, 0.07, 0.93)
    st.y = clamp(st.y + st.vy * dt + (Math.random() - 0.5) * tremble, 0.07, 0.93)
    st.speed = v
    scrape.current?.set(v / maxV)

    if (st.phase !== 'ask') return
    st.qt += dt
    if (st.qt >= Q_TIME) {
      timeout()
      return
    }
    // 停在哪個字上
    const on = CELLS.find((c) => Math.hypot(c.x - st.x, c.y - st.y) < HIT_R)
    const ch = on?.ch ?? ''
    if (ch !== st.dwellCh) {
      st.dwellCh = ch
      st.dwellT = 0
    } else if (ch) st.dwellT += dt
    if (!ch) return
    const qq = QUESTIONS[st.qi]
    for (let i = 0; i < qq.answers.length; i++) {
      const ans = qq.answers[i]
      const need = ans.chars[st.progress[i]]
      if (need !== ch) continue
      const hold = ans.chars.length > 1 ? 0.35 : 0.6
      if (st.dwellT < hold) continue
      st.progress = st.progress.map((p, j) => (j === i ? p + 1 : p))
      setProgress(st.progress)
      st.dwellT = -99 // 同一格不要重複算
      if (st.progress[i] >= ans.chars.length) {
        lock(ans.kind)
        return
      }
      ouijaSfx.tick()
      post(pick(['動了！！', '碟子在動', '……' + ans.chars.slice(0, st.progress[i]).join(''), '是「' + ch + '」', '拼字！？']))
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
      const size = w.clientWidth
      c.style.width = `${size}px`
      c.style.height = `${size}px`
      c.width = Math.round(size * dpr)
      c.height = Math.round(size * dpr)
      draw()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(w)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function draw() {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const st = s.current
    const W = c.width
    const X = (v: number) => v * W
    ctx.save()
    if (st.shake > 0) ctx.translate((Math.random() - 0.5) * W * 0.012 * st.shake, (Math.random() - 0.5) * W * 0.012 * st.shake)
    // 桌面
    ctx.fillStyle = '#1b120d'
    ctx.fillRect(-W, -W, W * 3, W * 3)
    // 紙：泛黃、有污漬
    const paper = ctx.createRadialGradient(X(0.5), X(0.5), W * 0.1, X(0.5), X(0.5), W * 0.75)
    paper.addColorStop(0, '#efe0bf')
    paper.addColorStop(1, '#c9ae7e')
    ctx.fillStyle = paper
    ctx.fillRect(X(0.02), X(0.02), X(0.96), X(0.96))
    ctx.globalAlpha = 0.08
    ctx.fillStyle = '#6a4a20'
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.arc(X(0.15 + ((i * 0.37) % 0.8)), X(0.2 + ((i * 0.53) % 0.7)), W * (0.04 + (i % 3) * 0.02), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    // 紅色的框與圈
    ctx.strokeStyle = '#8a1c14'
    ctx.lineWidth = W * 0.006
    ctx.strokeRect(X(0.04), X(0.04), X(0.92), X(0.92))
    ctx.beginPath()
    ctx.arc(X(CENTER.x), X(CENTER.y), X(RING_R + 0.055), 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(X(CENTER.x), X(CENTER.y), X(RING_R - 0.055), 0, Math.PI * 2)
    ctx.stroke()
    // 起點
    ctx.lineWidth = W * 0.004
    ctx.beginPath()
    ctx.arc(X(CENTER.x), X(CENTER.y), X(0.075), 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(138,28,20,0.55)'
    ctx.font = `700 ${W * 0.03}px 'LXGW WenKai TC', 'Noto Serif TC', serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('碟仙', X(CENTER.x), X(CENTER.y - 0.135))
    // 這一題每個答案「下一個要停的字」：淡淡的底色提示
    const qq = QUESTIONS[st.qi]
    const hint = new Map<string, Kind>()
    if (st.phase === 'ask') qq.answers.forEach((a, i) => a.chars[st.progress[i]] && hint.set(a.chars[st.progress[i]], a.kind))
    // 字
    for (const cell of CELLS) {
      const big = cell.ch === '是' || cell.ch === '否'
      const k = hint.get(cell.ch)
      if (k) {
        const pulse = 0.5 + 0.5 * Math.sin(st.t * 4)
        ctx.fillStyle = hexA(KIND_INFO[k].color, 0.18 + pulse * 0.12)
        ctx.beginPath()
        ctx.arc(X(cell.x), X(cell.y), X(big ? 0.058 : 0.044), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#2a120c'
      ctx.font = `700 ${W * (big ? 0.075 : 0.05)}px 'Noto Serif TC', 'LXGW WenKai TC', serif`
      ctx.fillText(cell.ch, X(cell.x), X(cell.y) + W * 0.003)
    }
    // 蠟燭（左下角）：碟子動的時候火苗亂晃
    drawCandle(ctx, X(0.1), X(0.9), W, st.t, st.speed)
    // 手機（右下角，錄影中）
    drawPhone(ctx, X(0.88), X(0.9), W, st.t)
    // 想推去的地方（鬼手的影子）
    if (st.dragging && st.phase === 'ask') {
      ctx.fillStyle = 'rgba(120,220,230,0.18)'
      ctx.beginPath()
      ctx.arc(X(st.tx), X(st.ty), X(0.045), 0, Math.PI * 2)
      ctx.fill()
    }
    // 碟子
    drawSaucer(ctx, X(st.x), X(st.y), X(SAUCER_R), st.t)
    // 停字的進度圈
    if (st.dwellCh && st.dwellT > 0 && hint.has(st.dwellCh)) {
      const cell = cellOf(st.dwellCh)
      const hold = qq.answers.some((a) => a.chars.length > 1 && a.chars.includes(st.dwellCh)) ? 0.35 : 0.6
      ctx.strokeStyle = KIND_INFO[hint.get(st.dwellCh)!].color
      ctx.lineWidth = W * 0.008
      ctx.beginPath()
      ctx.arc(X(cell.x), X(cell.y), X(0.062), -Math.PI / 2, -Math.PI / 2 + Math.min(1, st.dwellT / hold) * Math.PI * 2)
      ctx.stroke()
    }
    // 鎖定的閃光
    if (st.flash > 0) {
      ctx.fillStyle = hexA(st.flashColor, st.flash * 0.35)
      ctx.fillRect(-W, -W, W * 3, W * 3)
    }
    // 燭光暗角
    const vig = ctx.createRadialGradient(X(0.25), X(0.8), W * 0.1, X(0.5), X(0.5), W * 0.85)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, `rgba(10,4,2,${0.55 + Math.sin(st.t * 9) * 0.03 + st.speed * 0.1})`)
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, W, W)
    ctx.restore()
  }

  // ---------------------------------------------------------------------------
  // 操作
  // ---------------------------------------------------------------------------

  const toBoard = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  const onDown = (e: React.PointerEvent) => {
    if (phase !== 'ask') return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toBoard(e)
    const st = s.current
    st.pointerDown = true
    st.dragging = true
    st.tx = clamp(p.x, 0.06, 0.94)
    st.ty = clamp(p.y, 0.06, 0.94)
  }
  const onMove = (e: React.PointerEvent) => {
    const st = s.current
    if (!st.pointerDown) return
    const p = toBoard(e)
    st.tx = clamp(p.x, 0.06, 0.94)
    st.ty = clamp(p.y, 0.06, 0.94)
  }
  const onUp = () => {
    const st = s.current
    st.pointerDown = false
    st.dragging = false
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish(true)
        return
      }
      if (phase === 'intro' && (k === ' ' || k === 'e' || k === 'enter')) {
        e.preventDefault()
        start()
        return
      }
      if (phase === 'done' && (k === ' ' || k === 'e' || k === 'enter')) {
        e.preventDefault()
        finish()
        return
      }
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault()
        s.current.keys.add(k)
      }
    }
    const up = (e: KeyboardEvent) => s.current.keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ---------------------------------------------------------------------------

  return (
    <div className="oj-card">
      <div className="oj-head">
        <span className="oj-live">● LIVE</span>
        <span className="oj-title">阿凱的碟仙直播</span>
        <span className="oj-viewers">👁 {viewers.toLocaleString()}</span>
        <button className="oj-leave" onClick={() => finish(true)}>
          離開
        </button>
      </div>

      <div className="oj-main">
        <div className="oj-left">
          <div className="oj-ask">
            <img src={portraitDataUrl('akai', locked === 'scare' || locked === 'secret' ? 'surprised' : 'normal')} alt="" draggable={false} />
            <div className="oj-say">
              <span className="oj-name">阿凱</span>
              <span className="oj-text">{say || '（對著手機）哈囉大家好……今天我們來玩碟仙。'}</span>
            </div>
            {phase === 'ask' && <span className={`oj-timer ${left <= 5 ? 'hurry' : ''}`}>{left}</span>}
          </div>

          <div className="oj-board" ref={wrap}>
            <canvas ref={canvas} className="oj-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
            {phase === 'intro' && (
              <div className="oj-overlay">
                <p>
                  阿凱在房間裡開<b>碟仙直播</b>。
                  <br />
                  用手指（或方向鍵）<b>推碟子</b>回答他的問題，停在字上一下下才算。
                </p>
                <ul className="oj-legend">
                  {(Object.keys(KIND_INFO) as Kind[]).map((k) => (
                    <li key={k} style={{ color: KIND_INFO[k].color }}>
                      {KIND_INFO[k].tag}
                      <small>{k === 'comfort' ? '他比較不怕、比較舒服' : k === 'scare' ? '他很怕，但觀眾很愛' : '要一個字一個字拼，觀眾暴增'}</small>
                    </li>
                  ))}
                </ul>
                <button className="btn primary" onClick={start}>
                  開始推碟子
                </button>
              </div>
            )}
            {phase === 'done' && (
              <div className="oj-overlay">
                <p className="oj-sum">
                  安慰 <b>{score.comfort}</b>　嚇他 <b>{score.scare}</b>　秘密 <b>{score.secret}</b>
                </p>
                <p>
                  觀看人數 <b>{viewers.toLocaleString()}</b>
                </p>
                <button className="btn primary" onClick={() => finish()}>
                  讓碟子停下來
                </button>
              </div>
            )}
          </div>

          {(phase === 'ask' || phase === 'react') && (
            <div className="oj-answers">
              {q.answers.map((a, i) => (
                <span key={a.kind} className={`oj-ans ${locked === a.kind ? 'on' : ''} ${locked && locked !== a.kind ? 'off' : ''}`} style={{ borderColor: KIND_INFO[a.kind].color }}>
                  <small style={{ color: KIND_INFO[a.kind].color }}>{KIND_INFO[a.kind].tag}</small>
                  <b>
                    {a.chars.map((ch, j) => (
                      <i key={j} className={j < progress[i] ? 'got' : ''}>
                        {ch}
                      </i>
                    ))}
                  </b>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="oj-chat" ref={chatBox}>
          {chat.map((c) => (
            <div key={c.id} className={`oj-msg ${c.big ? 'big' : ''} ${c.donate ? 'donate' : ''}`}>
              <span style={{ color: c.color }}>{c.user}</span>
              {c.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 小圖
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`
}

function drawSaucer(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  ctx.save()
  ctx.translate(x, y)
  // 影子
  ctx.fillStyle = 'rgba(40,20,10,0.35)'
  ctx.beginPath()
  ctx.ellipse(r * 0.12, r * 0.18, r * 1.05, r * 0.95, 0, 0, Math.PI * 2)
  ctx.fill()
  // 白瓷碟
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(1, '#d9d6cc')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#9fb8c8'
  ctx.lineWidth = r * 0.08
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2)
  ctx.stroke()
  // 紅色箭頭（朝上）
  ctx.fillStyle = '#b3261e'
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.7)
  ctx.lineTo(r * 0.28, -r * 0.2)
  ctx.lineTo(r * 0.1, -r * 0.2)
  ctx.lineTo(r * 0.1, r * 0.45)
  ctx.lineTo(-r * 0.1, r * 0.45)
  ctx.lineTo(-r * 0.1, -r * 0.2)
  ctx.lineTo(-r * 0.28, -r * 0.2)
  ctx.closePath()
  ctx.fill()
  // 一點點青色的鬼氣
  ctx.strokeStyle = `rgba(143,244,255,${0.25 + Math.sin(t * 5) * 0.1})`
  ctx.lineWidth = r * 0.12
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawCandle(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, t: number, speed: number) {
  const w = W * 0.035
  const h = W * 0.08
  // 光暈
  const glow = ctx.createRadialGradient(x, y - h, 1, x, y - h, W * 0.2)
  glow.addColorStop(0, 'rgba(255,200,120,0.35)')
  glow.addColorStop(1, 'rgba(255,200,120,0)')
  ctx.fillStyle = glow
  ctx.fillRect(x - W * 0.2, y - h - W * 0.2, W * 0.4, W * 0.4)
  // 蠟燭
  ctx.fillStyle = '#f2ead8'
  ctx.fillRect(x - w / 2, y - h, w, h)
  ctx.fillStyle = '#d8ccb0'
  ctx.fillRect(x - w / 2, y - h, w * 0.25, h)
  // 火苗：碟子動越快越亂
  const k = Math.min(1, speed * 2.5)
  const sway = Math.sin(t * (9 + k * 20)) * (0.1 + k * 0.5)
  const fh = W * (0.04 + Math.sin(t * 13) * 0.004 + k * 0.02)
  ctx.save()
  ctx.translate(x, y - h - W * 0.004)
  ctx.rotate(sway * 0.4)
  const f = ctx.createLinearGradient(0, 0, 0, -fh)
  f.addColorStop(0, '#fff3c4')
  f.addColorStop(0.5, '#ffb347')
  f.addColorStop(1, 'rgba(255,90,40,0)')
  ctx.fillStyle = f
  ctx.beginPath()
  ctx.moveTo(-w * 0.28, 0)
  ctx.quadraticCurveTo(-w * 0.35, -fh * 0.55, sway * w, -fh)
  ctx.quadraticCurveTo(w * 0.35, -fh * 0.55, w * 0.28, 0)
  ctx.fill()
  ctx.restore()
}

function drawPhone(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, t: number) {
  const w = W * 0.07
  const h = W * 0.12
  ctx.save()
  ctx.translate(x, y - h / 2)
  ctx.rotate(-0.12)
  ctx.fillStyle = '#151515'
  roundRect(ctx, -w / 2, -h / 2, w, h, W * 0.01)
  ctx.fill()
  ctx.fillStyle = '#233040'
  roundRect(ctx, -w / 2 + W * 0.005, -h / 2 + W * 0.008, w - W * 0.01, h - W * 0.016, W * 0.006)
  ctx.fill()
  // 紅色 REC 點
  if (Math.sin(t * 4) > -0.2) {
    ctx.fillStyle = '#ff3b30'
    ctx.beginPath()
    ctx.arc(-w * 0.2, -h * 0.34, W * 0.007, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
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
