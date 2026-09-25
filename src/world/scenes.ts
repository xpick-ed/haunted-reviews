import {
  BED,
  BUCKET,
  CUPBOARD,
  DRESSER,
  FENCE,
  FLOOR_Y,
  GM_BED,
  GUEST_DOOR_Z,
  GUEST_ROOMS,
  HALL_PART_X,
  HAN_SWEEP,
  HAN_BED,
  HAN_DESK,
  KITCHEN_JAR,
  KITCHEN_TABLE,
  MAIN,
  MAIN_PORCH,
  MAIN_WALL_TOP,
  PILLOW_Z,
  ROAD,
  ROCKER,
  ROOMS,
  SEWING,
  SIDE_DOOR_W,
  SIDE_DOOR_Z,
  SINK,
  STOVE,
  TEA,
  TOILET,
  WING_BACK_DOOR_Z,
  WING_L,
  WING_PORCH,
  WING_R,
  WING_WALL_TOP,
  type Area,
} from '../scene/layout'
import { box, rect, wallRects, type Colliders, type Rect } from './collision'

// 場景定義：碰撞、出生點、出口、建築（淡出與室內鏡頭用）、地板高度。
// 視覺在 scene/ 底下，這裡只有「規則」需要的資料。

export type SceneId = 'home' | 'temple'

export interface Building {
  id: string
  /** 室內範圍：阿嬤在裡面就淡出、鏡頭拉近 */
  inside: Rect
  /** 遮擋判定用的立體盒子 */
  min: [number, number, number]
  max: [number, number, number]
}

export interface Exit {
  area: Rect
  to: SceneId
  spawn: string
  /** 出口路牌上寫的字 */
  label: string
  sign: [number, number]
}

export interface SceneDef {
  id: SceneId
  name: string
  colliders: Colliders
  spawns: Record<string, [number, number]>
  exits: Exit[]
  buildings: Building[]
  rooms: { id: string; name: string; area: Area }[]
  floorAt: (x: number, z: number) => number
}

const inside = (a: Area | Rect, x: number, z: number) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1

// ---------------------------------------------------------------------------
// 阿春民宿
// ---------------------------------------------------------------------------

const DOOR = 1.0
const T = 0.3

