import { box, rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import type { ClawResult } from '../ui/minigames/types'
import { DIALOGUES, type Dialogue } from './dialogues'

// 村路＋柑仔店（DESIGN §25.1）：阿春民宿東邊的路走過來，再往東是土地公廟。
// 柑仔店的阿嬌看得到阿嬤。這個檔案是規則（碰撞、出生點、出口、熱點）；畫面在 src/scene/Village.tsx。
// 注意：scenes.ts 會被 Node 的模擬測試載入，這裡不能 import store、音效這些只在瀏覽器跑的東西（用 run(s) 的 s）。
//
// 三棟房子都走得進去（DESIGN §30）：柑仔店裡、阿好嬸的紅磚厝（搬去台北了，只剩一隻鬼貓小花）、阿財伯家的透天厝一樓（八點檔）。
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
  /** 汽水冰箱靠東邊擺：冰箱和汽水箱中間留一條走道進店裡 */
  fridge: { x: 3.02, z: -3.85 },
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
  /** 擋在房子前面的兩支桿子：阿嬤在房子裡（或亭仔腳）被擋到時淡出 */
  fadePoles: [-10.6, 5.3],
  /** 路南側的水溝 */
  ditch: { z0: 2.05, z1: 2.65 },
  /** 柑仔店門口東邊的夾娃娃機 */
  claw: { x: 4.75, z: -4.3 },
  /** 往溪邊的小路（北）、往國小的小橋（南） */
  riverLane: { x: -20 },
  schoolBridge: { x: -6.5 },
  /** 柑仔店裡：店面開口、後門（掛花布門簾，通阿嬌家）、米桶、醬油米酒、糖果玻璃櫃、角落的黑白電視、磅秤、王子麵 */
  shopIn: {
    openHalf: 2.7,
    backDoor: { x: 2.3, w: 0.95 },
    rice: { x: -1.9, z: -7.55 },
    bottles: { x: -0.55, z: -7.75 },
    candy: { x: 1.0, z: -6.55, w: 1.3, d: 0.55 },
    tv: { x: -2.95, y: 2.5, z: -8.6 },
    scale: { x: -2.5, z: -5.7 },
    noodles: { x: 3.05, z: -4.75 },
  },
  /** 紅磚厝（阿好嬸家，人搬去台北了）：門、神明桌、八仙桌、紅眠床（鬼貓小花睡在上面）、灶腳、水缸、菜櫥、日曆 */
  houseAIn: {
    door: { x: -10.8, w: 1.1 },
    altar: { x: -10.8, z: -10.45, w: 1.9, d: 0.75 },
    table: { x: -10.8, z: -9.2 },
    bed: { x: -13.55, z: -9.75, w: 1.6, d: 2.1, top: 0.62 },
    dresser: { x: -14.1, z: -7.6 },
    stove: { x: -7.75, z: -10.2 },
    jar: { x: -7.6, z: -8.9 },
    cupboard: { x: -8.95, z: -10.6 },
    chair: { x: -8.3, z: -6.0 },
    calendar: { x: -9.2, y: 1.75 },
  },
  /** 透天厝一樓（阿財伯家的客廳）：鐵捲門拉起來、小門；電視櫃、沙發、茶几、阿財伯的藤椅、樓梯、魚缸、鋼琴、停在屋裡的機車 */
  houseBIn: {
    door: { x: 7.65, w: 0.9 },
    shutter: { x: 10.0, w: 3.0 },
    tv: { x: 9.4, z: -10.6 },
    sofa: { x: 9.4, z: -7.9 },
    coffee: { x: 9.4, z: -9.1 },
    armchair: { x: 11.4, z: -8.9, heading: -2.27 },
    stairs: { x0: 11.3, x1: 12.05, z0: -10.85, z1: -9.5 },
    tank: { x: 7.22, z: -8.65 },
    piano: { x: 7.3, z: -7.05 },
    scooter: { x: 10.9, z: -5.6 },
    /** 傍晚阿財伯站在魚缸北邊餵魚 */
    feed: { x: 7.85, z: -9.6 },
  },
}

/** 阿財伯家現在在做什麼：傍晚餵魚、19:30 起全家看八點檔、22:00 以後阿財伯一個人在藤椅上打瞌睡（電視演重播）、01:00 以後都睡了 */
export type AcaiState = 'feed' | 'tv' | 'doze' | 'none'
export function acaiState(s: { phase: string; time: number }): AcaiState {
  if (s.phase === 'dusk') return s.time < 19.5 ? 'feed' : 'tv'
  if (s.phase === 'night') return s.time < 25 ? 'doze' : 'none'
  return 'none'
}

