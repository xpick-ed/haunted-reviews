import { useEffect, useRef, useState } from 'react'
import { RECIPES, type Recipe, type RecipeId } from '../../world/night/items'
import type { GuestType } from '../../world/night/types'
import { sfx } from '../../audio/sfx'
import { cookSfx } from './cook.sound'
import type { CookParams, CookResult, MinigameProps } from './types'
import './cook.css'

// 煮宵夜（DESIGN §25.2）：先選食譜，再到大灶前抓三個時機——
// 熱油（指針停在綠區）→ 下料（圈圈縮到鍋子上時按，一共三樣）→ 翻面／起鍋（煎到金黃就翻）。
// 品質 0..1 = 熱油 25% + 下料 35% + 翻面 40%。E／空白鍵／點畫面都算「按」，ESC 或 ✕ 取消。

const LIKE_LABEL: Record<GuestType, string> = {
  timid: '一般旅客',
  thrill: 'YouTuber',
  business: '商務客',
  backpacker: '背包客',
  child: '小孩',
  parent: '家長',
  elder: '老朋友',
}

/** 用煮的（粥、湯、麵線）：沒有「翻面」，改成「起鍋」 */
const BOIL = new Set<RecipeId>(['porridge', 'sweetporridge', 'gingersoup', 'misua', 'fishsoup', 'zongzi'])

interface Look {
  /** 鍋裡的湯底（煎的是 null：只有一層油） */
  liquid: string | null
  raw: string
  gold: string
  burnt: string
  drops: { name: string; color: string }[]
}

const LOOK: Record<RecipeId, Look> = {
  fishsoup: {
    liquid: '#e8e4d4',
    raw: '#d8d4c4',
    gold: '#c9b98a',
    burnt: '#6a5a3a',
    drops: [
      { name: '薑絲', color: '#e9c46a' },
      { name: '溪哥', color: '#b8c4c8' },
      { name: '蔥花', color: '#6fb04a' },
    ],
  },
  // 粽子：用蒸的（鍋裡放水、放粽子）
  zongzi: {
    liquid: '#cfe3e8',
    raw: '#7fa65a',
    gold: '#5c8a3a',
    burnt: '#2a3a1a',
    drops: [
      { name: '水', color: '#bfe3ff' },
      { name: '粽子', color: '#6f9a4a' },
      { name: '蒸籠蓋', color: '#c8a064' },
    ],
  },
  omelette: {
    liquid: null,
    raw: '#f7e38c',
    gold: '#e39b32',
    burnt: '#3a2010',
    drops: [
      { name: '菜脯', color: '#a3703c' },
      { name: '蛋', color: '#fbe08a' },
      { name: '蔥花', color: '#6fb04a' },
    ],
  },
  leaves: {
    liquid: null,
    raw: '#86c95e',
    gold: '#3f8a2e',
    burnt: '#1d2610',
    drops: [
      { name: '蒜頭', color: '#f3ead6' },
      { name: '地瓜葉', color: '#6fb04a' },
      { name: '鹽', color: '#ffffff' },
    ],
  },
  porridge: {
    liquid: '#e9e2d0',
    raw: '#f4efe2',
    gold: '#efe0bd',
    burnt: '#8a6a3a',
    drops: [
      { name: '米', color: '#fbf6ea' },
      { name: '水', color: '#bfe3ff' },
      { name: '鹽', color: '#ffffff' },
    ],
  },
  sweetporridge: {
    liquid: '#ecdcbc',
    raw: '#f1e6cf',
    gold: '#e8a95a',
    burnt: '#7a4a22',
    drops: [
      { name: '米', color: '#fbf6ea' },
      { name: '地瓜', color: '#e9a14a' },
      { name: '水', color: '#bfe3ff' },
    ],
  },
  gingersoup: {
    liquid: '#c98f45',
    raw: '#e3c07e',
    gold: '#b66e22',
    burnt: '#4a2a10',
    drops: [
      { name: '薑片', color: '#ead28c' },
      { name: '黑糖', color: '#5a3418' },
      { name: '水', color: '#bfe3ff' },
    ],
  },
  misua: {
    liquid: '#e6d4a8',
    raw: '#f2e7c8',
    gold: '#dcb66a',
    burnt: '#7a5226',
    drops: [
      { name: '麵線', color: '#f6efdc' },
      { name: '蛋', color: '#fbe08a' },
      { name: '蔥花', color: '#6fb04a' },
    ],
  },
}

