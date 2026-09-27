import { rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import type { GameState } from '../store'
import { DIALOGUES, type Dialogue } from './dialogues'
import { festivalOf } from './night/plan'
import { placePlayer, player } from './player'

// 燈塔裡面（DESIGN §32.5）：海邊堤防盡頭那座燈塔的門進來。
//   下層：守燈人的小屋（床、值班日誌、收音機、燈油桶）→ 小走道 → 塔底 → 沿著牆一圈的螺旋梯，真的一階一階走上去
//   上層：燈籠室（大透鏡）＋外面一圈陽台；從上面看得到整個村子的燈（望遠鏡可以看每個地方現在怎樣）
// 上層放在另一塊地方（z 往北 40 公尺：在上層往西北看時，下層在鏡頭後面看不到），爬梯子時黑幕換過去：鏡頭一次只看一層，上層的地板不會擋住樓梯。
// 點燈改在燈籠室（按住動作鍵），旗標照舊 lighthouse_lit／harbor_oil／keeper_met。
// 規則在這裡；畫面在 src/scene/Lighthouse.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。
//
//   下層（俯視，鏡頭在右下）              上層（z − 40）
//        ┌───── 塔（樓梯一圈）─────┐          ┌──── 陽台（欄杆）────┐
//        │  頂上平台 ↰    ↱ 樓梯   │          │   ┌─ 燈籠室 ─┐       │
//        │  實心    井    上去     │          │   │  透鏡  梯│  望遠鏡│
//        │  入口平台 ↑             │          │   └── 門 ────┘       │
//        └──────── 走道 ───────────┘          └──────────────────────┘
//   ┌──── 守燈人的小屋 ────┐
//   │ 床          書桌 收音機│
//   │ 爐子        燈油桶    │
//   └──────── 門（出去海邊）┘

/** 角度：從 +z（南，鏡頭這邊）算起，往 +x（東）轉為正，單位度 */
export const deg = (x: number, z: number) => {
  let a = (Math.atan2(x, z) * 180) / Math.PI
  if (a < -46) a += 360
  return a
}
/** 角度 → 位置 */
export const polar = (cx: number, cz: number, a: number, r: number) => {
  const t = (a * Math.PI) / 180
  return { x: cx + Math.sin(t) * r, z: cz + Math.cos(t) * r }
}

export const LIGHTHOUSE = {
  /** 塔：中心、樓梯井的半徑、內牆的半徑 */
  tower: { x: 0, z: 0, rIn: 1.4, rOut: 3.3 },
  /**
   * 樓梯一圈（角度）：-18°～16° 是入口平台（地面），16°～292° 一路爬上去，292°～314° 是頂上的平台（梯子在這裡），
   * 314°～342° 是實心的（下面堆燈油桶，上面有欄杆擋著）
   */
  stair: { a0: -18, a1: 16, a2: 292, a3: 314, h: 6.6, treads: 40 },
  /** 塔跟小屋之間的門（塔牆的缺口，±16°） */
  towerDoor: 16,
  /** 守燈人的小屋（塔的南邊）：北牆中間有走道進塔，南牆中間是出去海邊的門 */
  cottage: { x0: -4.0, x1: 4.0, z0: 4.05, z1: 8.75, door: 0.7, passage: 0.62 },
  bed: { x: -3.25, z: 6.1 },
  desk: { x: 2.35, z: 4.55 },
  radio: { x: 3.35, z: 4.5 },
  drums: { x: 3.2, z: 7.5 },
  stove: { x: -3.1, z: 8.05 },
  photo: { x: -3.95, z: 4.9 },
  /** 樓梯半途的小窗（遠側的牆上，大概一半高） */
  window: 172,
  /** 上層：燈籠室＋陽台（另一塊地方） */
  top: { x: 0, z: -40, y: 7.4, rLens: 0.75, rGlass: 2.35, rRail: 4.1, door: 18, hatch: 250 },
  /** 守燈人在陽台上看海 */
  keeperA: 146,
  /** 望遠鏡（陽台北邊，朝村子那邊） */
  scopeA: 210,
}

const L = LIGHTHOUSE
const T = L.tower
const S = L.stair
const TOP = L.top
const C = L.cottage

/** 樓梯在某個角度的地板高度 */
export function stairY(a: number) {
  if (a < S.a1) return 0.02
  if (a < S.a2) return 0.02 + (S.h * (a - S.a1)) / (S.a2 - S.a1)
  return 0.02 + S.h
}

export const inTop = (x: number, z: number) => Math.hypot(x - TOP.x, z - TOP.z) < TOP.rRail + 0.6
export const inTower = (x: number, z: number) => Math.hypot(x - T.x, z - T.z) < T.rOut + 0.45

export function lighthouseFloor(x: number, z: number) {
  if (inTop(x, z)) return TOP.y
  if (inTower(x, z)) return stairY(deg(x - T.x, z - T.z))
  return 0.02
}

/** 樓梯頂的平台（下梯子出來的地方）、燈籠室的梯子口 */
export const LANDING = polar(T.x, T.z, 300, 2.4)
export const HATCH = polar(TOP.x, TOP.z, TOP.hatch, 1.45)
export const KEEPER_TOP = polar(TOP.x, TOP.z, L.keeperA, 3.55)
export const SCOPE = polar(TOP.x, TOP.z, L.scopeA, 3.85)
export const LAMP_SPOT = polar(TOP.x, TOP.z, 95, 1.45)
export const WINDOW_SPOT = polar(T.x, T.z, L.window, 2.35)

function colliders() {
  const rects: Rect[] = [
    // 小屋的牆：西、東、南（門）、北（走道）
    rect(C.x0 - 0.25, C.z0 - 0.2, C.x0, C.z1 + 0.15),
    rect(C.x1, C.z0 - 0.2, C.x1 + 0.25, C.z1 + 0.15),
    rect(C.x0 - 0.25, C.z1 - 0.15, -C.door, C.z1 + 0.15),
    rect(C.door, C.z1 - 0.15, C.x1 + 0.25, C.z1 + 0.15),
    rect(C.x0 - 0.25, C.z0 - 0.2, -C.passage, C.z0 + 0.1),
    rect(C.passage, C.z0 - 0.2, C.x1 + 0.25, C.z0 + 0.1),
    // 走道兩邊（塔牆和小屋北牆中間不要擠得過去）
    rect(-1.1, 3.3, -C.passage - 0.04, C.z0),
    rect(C.passage + 0.04, 3.3, 1.1, C.z0),
    // 小屋裡的家具：床、書桌、燈油桶、爐子
    rect(L.bed.x - 0.55, L.bed.z - 1.05, L.bed.x + 0.55, L.bed.z + 1.05),
    rect(L.desk.x - 0.9, L.desk.z - 0.35, L.desk.x + 0.9, L.desk.z + 0.35),
    rect(L.drums.x - 0.6, L.drums.z - 0.75, L.drums.x + 0.75, L.drums.z + 0.75),
    rect(L.stove.x - 0.45, L.stove.z - 0.4, L.stove.x + 0.45, L.stove.z + 0.4),
    // 下層和上層中間：什麼都沒有，擋起來
    rect(-6, TOP.z + TOP.rRail + 0.5, 6, -T.rOut - 0.75),
  ]
  const circles: Circle[] = [
    // 樓梯井（中間是空的，有欄杆）
    { x: T.x, z: T.z, r: T.rIn },
  ]
  // 塔的外牆：一圈小圓，門那邊留缺口
  for (let a = 0; a < 360; a += 4) {
    const aa = a > 180 ? a - 360 : a
    if (Math.abs(aa) <= L.towerDoor - 1) continue
    const p = polar(T.x, T.z, a, T.rOut + 0.34)
    circles.push({ x: p.x, z: p.z, r: 0.32 })
  }
  // 實心的那一塊（頂上平台後面、入口平台旁邊）
  for (let a = S.a3 + 4; a <= 360 + S.a0 - 4; a += 4)
    for (const r of [1.75, 2.2, 2.65, 3.1]) {
      const p = polar(T.x, T.z, a, r)
      circles.push({ x: p.x, z: p.z, r: 0.3 })
    }
  // 上層：透鏡的台座、燈籠室的玻璃牆（門留缺口）、陽台的欄杆
  circles.push({ x: TOP.x, z: TOP.z, r: TOP.rLens })
  for (let a = 0; a < 360; a += 7) {
    const aa = a > 180 ? a - 360 : a
    if (Math.abs(aa) > TOP.door) {
      const p = polar(TOP.x, TOP.z, a, TOP.rGlass)
      circles.push({ x: p.x, z: p.z, r: 0.16 })
    }
    const q = polar(TOP.x, TOP.z, a, TOP.rRail)
    circles.push({ x: q.x, z: q.z, r: 0.22 })
  }
  return { rects, circles, bounds: rect(-4.7, TOP.z - TOP.rRail - 0.4, 4.7, C.z1 + 0.9) }
}

export const LIGHTHOUSE_SCENE: SceneDef = {
  id: 'lighthouse',
  name: '燈塔',
  colliders: colliders(),
  spawns: {
    harbor: [0, C.z1 - 0.75],
    landing: [LANDING.x, LANDING.z],
    top: [HATCH.x, HATCH.z],
  },
  exits: [{ area: rect(-C.door, C.z1 + 0.18, C.door, C.z1 + 0.8), to: 'harbor', spawn: 'lighthouse', label: '出去 → 海邊', sign: [-2.4, C.z1 + 0.6] }],
  buildings: [
    // 下層、上層都算「在屋裡」：鏡頭拉近
    { id: 'lh_base', inside: rect(-4.6, -4.2, 4.6, C.z1 + 0.1), min: [-4.6, 0, -4.2], max: [4.6, 0.1, C.z1] },
    { id: 'lh_top', inside: rect(TOP.x - 4.6, TOP.z - 4.6, TOP.x + 4.6, TOP.z + 4.6), min: [TOP.x - 4.6, TOP.y, TOP.z - 4.6], max: [TOP.x + 4.6, TOP.y + 0.1, TOP.z + 4.6] },
  ],
  rooms: [
    { id: 'lh_cottage', name: '守燈人的小屋', area: rect(C.x0, C.z0 - 0.7, C.x1, C.z1) },
    { id: 'lh_stairs', name: '燈塔的樓梯', area: rect(-T.rOut - 0.3, -T.rOut - 0.3, T.rOut + 0.3, T.rOut + 0.1) },
    { id: 'lh_top', name: '燈籠室', area: rect(TOP.x - TOP.rRail, TOP.z - TOP.rRail, TOP.x + TOP.rRail, TOP.z + TOP.rRail) },
  ],
  floorAt: lighthouseFloor,
  npcs: (): Circle[] => [{ x: KEEPER_TOP.x, z: KEEPER_TOP.z, r: 0.3 }],
}

// ---------------------------------------------------------------------------
// 從燈塔上看村子：每個地方現在怎樣（望遠鏡、上層的字牌共用）
// ---------------------------------------------------------------------------

export type PlaceId = 'oldstreet' | 'station' | 'home' | 'school' | 'temple' | 'market' | 'hill'

/** 對岸的村子：方向（燈塔上層中心看出去的角度，鏡頭正前方大約 220°）、距離、高度（海面是 -1.2） */
export const PLACES: { id: PlaceId; name: string; a: number; d: number; y: number }[] = [
  { id: 'oldstreet', name: '老街', a: 233, d: 26, y: 0.2 },
  { id: 'station', name: '小火車站', a: 226, d: 42, y: 0.3 },
  { id: 'home', name: '阿春民宿', a: 219, d: 28, y: 0.6 },
  { id: 'school', name: '國小', a: 212, d: 44, y: 0.4 },
  { id: 'temple', name: '土地公廟', a: 205, d: 27, y: 0.8 },
  { id: 'market', name: '鬼夜市', a: 198, d: 43, y: 1.0 },
  { id: 'hill', name: '山上', a: 191, d: 46, y: 3.0 },
]

/** 家裡的情形（畫面、熱點各自抓好再傳進來，這裡不 import 深夜模擬） */
export interface HomeInfo {
  incident: boolean
  special: string | null
  guests: { awake: boolean; needs: number }[]
}

/** 某個地方現在怎樣（第二行字；bad：家裡出事了，字變紅） */
export function placeStatus(id: PlaceId, s: Pick<GameState, 'phase' | 'time' | 'meta'>, home: HomeInfo | null): { text: string; bad?: boolean } {
  const night = s.phase === 'night'
  const t = s.time
  const fest = festivalOf(s.meta.night)
  switch (id) {
    case 'home': {
      if (!night) return { text: '客人還沒到，小翰在準備。' }
      if (!home) return { text: '燈都關了。' }
      if (home.incident) return { text: '家裡出事了！快回去！', bad: true }
      if (home.special === 'typhoon') return { text: '風雨好大，家裡停電了。', bad: true }
      const needy = home.guests.filter((g) => g.awake && g.needs > 0).length
      if (needy) return { text: `有 ${needy} 個客人醒著，需要人照顧。`, bad: true }
      if (home.guests.some((g) => g.awake)) return { text: '還有客人醒著。' }
      return { text: '客人都睡了。' }
    }
    case 'temple':
      if (night && (fest === 'tudigong' || fest === 'zhongyuan')) return { text: '廟埕在演戲，好熱鬧。' }
      return { text: night ? '阿義還坐在廟口。' : '有人在拜拜。' }
    case 'market':
      if (night && t >= 24 && t < 28.5) return { text: '鬼夜市開了！燈籠一串一串。' }
      return { text: night && t < 24 ? '半夜十二點才開。' : '晚上才會開。' }
    case 'oldstreet':
      return { text: night ? '店都關了，只剩冰果室的霓虹燈。' : '冰果室還開著。' }
    case 'station':
      if (night && t >= 23.75 && t < 24.5) return { text: '末班車要進站了。' }
      return { text: night ? '月台上一個人都沒有。' : '今晚的客人坐火車來了。' }
    case 'school':
      return { text: night ? '小孩鬼在操場玩。' : '學校暗暗的。' }
    case 'hill':
      if (fest === 'qingming') return { text: '今天清明，山上有人掃墓。' }
      return { text: night ? '鬼鄰居在墳前聊天。' : '墓仔埔靜靜的。' }
  }
}

// ---------------------------------------------------------------------------
// 點燈：在燈籠室按住動作鍵（畫面那邊每幀推進度：Lighthouse.tsx）
// ---------------------------------------------------------------------------

/** 燈塔的燈亮了沒（點過一次以後每天晚上都會亮） */
const lit = (s: Pick<GameState, 'flags'>) => !!s.flags.lighthouse_lit

/** 點燈的長按：hotspot 開始、畫面推進度、放開或走開就取消 */
export const lampHold = { active: false, t: 0, need: 2.4, released: 0, x: 0, z: 0 }

function withStore(fn: (st: typeof import('../store').useStore) => void) {
  void import('../store').then(({ useStore }) => fn(useStore))
}
const later = (ms: number, fn: () => void) => window.setTimeout(fn, ms)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** 按住夠久：點亮（有燈油用燈油，沒有才用一根蠟燭），功德 +3，守燈人道謝 */
export function completeLighting() {
  withStore((st) => {
    const x = st.getState()
    if (lit(x)) return
    const pantry = { ...x.meta.pantry }
    if (!x.flags.harbor_oil) pantry.candle = Math.max(0, (pantry.candle ?? 0) - 1)
    st.setState({ flags: { ...x.flags, lighthouse_lit: true }, meta: { ...x.meta, pantry, merit: x.meta.merit + 3 } })
    x.bark('harbor.door.light')
    later(3200, () => st.getState().bark('keeper.lit.1'))
    later(7800, () => st.getState().bark('keeper.lit.2'))
  })
}

/** 放開太早 */
export function cancelLighting() {
  withStore((st) => st.getState().bark('lh.lamp.cancel'))
}

/** 爬梯子：黑幕蓋住、換到另一層（等鏡頭跟上再掀開） */
function climb(to: 'top' | 'landing') {
  withStore((st) => {
    const s = st.getState()
    if (s.transitioning) return
    st.setState({ transitioning: true, blackout: true, prompt: null })
    later(420, () => {
      const [x, z] = LIGHTHOUSE_SCENE.spawns[to]
      placePlayer(x, z)
    })
    later(1350, () => {
      st.setState({ blackout: false, transitioning: false })
      const x = st.getState()
      if (to === 'top' && !x.flags.lh_top_seen) {
        st.setState({ flags: { ...x.flags, lh_top_seen: true } })
        later(500, () => st.getState().bark('lh.top.first'))
      }
    })
  })
}

/** 家裡的情形（動態載入深夜模擬，規則檔不能在最上面 import） */
export async function homeInfo(special: string | null): Promise<HomeInfo | null> {
  const [{ night }, { incidentState }] = await Promise.all([import('./night/director'), import('./night/incidents')])
  const sim = night.sim
  if (!sim) return null
  const inc = incidentState.current
  return {
    incident: !!inc && inc.status === 'active',
    special,
    guests: sim.guests.map((g) => ({ awake: g.awake, needs: g.needs.length })),
  }
}

/** 望遠鏡：下一個要看的地方（畫面那邊亮一下那個地方的字牌） */
export const scope = { i: 0, lookAt: -1, at: 0 }

// ---------------------------------------------------------------------------
// 對話
// ---------------------------------------------------------------------------

const seq = (...lines: string[]) => lines.map((line) => ({ line }))

const LH_DIALOGUES: Record<string, Dialogue> = {
  // 值班日誌：五十四年堤防尾揮紅手帕的少年查某（阿嬤的回憶「堤防上揮手」）
  lh_log: { steps: [...seq('lh.log.1', 'lh.log.2', 'lh.log.3', 'lh.log.4'), { line: 'lh.log.5', set: 'lh_log_read' }] },
  // 燈籠室：守燈人為什麼死了還在顧燈
  lh_keeper_story: {
    steps: [
      { line: 'lh.ks.1' },
      {
        line: 'lh.ks.2',
        choices: [
          { line: 'lh.ks.ask.why', goto: 'why' },
          { line: 'lh.ks.ask.wife', goto: 'wife' },
        ],
      },
      { label: 'why', line: 'lh.ks.why.1' },
      { line: 'lh.ks.why.2', goto: 'wait' },
      { label: 'wife', line: 'lh.ks.wife.1' },
      { line: 'lh.ks.wife.2' },
      { label: 'wait', line: 'lh.ks.3' },
      { line: 'lh.ks.4' },
      { line: 'lh.ks.5' },
      { line: 'lh.ks.6' },
      { line: 'lh.ks.7' },
      { line: 'lh.ks.8' },
      { line: 'lh.ks.9', set: 'lh_story' },
    ],
  },
}
Object.assign(DIALOGUES, LH_DIALOGUES)

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

const night = (s: GameState) => s.phase === 'night'
const hasFuel = (s: GameState) => !!s.flags.harbor_oil || (s.meta.pantry.candle ?? 0) > 0
const at = (p: { x: number; z: number }) => ({ x: p.x, z: p.z })

export const LIGHTHOUSE_HOTSPOTS: Hotspot[] = [
  // ---------- 下層：守燈人的小屋 ----------
  {
    id: 'lh_bed',
    scene: 'lighthouse',
    x: L.bed.x + 0.9,
    z: L.bed.z,
    r: 1.1,
    icon: at(L.bed),
    iconY: 1.0,
    label: () => '守燈人的床',
    run: (s) => s.bark(pick(['lh.bed.1', 'lh.bed.2'])),
  },
  {
    id: 'lh_log',
    scene: 'lighthouse',
    x: L.desk.x - 0.4,
    z: L.desk.z + 0.85,
    r: 1.0,
    icon: { x: L.desk.x - 0.4, z: L.desk.z },
    iconY: 1.3,
    label: (s) => (s.flags.lh_log_read ? '值班日誌' : '翻翻值班日誌'),
    run: (s) => (s.flags.lh_log_read ? s.bark('lh.log.again') : s.startDialogue('lh_log')),
  },
  {
    id: 'lh_radio',
    scene: 'lighthouse',
    x: L.radio.x - 0.1,
    z: L.radio.z + 0.9,
    r: 0.9,
    icon: at(L.radio),
    iconY: 1.4,
    label: () => '收音機',
    run: (s) => s.bark(pick(['lh.radio.1', 'lh.radio.2', 'lh.radio.3'])),
  },
  {
    id: 'lh_photo',
    scene: 'lighthouse',
    x: L.photo.x + 1.0,
    z: L.photo.z + 0.1,
    r: 1.0,
    icon: at(L.photo),
    iconY: 1.9,
    label: () => '牆上的相片',
    run: (s) => s.bark('lh.photo'),
  },
  {
    id: 'lh_oil',
    scene: 'lighthouse',
    x: L.drums.x - 1.0,
    z: L.drums.z,
    r: 1.0,
    icon: at(L.drums),
    iconY: 1.4,
    label: () => '燈油桶',
    run: (s) => s.bark(hasFuel(s) && !lit(s) ? 'lh.oil.have' : 'lh.oil.empty'),
  },
  {
    id: 'lh_stove',
    scene: 'lighthouse',
    x: L.stove.x + 0.9,
    z: L.stove.z - 0.2,
    r: 0.9,
    icon: at(L.stove),
    iconY: 1.2,
    label: () => '煤油爐',
    run: (s) => s.bark('lh.stove'),
  },
  // ---------- 樓梯 ----------
  {
    id: 'lh_window',
    scene: 'lighthouse',
    x: WINDOW_SPOT.x,
    z: WINDOW_SPOT.z,
    r: 1.1,
    icon: polar(T.x, T.z, L.window, T.rOut - 0.1),
    iconY: 1.6,
    label: () => '從窗口看海',
    run: (s) => s.bark(lit(s) && night(s) ? 'lh.window.lit' : 'lh.window'),
  },
  {
    id: 'lh_up',
    scene: 'lighthouse',
    x: LANDING.x,
    z: LANDING.z,
    r: 1.1,
    icon: polar(T.x, T.z, 306, 2.9),
    iconY: 2.2,
    label: () => '爬上燈籠室',
    run: () => climb('top'),
  },
  // ---------- 上層：燈籠室、陽台 ----------
  {
    id: 'lh_down',
    scene: 'lighthouse',
    x: HATCH.x,
    z: HATCH.z,
    r: 0.9,
    icon: at(HATCH),
    iconY: 0.6,
    label: () => '爬下樓梯',
    run: () => climb('landing'),
  },
  {
    id: 'lh_lamp',
    scene: 'lighthouse',
    x: LAMP_SPOT.x,
    z: LAMP_SPOT.z,
    r: 1.05,
    icon: { x: TOP.x, z: TOP.z },
    iconY: 2.3,
    label: (s) => {
      if (lit(s)) return night(s) ? '燈（亮著）' : '燈（晚上會亮）'
      if (!night(s)) return '燈（晚上再點）'
      if (!hasFuel(s)) return '點燈（要燈油或蠟燭）'
      return lampHold.active ? '點燈中……（按住別放）' : '點燈（按住）'
    },
    run: (s) => {
      if (lit(s)) {
        s.bark(night(s) ? pick(['lh.lamp.lit.1', 'lh.lamp.lit.2']) : 'lh.lamp.day')
        return
      }
      if (!night(s)) {
        s.bark('keeper.wait.night')
        return
      }
      if (!hasFuel(s)) {
        s.bark('harbor.door.nooil')
        return
      }
      if (lampHold.active) return
      Object.assign(lampHold, { active: true, t: 0, released: 0, x: player.x, z: player.z })
      s.bark('lh.lamp.start')
    },
  },
  {
    id: 'lh_keeper',
    scene: 'lighthouse',
    x: polar(TOP.x, TOP.z, L.keeperA, 2.85).x,
    z: polar(TOP.x, TOP.z, L.keeperA, 2.85).z,
    r: 1.15,
    icon: at(KEEPER_TOP),
    iconY: 2.1,
    label: (s) => (s.flags.lh_story ? '守燈人' : '跟守燈人說話'),
    run: (s) => {
      if (!s.flags.lh_story) {
        s.startDialogue('lh_keeper_story')
        return
      }
      s.bark(pick(['lh.keeper.idle.1', 'lh.keeper.idle.2', 'keeper.idle.1', 'keeper.idle.2', 'keeper.idle.3']))
    },
  },
  {
    id: 'lh_scope',
    scene: 'lighthouse',
    x: polar(TOP.x, TOP.z, L.scopeA, 3.2).x,
    z: polar(TOP.x, TOP.z, L.scopeA, 3.2).z,
    r: 1.0,
    icon: at(SCOPE),
    iconY: 1.6,
    label: () => `望遠鏡（看${PLACES[scope.i % PLACES.length].name}）`,
    run: (s) => {
      const p = PLACES[scope.i % PLACES.length]
      scope.lookAt = scope.i % PLACES.length
      scope.at = performance.now()
      scope.i++
      void homeInfo(s.plan.special ?? null).then((home) => {
        const st = placeStatus(p.id, s, home)
        s.say(`${p.name}：${st.text}`)
      })
    },
  },
]