function homeColliders(): Colliders {
  const rects: Rect[] = []
  const add = (...r: Rect[]) => rects.push(...r)

  // 正身：前牆（大門）、後牆、兩側山牆、神明廳左右隔間（各有一扇門）
  add(...wallRects('x', MAIN.x0 - T / 2, MAIN.x1 + T / 2, MAIN.z1, T, [{ c: 0, w: 1.7 }]))
  add(...wallRects('x', MAIN.x0 - T / 2, MAIN.x1 + T / 2, MAIN.z0, T))
  add(...wallRects('z', MAIN.z0, MAIN.z1, MAIN.x0, T))
  add(...wallRects('z', MAIN.z0, MAIN.z1, MAIN.x1, T))
  for (const x of [-HALL_PART_X, HALL_PART_X]) add(...wallRects('z', MAIN.z0, MAIN.z1, x, 0.14, [{ c: SIDE_DOOR_Z, w: SIDE_DOOR_W }]))
  // 步口廊的柱子
  for (const x of MAIN_PORCH.columnsX) add(box(x, MAIN_PORCH.columnZ, 0.36, 0.36))

  // 護龍：內牆（兩扇門）、外牆、前後山牆、前後間隔間
  for (const [W, side] of [
    [WING_R, 1],
    [WING_L, -1],
  ] as const) {
    const inner = side === 1 ? W.x0 : W.x1
    const outer = side === 1 ? W.x1 : W.x0
    add(
      ...wallRects('z', W.z0, W.z1, inner, T, [
        { c: WING_BACK_DOOR_Z, w: DOOR },
        { c: GUEST_DOOR_Z, w: DOOR },
      ]),
    )
    add(...wallRects('z', W.z0, W.z1, outer, T))
    add(...wallRects('x', W.x0 - T / 2, W.x1 + T / 2, W.z0, T))
    add(...wallRects('x', W.x0 - T / 2, W.x1 + T / 2, W.z1, T))
    add(...wallRects('x', W.x0, W.x1, W.split, 0.14))
    // 走廊柱
    const postX = inner - side * (WING_PORCH - 0.12)
    for (const z of [-1.5, 0.95, 3.45, 5.75]) add(box(postX, z, 0.26, 0.26))
  }

  // 圍牆與門柱
  const wallEnd = WING_R.x1 + 0.45
  add(rect(FENCE.gateHalf + 0.3, FENCE.z - 0.12, wallEnd, FENCE.z + 0.12))
  add(rect(-wallEnd, FENCE.z - 0.12, -(FENCE.gateHalf + 0.3), FENCE.z + 0.12))
  for (const s of [-1, 1]) add(box(s * (FENCE.gateHalf + 0.15), FENCE.z, 0.5, 0.5))

  // 家具
  add(box(BED.x, BED.z, BED.w + 0.2, BED.l + 0.2))
  add(box(WING_R.x1 - 0.42, BED.z - BED.l / 2 + 0.28, 0.44, 0.44)) // 床頭櫃
  add(box(WING_R.x1 - 0.48, WING_R.split + 0.62, 0.6, 1.0)) // 衣櫃
  add(box(WING_R.x1 - 0.42, BED.z + BED.l / 2 + 0.38, 0.5, 0.85)) // 電視櫃
  add(box(0, MAIN.z0 + 0.62, 3.0, 0.7)) // 供桌
  add(box(0, MAIN.z0 + 1.87, 1.1, 1.1)) // 八仙桌
  add(box(GM_BED.x, GM_BED.z, GM_BED.w + 0.1, GM_BED.l + 0.1))
  add(box(SEWING.x, SEWING.z, 1.0, 0.55))
  add(box(DRESSER.x, DRESSER.z, 0.55, 1.1))
  add(box(HAN_BED.x, HAN_BED.z, HAN_BED.w + 0.1, HAN_BED.l + 0.1))
  add(box(HAN_DESK.x, HAN_DESK.z, 0.6, 1.2))
  add(box(STOVE.x, STOVE.z, 1.15, 1.7))
  add(box(CUPBOARD.x, CUPBOARD.z, 1.1, 0.5))
  add(box(KITCHEN_TABLE.x, KITCHEN_TABLE.z, 0.8, 0.8))
  add(box(TOILET.x, TOILET.z, 0.5, 0.6))
  add(box(SINK.x, SINK.z, 0.5, 0.6))
  // 客房二（舊儲藏室）
  const r2 = GUEST_ROOMS.r2
  add(box(r2.bed.x, r2.bed.z, r2.bed.w + 0.2, r2.bed.l + 0.2))
  add(box(r2.nightstand[0], r2.nightstand[1], 0.44, 0.44))

  const circles = [
    { x: ROCKER.x, z: ROCKER.z, r: 0.38 },
    { x: KITCHEN_JAR.x, z: KITCHEN_JAR.z, r: 0.42 },
    { x: BUCKET.x, z: BUCKET.z, r: 0.22 },
    { x: WING_R.x0 + 0.5, z: BED.z + BED.l / 2 + 0.3, r: 0.22 }, // 電扇
    { x: GUEST_ROOMS.r2.fan[0], z: GUEST_ROOMS.r2.fan[1], r: 0.22 }, // 客房二的電扇
    { x: TEA.x, z: TEA.z, r: 0.4 }, // 茶桌
    { x: TEA.x + 0.75, z: TEA.z + 0.2, r: 0.3 }, // 另一張竹椅
    { x: -5.35, z: 6.55, r: 0.45 }, // 水缸
    { x: -4.9, z: 3.9, r: 0.18 }, // 曬衣架
    { x: -1.9, z: 3.9, r: 0.18 },
    { x: 2.9, z: 9.1, r: 0.6 }, // 機車
    { x: 4.4, z: 7.18, r: 0.45 }, // 腳踏車
    // 樹、香蕉、竹叢、電線桿
    { x: -15.5, z: 1.5, r: 1.2 },
    { x: 14.5, z: -13.5, r: 0.9 },
    { x: -13.2, z: 7.0, r: 0.35 },
    { x: 13.8, z: -1.6, r: 0.35 },
    { x: -13.0, z: -8.8, r: 0.35 },
    { x: 13.3, z: -7.4, r: 0.35 },
    { x: -2.5, z: ROAD.z + ROAD.width / 2 + 0.25, r: 0.25 },
    { x: -18.5, z: ROAD.z + ROAD.width / 2 + 0.25, r: 0.25 },
  ]
  add(rect(3.4, -15.2, 11, -11.0)) // 竹叢
  return { rects, circles, bounds: rect(-24, -17, 27.5, 16) }
}