type Stage = 'pick' | 'oil' | 'drop' | 'flip' | 'reveal'

// 熱油：綠區
const OIL_LO = 0.6
const OIL_HI = 0.78
const OIL_TIMEOUT = 4.5
// 下料：三個拍子
const BEATS = [1.0, 2.0, 3.0]
const RING_T = 0.9
const BEAT_WINDOW = 0.35
// 翻面：金黃的範圍（褐變 0..BROWN_MAX）
const GOLD_LO = 0.75
const GOLD_HI = 0.95
const BROWN_MAX = 1.45

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const now = () => performance.now() / 1000

function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a: string, b: string, k: number) {
  const x = hexRgb(a)
  const y = hexRgb(b)
  const t = clamp01(k)
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}

function judgeText(s: number) {
  if (s >= 0.9) return '完美！'
  if (s >= 0.6) return '不錯'
  if (s >= 0.3) return '差一點'
  return '失手了'
}

function verdict(q: number) {
  if (q >= 0.85) return { title: '阿嬤的招牌！', line: '香味飄到整個三合院。' }
  if (q >= 0.6) return { title: '還不錯', line: '家常的味道，吃了會想睡。' }
  if (q >= 0.35) return { title: '有點失手', line: '算了，餓的人不會嫌。' }
  return { title: '燒焦了……', line: '阿嬤嘆了一口氣，還是端出去吧。' }
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  kind: 'spatter' | 'steam' | 'spark'
  r: number
}

interface Drop {
  x: number
  y: number
  vy: number
  rot: number
  vr: number
  color: string
  landed: boolean
}

