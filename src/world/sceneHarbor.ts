import { box, rect, type Circle, type Colliders, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import type { GameState } from '../store'
import type { CrabResult } from '../ui/minigames/types'
import { FLATS, flatsY, onFlats, tideRects, tideState, waterY, type TideBand } from './tide'

// 海邊漁港＋燈塔（DESIGN §27.1）：老街盡頭。漁船、魚市、消波塊；退潮時潮間帶可以走、抓螃蟹；燈塔的守燈人鬼。
// 規則在這裡；畫面在 src/scene/Harbor.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。
//
//          z 負（北，海）
//   燈塔                                         ～ 外海 ～
//    ▲ 堤防（消波塊）  漁船  漁船  漁船        潮間帶（礁石、潮池）
//    ┃ ═════════════════ 碼頭邊 ═════════ 石階 ═════════
//   魚市（棚子）   路燈      繫船柱      路燈        → 出口（老街）
//          z 正（南，鏡頭這一側）

export const HARBOR = {
  /** 碼頭邊：再往北就是海 */
  quayZ: -1.5,
  /** 碼頭面、陸地的高度 */
  landY: 0.02,
  /** 堤防（往北伸進海裡，盡頭是燈塔） */
  breakwater: { x0: -15.6, x1: -12.4, z0: -12.4, z1: -1.5, y: 0.75 },
  /** 燈塔：塔身、門、守燈人站的地方 */
  lighthouse: { x: -14, z: -13.2, r: 1.15, h: 7.4 },
  door: { x: -14, z: -11.9 },
  keeper: { x: -12.95, z: -11.2 },
  /** 魚市的棚子（西南邊） */
  shed: { x0: -20.5, x1: -11.5, z0: 3.4, z1: 8.6, h: 3.6 },
  /** 停在港裡的漁船：船身中心、長度、朝向（x 軸方向的小偏角） */
  boats: [
    { x: -8.2, z: -4.3, len: 7.0, rot: 0.06, name: '金順發', color: '#2f6fa8' },
    { x: -1.2, z: -4.6, len: 6.2, rot: -0.05, name: '新漁興', color: '#b8433a' },
    { x: 4.2, z: -5.6, len: 5.2, rot: 0.14, name: '海安號', color: '#3f8a5a' },
  ],
  /** 從碼頭下到潮間帶的石階 */
  steps: { x: 7.2, w: 1.6 },
  /** 潮池（抓螃蟹的地方） */
  pools: [
    { x: 9.4, z: -4.2, r: 0.9 },
    { x: 12.8, z: -6.6, r: 1.1 },
    { x: 15.6, z: -3.6, r: 0.8 },
    { x: 10.8, z: -8.3, r: 0.7 },
  ],
  /** 碼頭上的路燈（鈉燈，橘黃色） */
  lamps: [-9.5, 0.5, 11, 18],
  lampZ: 0.9,
  /** 繫船柱 */
  bollards: [-10.5, -6, -2.8, 1.4, 4.8],
  /** 坐在碼頭邊釣魚、補網的鬼漁夫（晚上才出來） */
  fishers: [
    { x: -4.4, z: -1.15, heading: Math.PI, pose: 'sit' as const },
    { x: 2.9, z: 0.1, heading: Math.PI * 0.8, pose: 'sit' as const },
  ],
  /** 保麗龍箱、漁網堆 */
  boxes: [
    { x: -9.8, z: 1.9, n: 3 },
    { x: -8.6, z: 2.3, n: 2 },
    { x: 13.5, z: 2.0, n: 2 },
  ],
  nets: [
    { x: -5.6, z: 1.6, color: '#3f8a5a' },
    { x: 8.8, z: 1.5, color: '#d8662a' },
  ],
}

const H = HARBOR

const inRect = (x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1

/** 地面高度：碼頭與陸地、堤防頂、潮間帶的礁石（泡在水裡就浮在水面上：阿嬤是鬼） */
export function harborFloor(x: number, z: number) {
  if (inRect(x, z, H.breakwater)) return H.breakwater.y
  if (onFlats(x, z)) return Math.max(flatsY(x, z), waterY(tideState.level) + 0.02)
  if (z < H.quayZ) return Math.max(waterY(tideState.level) + 0.02, -0.4)
  return H.landY
}

function baseColliders(): Colliders {
  const bw = H.breakwater
  const f = FLATS
  const rects: Rect[] = [
    // 海：堤防西邊、堤防和潮間帶中間的港區、潮間帶外面
    rect(-22, -14, bw.x0, H.quayZ),
    rect(bw.x1, -14, f.x0, H.quayZ),
    rect(f.x0, -14, 22, f.z0),
    // 潮間帶東邊到出口之間是亂石與海堤
    rect(f.x1, f.z0, 22, H.quayZ - 0.4),
    // 燈塔再往北
    rect(bw.x0, -14, bw.x1, bw.z0),
    // 魚市棚子的後牆與兩側（前面開放，可以走進去）
    rect(H.shed.x0, H.shed.z1 - 0.25, H.shed.x1, H.shed.z1 + 0.1),
    rect(H.shed.x0 - 0.1, H.shed.z0, H.shed.x0 + 0.25, H.shed.z1),
    // 棚子裡的魚台（兩排水泥台）
    box((H.shed.x0 + H.shed.x1) / 2, H.shed.z0 + 2.2, 6.2, 0.9),
    // 保麗龍箱
    ...H.boxes.map((b) => box(b.x, b.z, 0.9, 0.7)),
  ]
  const circles: Circle[] = [
    { x: H.lighthouse.x, z: H.lighthouse.z, r: H.lighthouse.r + 0.1 },
    ...H.bollards.map((x) => ({ x, z: H.quayZ + 0.35, r: 0.2 })),
    ...H.lamps.map((x) => ({ x, z: H.lampZ, r: 0.15 })),
    ...H.nets.map((n) => ({ x: n.x, z: n.z, r: 0.6 })),
  ]
  return { rects, circles, bounds: rect(-22, -14, 22, 12) }
}

const BASE = baseColliders()

/**
 * 依潮位換掉碰撞（World.tsx 不快取海邊的碰撞）。潮位分段變了才換（Harbor.tsx 每幀呼叫）。
 */
export function applyTide(band: TideBand) {
  HARBOR_SCENE.colliders = { rects: [...BASE.rects, ...tideRects(band)], circles: BASE.circles, bounds: BASE.bounds }
}

export const HARBOR_SCENE: SceneDef = {
  id: 'harbor',
  name: '海邊漁港',
  colliders: { rects: [...BASE.rects, ...tideRects('high')], circles: BASE.circles, bounds: BASE.bounds },
  spawns: { oldstreet: [18, 0] },
  exits: [{ area: rect(20.5, -1.2, 22, 3), to: 'oldstreet', spawn: 'harbor', label: '老街 →', sign: [18.8, -0.9] }],
  buildings: [
    {
      id: 'harbor_shed',
      inside: rect(H.shed.x0, H.shed.z0, H.shed.x1, H.shed.z1),
      min: [H.shed.x0 - 0.3, 0, H.shed.z0 - 0.3],
      max: [H.shed.x1 + 0.3, H.shed.h + 0.4, H.shed.z1 + 0.3],
    },
  ],
  rooms: [
    { id: 'breakwater', name: '堤防', area: rect(H.breakwater.x0, H.breakwater.z0, H.breakwater.x1, H.breakwater.z1) },
    { id: 'flats', name: '潮間帶', area: rect(FLATS.x0, FLATS.z0, FLATS.x1, FLATS.z1) },
    { id: 'shed', name: '魚市', area: rect(H.shed.x0, H.shed.z0, H.shed.x1, H.shed.z1) },
  ],
  floorAt: harborFloor,
  npcs: (phase: string): Circle[] => [
    { x: H.keeper.x, z: H.keeper.z, r: 0.34 },
    ...(phase === 'night' ? H.fishers.map((f) => ({ x: f.x, z: f.z, r: 0.3 })) : []),
  ],
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

// 規則檔不能直接 import store（store → hotspots → scenes → 這裡，會循環），要改狀態時再動態載入
const withStore = (fn: (st: typeof import('../store').useStore) => void) => {
  void import('../store').then((m) => fn(m.useStore))
}

const setFlag = (flag: string) =>
  withStore((st) => {
    const s = st.getState()
    st.setState({ flags: { ...s.flags, [flag]: true } })
  })

const addCrabs = (n: number) =>
  withStore((st) => {
    if (n <= 0) return
    const s = st.getState()
    st.setState({ meta: { ...s.meta, pantry: { ...s.meta.pantry, crab: (s.meta.pantry.crab ?? 0) + n } } })
  })

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** 燈塔的燈亮了沒（點過一次以後每天晚上都會亮） */
export const lighthouseLit = (s: Pick<GameState, 'flags'>) => !!s.flags.lighthouse_lit

/** 守燈人：鬼，一直站在燈塔門口（傍晚也在） */
export const keeperSpot = H.keeper

const boatOil = H.boats[1]
const poolMain = H.pools[0]

export const HARBOR_HOTSPOTS: Hotspot[] = [
  {
    // 守燈人：第一次說話 → 燈熄了，要燈油；點亮以後道謝
    id: 'harbor_keeper',
    scene: 'harbor',
    x: H.keeper.x + 0.3,
    z: H.keeper.z + 1.1,
    r: 1.5,
    icon: { x: H.keeper.x, z: H.keeper.z },
    iconY: 2.1,
    label: (s) => (s.flags.keeper_met ? '守燈人' : '跟燈塔下的阿伯說話'),
    run: (s) => {
      if (!s.flags.keeper_met) {
        s.startDialogue('keeper_1')
        return
      }
      if (lighthouseLit(s)) {
        s.bark(pick(['keeper.idle.1', 'keeper.idle.2', 'keeper.idle.3']))
        return
      }
      if (s.flags.harbor_oil || (s.meta.pantry.candle ?? 0) > 0) s.bark(s.phase === 'night' ? 'keeper.ready' : 'keeper.wait.night')
      else s.bark(pick(['keeper.hint.oil', 'keeper.hint.candle']))
    },
  },
  {
    // 燈塔的門：晚上才能點燈（要燈油，或拿一根蠟燭）
    id: 'harbor_door',
    scene: 'harbor',
    x: H.door.x,
    z: H.door.z + 0.9,
    r: 1.2,
    icon: { x: H.door.x, z: H.door.z },
    iconY: 2.4,
    label: (s) => {
      if (!s.flags.keeper_met) return '燈塔'
      if (lighthouseLit(s)) return '燈塔（燈亮著）'
      if (s.phase !== 'night') return '燈塔（晚上再來點燈）'
      return '點亮燈塔'
    },
    run: (s) => {
      if (!s.flags.keeper_met) {
        s.bark('harbor.lighthouse')
        return
      }
      if (lighthouseLit(s)) {
        s.bark(pick(['harbor.lighthouse.lit.1', 'harbor.lighthouse.lit.2']))
        return
      }
      if (s.phase !== 'night') {
        s.bark('keeper.wait.night')
        return
      }
      const hasOil = !!s.flags.harbor_oil
      const candles = s.meta.pantry.candle ?? 0
      if (!hasOil && candles <= 0) {
        s.bark('harbor.door.nooil')
        return
      }
      s.bark('harbor.door.light')
      withStore((st) => {
        const x = st.getState()
        const pantry = { ...x.meta.pantry }
        // 有燈油就用燈油；沒有才用蠟燭
        if (!hasOil) pantry.candle = Math.max(0, (pantry.candle ?? 0) - 1)
        st.setState({ flags: { ...x.flags, lighthouse_lit: true }, meta: { ...x.meta, pantry, merit: x.meta.merit + 3 } })
      })
      window.setTimeout(() => void import('../store').then(({ useStore }) => useStore.getState().bark('keeper.lit.1')), 3200)
      window.setTimeout(() => void import('../store').then(({ useStore }) => useStore.getState().bark('keeper.lit.2')), 7800)
    },
  },
  {
    // 「新漁興」船尾的燈油罐（見過守燈人才知道要拿）
    id: 'harbor_oil',
    scene: 'harbor',
    x: boatOil.x + 1.8,
    z: H.quayZ + 0.7,
    r: 1.3,
    icon: { x: boatOil.x + 2.2, z: boatOil.z + 0.6 },
    iconY: 1.0,
    label: (s) => (!s.flags.keeper_met ? `漁船「${boatOil.name}」` : s.flags.harbor_oil ? `漁船「${boatOil.name}」` : '拿船上的燈油罐'),
    run: (s) => {
      if (!s.flags.keeper_met || s.flags.harbor_oil) {
        s.bark(pick(['harbor.boat.1', 'harbor.boat.2']))
        return
      }
      setFlag('harbor_oil')
      s.bark('harbor.oil.take')
    },
  },
  {
    // 潮池：乾潮才抓得到螃蟹（一天一次）
    id: 'harbor_crab',
    scene: 'harbor',
    x: poolMain.x - 0.4,
    z: poolMain.z + 1.4,
    r: 1.6,
    icon: { x: poolMain.x, z: poolMain.z },
    iconY: 0.6,
    label: (s) => {
      if (s.phase !== 'night' || tideState.band !== 'low') return null
      return s.flags.harbor_crab_today ? '抓螃蟹（今天抓過了）' : '抓螃蟹（退潮了）'
    },
    run: (s) => {
      if (s.flags.harbor_crab_today) {
        s.bark('harbor.crab.done')
        return
      }
      setFlag('harbor_crab_today')
      s.bark('harbor.crab.start')
      s.startMinigame('crab', {}, (r) => {
        const crabs = (r as CrabResult | null)?.crabs ?? 0
        addCrabs(crabs)
        s.bark(crabs >= 3 ? 'harbor.crab.good' : crabs > 0 ? 'harbor.crab.one' : 'harbor.crab.none')
      })
    },
  },
  {
    // 石階口：看潮水（告訴玩家什麼時候退潮）
    id: 'harbor_steps',
    scene: 'harbor',
    x: H.steps.x,
    z: H.quayZ + 0.9,
    r: 1.2,
    icon: { x: H.steps.x, z: H.quayZ - 0.4 },
    iconY: 0.9,
    label: () => (tideState.band === 'high' ? '看海（漲潮中）' : tideState.band === 'mid' ? '看海（正在退潮）' : '看海（乾潮）'),
    run: (s) => {
      if (s.phase !== 'night') s.bark('harbor.tide.dusk')
      else s.bark(tideState.band === 'high' ? 'harbor.tide.high' : tideState.band === 'mid' ? 'harbor.tide.mid' : 'harbor.tide.low')
    },
  },
  {
    id: 'harbor_tetrapod',
    scene: 'harbor',
    x: H.breakwater.x1 - 0.4,
    z: -5.5,
    r: 1.3,
    icon: { x: H.breakwater.x0 - 0.5, z: -5.8 },
    iconY: 1.3,
    label: () => '消波塊',
    run: (s) => s.bark(pick(['harbor.tetrapod.1', 'harbor.tetrapod.2'])),
  },
  {
    id: 'harbor_market',
    scene: 'harbor',
    x: (H.shed.x0 + H.shed.x1) / 2 + 1.5,
    z: H.shed.z0 - 0.6,
    r: 1.6,
    icon: { x: (H.shed.x0 + H.shed.x1) / 2, z: H.shed.z0 + 2.2 },
    iconY: 1.8,
    label: () => '漁會魚市場',
    run: (s) => s.bark(s.phase === 'night' ? pick(['harbor.market.1', 'harbor.market.2']) : 'harbor.market.dusk'),
  },
  {
    // 鬼漁夫：晚上坐在碼頭邊釣魚、補網
    id: 'harbor_fishers',
    scene: 'harbor',
    x: H.fishers[0].x + 0.9,
    z: H.fishers[0].z + 1.0,
    r: 1.5,
    icon: { x: H.fishers[0].x, z: H.fishers[0].z },
    iconY: 1.4,
    label: (s) => (s.phase === 'night' ? '碼頭邊的老漁夫' : null),
    run: (s) => s.bark(pick(['harbor.fisher.1', 'harbor.fisher.2', 'harbor.fisher.3'])),
  },
]
