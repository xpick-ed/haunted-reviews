import { box, rect, resolve, type Circle, type Colliders, type Rect } from './collision'
import { seeded } from './rng'
import { DREAM_SCENE } from './sceneDream'
import type { GuestId } from './night/types'

// 托夢（DESIGN §25.1）：阿嬤進入睡著客人的夢，40 秒內幫他完成一件事。
// 三種玩法：陪走（escort）、收集（collect）、找人（find）；每位客人一個主題。
// 這個檔案是純邏輯（不碰畫面），Node 也能跑：scripts/sim-dream.ts 用機器人把每場夢玩一遍。
// 畫面在 src/scene/Dream.tsx（每幀呼叫 stepDream），HUD 在 src/ui/DreamHud.tsx。

type XZ = [number, number]

export type DreamMode = 'escort' | 'collect' | 'find'
export type DreamTheme = 'market' | 'fog' | 'oldvillage' | 'office' | 'mountain' | 'toys' | 'studio'

/** 擋路的道具（碰撞＋畫面共用）。kind 決定畫成什麼 */
export interface Block {
  x: number
  z: number
  w: number
  d: number
  h: number
  kind: string
  /** 同一種道具的變化（顏色、字母……） */
  v?: number
}

/** 圓形的擋路道具（樹、柱子、花莖） */
export interface Post {
  x: number
  z: number
  r: number
  h: number
  kind: string
  v?: number
}

export interface DreamPalette {
  /** 背景大球：上、下 */
  skyTop: string
  skyBottom: string
  fog: string
  /** 霧從幾公尺開始、幾公尺全白（鏡頭離阿嬤大約 19–26 公尺） */
  fogNear: number
  fogFar: number
  ground: string
  groundEdge: string
  /** 亮點、目標光圈 */
  accent: string
  /** 場景主光、補光 */
  light: string
  fill: string
  particles: string
  /** 整體亮度 0..1（夜市、攝影棚暗；玩具、老街亮） */
  bright: number
}

export interface DreamLayout {
  bounds: Rect
  /** 阿嬤出現的地方 */
  spawn: XZ
  blocks: Block[]
  posts: Post[]
  /** 不擋路的裝飾（燈籠、路面、鐵軌……） */
  deco: Block[]
  /** 陪走：做夢的人出發點與終點 */
  dreamer?: XZ
  goal?: XZ
  /** 陪走：追做夢的人的影子出生點 */
  shadows?: XZ[]
  /** 陪走：回憶點（做夢的人經過會停下來說一句） */
  stops?: { x: number; z: number; line: string }[]
  /** 收集：東西的位置 */
  items?: XZ[]
  /** 收集：老闆巡邏的路線（繞圈） */
  patrol?: XZ[]
  /** 找人：可以躲的地方 */
  spots?: XZ[]
  /** 設計好的路線（機器人測試跟著走；陪走時也是正解） */
  route: XZ[]
}

export interface DreamDef {
  guest: GuestId
  title: string
  mode: DreamMode
  theme: DreamTheme
  /** 目標說明（HUD） */
  objective: string
  /** 收集的東西叫什麼（HUD：簡報 3/5） */
  itemName?: string
  duration: number
  /** 學了「好夢」：時間 +15 秒、影子慢、老闆看不遠、提示比較多 */
  easy: boolean
  palette: DreamPalette
  layout: DreamLayout
  /** 台詞 id（dream.lines.json） */
  lines: {
    start: string
    win: string
    lose: string
    follow?: string
    lost?: string
    scared?: string
    pick?: string
    caught?: string
    patrol?: string
    hint?: string[]
    wrong?: string
    found?: string
    runner?: string
  }
}

// ---------------------------------------------------------------------------
// 版面：每個主題一張地圖
// ---------------------------------------------------------------------------

const B = (x: number, z: number, w: number, d: number, h: number, kind: string, v?: number): Block => ({ x, z, w, d, h, kind, v })

/** 一排攤位：從 x0 到 x1 平均切成幾格（中間不留縫，阿嬤過不去） */
function row(x0: number, x1: number, z: number, d: number, h: number, kind: string, cell = 2.4): Block[] {
  const n = Math.max(1, Math.round((x1 - x0) / cell))
  const w = (x1 - x0) / n
  return Array.from({ length: n }, (_, i) => B(x0 + w * (i + 0.5), z, w, d, h, kind, i))
}

/** 在範圍裡撒一些圓形道具，避開幾個不能擋的點 */
function scatter(seed: number, n: number, area: Rect, avoid: XZ[], minGap: number, make: (x: number, z: number, r: () => number) => Post): Post[] {
  const r = seeded(seed)
  const out: Post[] = []
  for (let tries = 0; out.length < n && tries < n * 60; tries++) {
    const x = area.x0 + r() * (area.x1 - area.x0)
    const z = area.z0 + r() * (area.z1 - area.z0)
    if (avoid.some(([ax, az]) => Math.hypot(ax - x, az - z) < minGap)) continue
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 2.1)) continue
    out.push(make(x, z, r))
  }
  return out
}

const BOUNDS = rect(-11, -13, 11, 12)