const V = VILLAGE

const SI = V.shopIn
const HA = V.houseA
const AI = V.houseAIn
const HB = V.houseB
const BI = V.houseBIn
/** 牆的一半厚度（跟 House.tsx 的 Wall 一樣 0.3 厚） */
const W = 0.15

/** 一面東西向的牆（可以挖門） */
function wallX(x0: number, x1: number, z: number, gaps: { c: number; w: number }[] = []): Rect[] {
  const out: Rect[] = []
  let cur = x0
  for (const g of [...gaps].sort((a, b) => a.c - b.c)) {
    if (g.c - g.w / 2 > cur) out.push(rect(cur, z - W, g.c - g.w / 2, z + W))
    cur = g.c + g.w / 2
  }
  if (x1 > cur) out.push(rect(cur, z - W, x1, z + W))
  return out
}
const wallZ = (x: number, z0: number, z1: number) => rect(x - W, z0, x + W, z1)

function villageColliders() {
  const rects: Rect[] = [
    // 柑仔店：牆（正面整片打開）、店裡的貨架與擺設；門口的櫃台、兩端的汽水箱（不讓阿嬤繞到櫃台後面）
    ...wallX(V.shop.x0, V.shop.x1, V.shop.z0),
    ...wallX(V.shop.x0, V.shop.x1, V.shop.z1, [{ c: 0, w: SI.openHalf * 2 }]),
    wallZ(V.shop.x0, V.shop.z0, V.shop.z1),
    wallZ(V.shop.x1, V.shop.z0, V.shop.z1),
    rect(V.shop.x0, V.shop.z0, 1.65, -8.53),
    rect(V.shop.x0, -8.5, -2.93, -5.0),
    rect(2.93, -8.5, V.shop.x1, -5.0),
    box(SI.noodles.x, SI.noodles.z, 0.7, 0.6),
    box(SI.bottles.x, SI.bottles.z, 1.0, 0.5),
    box(SI.candy.x, SI.candy.z, SI.candy.w, SI.candy.d),
    box(SI.scale.x, SI.scale.z, 0.5, 0.4),
    box(V.counter.x, V.counter.z, V.counter.w, V.counter.d),
    box(-1.33, -3.82, 0.5, 0.78),
    box(1.33, -3.82, 0.5, 0.78),
    box(V.fridge.x, V.fridge.z, 0.72, 0.62),
    box(V.bench.x, V.bench.z, 1.4, 0.4),
    // 紅磚厝：牆（正面開門）、神明桌、八仙桌、紅眠床、梳妝台、灶、菜櫥
    ...wallX(HA.x0, HA.x1, HA.z0),
    ...wallX(HA.x0, HA.x1, HA.z1, [{ c: AI.door.x, w: AI.door.w }]),
    wallZ(HA.x0, HA.z0, HA.z1),
    wallZ(HA.x1, HA.z0, HA.z1),
    box(AI.altar.x, AI.altar.z, AI.altar.w, AI.altar.d),
    box(AI.table.x, AI.table.z, 0.9, 0.9),
    box(AI.bed.x, AI.bed.z, AI.bed.w, AI.bed.d),
    box(AI.dresser.x, AI.dresser.z, 0.5, 1.0),
    box(AI.stove.x, AI.stove.z, 1.1, 1.2),
    box(AI.cupboard.x, AI.cupboard.z, 0.9, 0.45),
    // 透天厝一樓：牆（小門、拉起來的鐵捲門）、電視櫃、沙發、茶几、藤椅、樓梯、魚缸、鋼琴、機車
    ...wallX(HB.x0, HB.x1, HB.z0),
    ...wallX(HB.x0, HB.x1, HB.z1, [
      { c: BI.door.x, w: BI.door.w },
      { c: BI.shutter.x, w: BI.shutter.w },
    ]),
    wallZ(HB.x0, HB.z0, HB.z1),
    wallZ(HB.x1, HB.z0, HB.z1),
    box(BI.tv.x, BI.tv.z, 2.4, 0.5),
    box(BI.sofa.x, BI.sofa.z, 2.1, 0.85),
    box(BI.coffee.x, BI.coffee.z, 1.2, 0.6),
    box(BI.armchair.x, BI.armchair.z, 0.75, 0.75),
    rect(BI.stairs.x0, BI.stairs.z0, BI.stairs.x1, BI.stairs.z1),
    box(BI.tank.x, BI.tank.z, 0.45, 1.5),
    box(BI.piano.x, BI.piano.z, 0.6, 1.4),
    box(BI.scooter.x, BI.scooter.z, 1.6, 0.55),
    // 房子之間的矮牆（不讓阿嬤鑽到房子後面）
    rect(V.houseA.x1, -5.05, V.shop.x0, -4.75),
    rect(V.shop.x1, -5.05, V.houseB.x0, -4.75),
    rect(V.houseA.x0 - 3.2, -5.05, V.houseA.x0, -4.75),
    // 房子以外的地方北邊到 z = -9.5 為止（往溪邊的小路從這裡出去；房子裡面可以走到後牆）
    rect(-24.5, -12, V.houseA.x0 - 3.1, -9.5),
    rect(V.houseB.x1 + W, -12, 24.5, -9.5),
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
    // 店裡的米桶；紅磚厝的竹椅、水缸
    { x: SI.rice.x, z: SI.rice.z, r: 0.34 },
    { x: AI.table.x - 0.8, z: AI.table.z, r: 0.24 },
    { x: AI.table.x + 0.8, z: AI.table.z, r: 0.24 },
    { x: AI.jar.x, z: AI.jar.z, r: 0.32 },
    { x: AI.chair.x, z: AI.chair.z, r: 0.3 },
  ]
  // 南邊到水溝為止；北邊到房子的後牆（房子以外的地方另外擋在 -9.5）
  return { rects, circles, bounds: rect(-24, HA.z0 + W, 24, V.ditch.z0 - 0.08) }
}