const PLATFORMS: Rect[] = [
  rect(MAIN.x0 - 0.45, MAIN.z0 - 0.45, MAIN.x1 + 0.45, MAIN.z1),
  rect(WING_L.x0 - 0.45, MAIN.z1, WING_R.x1 + 0.45, MAIN_PORCH.z1 + 0.15),
  rect(WING_R.x0 - WING_PORCH - 0.2, MAIN_PORCH.z1 + 0.15, WING_R.x1 + 0.45, WING_R.z1 + 0.45),
  rect(WING_L.x0 - 0.45, MAIN_PORCH.z1 + 0.15, WING_L.x1 + WING_PORCH + 0.2, WING_L.z1 + 0.45),
]
const YARD_AREA = rect(-(WING_R.x1 + 0.45), MAIN_PORCH.z1, WING_R.x1 + 0.45, FENCE.z)

export const HOME: SceneDef = {
  id: 'home',
  name: '阿春民宿',
  colliders: homeColliders(),
  spawns: {
    start: [0, MAIN.z1 - 1.3],
    yard: [0, 2.5],
    gate: [0, FENCE.z + 1.2],
    road_east: [22.5, ROAD.z],
  },
  exits: [{ area: rect(25.2, ROAD.z - 3, 28, ROAD.z + 3), to: 'temple', spawn: 'road_west', label: '土地公廟 →', sign: [23.6, ROAD.z - 2.1] }],
  buildings: [
    {
      id: 'main',
      inside: rect(MAIN.x0, MAIN.z0, MAIN.x1, MAIN_PORCH.z1),
      min: [MAIN.x0 - 0.7, 0, MAIN.z0 - 0.6],
      max: [MAIN.x1 + 0.7, MAIN.ridgeY + 0.6, MAIN_PORCH.z1],
    },
    {
      id: 'wingR',
      inside: rect(WING_R.x0 - WING_PORCH, WING_R.z0, WING_R.x1, WING_R.z1),
      min: [WING_R.x0 - WING_PORCH, 0, WING_R.z0 - 0.2],
      max: [WING_R.x1 + 0.5, WING_R.ridgeY + 0.4, WING_R.z1 + 0.5],
    },
    {
      id: 'wingL',
      inside: rect(WING_L.x0, WING_L.z0, WING_L.x1 + WING_PORCH, WING_L.z1),
      min: [WING_L.x0 - 0.5, 0, WING_L.z0 - 0.2],
      max: [WING_L.x1 + WING_PORCH, WING_L.ridgeY + 1.0, WING_L.z1 + 0.5],
    },
  ],
  rooms: Object.entries(ROOMS).map(([id, r]) => ({ id, name: r.name, area: r.area })),
  floorAt: (x, z) => {
    for (const p of PLATFORMS) if (inside(p, x, z)) return FLOOR_Y
    if (inside(YARD_AREA, x, z)) return 0.1
    return 0.02
  },
}

// ---------------------------------------------------------------------------
// 土地公廟（福德祠）
// ---------------------------------------------------------------------------

