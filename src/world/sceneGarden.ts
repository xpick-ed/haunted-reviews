import { box, rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import type { Ingredient } from './night/items'

// 後院菜園＋雞舍（DESIGN §25.1）：從阿春民宿屋後的小路過來。採地瓜葉、挖地瓜、撿雞蛋、拿菜脯。
// 規則在這裡；畫面在 src/scene/Garden.tsx。
// 注意：scenes.ts 會被 Node 的模擬測試載入，這裡不能 import store（寫入 store 走 gardenStore，由畫面那邊掛上來）。
//
//          z 負（北）
//   稻草人   地瓜田（三條壟）   絲瓜棚   雞舍 ┐ 堆肥
//            地瓜葉（四行）     小路     雞圈 ┘
//   水井＋水缸                  │       竹篩曬菜脯
//   ─────────────── 竹籬笆 ── 出口（回家）──────
//          z 正（南，鏡頭這一側）

export const GARDEN = {
  /** 地瓜葉（四行）、地瓜壟（三條） */
  leaf: { x0: -9.2, x1: -3.0, z0: -0.6, z1: 3.9 },
  potato: { x0: -9.2, x1: -3.0, z0: -8.2, z1: -3.2 },
  /** 絲瓜棚（跨在小路上） */
  trellis: { x0: -1.7, x1: 1.7, z0: -9.4, z1: -5.8, h: 2.3 },
  /** 雞舍（小屋）與雞圈（竹籬圍起來，西邊有門） */
  coop: { x0: 4.2, x1: 8.8, z0: -10.2, z1: -6.8 },
  run: { x0: 3.0, x1: 10.2, z0: -6.8, z1: -1.4, gateZ: -3.4, gateW: 1.3 },
  nest: { x: 6.5, z: -6.35 },
  /** 竹篩曬菜脯 */
  rack: { x: 7.4, z: 3.4 },
  well: { x: -10.2, z: 5.4 },
  jar: { x: -8.7, z: 6.3 },
  compost: { x: 11.2, z: -8.8 },
  scarecrow: { x: -6.1, z: -9.6 },
  /** 南邊的竹籬笆，中間留出口 */
  fenceZ: 9.3,
  gateHalf: 2.5,
}

const G = GARDEN

function gardenColliders() {
  const r = G.run
  const rects: Rect[] = [
    rect(G.coop.x0, G.coop.z0, G.coop.x1, G.coop.z1),
    // 雞圈的竹籬（西邊留門）
    rect(r.x0, r.z1 - 0.08, r.x1, r.z1 + 0.08),
    rect(r.x1 - 0.08, r.z0, r.x1 + 0.08, r.z1),
    rect(r.x0 - 0.08, r.z0, r.x0 + 0.08, r.gateZ - r.gateW / 2),
    rect(r.x0 - 0.08, r.gateZ + r.gateW / 2, r.x0 + 0.08, r.z1),
    box(G.rack.x, G.rack.z, 3.2, 1.3),
    box(G.compost.x, G.compost.z, 1.8, 1.6),
    // 南邊竹籬笆（出口兩側）
    rect(-13, G.fenceZ - 0.08, -G.gateHalf, G.fenceZ + 0.08),
    rect(G.gateHalf, G.fenceZ - 0.08, 13, G.fenceZ + 0.08),
  ]
  const circles: Circle[] = [
    { x: G.well.x, z: G.well.z, r: 0.62 },
    { x: G.jar.x, z: G.jar.z, r: 0.45 },
    { x: G.scarecrow.x, z: G.scarecrow.z, r: 0.25 },
    // 絲瓜棚的四根柱子
    ...[G.trellis.x0, G.trellis.x1].flatMap((x) => [G.trellis.z0, G.trellis.z1].map((z) => ({ x, z, r: 0.1 }))),
  ]
  return { rects, circles, bounds: rect(-12.4, -10.6, 12.4, 10) }
}

export const GARDEN_SCENE: SceneDef = {
  id: 'garden',
  name: '後院菜園',
  colliders: gardenColliders(),
  spawns: {
    path: [0, 8],
  },
  exits: [{ area: rect(-2.5, 9, 2.5, 10), to: 'home', spawn: 'back', label: '↓ 回家', sign: [2.6, 8.2] }],
  buildings: [],
  rooms: [
    { id: 'patch', name: '菜園', area: rect(G.leaf.x0 - 0.6, G.potato.z0 - 0.6, G.leaf.x1 + 0.6, G.leaf.z1 + 0.6) },
    { id: 'run', name: '雞圈', area: rect(G.run.x0, G.run.z0, G.run.x1, G.run.z1) },
  ],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}

// ---------------------------------------------------------------------------
// 熱點：每樣東西一天只能拿一次（旗標名字以 _today 結尾，天亮自動清掉）
// ---------------------------------------------------------------------------

/** 畫面那邊（Garden.tsx）掛上來的 store 寫入：這個檔案不能直接 import store */
export const gardenStore: { set?: (fn: (s: GameState) => Partial<GameState>) => void } = {}

/** 拿到東西：食材 +n、設今天的旗標 */
function gain(item: Ingredient, n: number, flag: string) {
  gardenStore.set?.((s) => ({
    meta: { ...s.meta, pantry: { ...s.meta.pantry, [item]: (s.meta.pantry[item] ?? 0) + n } },
    flags: { ...s.flags, [flag]: true },
  }))
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

function chore(o: {
  id: string
  flag: string
  item: Ingredient
  amount: () => number
  x: number
  z: number
  r: number
  icon: { x: number; z: number }
  iconY: number
  todo: string
  done: string
  lines: string[]
  doneLine: string
}): Hotspot {
  return {
    id: o.id,
    scene: 'garden',
    x: o.x,
    z: o.z,
    r: o.r,
    icon: o.icon,
    iconY: o.iconY,
    label: (s) => (s.flags[o.flag] ? o.done : o.todo),
    run: (s) => {
      if (s.flags[o.flag]) {
        s.bark(o.doneLine)
        return
      }
      gain(o.item, o.amount(), o.flag)
      s.bark(pick(o.lines))
    },
  }
}

export const GARDEN_HOTSPOTS: Hotspot[] = [
  chore({
    id: 'garden_leaf',
    flag: 'garden_leaf_today',
    item: 'leaf',
    amount: () => 1,
    x: (G.leaf.x0 + G.leaf.x1) / 2,
    z: G.leaf.z1 + 0.7,
    r: 1.9,
    icon: { x: (G.leaf.x0 + G.leaf.x1) / 2, z: (G.leaf.z0 + G.leaf.z1) / 2 },
    iconY: 1.0,
    todo: '採地瓜葉',
    done: '地瓜葉（今天採過了）',
    lines: ['garden.leaf.1', 'garden.leaf.2'],
    doneLine: 'garden.leaf.done',
  }),
  chore({
    id: 'garden_potato',
    flag: 'garden_potato_today',
    item: 'sweetpotato',
    amount: () => 1,
    x: (G.potato.x0 + G.potato.x1) / 2,
    z: G.potato.z1 + 0.75,
    r: 1.7,
    icon: { x: (G.potato.x0 + G.potato.x1) / 2, z: (G.potato.z0 + G.potato.z1) / 2 },
    iconY: 1.0,
    todo: '挖地瓜',
    done: '地瓜（今天挖過了）',
    lines: ['garden.potato.1', 'garden.potato.2'],
    doneLine: 'garden.potato.done',
  }),
  chore({
    id: 'garden_egg',
    flag: 'garden_egg_today',
    item: 'egg',
    // 母雞今天生了一或兩顆
    amount: () => (Math.random() < 0.5 ? 1 : 2),
    x: G.nest.x,
    z: G.nest.z + 0.55,
    r: 1.3,
    icon: { x: G.nest.x, z: G.coop.z1 - 0.2 },
    iconY: 1.3,
    todo: '撿雞蛋',
    done: '雞蛋（今天撿過了）',
    lines: ['garden.egg.1', 'garden.egg.2'],
    doneLine: 'garden.egg.done',
  }),
  chore({
    id: 'garden_radish',
    flag: 'garden_radish_today',
    item: 'radish',
    amount: () => 1,
    x: G.rack.x,
    z: G.rack.z - 1.25,
    r: 1.6,
    icon: { x: G.rack.x, z: G.rack.z },
    iconY: 1.4,
    todo: '拿菜脯',
    done: '菜脯（今天拿過了）',
    lines: ['garden.radish.1', 'garden.radish.2'],
    doneLine: 'garden.radish.done',
  }),
  {
    id: 'garden_well',
    scene: 'garden',
    x: G.well.x + 0.9,
    z: G.well.z + 0.2,
    r: 1.3,
    icon: { x: G.well.x, z: G.well.z },
    iconY: 1.8,
    label: () => '手壓式抽水機',
    run: (s) => s.bark(s.phase === 'night' ? 'garden.well.night' : 'garden.well'),
  },
  {
    id: 'garden_scarecrow',
    scene: 'garden',
    x: G.scarecrow.x,
    z: G.scarecrow.z + 0.9,
    r: 1.1,
    icon: { x: G.scarecrow.x, z: G.scarecrow.z },
    iconY: 2.1,
    label: () => '稻草人',
    run: (s) => s.bark('garden.scarecrow'),
  },
]