/** 三棟可以走進去的房子：阿嬤在裡面就淡出外殼、鏡頭拉近 */
const inRoom = (r: { x0: number; x1: number; z0: number; z1: number }) => rect(r.x0 + W, r.z0 + W, r.x1 - W, r.z1 - 0.1)

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
  buildings: [
    // 外殼（正面、東牆、屋頂、招牌、亭仔腳的浪板）淡出；後牆、西牆留著當背景
    { id: 'village_shop', inside: inRoom(V.shop), min: [V.shop.x0 - 0.5, 0.2, V.shop.z0 - 0.5], max: [V.shop.x1 + 0.5, 5.8, V.shop.z1 + 0.2] },
    { id: 'village_house_a', inside: inRoom(HA), min: [HA.x0 - 0.5, 0.2, HA.z0 - 0.5], max: [HA.x1 + 0.5, 5.0, HA.z1 + 0.3] },
    { id: 'village_house_b', inside: inRoom(HB), min: [HB.x0 - 0.3, 0.2, HB.z0 - 0.3], max: [HB.x1 + 0.3, HB.top + 2.2, HB.z1 + 0.5] },
    // 老榕樹的樹冠：在透天厝裡、榕樹擋住鏡頭時淡成半透明（跟土地公廟的榕樹一樣）
    { id: 'village_banyan', inside: rect(1e3, 1e3, 1e3 + 0.1, 1e3 + 0.1), min: [V.banyan.x - 4.8, 1.5, V.banyan.z - 4.8], max: [V.banyan.x + 4.8, 7.5, V.banyan.z + 4.8] },
    // 電線桿：只當遮擋盒子
    ...V.fadePoles.map((x) => ({ id: `village_pole_${x}`, inside: rect(1e3, 1e3, 1e3 + 0.1, 1e3 + 0.1), min: [x - 0.3, 0.8, V.poleZ - 0.3] as [number, number, number], max: [x + 0.3, 8.6, V.poleZ + 0.3] as [number, number, number] })),
  ],
  rooms: [
    { id: 'shop', name: '柑仔店', area: rect(V.shop.x0, V.shop.z1, V.shop.x1, V.awning.z1) },
    { id: 'shop_in', name: '柑仔店裡', area: inRoom(V.shop) },
    { id: 'house_a', name: '阿好嬸的紅磚厝', area: inRoom(HA) },
    { id: 'house_b', name: '阿財伯家', area: inRoom(HB) },
    { id: 'banyan', name: '老榕樹下', area: rect(12.8, -8, 20, -2.1) },
  ],
  // 亭仔腳和店裡是高起來一階的水泥地、磁磚地
  floorAt: (x, z) => (x > V.shop.x0 && x < V.shop.x1 && z > V.shop.z0 && z < V.awning.z1 ? 0.14 : 0.02),
  // 阿嬌；傍晚阿財伯站在魚缸邊餵魚（晚上他坐藤椅，藤椅本身擋著）
  npcs: (phase: string): Circle[] => [{ x: V.ajiao.x, z: V.ajiao.z, r: 0.32 }, ...(phase === 'dusk' ? [{ x: BI.feed.x, z: BI.feed.z, r: 0.28 }] : [])],
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const night = (s: { phase: string }) => s.phase === 'night'