/** 每幀要讀寫的狀態（不放 React state，避免每幀重畫） */
interface Game {
  stage: Stage
  t0: number
  heat: number
  needle: number
  scores: [number, number, number]
  beats: { at: number; score: number | null }[]
  browning: number
  brownRate: number
  flipT: number
  foodIn: number
  particles: Particle[]
  drops: Drop[]
  judge: { text: string; t: number; good: boolean } | null
  shake: number
  next: { at: number; stage: Stage } | null
}

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Cook({ params, done }: MinigameProps<CookParams, CookResult>) {
  const list = (() => {
    const ids = new Set<RecipeId>(params?.recipes ?? [])
    ids.add('porridge')
    return RECIPES.filter((r) => ids.has(r.id))
  })()
  const [sel, setSel] = useState(0)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [stage, setStage] = useState<Stage>('pick')
  const [quality, setQuality] = useState(0)
  const finished = useRef(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const needleEl = useRef<HTMLDivElement>(null)
  const brownEl = useRef<HTMLDivElement>(null)
  const beatEl = useRef<HTMLDivElement>(null)
  const game = useRef<Game | null>(null)
  const recipeRef = useRef<Recipe | null>(null)
  recipeRef.current = recipe

  const finish = (r: CookResult) => {
    if (finished.current) return
    finished.current = true
    cookSfx.stopSizzle()
    done(r)
  }

  const goStage = (g: Game, s: Stage) => {
    g.stage = s
    g.t0 = now()
    g.next = null
    setStage(s)
    if (s === 'reveal') {
      const q = clamp01(g.scores[0] * 0.25 + g.scores[1] * 0.35 + g.scores[2] * 0.4)
      setQuality(q)
      cookSfx.stopSizzle()
      sfx.play(q >= 0.6 ? 'pickup' : 'pot', { volume: 0.8 })
      if (q >= 0.85) cookSfx.chime()
    }
  }

  const start = (r: Recipe) => {
    setRecipe(r)
    sfx.play('ui_confirm', { volume: 0.6 })
    cookSfx.ignite()
    const g: Game = {
      stage: 'oil',
      t0: now(),
      heat: 0,
      needle: 0,
      scores: [0, 0, 0],
      beats: BEATS.map((at) => ({ at, score: null })),
      browning: 0,
      brownRate: 0.36,
      flipT: -1,
      foodIn: 0,
      particles: [],
      drops: [],
      judge: null,
      shake: 0,
      next: null,
    }
    game.current = g
    setStage('oil')
  }

  const showJudge = (g: Game, s: number) => {
    g.judge = { text: judgeText(s), t: now(), good: s >= 0.6 }
    if (s >= 0.6) cookSfx.tick(s >= 0.9 ? 1320 : 990)
    else sfx.play('ui_cancel', { volume: 0.4 })
  }

  /** 「按」：依階段判定 */
  const act = () => {
    if (stage === 'pick') {
      const r = list[sel]
      if (r) start(r)
      return
    }
    const g = game.current
    if (!g) return
    const t = now() - g.t0
    if (g.stage === 'reveal') {
      if (t > 0.5 && recipeRef.current) finish({ recipe: recipeRef.current.id, quality })
      return
    }
    if (g.next) return
    if (g.stage === 'oil') {
      const p = g.needle
      const s = p >= OIL_LO && p <= OIL_HI ? 1 : clamp01(1 - (p < OIL_LO ? OIL_LO - p : p - OIL_HI) / 0.25)
      g.scores[0] = s
      g.heat = p
      g.brownRate = 0.36 + (p - 0.69) * 0.35
      showJudge(g, s)
      cookSfx.startSizzle(0.12 + p * 0.1)
      g.next = { at: now() + 0.7, stage: 'drop' }
      return
    }
    if (g.stage === 'drop') {
      const beat = g.beats.find((b) => b.score === null && Math.abs(t - b.at) < BEAT_WINDOW)
      if (!beat) return
      const err = Math.abs(t - beat.at)
      const s = err < 0.08 ? 1 : err < 0.18 ? 0.7 : 0.35
      beat.score = s
      landIngredient(g, g.beats.indexOf(beat), s)
      showJudge(g, s)
      return
    }
    if (g.stage === 'flip') {
      if (g.flipT >= 0) return
      const b = g.browning
      const s = b >= GOLD_LO && b <= GOLD_HI ? 1 : b < GOLD_LO ? clamp01(1 - (GOLD_LO - b) / 0.5) : clamp01(1 - (b - GOLD_HI) / 0.35)
      g.scores[2] = s
      g.flipT = now()
      showJudge(g, s)
      sfx.play('pot', { volume: 0.7 })
      g.next = { at: now() + 1.0, stage: 'reveal' }
    }
  }
  const actRef = useRef(act)
  actRef.current = act

  const landIngredient = (g: Game, i: number, s: number) => {
    const r = recipeRef.current
    if (!r) return
    const look = LOOK[r.id]
    const W = wrap.current?.clientWidth ?? 400
    g.drops.push({ x: W / 2 + (i - 1) * 26, y: -10, vy: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, color: look.drops[i]?.color ?? '#fff', landed: false })
    g.shake = s >= 0.6 ? 0.5 : 0.25
    cookSfx.sizzleBurst(0.5, 0.3)
    sfx.play('pot', { volume: 0.35, rate: 1.3 })
  }

  // 鍵盤
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        sfx.play('ui_cancel', { volume: 0.5 })
        finish(null)
        return
      }
      if (e.repeat) return
      if (stage === 'pick' && (k === 'arrowleft' || k === 'arrowup' || k === 'a' || k === 'w')) {
        setSel((i) => (i - 1 + list.length) % list.length)
        sfx.play('ui_select', { volume: 0.3 })
        return
      }
      if (stage === 'pick' && (k === 'arrowright' || k === 'arrowdown' || k === 'd' || k === 's')) {
        setSel((i) => (i + 1) % list.length)
        sfx.play('ui_select', { volume: 0.3 })
        return
      }
      if (k === 'e' || k === ' ' || k === 'enter') {
        e.preventDefault()
        actRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, list.length])

  useEffect(() => () => cookSfx.stopSizzle(), [])

  // 畫面迴圈
  useEffect(() => {
    if (stage === 'pick') return
    const cv = canvas.current
    const box = wrap.current
    if (!cv || !box) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = now()
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const g = game.current
      const r = recipeRef.current
      if (!g || !r) return
      const tn = now()
      const dt = Math.min(0.05, tn - last)
      last = tn
      const t = tn - g.t0
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = box.clientWidth
      const H = box.clientHeight
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr)
        cv.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // ---- 規則 ----
      if (g.next && tn >= g.next.at) goStage(g, g.next.stage)
      if (g.stage === 'oil' && !g.next) {
        const w = 2.4 + Math.min(t, 3) * 0.7
        g.needle = 0.5 - 0.5 * Math.cos(w * t)
        g.heat = g.needle
        if (t > OIL_TIMEOUT) {
          g.scores[0] = 0.25
          g.heat = 0.45
          g.judge = { text: '油還不夠熱', t: tn, good: false }
          cookSfx.startSizzle(0.1)
          g.next = { at: tn + 0.6, stage: 'drop' }
        }
      }
      if (g.stage === 'drop') {
        for (const b of g.beats) {
          if (b.score === null && t > b.at + BEAT_WINDOW) {
            b.score = 0
            landIngredient(g, g.beats.indexOf(b), 0)
            g.judge = { text: '太慢了', t: tn, good: false }
          }
        }
        if (!g.next && g.beats.every((b) => b.score !== null)) {
          g.scores[1] = g.beats.reduce((a, b) => a + (b.score ?? 0), 0) / g.beats.length
          g.next = { at: tn + 0.55, stage: 'flip' }
        }
      }
      if (g.stage === 'flip' && g.flipT < 0) {
        g.browning = t * g.brownRate
        if (g.browning >= BROWN_MAX) {
          g.scores[2] = 0
          g.flipT = tn
          g.judge = { text: '燒焦了！', t: tn, good: false }
          cookSfx.sizzleBurst(0.9, 0.4)
          g.next = { at: tn + 1.1, stage: 'reveal' }
        }
      }
      g.foodIn = Math.min(1, g.foodIn + (g.drops.some((d) => d.landed) ? dt * 3 : 0))
      g.shake = Math.max(0, g.shake - dt * 2.2)

      // DOM 指示
      if (needleEl.current) needleEl.current.style.left = `${g.needle * 100}%`
      if (brownEl.current) brownEl.current.style.left = `${Math.min(1, g.browning / BROWN_MAX) * 100}%`
      if (beatEl.current) {
        const i = g.beats.findIndex((b) => b.score === null)
        beatEl.current.textContent = i >= 0 ? `第 ${i + 1}／3 樣：${LOOK[r.id].drops[i]?.name ?? ''}` : '下好了'
      }

      // ---- 畫 ----
      drawScene(ctx, W, H, g, r, tn, dt)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage === 'pick'])

  // 翻完／起鍋之後 4 秒自動端出去（半夜很忙）
  useEffect(() => {
    if (stage !== 'reveal' || !recipe) return
    const id = window.setTimeout(() => finish({ recipe: recipe.id, quality }), 4200)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, quality])

  const boil = recipe ? BOIL.has(recipe.id) : false
  const stageNames = boil ? ['起火', '下料', '起鍋'] : ['熱油', '下料', '翻面']
  const stageIdx = stage === 'oil' ? 0 : stage === 'drop' ? 1 : stage === 'flip' ? 2 : 3
  const hint =
    stage === 'oil'
      ? boil
        ? '火候跑到綠色的時候按下去'
        : '指針跑到綠色（油溫剛好）的時候按下去'
      : stage === 'drop'
        ? '圈圈縮到鍋子上的時候按，一樣一樣下'
        : stage === 'flip'
          ? boil
            ? '滾到剛好就起鍋！太早沒味道，太晚會黏鍋'
            : '煎到金黃色就翻面！太早是生的，太晚會焦'
          : ''
  const button = stage === 'oil' ? '就是現在！' : stage === 'drop' ? '下！' : stage === 'flip' ? (boil ? '起鍋！' : '翻面！') : '端去給客人'

  return (
    <div className="cook-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cook-head">
        <span className="cook-title">{recipe ? `${recipe.icon} ${recipe.name}` : '煮宵夜'}</span>
        {recipe && stage !== 'reveal' && (
          <span className="cook-steps">
            {stageNames.map((n, i) => (
              <span key={n} className={i < stageIdx ? 'done' : i === stageIdx ? 'on' : ''}>
                {n}
              </span>
            ))}
          </span>
        )}
        <button
          className="cook-close"
          aria-label="不煮了"
          onClick={() => {
            sfx.play('ui_cancel', { volume: 0.5 })
            finish(null)
          }}
        >
          ✕
        </button>
      </div>

      {stage === 'pick' && (
        <>
          <p className="cook-flavor">灶腳的火還沒熄。今晚煮什麼好？</p>
          <div className="cook-cards">
            {list.map((r, i) => (
              <button
                key={r.id}
                className={`cook-card ${i === sel ? 'on' : ''}`}
                onPointerEnter={() => setSel(i)}
                onClick={() => start(r)}
              >
                <span className="cook-card-icon">{r.icon}</span>
                <span className="cook-card-name">{r.name}</span>
                <span className="cook-card-comfort">舒適 +{r.comfort}</span>
                <span className="cook-card-likes">{r.likes.length ? `${r.likes.map((l) => LIKE_LABEL[l]).join('、')}最愛` : '什麼都沒有的時候'}</span>
                {r.alsoCold && <span className="cook-card-tag">暖身子</span>}
              </button>
            ))}
          </div>
          <p className="cook-hint">← → 選、E 開火　·　ESC 不煮了</p>
        </>
      )}

      {stage !== 'pick' && recipe && (
        <>
          <div
            ref={wrap}
            className="cook-stage"
            onPointerDown={(e) => {
              e.preventDefault()
              act()
            }}
          >
            <canvas ref={canvas} />
            {stage === 'reveal' && (
              <div className="cook-reveal">
                <div className="cook-dish">
                  <span className="cook-dish-icon">{recipe.icon}</span>
                  <span className="cook-steam" />
                </div>
                <div className="cook-verdict">{verdict(quality).title}</div>
                <div className="cook-line">{verdict(quality).line}</div>
                <div className="cook-quality">
                  <i style={{ width: `${Math.round(quality * 100)}%` }} />
                </div>
                <div className="cook-bonus">舒適加成 ×{(0.6 + 0.6 * quality).toFixed(2)}</div>
              </div>
            )}
          </div>

          {stage === 'oil' && (
            <div className="cook-gauge oil">
              <div className="cook-zone" style={{ left: `${OIL_LO * 100}%`, width: `${(OIL_HI - OIL_LO) * 100}%` }} />
              <div ref={needleEl} className="cook-needle" />
              <span className="cook-gauge-l">冷</span>
              <span className="cook-gauge-r">冒煙</span>
            </div>
          )}
          {stage === 'drop' && <div ref={beatEl} className="cook-beat" />}
          {stage === 'flip' && (
            <div className={`cook-gauge brown ${boil ? 'boil' : ''}`}>
              <div className="cook-zone" style={{ left: `${(GOLD_LO / BROWN_MAX) * 100}%`, width: `${((GOLD_HI - GOLD_LO) / BROWN_MAX) * 100}%` }} />
              <div ref={brownEl} className="cook-needle" />
              <span className="cook-gauge-l">{boil ? '水水的' : '生'}</span>
              <span className="cook-gauge-r">{boil ? '黏鍋' : '焦'}</span>
            </div>
          )}
          {hint && <p className="cook-hint">{hint}</p>}
          <button
            className="cook-act"
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              act()
            }}
          >
            {button}
            <span className="cook-key">E</span>
          </button>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 畫：大灶、鍋、油／湯、食材、油花、蒸氣
// ---------------------------------------------------------------------------

function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, g: Game, r: Recipe, tn: number, dt: number) {
  const look = LOOK[r.id]
  const boil = BOIL.has(r.id)
  ctx.clearRect(0, 0, W, H)
  const shake = reduceMotion ? 0 : g.shake
  ctx.save()
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 8 * shake, (Math.random() - 0.5) * 6 * shake)

  // 背景：灶腳的暗牆
  const bg = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, Math.max(W, H) * 0.8)
  bg.addColorStop(0, '#4a2a18')
  bg.addColorStop(1, '#120a07')
  ctx.fillStyle = bg
  ctx.fillRect(-10, -10, W + 20, H + 20)

  const cx = W / 2
  const cy = H * 0.52
  const rx = Math.min(W * 0.36, 170)
  const ry = rx * 0.32

  // 大灶（磚）
  const top = cy + ry * 0.35
  ctx.fillStyle = '#7a3b28'
  roundRect(ctx, cx - rx * 1.45, top, rx * 2.9, H - top + 20, 14)
  ctx.fill()
  ctx.strokeStyle = 'rgba(40,16,8,0.45)'
  ctx.lineWidth = 1
  for (let y = top + 16; y < H; y += 16) {
    ctx.beginPath()
    ctx.moveTo(cx - rx * 1.45, y)
    ctx.lineTo(cx + rx * 1.45, y)
    ctx.stroke()
    const off = ((y - top) / 16) % 2 ? 0 : 18
    for (let x = cx - rx * 1.45 + off; x < cx + rx * 1.45; x += 36) {
      ctx.beginPath()
      ctx.moveTo(x, y - 16)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }
  // 灶口的火光
  const flick = 0.75 + Math.sin(tn * 17) * 0.1 + Math.sin(tn * 7.3) * 0.12
  const fireK = 0.35 + g.heat * 0.65
  const mouthY = Math.min(H - 18, top + (H - top) * 0.6)
  const fire = ctx.createRadialGradient(cx, mouthY, 2, cx, mouthY, rx * 0.7)
  fire.addColorStop(0, `rgba(255,220,120,${0.95 * fireK * flick})`)
  fire.addColorStop(0.4, `rgba(255,120,40,${0.7 * fireK * flick})`)
  fire.addColorStop(1, 'rgba(120,30,10,0)')
  ctx.fillStyle = '#1a0a05'
  ctx.beginPath()
  ctx.ellipse(cx, mouthY, rx * 0.42, Math.min(26, (H - top) * 0.3), 0, Math.PI, 0)
  ctx.lineTo(cx + rx * 0.42, mouthY + 30)
  ctx.lineTo(cx - rx * 0.42, mouthY + 30)
  ctx.fill()
  ctx.fillStyle = fire
  ctx.fillRect(cx - rx, mouthY - rx * 0.7, rx * 2, rx * 1.4)

  // 鍋底的火光往上照
  const glow = ctx.createRadialGradient(cx, cy + ry, 5, cx, cy + ry, rx * 1.3)
  glow.addColorStop(0, `rgba(255,140,50,${0.35 * fireK})`)
  glow.addColorStop(1, 'rgba(255,140,50,0)')
  ctx.fillStyle = glow
  ctx.fillRect(cx - rx * 1.5, cy - ry * 2, rx * 3, ry * 5)

  // 鍋（黑鐵）
  ctx.fillStyle = '#0d0d0f'
  ctx.beginPath()
  ctx.ellipse(cx, cy + ry * 0.25, rx * 1.02, ry * 1.25, 0, 0, Math.PI)
  ctx.fill()
  // 把手
  ctx.strokeStyle = '#2a2a2e'
  ctx.lineWidth = 5
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(cx + s * rx * 1.08, cy, rx * 0.1, ry * 0.3, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  const wok = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry)
  wok.addColorStop(0, '#4a4a50')
  wok.addColorStop(0.5, '#1c1c20')
  wok.addColorStop(1, '#0b0b0d')
  ctx.fillStyle = wok
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#6a6a70'
  ctx.lineWidth = 2
  ctx.stroke()

  // 油／湯
  const irx = rx * 0.78
  const iry = ry * 0.7
  if (look.liquid) {
    ctx.fillStyle = look.liquid
    ctx.globalAlpha = 0.25 + 0.75 * Math.min(1, g.foodIn + (g.stage === 'oil' ? 0 : 0.4))
    ctx.beginPath()
    ctx.ellipse(cx, cy + 2, irx, iry, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    // 滾的泡泡
    const boilK = g.stage === 'flip' ? Math.min(1, g.browning / GOLD_LO) : g.heat * 0.4
    for (let i = 0; i < 14 * boilK; i++) {
      const a = (i * 2.39 + tn * 0.6) % (Math.PI * 2)
      const rr = ((i * 37) % 100) / 100
      const ph = (tn * (1.5 + (i % 3)) + i * 0.37) % 1
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ph)})`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * irx * rr * 0.85, cy + Math.sin(a) * iry * rr * 0.85, 2 + ph * 4, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else {
    // 油：越熱越亮，會閃
    const oil = ctx.createRadialGradient(cx - irx * 0.2, cy - iry * 0.3, 2, cx, cy, irx)
    oil.addColorStop(0, `rgba(255,230,140,${0.2 + g.heat * 0.45})`)
    oil.addColorStop(1, 'rgba(200,140,40,0.08)')
    ctx.fillStyle = oil
    ctx.beginPath()
    ctx.ellipse(cx, cy + 2, irx * 0.8, iry * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
    if (g.heat > 0.4) {
      ctx.strokeStyle = `rgba(255,245,200,${(g.heat - 0.4) * 0.6})`
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        const y = cy - iry * 0.4 + i * iry * 0.2
        ctx.beginPath()
        for (let x = -irx * 0.6; x <= irx * 0.6; x += 6) {
          const yy = y + Math.sin(x * 0.08 + tn * 9 + i) * 1.6
          if (x === -irx * 0.6) ctx.moveTo(cx + x, yy)
          else ctx.lineTo(cx + x, yy)
        }
        ctx.stroke()
      }
    }
  }

  // 鍋裡的食物
  if (g.foodIn > 0) {
    const b = g.browning
    const col = b < 0.85 ? mix(look.raw, look.gold, b / 0.85) : mix(look.gold, look.burnt, (b - 0.85) / 0.6)
    let lift = 0
    let flipS = 1
    if (g.flipT >= 0) {
      const k = Math.min(1, (tn - g.flipT) / 0.55)
      lift = Math.sin(k * Math.PI) * ry * 2.4
      flipS = Math.cos(k * Math.PI * 2)
    }
    ctx.save()
    ctx.translate(cx, cy - lift)
    ctx.scale(1, Math.max(0.08, Math.abs(flipS)))
    ctx.globalAlpha = g.foodIn
    if (boil) {
      // 湯裡的料：一塊一塊
      for (let i = 0; i < 9; i++) {
        const a = i * 2.1 + tn * 0.25
        const rr = 0.25 + ((i * 53) % 60) / 100
        ctx.fillStyle = i % 3 === 0 ? look.drops[1]?.color ?? col : col
        ctx.beginPath()
        ctx.ellipse(Math.cos(a) * irx * rr * 0.7, Math.sin(a) * iry * rr * 0.7, 7, 4, a, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.fillStyle = col
      ctx.beginPath()
      blob(ctx, irx * 0.62, iry * 0.72, tn)
      ctx.fill()
      // 焦斑
      ctx.fillStyle = `rgba(90,45,10,${clamp01((b - 0.5) * 0.9)})`
      for (let i = 0; i < 10; i++) {
        const a = i * 2.4
        ctx.beginPath()
        ctx.arc(Math.cos(a) * irx * 0.4 * ((i % 4) / 4 + 0.2), Math.sin(a) * iry * 0.5 * ((i % 3) / 3 + 0.2), 3, 0, Math.PI * 2)
        ctx.fill()
      }
      // 配料的顏色點
      for (let i = 0; i < 14; i++) {
        const d = look.drops[i % 3]
        if (!d || i % 3 === 1) continue
        const a = i * 1.7
        ctx.fillStyle = d.color
        ctx.beginPath()
        ctx.arc(Math.cos(a) * irx * 0.45 * ((i % 5) / 5 + 0.15), Math.sin(a) * iry * 0.5 * ((i % 4) / 4 + 0.1), 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  // 正在掉進鍋子的料
  for (const d of g.drops) {
    if (d.landed) continue
    d.vy += 900 * dt
    d.y += d.vy * dt
    d.rot += d.vr * dt
    if (d.y >= cy) {
      d.landed = true
      for (let i = 0; i < 10; i++) spawn(g, d.x, cy, boil ? 'steam' : 'spatter')
      continue
    }
    ctx.save()
    ctx.translate(d.x, d.y)
    ctx.rotate(d.rot)
    ctx.fillStyle = d.color
    ctx.beginPath()
    ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // 下料的節拍圈
  if (g.stage === 'drop') {
    const t = tn - g.t0
    const target = rx * 0.42
    for (const b of g.beats) {
      if (b.score !== null) continue
      const k = (b.at - t) / RING_T
      if (k > 1 || k < -0.4) continue
      const rr = target * (1 + Math.max(0, k) * 2.2)
      ctx.strokeStyle = `rgba(255,213,138,${k < 0 ? 0.3 : 0.9})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(cx, cy, rr, rr * 0.36, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.setLineDash([5, 5])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, target, target * 0.36, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // 油花、蒸氣
  if (!boil && g.heat > 0.55 && g.stage !== 'reveal' && Math.random() < (g.heat - 0.5) * 0.6) spawn(g, cx + (Math.random() - 0.5) * irx, cy, 'spatter')
  if (g.foodIn > 0 && Math.random() < 0.35) spawn(g, cx + (Math.random() - 0.5) * irx * 1.2, cy - iry * 0.3, 'steam')
  if (g.stage === 'flip' && g.browning > GOLD_HI && Math.random() < 0.4) spawn(g, cx + (Math.random() - 0.5) * irx, cy, 'steam')
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i]
    p.life += dt
    if (p.life >= p.max) {
      g.particles.splice(i, 1)
      continue
    }
    const k = p.life / p.max
    if (p.kind === 'spatter') {
      p.vy += 700 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      ctx.fillStyle = `rgba(255,236,170,${1 - k})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    } else {
      p.x += p.vx * dt + Math.sin(tn * 2 + i) * 0.3
      p.y += p.vy * dt
      const burnt = g.stage === 'flip' && g.browning > GOLD_HI ? 0.45 : 0
      const c = Math.round(235 - burnt * 150)
      ctx.fillStyle = `rgba(${c},${c},${c},${0.22 * (1 - k)})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * (1 + k * 2.5), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 判定字
  if (g.judge) {
    const k = (tn - g.judge.t) / 0.9
    if (k < 1) {
      ctx.save()
      ctx.globalAlpha = 1 - k * k
      ctx.font = `700 ${Math.round(26 + (1 - k) * 6)}px "LXGW WenKai TC", "Noto Serif TC", serif`
      ctx.textAlign = 'center'
      ctx.fillStyle = g.judge.good ? '#ffd58a' : '#ff9a8a'
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = 8
      ctx.fillText(g.judge.text, cx, cy - ry * 2.1 - k * 14)
      ctx.restore()
    } else g.judge = null
  }
  ctx.restore()
}

function spawn(g: Game, x: number, y: number, kind: Particle['kind']) {
  if (g.particles.length > 160) return
  if (kind === 'spatter') g.particles.push({ x, y, vx: (Math.random() - 0.5) * 260, vy: -160 - Math.random() * 220, life: 0, max: 0.5 + Math.random() * 0.3, kind, r: 1 + Math.random() * 1.6 })
  else g.particles.push({ x, y, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30, life: 0, max: 1.4 + Math.random() * 0.8, kind, r: 6 + Math.random() * 6 })
}

function blob(ctx: CanvasRenderingContext2D, rx: number, ry: number, t: number) {
  const n = 22
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const w = 1 + Math.sin(a * 3 + 1.3) * 0.07 + Math.sin(a * 5 + t * 0.8) * 0.03
    const x = Math.cos(a) * rx * w
    const y = Math.sin(a) * ry * w
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
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