export const TEMPLE = {
  /** 廟身（室內） */
  hall: rect(-2.4, -3.6, 2.4, -0.6),
  /** 台基 */
  base: rect(-3.3, -4.2, 3.3, 0.9),
  baseY: 0.36,
  ridgeY: 3.9,
  burner: { x: 0, z: 2.3 },
  furnace: { x: 3.9, z: 0.6 },
  bench: { x: -4.9, z: 0.6 },
  banyan: { x: -6.8, z: -3.2 },
  roadZ: 6.2,
  roadWidth: 3.4,
}

function templeColliders(): Colliders {
  const t = TEMPLE
  const rects: Rect[] = [
    // 廟身三面牆（正面開放，兩根柱子）
    ...wallRects('x', t.hall.x0, t.hall.x1, t.hall.z0, 0.3),
    ...wallRects('z', t.hall.z0, t.hall.z1, t.hall.x0, 0.3),
    ...wallRects('z', t.hall.z0, t.hall.z1, t.hall.x1, 0.3),
    box(0, t.hall.z0 + 0.55, 2.4, 0.7), // 供桌
    box(t.furnace.x, t.furnace.z, 1.1, 1.1),
    box(t.bench.x, t.bench.z, 1.7, 0.5),
  ]
  const circles = [
    { x: t.burner.x, z: t.burner.z, r: 0.62 },
    { x: -1.4, z: t.hall.z1 + 0.2, r: 0.18 },
    { x: 1.4, z: t.hall.z1 + 0.2, r: 0.18 },
    { x: t.banyan.x, z: t.banyan.z, r: 1.1 },
  ]
  return { rects, circles, bounds: rect(-17, -9, 17, 10.5) }
}

export const TEMPLE_SCENE: SceneDef = {
  id: 'temple',
  name: '土地公廟',
  colliders: templeColliders(),
  spawns: {
    road_west: [-12, TEMPLE.roadZ],
    front: [0, 4.2],
  },
  exits: [{ area: rect(-17, TEMPLE.roadZ - 3.2, -14.4, TEMPLE.roadZ + 3.2), to: 'home', spawn: 'road_east', label: '← 阿春民宿', sign: [-12.6, TEMPLE.roadZ - 2.1] }],
  buildings: [
    {
      id: 'temple',
      inside: TEMPLE.hall,
      min: [-3.0, 0, -4.1],
      max: [3.0, TEMPLE.ridgeY + 0.6, 0.2],
    },
  ],
  rooms: [{ id: 'temple', name: '福德祠', area: TEMPLE.hall }],
  floorAt: (x, z) => (inside(TEMPLE.base, x, z) ? TEMPLE.baseY : 0.02),
}

export const SCENES: Record<SceneId, SceneDef> = { home: HOME, temple: TEMPLE_SCENE }

/** NPC 站的位置（畫面與碰撞共用） */
export const NPC_SPOTS = {
  xiaohan: { x: HAN_SWEEP.x, z: HAN_SWEEP.z },
  ayi: { x: TEMPLE.bench.x + 0.2, z: TEMPLE.bench.z + 0.55 },
}

/** 目前站在場景裡的 NPC 的碰撞圓 */
export function npcColliders(scene: SceneId, phase: string) {
  if (scene === 'home' && phase === 'dusk') return [{ ...NPC_SPOTS.xiaohan, r: 0.34 }]
  if (scene === 'temple') return [{ ...NPC_SPOTS.ayi, r: 0.34 }]
  return []
}

/** 客房床邊（蓋被子的熱點）等常用點 */
export const SPOTS = {
  bedside: { x: BED.x - BED.w / 2 - 0.45, z: BED.z + 0.1 },
  fan: { x: WING_R.x0 + 0.55, z: BED.z + BED.l / 2 + 0.15 },
  fanBody: { x: WING_R.x0 + 0.5, z: BED.z + BED.l / 2 + 0.3 },
  pillow: { x: BED.x, z: PILLOW_Z },
  altar: { x: 0, z: MAIN.z0 + 2.9 },
  wallTop: { main: MAIN_WALL_TOP, wing: WING_WALL_TOP },
}