// ---------------------------------------------------------------------------
// 走進房子裡（DESIGN §30）
// ---------------------------------------------------------------------------

/** 一句一句接著講（間隔 ms） */
function barks(s: { bark: (id: string) => void }, ids: string[], gap = 2600) {
  ids.forEach((id, i) => (i ? window.setTimeout(() => s.bark(id), i * gap) : s.bark(id)))
}

/** 規則檔不能直接 import store（Node 測試會載入），要改狀態時才動態載入 */
function withStore(fn: (st: typeof import('../store').useStore) => void) {
  void import('../store').then(({ useStore }) => fn(useStore))
}

/** 設旗標＋加功德 */
function reward(flags: string[], merit: number) {
  withStore((st) => {
    const x = st.getState()
    st.setState({ flags: { ...x.flags, ...Object.fromEntries(flags.map((f) => [f, true])) }, meta: { ...x.meta, merit: x.meta.merit + merit } })
  })
}

/** 畫面那邊的小音效（鋼琴、貓呼嚕）：只在按下去的時候動態載入 */
function sound(name: 'piano' | 'purr' | 'meow' | 'tv') {
  void import('../scene/VillageSound').then((m) => m.villageSound(name))
}

const lines = (ids: string[]) => ids.map((line) => ({ line }))

const V2_DIALOGUES: Record<string, Dialogue> = {
  // 柑仔店：偷拿糖果罐裡的糖（1946 年的回憶，兩個人蹲在板凳後面一人一顆）
  v2_candy_first: { steps: lines(['v2.candy.1', 'v2.candy.2', 'v2.candy.3', 'v2.candy.4', 'v2.candy.5']) },
  v2_candy_again: { steps: lines(['v2.candy.again.1', 'v2.candy.again.2', 'v2.candy.again.3']) },
  // 紅磚厝：床上的鬼貓小花（阿嬤自己說話）
  v2_cat_first: { steps: lines(['v2.cat.first.1', 'v2.cat.first.2', 'v2.cat.first.3', 'v2.cat.first.4', 'v2.cat.first.5']) },
  // 透天厝：阿財伯（退休的總鋪師，看得到阿嬤）
  v2_acai_first: {
    steps: [
      { line: 'v2.acai.first.1' },
      { line: 'v2.acai.first.2' },
      { line: 'v2.acai.first.3' },
      { line: 'v2.acai.first.4' },
      {
        line: 'v2.acai.first.5',
        choices: [
          { line: 'v2.acai.first.c1', goto: 'rice' },
          { line: 'v2.acai.first.c2', goto: 'tv' },
        ],
      },
      { label: 'rice', line: 'v2.acai.first.c1' },
      { line: 'v2.acai.first.r1' },
      { line: 'v2.acai.first.r2', goto: 'end' },
      { label: 'tv', line: 'v2.acai.first.c2' },
      { line: 'v2.acai.first.t1' },
      { label: 'end', line: 'v2.acai.first.end', set: 'acai_met' },
    ],
  },
  v2_acai_tv_intro: { steps: [{ line: 'v2.acai.tvintro.1' }, { line: 'v2.acai.tvintro.2' }, { line: 'v2.acai.tvintro.3', set: 'acai_met' }] },
  v2_acai_tv_a: { steps: lines(['v2.tv.a.1', 'v2.tv.a.2', 'v2.tv.a.3', 'v2.tv.a.4', 'v2.tv.a.5']) },
  v2_acai_tv_b: { steps: lines(['v2.tv.b.1', 'v2.tv.b.2', 'v2.tv.b.3', 'v2.tv.b.4']) },
  v2_acai_tv_c: {
    steps: [
      { line: 'v2.tv.c.1' },
      { line: 'v2.tv.c.2' },
      {
        line: 'v2.tv.c.3',
        choices: [
          { line: 'v2.tv.c.c1', goto: 'how' },
          { line: 'v2.tv.c.c2', goto: 'bet' },
        ],
      },
      { label: 'how', line: 'v2.tv.c.c1' },
      { line: 'v2.tv.c.h1', goto: 'end' },
      { label: 'bet', line: 'v2.tv.c.c2' },
      { line: 'v2.tv.c.b1' },
      { label: 'end', line: 'v2.tv.c.end' },
    ],
  },
}
Object.assign(DIALOGUES, V2_DIALOGUES)