function marketLayout(): DreamLayout {
  // 沒有人的夜市：三排攤位，每排的缺口錯開，要走 Z 字
  const blocks = [
    ...row(-11, -2.5, 6, 1.6, 2.2, 'stall'),
    ...row(1.5, 11, 6, 1.6, 2.2, 'stall'),
    ...row(-11, -7, 0.5, 1.6, 2.2, 'stall'),
    ...row(-3, 11, 0.5, 1.6, 2.2, 'stall'),
    ...row(-11, 3, -5, 1.6, 2.2, 'stall'),
    ...row(7, 11, -5, 1.6, 2.2, 'stall'),
  ]
  const deco = [
    // 攤位上面的燈籠串（每條走道一條）
    B(-0.5, 8.6, 20, 0.1, 3.2, 'lanterns'),
    B(0, 3.2, 20, 0.1, 3.2, 'lanterns', 1),
    B(0, -2.3, 20, 0.1, 3.2, 'lanterns', 2),
    B(0, -8.2, 20, 0.1, 3.2, 'lanterns', 3),
  ]
  return {
    bounds: BOUNDS,
    spawn: [1.2, 10.4],
    dreamer: [-0.6, 10.8],
    goal: [0, -11.8],
    blocks,
    posts: [],
    deco,
    shadows: [
      [-8, 3.2],
      [7, 3.2],
      [-6.5, -2.3],
      [8.5, -8],
      [-3, -8.5],
    ],
    route: [
      [-0.5, 8.5],
      [-0.5, 3.2],
      [-5, 3.2],
      [-5, -2.3],
      [5, -2.3],
      [5, -8],
      [0, -11.3],
    ],
  }
}

function fogLayout(): DreamLayout {
  const spawn: XZ = [6.5, 10.4]
  const goal: XZ = [-6.5, -11]
  const route: XZ[] = [
    [4, 6],
    [0, 1],
    [-3, -4],
    [-6.5, -10.5],
  ]
  // 霧裡的巨大花莖與路燈：避開起點、終點、路線
  const posts = scatter(71, 16, rect(-10.5, -12.5, 10.5, 11.5), [spawn, goal, [7.5, 11], ...route], 2.2, (x, z, r) => ({
    x,
    z,
    r: 0.45 + r() * 0.5,
    h: 3 + r() * 3,
    kind: r() < 0.55 ? 'flower' : 'lamp',
    v: Math.floor(r() * 4),
  }))
  return {
    bounds: BOUNDS,
    spawn,
    dreamer: [7.6, 10.9],
    goal,
    blocks: [],
    posts,
    deco: [],
    shadows: [
      [-6, 6],
      [6, -2],
      [-8, -3],
      [3, -9],
    ],
    route,
  }
}

function oldVillageLayout(): DreamLayout {
  // 以前的街仔路：兩排老房子，中間轉一個彎
  const blocks = [
    B(-8.5, 8.5, 5, 4, 3.2, 'house', 0),
    B(-8.5, 2.5, 5, 5, 3.4, 'house', 1),
    B(-8.5, -4.5, 5, 5, 3.2, 'house', 2),
    // 靠鏡頭這一側（東邊）的房子矮一點，不然會擋住阿嬤
    B(8, 8.5, 6, 4, 2.2, 'house', 3),
    B(7.5, 2.8, 7, 4, 2.3, 'house', 4),
    B(8.5, -3.5, 5, 5, 2.4, 'house', 5),
    // 轉彎：右邊的房子凸出來
    B(4, -7.5, 7, 3, 3.2, 'house', 6),
    B(-8.5, -10.5, 5, 3, 3, 'house', 7),
  ]
  const posts: Post[] = [
    { x: -3.6, z: 5.8, r: 0.7, h: 0.9, kind: 'well' },
    { x: -2.8, z: -5.8, r: 1.1, h: 5, kind: 'banyan' },
  ]
  return {
    bounds: BOUNDS,
    spawn: [0.6, 10.4],
    dreamer: [-0.6, 10.9],
    goal: [0.2, -11.6],
    blocks,
    posts,
    deco: [B(0, 0, 4.2, 26, 0.02, 'street')],
    stops: [
      { x: -2.4, z: 5.8, line: 'well' },
      { x: 3.3, z: 1.2, line: 'shop' },
      { x: -1.4, z: -4.8, line: 'tree' },
    ],
    route: [
      [0, 6],
      [1.5, 1.2],
      [-0.5, -4.5],
      [-2, -9.2],
      [0.2, -11.2],
    ],
  }
}

function officeLayout(): DreamLayout {
  // 沒有盡頭的辦公室：三排辦公桌、檔案櫃（擋視線），走道是老闆巡邏的路
  const blocks: Block[] = []
  for (const z of [6, 0, -6]) for (const x of [-7, -1.5, 4.5]) blocks.push(B(x, z, 3.4, 1.8, 1.0, 'desk', blocks.length))
  blocks.push(B(9.8, 4.5, 1.2, 2.4, 1.9, 'cabinet'), B(-10, -1, 1.2, 2.4, 1.9, 'cabinet', 1), B(8, -6.2, 1.6, 1.2, 1.9, 'cabinet', 2))
  return {
    bounds: rect(-11, -12, 11, 12),
    spawn: [2, 10.4],
    dreamer: [-0.5, 10.9],
    blocks,
    posts: [
      { x: -9.8, z: 9.8, r: 0.5, h: 1.6, kind: 'plant' },
      { x: 10, z: -10.4, r: 0.5, h: 1.6, kind: 'plant', v: 1 },
    ],
    deco: [],
    items: [
      [-4.25, 6],
      [7.8, 0],
      [-9.8, -6],
      [1.5, -6],
      [-4.25, -9.6],
    ],
    patrol: [
      [-9.5, 9.2],
      [9.5, 9.2],
      [9.5, -9.5],
      [1.5, -9.5],
      [1.5, 3],
      [-9.5, 3],
    ],
    route: [
      [-4.25, 9],
      [-4.25, 6],
      [-4.25, 3],
      [7.8, 3],
      [7.8, 0],
      [7.8, -3],
      [-9.8, -3],
      [-9.8, -6],
      [-9.8, -9.3],
      [-4.25, -9.6],
      [1.5, -9.3],
      [1.5, -6],
    ],
  }
}

