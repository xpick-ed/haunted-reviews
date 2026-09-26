import { box, rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import type { ClawResult } from '../ui/minigames/types'

// 村路＋柑仔店（DESIGN §25.1）：阿春民宿東邊的路走過來，再往東是土地公廟。
// 柑仔店的阿嬌看得到阿嬤。這個檔案是規則（碰撞、出生點、出口、熱點）；畫面在 src/scene/Village.tsx。
// 注意：scenes.ts 會被 Node 的模擬測試載入，這裡不能 import store、音效這些只在瀏覽器跑的東西（用 run(s) 的 s）。
//
//          z 負（北，房子這一側）
//   檳榔攤   紅磚厝        柑仔店（亭仔腳）     透天厝        老榕樹
//   ════════════════ 村路（東西向）════════════════════════════
//   水溝 ─────────────────────────────────────────────
//          z 正（南，水田，鏡頭這一側）

export const VILLAGE = {
  roadZ: 0,
  roadWidth: 3.4,
  /** 柑仔店：店身、亭仔腳（騎樓）、櫃台、阿嬌站的位置 */
  shop: { x0: -3.6, x1: 3.6, z0: -9.2, z1: -4.3, wallTop: 3.8 },
  awning: { z1: -2.4, postZ: -2.55, postX: 3.4, y0: 2.95, y1: 2.6 },
  counter: { x: 0, z: -3.4, w: 2.1, d: 0.56, h: 0.8 },
  ajiao: { x: 0, z: -4.0 },
  fridge: { x: 2.05, z: -3.85 },
  phone: { x: -2.95, z: -2.75 },
  bench: { x: -2.1, z: -3.98 },
  /** 西邊的紅磚厝、東邊的透天厝 */
  houseA: { x0: -14.5, x1: -7.0, z0: -11, z1: -4.8, wallTop: 3.0 },
  houseB: { x0: 6.8, x1: 12.2, z0: -11, z1: -4.8, floor2: 3.2, top: 6.3 },
  betel: { x: -17.4, z: -3.9 },
  bike: { x: -9.4, z: -3.55 },
  banyan: { x: 16.2, z: -5.0 },
  stoneTable: { x: 14.3, z: -3.4 },
  tablet: { x: 18.3, z: -3.7 },
  /** 路北側的電線桿（南側會擋在鏡頭前面，不放） */
  poleZ: -2.75,
  poleXs: [-22.6, -10.6, 5.3, 21.6],
  /** 有路燈的桿子 */
  lampXs: [-10.6, 5.3],
  /** 路南側的水溝 */
  ditch: { z0: 2.05, z1: 2.65 },
  /** 柑仔店門口東邊的夾娃娃機 */
  claw: { x: 4.75, z: -4.3 },
  /** 往溪邊的小路（北）、往國小的小橋（南） */
  riverLane: { x: -20 },
  schoolBridge: { x: -6.5 },
}

const V = VILLAGE

function villageColliders() {
  const rects: Rect[] = [
    // 柑仔店：店身、櫃台、兩端的汽水箱（不讓阿嬤繞到櫃台後面）
    rect(V.shop.x0, V.shop.z0, V.shop.x1, V.shop.z1),
    box(V.counter.x, V.counter.z, V.counter.w, V.counter.d),
    box(-1.33, -3.82, 0.5, 0.78),
    box(1.33, -3.82, 0.5, 0.78),
    box(V.fridge.x, V.fridge.z, 0.72, 0.62),
    box(V.bench.x, V.bench.z, 1.4, 0.4),
    // 兩棟厝
    rect(V.houseA.x0, V.houseA.z0, V.houseA.x1, V.houseA.z1),
    rect(V.houseB.x0, V.houseB.z0, V.houseB.x1, V.houseB.z1),
    // 房子之間的矮牆（不讓阿嬤鑽到房子後面）
    rect(V.houseA.x1, -5.05, V.shop.x0, -4.75),
    rect(V.shop.x1, -5.05, V.houseB.x0, -4.75),
    rect(V.houseA.x0 - 3.2, -5.05, V.houseA.x0, -4.75),
    // 檳榔攤、野狼、石桌石椅
    box(V.betel.x, V.betel.z, 1.7, 1.3),
    box(V.bike.x, V.bike.z, 1.5, 0.6),
    box(V.stoneTable.x, V.stoneTable.z, 0.8, 0.8),
    box(V.stoneTable.x - 1.0, V.stoneTable.z, 0.4, 0.9),
    box(V.stoneTable.x + 1.0, V.stoneTable.z, 0.4, 0.9),
    box(V.tablet.x, V.tablet.z, 0.6, 0.5),
    box(V.claw.x, V.claw.z, 0.9, 0.85),
  ]
  const circles: Circle[] = [
    ...[-1, 1].map((s) => ({ x: s * V.awning.postX, z: V.awning.postZ, r: 0.13 })),
    { x: V.phone.x, z: V.phone.z, r: 0.18 },
    { x: V.banyan.x, z: V.banyan.z, r: 1.05 },
    ...V.poleXs.map((x) => ({ x, z: V.poleZ, r: 0.2 })),
  ]
  // 南邊到水溝為止，北邊到房子後面一點（房子之間有矮牆）
  return { rects, circles, bounds: rect(-24, -9.5, 24, V.ditch.z0 - 0.08) }
}

export const VILLAGE_SCENE: SceneDef = {
  id: 'village',
  name: '村路',
  colliders: villageColliders(),
  spawns: {
    west: [-19, VILLAGE.roadZ],
    east: [19, VILLAGE.roadZ],
    shop: [0, -1.9],
    // 從溪邊回來（村子西頭的小路）、從國小回來（水溝上的小橋）
    north: [-20, -7.6],
    south: [-6.5, 0.9],
  },
  exits: [
    { area: rect(-24, VILLAGE.roadZ - 3, -21.5, VILLAGE.roadZ + 3), to: 'home', spawn: 'road_east', label: '← 阿春民宿', sign: [-20, VILLAGE.roadZ - 2.2] },
    { area: rect(21.5, VILLAGE.roadZ - 3, 24, VILLAGE.roadZ + 3), to: 'temple', spawn: 'road_west', label: '土地公廟 →', sign: [20, VILLAGE.roadZ - 2.2] },
    { area: rect(-21.05, -9.5, -18.95, -8.9), to: 'river', spawn: 'path', label: '溪邊 ↑', sign: [-18.4, -7.9] },
    { area: rect(-7.4, 1.5, -5.6, 1.97), to: 'school', spawn: 'gate', label: '國小 ↓', sign: [-4.9, 1.3] },
  ],
  buildings: [],
  rooms: [
    { id: 'shop', name: '柑仔店', area: rect(V.shop.x0, V.shop.z1, V.shop.x1, V.awning.z1) },
    { id: 'banyan', name: '老榕樹下', area: rect(12.8, -8, 20, -2.1) },
  ],
  // 亭仔腳是高起來一階的水泥地
  floorAt: (x, z) => (x > V.shop.x0 && x < V.shop.x1 && z > V.shop.z1 && z < V.awning.z1 ? 0.14 : 0.02),
  npcs: (): Circle[] => [{ x: V.ajiao.x, z: V.ajiao.z, r: 0.32 }],
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const night = (s: { phase: string }) => s.phase === 'night'

export const VILLAGE_HOTSPOTS: Hotspot[] = [
  {
    id: 'ajiao',
    scene: 'village',
    x: V.counter.x,
    z: V.counter.z + 0.85,
    r: 1.6,
    icon: { x: V.ajiao.x, z: V.ajiao.z },
    iconY: 2.1,
    label: (s) => (s.flags.ajiao_met ? '跟阿嬌買東西' : '跟阿嬌打招呼'),
    run: (s) => {
      const shop = () => s.openPanel('shop')
      if (!s.flags.ajiao_met) {
        s.startDialogue('ajiao_first', shop)
        return
      }
      s.bark(night(s) ? pick(['ajiao.night.1', 'ajiao.night.2']) : pick(['ajiao.hi.1', 'ajiao.hi.2', 'ajiao.hi.3']))
      shop()
    },
  },
  {
    // 夾娃娃機：一枚 $20，一天一次（最多三枚）。夾到的玩具放進 pantry.toy，可以送小宇
    id: 'village_claw',
    scene: 'village',
    x: V.claw.x,
    z: V.claw.z + 1.05,
    r: 1.2,
    icon: { x: V.claw.x, z: V.claw.z },
    iconY: 2.2,
    label: (s) => (s.flags.claw_today ? '夾娃娃機（今天夾過了）' : '夾娃娃機（一次 $20）'),
    run: (s) => {
      if (s.flags.claw_today) {
        s.bark('toys.claw.done')
        return
      }
      const coins = Math.min(3, Math.floor(s.meta.money / 20))
      if (coins <= 0) {
        s.bark('toys.claw.nomoney')
        return
      }
      s.bark(s.flags.claw_met ? 'toys.claw.hello' : 'toys.claw.ajiao')
      s.startMinigame('claw', { coins }, (r) => {
        const res = (r as ClawResult | null) ?? { prize: null, coins: 0 }
        if (res.coins <= 0) return
        // 規則檔不能直接 import store（Node 測試會載入這個檔），要改狀態時再動態載入
        void import('../store').then(({ useStore }) => {
          const st = useStore.getState()
          const pantry = { ...st.meta.pantry }
          if (res.prize) pantry.toy = (pantry.toy ?? 0) + 1
          useStore.setState({
            meta: { ...st.meta, money: Math.max(0, st.meta.money - res.coins * 20), pantry },
            flags: { ...st.flags, claw_today: true, claw_met: true },
          })
          st.bark(res.prize ? `toys.claw.win.${res.prize}` : 'toys.claw.lose')
        })
      })
    },
  },
  {
    id: 'village_phone',
    scene: 'village',
    x: V.phone.x + 0.1,
    z: V.phone.z + 0.55,
    r: 1.0,
    icon: { x: V.phone.x, z: V.phone.z },
    iconY: 1.95,
    label: () => '公共電話',
    run: (s) => s.bark(pick(['village.phone.1', 'village.phone.2'])),
  },
  {
    id: 'village_banyan',
    scene: 'village',
    x: V.stoneTable.x,
    z: V.stoneTable.z + 1.0,
    r: 1.7,
    icon: { x: V.stoneTable.x, z: V.stoneTable.z },
    iconY: 1.4,
    label: () => '榕樹下的石桌',
    run: (s) => s.bark(night(s) ? 'village.banyan.night' : pick(['village.banyan.1', 'village.banyan.2'])),
  },
  {
    id: 'village_betel',
    scene: 'village',
    x: V.betel.x,
    z: V.betel.z + 1.2,
    r: 1.3,
    icon: { x: V.betel.x, z: V.betel.z },
    iconY: 2.7,
    label: () => '檳榔攤',
    run: (s) => s.bark(night(s) ? 'village.betel.night' : 'village.betel'),
  },
  {
    id: 'village_bike',
    scene: 'village',
    x: V.bike.x,
    z: V.bike.z + 0.8,
    r: 1.1,
    icon: { x: V.bike.x, z: V.bike.z },
    iconY: 1.5,
    label: () => '野狼機車',
    run: (s) => s.bark('village.bike'),
  },
  {
    id: 'village_tablet',
    scene: 'village',
    x: V.tablet.x,
    z: V.tablet.z + 0.8,
    r: 1.0,
    icon: { x: V.tablet.x, z: V.tablet.z },
    iconY: 1.2,
    label: () => '路邊的小石碑',
    run: (s) => s.bark('village.tablet'),
  },
]