const TV_EPISODES = ['v2_acai_tv_a', 'v2_acai_tv_b', 'v2_acai_tv_c']

const INTERIOR_HOTSPOTS: Hotspot[] = [
  // ---------- 柑仔店裡 ----------
  {
    // 角落的黑白電視：傍晚演布袋戲，半夜收播只剩雪花
    id: 'village_shop_tv',
    scene: 'village',
    x: -2.25,
    z: -6.7,
    r: 1.3,
    icon: { x: SI.tv.x, z: SI.tv.z },
    iconY: SI.tv.y + 0.75,
    label: (s) => (night(s) ? '黑白電視（收播了）' : '看一下黑白電視'),
    run: (s) => {
      sound('tv')
      if (night(s)) barks(s, ['v2.shop.tv.night.1', 'v2.shop.tv.night.2'])
      else barks(s, pick([['v2.shop.tv.dusk.1', 'v2.shop.tv.dusk.2'], ['v2.shop.tv.dusk.3', 'v2.shop.tv.dusk.4']]))
    },
  },
  {
    // 糖果罐：一天偷拿一顆，阿嬌抓包（跟阿嬌的交情 +2）
    id: 'village_shop_candy',
    scene: 'village',
    x: SI.candy.x,
    z: SI.candy.z + 0.8,
    r: 1.1,
    icon: { x: SI.candy.x, z: SI.candy.z },
    iconY: 1.55,
    label: (s) => (s.flags.ajiao_candy_today ? '糖果罐（今天拿過了）' : '偷拿一顆糖'),
    run: (s) => {
      if (s.flags.ajiao_candy_today) {
        s.bark('v2.candy.done')
        return
      }
      s.startDialogue(s.flags.ajiao_candy_met ? 'v2_candy_again' : 'v2_candy_first', () => {
        reward(['ajiao_candy_today', 'ajiao_candy_met'], 0)
        withStore((st) => st.getState().addBond('ajiao', 2))
      })
    },
  },
  {
    // 後門的花布門簾：後面是阿嬌家
    id: 'village_shop_back',
    scene: 'village',
    x: SI.backDoor.x,
    z: V.shop.z0 + 0.95,
    r: 0.9,
    icon: { x: SI.backDoor.x, z: V.shop.z0 + 0.2 },
    iconY: 2.4,
    label: () => '後門的門簾',
    run: (s) => s.bark(night(s) ? 'v2.shop.back.night' : 'v2.shop.back.dusk'),
  },

  // ---------- 紅磚厝（阿好嬸家） ----------
  {
    // 神明桌：阿好搬走以後沒人點香，阿嬤一天幫她點一炷（功德 +1）
    id: 'village_ahao_altar',
    scene: 'village',
    x: AI.table.x,
    z: AI.table.z + 0.95,
    r: 1.25,
    icon: { x: AI.altar.x, z: AI.altar.z },
    iconY: 2.0,
    label: (s) => (s.flags.ahao_incense_today ? '阿好家的神明桌（香還在燒）' : '幫阿好點一炷香'),
    run: (s) => {
      if (s.flags.ahao_incense_today) {
        s.bark('v2.ahao.altar.done')
        return
      }
      s.bark(s.flags.ahao_incense_met ? pick(['v2.ahao.altar.2', 'v2.ahao.altar.3']) : 'v2.ahao.altar.1')
      reward(['ahao_incense_today', 'ahao_incense_met'], 1)
      void import('../audio/sfx').then(({ sfx }) => sfx.play('incense', { volume: 0.5 }))
    },
  },
  {
    // 牆上的日曆與全家福
    id: 'village_ahao_calendar',
    scene: 'village',
    x: AI.cupboard.x - 0.2,
    z: AI.table.z - 0.35,
    r: 0.95,
    icon: { x: AI.calendar.x, z: HA.z0 + 0.2 },
    iconY: AI.calendar.y + 0.6,
    label: () => '牆上的日曆',
    run: (s) => barks(s, ['v2.ahao.calendar', 'v2.ahao.photo'], 3600),
  },
  {
    // 紅眠床上的鬼貓小花（陰陽眼才看得到）
    id: 'village_ahao_cat',
    scene: 'village',
    x: AI.bed.x + AI.bed.w / 2 + 0.55,
    z: AI.bed.z + 0.2,
    r: 1.15,
    icon: { x: AI.bed.x + 0.2, z: AI.bed.z + 0.25 },
    iconY: 1.2,
    label: (s) => (s.vision ? '摸摸小花' : null),
    run: (s) => {
      if (!s.flags.ahao_cat_met) {
        sound('meow')
        s.startDialogue('v2_cat_first', () => {
          reward(['ahao_cat_met'], 1)
          sound('purr')
        })
        return
      }
      sound('purr')
      s.bark(pick(['v2.cat.again.1', 'v2.cat.again.2', 'v2.cat.again.3']))
    },
  },

  // ---------- 透天厝（阿財伯家） ----------
  {
    // 阿財伯：傍晚餵魚、八點檔、半夜在藤椅上睡著
    id: 'village_acai',
    scene: 'village',
    x: BI.sofa.x + 0.4,
    z: BI.sofa.z + 1.0,
    r: 1.55,
    icon: { x: BI.armchair.x, z: BI.armchair.z },
    iconY: 1.95,
    label: (s) => {
      switch (acaiState(s)) {
        case 'feed':
          return s.flags.acai_met ? '跟阿財伯說話' : '跟阿財伯打招呼'
        case 'tv':
          return s.flags.acai_tv_today ? '八點檔（今天看過了）' : '陪阿財伯看八點檔'
        case 'doze':
          return s.flags.acai_blanket_today ? '阿財伯睡得很熟' : '幫阿財伯蓋被子'
        default:
          return null
      }
    },
    run: (s) => {
      const st = acaiState(s)
      if (st === 'feed') {
        if (!s.flags.acai_met) s.startDialogue('v2_acai_first')
        else s.bark(pick(['v2.acai.feed.1', 'v2.acai.feed.2']))
        return
      }
      if (st === 'tv') {
        if (s.flags.acai_tv_today) {
          s.bark('v2.acai.tv.done')
          return
        }
        const ep = TV_EPISODES[s.meta.night % TV_EPISODES.length]
        const watch = () => s.startDialogue(ep, () => reward(['acai_tv_today'], 1))
        if (!s.flags.acai_met) s.startDialogue('v2_acai_tv_intro', watch)
        else watch()
        return
      }
      if (st === 'doze') {
        if (s.flags.acai_blanket_today) {
          s.bark(pick(['v2.acai.snore.1', 'v2.acai.snore.2']))
          return
        }
        barks(s, ['v2.acai.sleeptalk', 'v2.acai.blanket'], 3200)
        reward(['acai_blanket_today'], 1)
      }
    },
  },
  {
    // 魚缸：傍晚阿財伯在餵魚；陰陽眼開著，魚會游過來看阿嬤
    id: 'village_acai_tank',
    scene: 'village',
    x: BI.tank.x + 0.75,
    z: BI.tank.z + 0.3,
    r: 0.95,
    icon: { x: BI.tank.x, z: BI.tank.z },
    iconY: 1.85,
    label: () => '看魚缸',
    run: (s) => {
      if (s.vision) s.bark('v2.tank.vision')
      else if (acaiState(s) === 'feed') s.bark('v2.tank.acai')
      else s.bark(night(s) ? 'v2.tank.night' : 'v2.tank.dusk')
    },
  },
  {
    // 鋼琴：孫女的，一根手指頭叮叮咚咚（半夜彈小聲一點）
    id: 'village_acai_piano',
    scene: 'village',
    x: BI.piano.x + 0.75,
    z: BI.piano.z,
    r: 0.85,
    icon: { x: BI.piano.x, z: BI.piano.z },
    iconY: 1.7,
    label: () => '按一下鋼琴',
    run: (s) => {
      sound('piano')
      s.bark(acaiState(s) === 'doze' ? 'v2.piano.night' : pick(['v2.piano.1', 'v2.piano.2']))
    },
  },
]

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
  ...INTERIOR_HOTSPOTS,
]