function mountainLayout(): DreamLayout {
  const spawn: XZ = [2, 10.4]
  const items: XZ[] = [
    [-8, 7],
    [7, 4],
    [-5, -2],
    [6, -7],
    [-3, -11],
  ]
  const route: XZ[] = [[-8, 7], [7, 4], [-5, -2], [6, -7], [-3, -11]]
  const posts = scatter(37, 18, rect(-10.5, -12.5, 10.5, 11.5), [spawn, [0, 9.4], ...items, [0.5, 1.5], [0.5, -4.5], [1.5, -9]], 2.3, (x, z, r) => ({
    x,
    z,
    r: 0.55 + r() * 0.6,
    h: 2 + r() * 3,
    kind: r() < 0.6 ? 'pine' : 'rock',
    v: Math.floor(r() * 3),
  }))
  return {
    bounds: BOUNDS,
    spawn,
    dreamer: [0, 9.4],
    blocks: [],
    posts,
    deco: [],
    items,
    route,
  }
}

function toysLayout(): DreamLayout {
  // 巨大的積木堆：小宇躲在積木後面（鏡頭看不到的那一側）
  const blocks = [
    B(-6, 6, 2, 2, 2, 'toy', 0),
    B(-1, 5, 2.4, 2.4, 3, 'toy', 1),
    B(5, 7, 2, 2, 1.6, 'toy', 2),
    B(7, 1, 2.6, 2.6, 2.6, 'toy', 3),
    B(-7, -1, 2.2, 2.2, 2.2, 'toy', 4),
    B(0, -2, 1.8, 1.8, 1.8, 'toy', 5),
    B(5, -6, 2.4, 2.4, 3, 'toy', 6),
    B(-4, -7, 2, 2, 2, 'toy', 7),
    B(-9, -10.5, 1.6, 1.6, 1.6, 'toy', 8),
    B(8.5, -10.5, 2, 2, 2, 'toy', 9),
  ]
  const posts: Post[] = [
    { x: 2.5, z: 1.5, r: 0.8, h: 1.6, kind: 'ball' },
    { x: -3.5, z: 1.8, r: 0.7, h: 2, kind: 'bear' },
    { x: 9, z: 7.5, r: 0.6, h: 2.4, kind: 'rocket' },
  ]
  const spots: XZ[] = blocks.map((b) => [b.x - b.w / 2 - 0.55, b.z - b.d / 2 - 0.35])
  return {
    bounds: rect(-11, -12.5, 11, 12),
    spawn: [0, 10.4],
    blocks,
    posts,
    deco: [B(0, 0, 18, 18, 0.02, 'track')],
    spots,
    route: [...spots.slice(0, 8), [-9, -9.2], ...spots.slice(8)],
  }
}

function studioLayout(): DreamLayout {
  // 鬧鬼的電視攝影棚：棺材、墓碑、布幕、燈架
  const blocks = [
    B(-6.5, 5.5, 2.4, 1, 0.9, 'coffin'),
    B(5.5, 6.5, 1.4, 0.5, 1.4, 'tomb', 0),
    B(7.5, 6.2, 1.2, 0.5, 1.2, 'tomb', 1),
    B(-9.6, -1, 0.4, 7, 3.4, 'curtain'),
    B(0, -11.4, 12, 0.4, 3.6, 'screen'),
    B(2.5, -1.5, 2.6, 1.6, 1.2, 'console'),
    B(-4, -6.5, 2, 1.2, 1.1, 'coffin', 1),
    B(8, -4.5, 1.6, 1.6, 1.8, 'crate'),
  ]
  const posts: Post[] = [
    { x: -2, z: 8, r: 0.35, h: 3, kind: 'spot' },
    { x: 9.5, z: 0.5, r: 0.35, h: 3, kind: 'spot', v: 1 },
    { x: -8.5, z: -9.5, r: 0.35, h: 3, kind: 'spot', v: 2 },
    { x: 5.5, z: 1.5, r: 0.6, h: 2.2, kind: 'crane' },
    { x: -1.5, z: 2.5, r: 0.5, h: 1, kind: 'chair' },
  ]
  const spots: XZ[] = [
    [-6.5, 4.5],
    [4.4, 5.7],
    [-8.9, 2.2],
    [2.5, -2.8],
    [-4, -7.6],
    [8, -5.8],
    [-5.5, -10.5],
    [6.5, -10.4],
  ]
  return {
    bounds: rect(-11, -12.5, 11, 12),
    spawn: [0, 10.4],
    dreamer: [1.8, 10.9],
    blocks,
    posts,
    deco: [],
    spots,
    route: [...spots],
  }
}

// ---------------------------------------------------------------------------
// 每位客人的夢
// ---------------------------------------------------------------------------

