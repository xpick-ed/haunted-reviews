import { GUEST_ROOMS, HALL_PART_X, MAIN, SIDE_DOOR_Z, SINK, STOVE, TEA, TOILET, WING_BACK_DOOR_Z, WING_L, WING_R, ROCKER } from '../../scene/layout'

// 客人走路用的路網（DESIGN §16：NPC 路徑）。節點都在門內、門外、走廊、埕上，
// 兩個節點之間走直線不會撞牆。找路用 BFS（節點很少）。

type XZ = [number, number]

export const NODES: Record<string, XZ> = {
  // 客房一（右護龍前間）
  r1_bed: GUEST_ROOMS.r1.bedside,
  r1_in: [WING_R.x0 + 0.75, 2.6],
  r1_door_in: GUEST_ROOMS.r1.doorIn,
  r1_door_out: GUEST_ROOMS.r1.doorOut,
  // 浴廁（右護龍後間）
  bath_door_in: [WING_R.x0 + 0.5, WING_BACK_DOOR_Z],
  bath_door_out: [WING_R.x0 - 0.55, WING_BACK_DOOR_Z],
  bath_in: [8.2, 0.1],
  bath_toilet: [TOILET.x - 0.6, TOILET.z],
  bath_sink: [SINK.x - 0.65, SINK.z],
  porchR: [WING_R.x0 - 0.4, 0.4],
  // 客房二（左護龍後間）
  r2_bed: GUEST_ROOMS.r2.bedside,
  r2_door_in: GUEST_ROOMS.r2.doorIn,
  r2_door_out: GUEST_ROOMS.r2.doorOut,
  porchL: [WING_L.x1 + 0.4, 0.4],
  // 灶腳（左護龍前間）
  kitchen_door_out: [WING_L.x1 + 0.55, 2.15],
  kitchen_door_in: [WING_L.x1 - 0.5, 2.15],
  kitchen_stove: [STOVE.x + 1.05, STOVE.z - 0.3],
  // 埕
  yardR: [4.6, 0.6],
  yardC: [0, 1.4],
  yardL: [-4.6, 0.6],
  yardFront: [0.5, 5.2],
  tea: [TEA.x + 0.2, TEA.z + 1.0],
  // 步口廊與正身
  porchC: [0, MAIN.z1 + 0.85],
  hall: [0, MAIN.z1 - 1.1],
  altar: [0, MAIN.z0 + 2.9],
  hall_sideL: [-HALL_PART_X + 0.5, SIDE_DOOR_Z],
  gm_door: [-HALL_PART_X - 0.55, SIDE_DOOR_Z],
  gm_room: [ROCKER.x + 0.6, ROCKER.z + 0.9],
}

const EDGES: [string, string][] = [
  ['r1_bed', 'r1_in'],
  ['r1_in', 'r1_door_in'],
  ['r1_door_in', 'r1_door_out'],
  ['r1_door_out', 'porchR'],
  ['porchR', 'bath_door_out'],
  ['bath_door_out', 'bath_door_in'],
  ['bath_door_in', 'bath_in'],
  ['bath_in', 'bath_toilet'],
  ['bath_in', 'bath_sink'],
  ['porchR', 'yardR'],
  ['r1_door_out', 'yardR'],
  ['yardR', 'yardC'],
  ['yardC', 'yardL'],
  ['yardC', 'yardFront'],
  ['yardC', 'porchC'],
  ['yardL', 'tea'],
  ['yardL', 'porchL'],
  ['porchL', 'r2_door_out'],
  ['r2_door_out', 'r2_door_in'],
  ['r2_door_in', 'r2_bed'],
  ['porchL', 'kitchen_door_out'],
  ['yardL', 'kitchen_door_out'],
  ['kitchen_door_out', 'kitchen_door_in'],
  ['kitchen_door_in', 'kitchen_stove'],
  ['porchC', 'hall'],
  ['hall', 'altar'],
  ['hall', 'hall_sideL'],
  ['hall_sideL', 'gm_door'],
  ['gm_door', 'gm_room'],
]

const ADJ: Record<string, string[]> = {}
for (const [a, b] of EDGES) {
  ;(ADJ[a] ??= []).push(b)
  ;(ADJ[b] ??= []).push(a)
}

/** 從節點 a 走到節點 b 的點列（含起點、終點） */
export function route(a: string, b: string): XZ[] {
  if (a === b) return [NODES[a]]
  const prev: Record<string, string> = {}
  const seen = new Set([a])
  const q = [a]
  while (q.length) {
    const n = q.shift()!
    if (n === b) break
    for (const m of ADJ[n] ?? []) {
      if (seen.has(m)) continue
      seen.add(m)
      prev[m] = n
      q.push(m)
    }
  }
  if (!seen.has(b)) return [NODES[a]]
  const out: XZ[] = []
  for (let n: string | undefined = b; n; n = prev[n]) out.unshift(NODES[n])
  return out
}

/** 房間 → 床邊節點 */
export const BED_NODE: Record<'r1' | 'r2', string> = { r1: 'r1_bed', r2: 'r2_bed' }

/** YouTuber 巡夜的路線：走到哪裡、在那裡拍多久（秒）、拍的時候看向哪裡 */
export const PATROL: { node: string; film: number; look: XZ; area: string }[] = [
  { node: 'yardC', film: 14, look: [0, MAIN.z1], area: 'yard' },
  { node: 'altar', film: 16, look: [0, MAIN.z0], area: 'altar' },
  { node: 'gm_room', film: 20, look: [ROCKER.x, ROCKER.z], area: 'gm' },
  { node: 'bath_sink', film: 14, look: [SINK.x, SINK.z], area: 'bath' },
  { node: 'yardFront', film: 12, look: [0, 0], area: 'yard' },
]

/** 廟公巡夜的路線（繞一圈） */
export const MIAOGONG_LOOP = ['yardFront', 'yardC', 'porchC', 'hall', 'altar', 'hall', 'porchC', 'yardL', 'porchL', 'kitchen_door_out', 'yardL', 'yardC', 'yardR', 'porchR', 'bath_door_out', 'r1_door_out', 'yardR', 'yardFront']