const PALETTES: Record<DreamTheme, DreamPalette> = {
  market: { skyTop: '#0c0620', skyBottom: '#4a1f5e', fog: '#1e0f30', fogNear: 26, fogFar: 62, ground: '#241c36', groundEdge: '#4a3466', accent: '#ffd36e', light: '#ff9ad5', fill: '#5a6bd8', particles: '#ffb8f0', bright: 0.25 },
  fog: { skyTop: '#2c3550', skyBottom: '#9aa6bd', fog: '#8a94ab', fogNear: 17, fogFar: 36, ground: '#5d6a7c', groundEdge: '#8f9bb0', accent: '#fff2b0', light: '#dfe8ff', fill: '#9fb4ff', particles: '#ffffff', bright: 0.6 },
  oldvillage: { skyTop: '#6b4a2e', skyBottom: '#f0c98a', fog: '#caa272', fogNear: 28, fogFar: 70, ground: '#a58a62', groundEdge: '#7b6445', accent: '#fff0c8', light: '#ffd9a0', fill: '#c8a0ff', particles: '#fff3d0', bright: 0.85 },
  office: { skyTop: '#060a14', skyBottom: '#1d3350', fog: '#0f1c2e', fogNear: 26, fogFar: 60, ground: '#3c4654', groundEdge: '#26303c', accent: '#7fe3ff', light: '#bfe4ff', fill: '#5a7cff', particles: '#9fd8ff', bright: 0.45 },
  mountain: { skyTop: '#1a2f5c', skyBottom: '#ff9f7a', fog: '#6a6a8a', fogNear: 28, fogFar: 70, ground: '#4f7a4a', groundEdge: '#6f5a3e', accent: '#ffe08a', light: '#ffd0a0', fill: '#8fb0ff', particles: '#fff0b0', bright: 0.75 },
  toys: { skyTop: '#4a7ad8', skyBottom: '#ffd0e8', fog: '#d8c8f0', fogNear: 30, fogFar: 75, ground: '#ffffff', groundEdge: '#f0a8c8', accent: '#fff27a', light: '#fff8f0', fill: '#e8f0ff', particles: '#fff6a8', bright: 0.75 },
  studio: { skyTop: '#050508', skyBottom: '#2a0d14', fog: '#12070b', fogNear: 24, fogFar: 55, ground: '#2a2626', groundEdge: '#141212', accent: '#ff3b3b', light: '#fff0d0', fill: '#7a2a4a', particles: '#ff9a9a', bright: 0.3 },
}

const NAMES: Record<GuestId, string> = {
  xiaomei: '小美',
  akai: '阿凱',
  zhang: '張經理',
  ahao: '阿豪',
  xiaoyu: '小宇',
  linmom: '林太太',
  agui: '阿桂',
  atu: '阿土伯',
  ajie: '阿傑',
  xiaohui: '小惠',
  mrwang: '王先生',
  mrswang: '王太太',
  zhiming: '志明',
  fubo: '福伯',
  zhiwei: '志偉',
  gg_shuimu: '水木伯',
  gg_bangsi: '罔市姆',
  gg_soldier: '陳班長',
  gg_opera: '秋月',
}

/** 某位客人的夢（easy：學了「好夢」） */
export function dreamFor(guest: GuestId, easy = false): DreamDef {
  const base = { guest, title: `${NAMES[guest]}的夢`, easy, duration: 40 + (easy ? 15 : 0) }
  const gm = { lose: 'dream.gm.lose' }
  switch (guest) {
    case 'xiaomei':
      return {
        ...base,
        mode: 'escort',
        theme: 'market',
        objective: '帶小美走出空無一人的夜市（靠近影子可以把它趕走）',
        palette: PALETTES.market,
        layout: marketLayout(),
        lines: { ...gm, start: 'dream.xiaomei.start', win: 'dream.xiaomei.win', follow: 'dream.xiaomei.follow', lost: 'dream.xiaomei.lost', scared: 'dream.xiaomei.scared' },
      }
    case 'linmom':
      return {
        ...base,
        mode: 'escort',
        theme: 'fog',
        objective: '帶林太太穿過大霧，找到小宇',
        palette: PALETTES.fog,
        layout: fogLayout(),
        lines: { ...gm, start: 'dream.linmom.start', win: 'dream.linmom.win', follow: 'dream.linmom.follow', lost: 'dream.linmom.lost', scared: 'dream.linmom.scared' },
      }
    case 'agui':
    case 'atu':
      return {
        ...base,
        mode: 'escort',
        theme: 'oldvillage',
        title: `${NAMES[guest]}的夢：以前的街仔路`,
        objective: `陪${NAMES[guest]}走回阿春以前的家`,
        palette: PALETTES.oldvillage,
        layout: oldVillageLayout(),
        lines: { ...gm, start: `dream.${guest}.start`, win: `dream.${guest}.win`, follow: `dream.${guest}.follow`, lost: `dream.${guest}.lost` },
      }
    case 'zhang':
      return {
        ...base,
        mode: 'collect',
        theme: 'office',
        objective: '撿回 5 張散掉的簡報，別被老闆的影子看到',
        itemName: '簡報',
        palette: PALETTES.office,
        layout: officeLayout(),
        lines: { ...gm, start: 'dream.zhang.start', win: 'dream.zhang.win', pick: 'dream.zhang.pick', caught: 'dream.boss.caught', patrol: 'dream.boss.patrol' },
      }
    case 'ahao':
      return {
        ...base,
        mode: 'collect',
        theme: 'mountain',
        objective: '幫阿豪撿回 5 樣飛走的食物（有一顆肉粽會跑）',
        itemName: '食物',
        palette: PALETTES.mountain,
        layout: mountainLayout(),
        lines: { ...gm, start: 'dream.ahao.start', win: 'dream.ahao.win', pick: 'dream.ahao.pick', runner: 'dream.ahao.runner' },
      }
    case 'xiaoyu':
      return {
        ...base,
        mode: 'find',
        theme: 'toys',
        objective: easy ? '捉迷藏：找到躲在積木後面的小宇' : '捉迷藏：找到躲在積木後面的小宇（兩次）',
        palette: PALETTES.toys,
        layout: toysLayout(),
        lines: { ...gm, start: 'dream.xiaoyu.start', win: 'dream.xiaoyu.win', hint: ['dream.xiaoyu.giggle.1', 'dream.xiaoyu.giggle.2', 'dream.xiaoyu.giggle.3'], wrong: 'dream.xiaoyu.cold', found: 'dream.xiaoyu.found' },
      }
    case 'akai':
      return {
        ...base,
        mode: 'find',
        theme: 'studio',
        objective: '在鬧鬼的攝影棚裡找到阿凱的攝影機（紅燈會閃）',
        palette: PALETTES.studio,
        layout: studioLayout(),
        lines: { ...gm, start: 'dream.akai.start', win: 'dream.akai.win', hint: ['dream.akai.hint.1', 'dream.akai.hint.2'], wrong: 'dream.akai.wrong' },
      }
    default:
      // 大人的客人（DESIGN §29）：在大霧裡陪他走一段（台詞 dream.<id>.start／win／follow／lost／scared 由各自的模組補）
      return {
        ...base,
        mode: 'escort',
        theme: 'fog',
        objective: `陪${NAMES[guest]}走出大霧`,
        palette: PALETTES.fog,
        layout: fogLayout(),
        lines: { ...gm, start: `dream.${guest}.start`, win: `dream.${guest}.win`, follow: `dream.${guest}.follow`, lost: `dream.${guest}.lost`, scared: `dream.${guest}.scared` },
      }
  }
}

// ---------------------------------------------------------------------------
// 執行中的夢
// ---------------------------------------------------------------------------

export interface Actor {
  x: number
  z: number
  heading: number
  speed: number
}

export interface Shadow extends Actor {
  alive: boolean
  respawnT: number
  tx: number
  tz: number
  /** 出生時間（畫面淡入） */
  born: number
}

export interface Item {
  x: number
  z: number
  home: XZ
  got: boolean
  runner: boolean
}

export interface Spot {
  x: number
  z: number
  /** 最近一次被翻過的時間（畫面：噗一下） */
  checkedAt: number
}

export type DreamEvent =
  | { t: 'bark'; id: string }
  | { t: 'sfx'; name: 'pickup' | 'whoosh' | 'chime' | 'caught' | 'scared' | 'beep' | 'poof' | 'found' }
  | { t: 'poof'; x: number; z: number }
  /** 找人：笑聲／嗶聲從這附近傳來（畫面在這裡冒「嘻嘻」；有偏差，還是要找一下） */
  | { t: 'hint'; x: number; z: number }
  | { t: 'end'; ok: boolean }

export interface DreamRT {
  def: DreamDef
  colliders: Colliders
  /** 經過秒數 */
  t: number
  /** 被扣掉的時間（嚇到、被抓到） */
  penalty: number
  done: boolean
  ok: boolean
  /** 結束後經過秒數（結束卡片顯示 1.2 秒才真的醒來） */
  endT: number
  /** 0..1 */
  progress: number
  // 陪走
  dreamer: Actor & { scaredT: number; pauseT: number; lostT: number; following: boolean; happy: boolean }
  /** 阿嬤走過的腳印：做夢的人沿著腳印走，轉角才不會卡住 */
  trail: XZ[]
  startDist: number
  shadows: Shadow[]
  stopsDone: boolean[]
  // 收集
  items: Item[]
  got: number
  boss: (Actor & { i: number; seeT: number; cool: number; alarm: number }) | null
  // 找人
  spots: Spot[]
  target: number
  rounds: number
  found: number
  hintT: number
  /** 找到的那一刻（畫面：跳出來） */
  revealT: number
  lastReveal: XZ | null
  events: DreamEvent[]
  barkAt: Record<string, number>
  lastBark: number
  rnd: () => number
}

/** 目前的夢（畫面、HUD 每幀讀） */
export const dreamState: { rt: DreamRT | null } = { rt: null }

const FOLLOW_R = 3.2
const SHADOW_R = 0.4

/** 開始一場夢：換掉 DREAM_SCENE 的碰撞與出生點，回傳執行狀態 */
export function startDream(def: DreamDef, seed = 1): DreamRT {
  const L = def.layout
  const colliders: Colliders = {
    rects: L.blocks.filter((b) => b.h > 0.2).map((b) => box(b.x, b.z, b.w, b.d)),
    circles: L.posts.map((p): Circle => ({ x: p.x, z: p.z, r: p.r })),
    bounds: L.bounds,
  }
  DREAM_SCENE.colliders = colliders
  DREAM_SCENE.spawns = { start: L.spawn }
  DREAM_SCENE.name = def.title
  const rnd = seeded(seed * 977 + 13)
  const d = L.dreamer ?? L.spawn
  const rt: DreamRT = {
    def,
    colliders,
    t: 0,
    penalty: 0,
    done: false,
    ok: false,
    endT: 0,
    progress: 0,
    dreamer: { x: d[0], z: d[1], heading: Math.PI, speed: 0, scaredT: 0, pauseT: 0, lostT: 0, following: false, happy: false },
    trail: [],
    startDist: L.goal ? Math.hypot(L.goal[0] - d[0], L.goal[1] - d[1]) : 1,
    shadows: [],
    stopsDone: (L.stops ?? []).map(() => false),
    items: (L.items ?? []).map((p, i) => ({ x: p[0], z: p[1], home: p, got: false, runner: def.theme === 'mountain' && i === 3 })),
    got: 0,
    boss: null,
    spots: (L.spots ?? []).map((p) => ({ x: p[0], z: p[1], checkedAt: -99 })),
    target: -1,
    rounds: def.mode === 'find' && def.theme === 'toys' && !def.easy ? 2 : 1,
    found: 0,
    hintT: 3,
    revealT: -99,
    lastReveal: null,
    events: [],
    barkAt: {},
    lastBark: -99,
    rnd,
  }
  // 影子：好夢少一隻
  const sh = L.shadows ?? []
  for (const [x, z] of sh.slice(0, def.easy ? Math.max(2, sh.length - 2) : sh.length)) {
    rt.shadows.push({ x, z, heading: 0, speed: 0, alive: true, respawnT: 0, tx: x, tz: z, born: 0 })
  }
  if (L.patrol) {
    const [x, z] = L.patrol[0]
    rt.boss = { x, z, heading: 0, speed: 0, i: 1, seeT: 0, cool: 0, alarm: 0 }
  }
  if (rt.spots.length) rt.target = pickSpot(rt, -1)
  return rt
}

function pickSpot(rt: DreamRT, not: number) {
  // 第二回合：小宇跑到附近另一個地方躲（4–9 公尺），不會跑到地圖另一頭
  if (not >= 0) {
    const from = rt.spots[not]
    const near = rt.spots.map((s, i) => [i, Math.hypot(s.x - from.x, s.z - from.z)] as const).filter(([i, d]) => i !== not && d > 4 && d < 9)
    if (near.length) return near[Math.floor(rt.rnd() * near.length)][0]
  }
  let i = not
  // 不要選離阿嬤出生點太近的
  for (let k = 0; k < 20 && (i === not || Math.hypot(rt.spots[i].x - rt.def.layout.spawn[0], rt.spots[i].z - rt.def.layout.spawn[1]) < 6); k++) {
    i = Math.floor(rt.rnd() * rt.spots.length)
  }
  return i
}

function bark(rt: DreamRT, id: string | undefined, cool = 6) {
  if (!id) return
  if (rt.t - (rt.barkAt[id] ?? -99) < cool) return
  if (rt.t - rt.lastBark < 1.6) return
  rt.barkAt[id] = rt.t
  rt.lastBark = rt.t
  rt.events.push({ t: 'bark', id })
}

const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

function moveToward(a: Actor, tx: number, tz: number, speed: number, dt: number, stopAt = 0) {
  const dx = tx - a.x
  const dz = tz - a.z
  const d = Math.hypot(dx, dz)
  if (d <= stopAt + 1e-3) {
    a.speed = 0
    return d
  }
  const step = Math.min(d - stopAt, speed * dt)
  a.x += (dx / d) * step
  a.z += (dz / d) * step
  a.speed = step / Math.max(dt, 1e-4)
  a.heading = Math.atan2(dx, dz)
  return d
}

/** 視線：牆（高 ≥ 1.4 的道具）擋住就看不到 */
function lineClear(rt: DreamRT, ax: number, az: number, bx: number, bz: number) {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25)
  for (let i = 1; i < n; i++) {
    const x = ax + ((bx - ax) * i) / n
    const z = az + ((bz - az) * i) / n
    for (const b of rt.def.layout.blocks) {
      if (b.h < 1.4) continue
      if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return false
    }
  }
  return true
}

export const BOSS_RANGE = (easy: boolean) => (easy ? 4 : 5.2)
export const BOSS_HALF = (easy: boolean) => ((easy ? 30 : 40) * Math.PI) / 180

/**
 * 推進一幀。gm 是阿嬤的位置與速度（站著不動，老闆的影子比較看不到）。回傳這幀的事件（台詞、音效、結束）。
 * 結束後還會再跑 1.2 秒（結束卡片），然後回傳 { t: 'end' } 一次。
 */
export function stepDream(rt: DreamRT, dt: number, gm: { x: number; z: number; speed: number }): DreamEvent[] {
  rt.events = []
  if (rt.done) {
    const before = rt.endT
    rt.endT += dt
    if (before < 1.2 && rt.endT >= 1.2) rt.events.push({ t: 'end', ok: rt.ok })
    rt.dreamer.speed = 0
    return rt.events
  }
  const t0 = rt.t
  rt.t += dt
  const def = rt.def
  // 開場：做夢的人先說一句，幾秒後阿嬤說一句（說明怎麼玩）
  if (t0 < 0.8 && rt.t >= 0.8) bark(rt, def.lines.start, 0)
  if (t0 < 3.4 && rt.t >= 3.4) {
    rt.lastBark = -99
    bark(rt, `dream.gm.${def.mode}`, 0)
  }
  if (def.mode === 'escort') stepEscort(rt, dt, gm)
  else if (def.mode === 'collect') stepCollect(rt, dt, gm)
  else stepFind(rt, dt, gm)

  if (!rt.done && rt.t + rt.penalty >= def.duration) finish(rt, false)
  return rt.events
}

function finish(rt: DreamRT, ok: boolean) {
  rt.done = true
  rt.ok = ok
  rt.endT = 0
  rt.dreamer.happy = ok
  if (ok) rt.progress = 1
  rt.events.push({ t: 'sfx', name: ok ? 'chime' : 'whoosh' })
  rt.lastBark = -99
  rt.events.push({ t: 'bark', id: ok ? rt.def.lines.win : rt.def.lines.lose })
}

/** 剩下幾秒（HUD） */
export function timeLeft(rt: DreamRT) {
  return Math.max(0, rt.def.duration - rt.t - rt.penalty)
}

// ---- 陪走 -------------------------------------------------------------------

function stepEscort(rt: DreamRT, dt: number, gm: { x: number; z: number }) {
  const L = rt.def.layout
  const D = rt.dreamer
  const easy = rt.def.easy
  const elder = rt.def.theme === 'oldvillage'
  D.scaredT = Math.max(0, D.scaredT - dt)
  D.pauseT = Math.max(0, D.pauseT - dt)
  const dGm = Math.hypot(gm.x - D.x, gm.z - D.z)
  const followR = FOLLOW_R + (easy ? 0.8 : 0)
  const was = D.following
  D.following = dGm < followR && D.scaredT <= 0
  if (D.scaredT > 0 || D.pauseT > 0) {
    D.speed = 0
  } else if (D.following) {
    D.lostT = 0
    if (!was) {
      rt.trail = [[gm.x, gm.z]]
      bark(rt, rt.def.lines.follow, 12)
    }
    // 沿著腳印走；離阿嬤 1.1 公尺就停
    const last = rt.trail[rt.trail.length - 1]
    if (!last || Math.hypot(gm.x - last[0], gm.z - last[1]) > 0.4) rt.trail.push([gm.x, gm.z])
    while (rt.trail.length > 1 && Math.hypot(rt.trail[0][0] - D.x, rt.trail[0][1] - D.z) < 0.45) rt.trail.shift()
    if (dGm > 1.1) {
      const [tx, tz] = rt.trail[0] ?? [gm.x, gm.z]
      moveToward(D, tx, tz, elder ? 1.8 : 2.35, dt)
      resolve(D, 0.3, rt.colliders)
    } else D.speed = 0
  } else {
    D.speed = 0
    D.lostT += dt
    // 找阿嬤：轉頭看她
    D.heading = Math.atan2(gm.x - D.x, gm.z - D.z)
    if (D.lostT > 2.5) bark(rt, rt.def.lines.lost, 9)
  }

  // 回憶點：老朋友經過會停下來說一句
  L.stops?.forEach((s, i) => {
    if (rt.stopsDone[i] || Math.hypot(s.x - D.x, s.z - D.z) > 1.5) return
    rt.stopsDone[i] = true
    D.pauseT = 2.2
    rt.lastBark = -99
    bark(rt, `dream.${rt.def.guest}.stop.${s.line}`, 0)
  })

  // 影子：飄來飄去，靠近做夢的人就追；阿嬤靠近就散掉
  const chase = easy ? 0.85 : 1.2
  for (const s of rt.shadows) {
    if (!s.alive) {
      s.respawnT -= dt
      if (s.respawnT <= 0) respawnShadow(rt, s)
      continue
    }
    const dD = Math.hypot(D.x - s.x, D.z - s.z)
    if (dD < (easy ? 4.5 : 6)) moveToward(s, D.x, D.z, chase, dt)
    else {
      if (Math.hypot(s.tx - s.x, s.tz - s.z) < 0.4 || rt.rnd() < dt * 0.2) {
        s.tx = L.bounds.x0 + rt.rnd() * (L.bounds.x1 - L.bounds.x0)
        s.tz = L.bounds.z0 + rt.rnd() * (L.bounds.z1 - L.bounds.z0)
      }
      moveToward(s, s.tx, s.tz, 0.7, dt)
    }
    resolve(s, SHADOW_R, rt.colliders)
    if (Math.hypot(gm.x - s.x, gm.z - s.z) < 1.3) {
      poofShadow(rt, s)
      bark(rt, 'dream.gm.shoo', 14)
      continue
    }
    if (dD < 0.75 && D.scaredT <= 0) {
      D.scaredT = easy ? 1.2 : 1.6
      // 往後退一步
      const k = 1.2 / Math.max(dD, 0.1)
      D.x += (D.x - s.x) * k
      D.z += (D.z - s.z) * k
      resolve(D, 0.3, rt.colliders)
      rt.penalty += easy ? 2 : 3
      rt.events.push({ t: 'sfx', name: 'scared' })
      rt.lastBark = -99
      bark(rt, rt.def.lines.scared, 4)
      poofShadow(rt, s)
    }
  }

  const [gx, gz] = L.goal!
  const dGoal = Math.hypot(gx - D.x, gz - D.z)
  rt.progress = Math.max(rt.progress, Math.min(1, 1 - dGoal / rt.startDist))
  if (dGoal < 1.9) finish(rt, true)
}

function poofShadow(rt: DreamRT, s: Shadow) {
  s.alive = false
  s.respawnT = 4
  rt.events.push({ t: 'poof', x: s.x, z: s.z }, { t: 'sfx', name: 'poof' })
}

function respawnShadow(rt: DreamRT, s: Shadow) {
  const L = rt.def.layout
  const D = rt.dreamer
  const opts = (L.shadows ?? []).filter(([x, z]) => Math.hypot(x - D.x, z - D.z) > 7)
  const [x, z] = opts.length ? opts[Math.floor(rt.rnd() * opts.length)] : (L.shadows ?? [[0, 0]])[0]
  Object.assign(s, { x, z, tx: x, tz: z, alive: true, born: rt.t })
}

// ---- 收集 -------------------------------------------------------------------

function stepCollect(rt: DreamRT, dt: number, gm: { x: number; z: number; speed: number }) {
  const easy = rt.def.easy
  for (const it of rt.items) {
    if (it.got) continue
    // 會跑的肉粽：阿嬤靠近就跑開
    if (it.runner) {
      const d = Math.hypot(gm.x - it.x, gm.z - it.z)
      if (d < 3.5 && d > 0.85) {
        const a: Actor = { x: it.x, z: it.z, heading: 0, speed: 0 }
        moveToward(a, it.x + (it.x - gm.x), it.z + (it.z - gm.z), easy ? 1.4 : 1.9, dt)
        const b = rt.def.layout.bounds
        a.x = Math.min(b.x1 - 0.6, Math.max(b.x0 + 0.6, a.x))
        a.z = Math.min(b.z1 - 0.6, Math.max(b.z0 + 0.6, a.z))
        resolve(a, 0.35, rt.colliders)
        it.x = a.x
        it.z = a.z
        bark(rt, rt.def.lines.runner, 15)
      }
    }
    if (Math.hypot(gm.x - it.x, gm.z - it.z) < 0.9) {
      it.got = true
      rt.got++
      rt.events.push({ t: 'sfx', name: 'pickup' })
      if (rt.got === 1 || rt.got === 3) bark(rt, rt.def.lines.pick, 5)
    }
  }
  rt.progress = rt.got / Math.max(1, rt.items.length)

  // 老闆的影子：沿著走道巡邏，看到阿嬤 0.5 秒就「抓到」：掉一張、扣時間
  const boss = rt.boss
  const route = rt.def.layout.patrol
  if (boss && route) {
    boss.cool = Math.max(0, boss.cool - dt)
    boss.alarm = Math.max(0, boss.alarm - dt)
    const [tx, tz] = route[boss.i]
    if (moveToward(boss, tx, tz, easy ? 1.2 : 1.6, dt) < 0.1) boss.i = (boss.i + 1) % route.length
    const dx = gm.x - boss.x
    const dz = gm.z - boss.z
    const d = Math.hypot(dx, dz)
    const inCone = d < BOSS_RANGE(easy) && Math.abs(wrapA(Math.atan2(dx, dz) - boss.heading)) < BOSS_HALF(easy) && lineClear(rt, boss.x, boss.z, gm.x, gm.z)
    if (inCone && boss.cool <= 0) {
      // 一二三木頭人：站著不動幾乎不會被發現（跟真實世界一樣）
      boss.seeT += dt * (gm.speed > 0.3 ? 1 : 0.12)
      if (boss.seeT > 0.5) {
        boss.seeT = 0
        boss.cool = 3
        boss.alarm = 1.2
        rt.penalty += easy ? 2 : 4
        const had = rt.items.filter((i) => i.got)
        const drop = had[had.length - 1]
        if (drop) {
          drop.got = false
          drop.x = drop.home[0]
          drop.z = drop.home[1]
          rt.got--
        }
        rt.events.push({ t: 'sfx', name: 'caught' })
        rt.lastBark = -99
        bark(rt, rt.def.lines.caught, 3)
      }
    } else {
      boss.seeT = Math.max(0, boss.seeT - dt)
      if (rt.rnd() < dt * 0.08) bark(rt, rt.def.lines.patrol, 12)
    }
  }
  rt.progress = rt.got / Math.max(1, rt.items.length)
  if (rt.got >= rt.items.length && rt.items.length) finish(rt, true)
}

// ---- 找人 -------------------------------------------------------------------

function stepFind(rt: DreamRT, dt: number, gm: { x: number; z: number }) {
  const easy = rt.def.easy
  // 做夢的人（阿凱）在起點緊張地看來看去
  rt.dreamer.heading = Math.sin(rt.t * 0.8) * 1.2 + Math.PI
  // 提示：隔一陣子笑一聲／嗶一聲（好夢比較常）
  rt.hintT -= dt
  if (rt.hintT <= 0 && rt.t - rt.revealT > 1.2) {
    rt.hintT = easy ? 4.5 : 6.5
    const hints = rt.def.lines.hint ?? []
    const id = hints[Math.floor(rt.rnd() * hints.length)]
    rt.lastBark = -99
    bark(rt, id, 0)
    const s = rt.spots[rt.target]
    const a = rt.rnd() * Math.PI * 2
    const r = (easy ? 0.8 : 1.8) * rt.rnd()
    rt.events.push({ t: 'sfx', name: 'beep' }, { t: 'hint', x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r })
  }
  for (let i = 0; i < rt.spots.length; i++) {
    const s = rt.spots[i]
    if (Math.hypot(gm.x - s.x, gm.z - s.z) > 1.1) continue
    if (i === rt.target) {
      rt.found++
      rt.revealT = rt.t
      rt.lastReveal = [s.x, s.z]
      s.checkedAt = rt.t
      rt.events.push({ t: 'sfx', name: 'found' }, { t: 'poof', x: s.x, z: s.z })
      if (rt.found >= rt.rounds) {
        rt.progress = 1
        finish(rt, true)
        return
      }
      rt.lastBark = -99
      bark(rt, rt.def.lines.found, 0)
      rt.target = pickSpot(rt, i)
      rt.hintT = 2.5
    } else if (rt.t - s.checkedAt > 3) {
      s.checkedAt = rt.t
      rt.events.push({ t: 'poof', x: s.x, z: s.z })
      bark(rt, rt.def.lines.wrong, 7)
    }
  }
  rt.progress = rt.found / rt.rounds
}

/** 阿嬤離目標多近（0 遠 … 1 就在旁邊），畫面的閃光與 HUD 的「好熱」用 */
export function warmth(rt: DreamRT, x: number, z: number) {
  if (rt.target < 0) return 0
  const s = rt.spots[rt.target]
  return Math.max(0, 1 - Math.hypot(s.x - x, s.z - z) / 5)
}
