import { FLOOR_Y, GUEST_DOOR_Z, GUEST_ROOMS, GUEST_WINDOW_OUT_Z, ROOMS, WING_BACK_DOOR_Z, WING_L, WING_R } from '../../scene/layout'
import type { NightSim } from './sim'
import type { GuestId, ObjectState, RoomId } from './types'
import type { TKKind } from './director'

// 念力（DESIGN §26.2）：深夜在家裡，用手指／滑鼠直接拖房間裡的東西。
// 這裡只有「規則」：今晚有哪些東西可以拖、每個東西沿著什麼路徑走、拖到哪裡算完成。
// 畫面與拖曳在 src/scene/Telekinesis.tsx。純 TS，不依賴 three（Node 也能跑）。

export type V3 = [number, number, number]

/** 阿嬤離東西多遠以內才拖得到（公尺） */
export const TK_RANGE = 6
/** 路徑走到這個比例就算完成 */
export const TK_DONE = 0.93

/**
 * 東西怎麼走：
 * - poly：沿著一串點（被子、窗、門、掉的東西），手指拖到路徑上最近的地方
 * - floor：在地上自由滾（球），碰到床會被擋開，滾到 goal 附近算完成
 */
export type TKPath =
  | { type: 'poly'; pts: V3[] }
  | { type: 'floor'; y: number; area: Box; block: Box | null; goal: [number, number]; goalR: number }

interface Box {
  x0: number
  z0: number
  x1: number
  z1: number
}

/** 東西長什麼樣子（Telekinesis.tsx 依這個畫） */
export type TKLook = 'corner' | 'ball' | 'shutter' | 'door' | 'glasses' | 'phone' | 'cup'

export interface TKTarget {
  id: string
  kind: TKKind
  room: RoomId | null
  look: TKLook
  /** 拿在手上時 HUD 顯示的字 */
  label: string
  path: TKPath
  /** 轉的東西（窗、門）：鉸鏈在哪、半徑、從哪個角度轉到哪個角度（角度：0 = 朝 +z，atan2(x, z)） */
  arc?: { hinge: V3; r: number; a0: number; a1: number }
  /** 被子：床（畫鬼影被子用） */
  bed?: { x: number; w: number; topY: number; z0: number }
}

// ---------------------------------------------------------------------------
// 路徑工具
// ---------------------------------------------------------------------------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** 取樣一段弧：鉸鏈、半徑、角度從 a0 到 a1 */
function arcPts(h: V3, r: number, a0: number, a1: number, n = 24): V3[] {
  const out: V3[] = []
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n)
    out.push([h[0] + Math.sin(a) * r, h[1], h[2] + Math.cos(a) * r])
  }
  return out
}

/** 取樣一條往上拱的曲線（掉的東西從床底下飄到床頭櫃上） */
function hopPts(a: V3, b: V3, lift: number, n = 24): V3[] {
  const out: V3[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) + Math.sin(t * Math.PI) * lift, lerp(a[2], b[2], t)])
  }
  return out
}

/** 取樣一條直線 */
function linePts(a: V3, b: V3, n = 12): V3[] {
  return hopPts(a, b, 0, n)
}

/** 路徑上比例 t（0..1）的位置 */
export function pathPoint(pts: V3[], t: number): V3 {
  const f = Math.min(Math.max(t, 0), 1) * (pts.length - 1)
  const i = Math.min(Math.floor(f), pts.length - 2)
  const k = f - i
  const a = pts[i]
  const b = pts[i + 1]
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]
}

/**
 * 手指的射線（相機位置 o、方向 d，d 是單位向量）最靠近路徑上的哪裡：回傳比例 t。
 * 每一段都算「射線到線段」的最近點，取最近的那一段。
 */
export function projectRay(pts: V3[], o: V3, d: V3): number {
  let best = Infinity
  let bestT = 0
  const n = pts.length - 1
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const w: V3 = [a[0] - o[0], a[1] - o[1], a[2] - o[2]]
    const uu = u[0] * u[0] + u[1] * u[1] + u[2] * u[2]
    const ud = u[0] * d[0] + u[1] * d[1] + u[2] * d[2]
    const uw = u[0] * w[0] + u[1] * w[1] + u[2] * w[2]
    const dw = d[0] * w[0] + d[1] * w[1] + d[2] * w[2]
    const den = uu - ud * ud // d 是單位向量
    // 線段上的參數 s（射線和線段幾乎平行時取中間）
    let s = den > 1e-9 ? (ud * dw - uw) / den : 0.5
    s = Math.min(Math.max(s, 0), 1)
    const p: V3 = [a[0] + u[0] * s, a[1] + u[1] * s, a[2] + u[2] * s]
    // p 到射線的距離
    const q: V3 = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]
    const along = Math.max(0, q[0] * d[0] + q[1] * d[1] + q[2] * d[2])
    const dx = q[0] - d[0] * along
    const dy = q[1] - d[1] * along
    const dz = q[2] - d[2] * along
    const dist = dx * dx + dy * dy + dz * dz
    if (dist < best) {
      best = dist
      bestT = (i + s) / n
    }
  }
  return bestT
}

/** 射線打到高度 y 的水平面的位置（打不到回傳 null） */
export function rayToPlane(o: V3, d: V3, y: number): [number, number] | null {
  if (Math.abs(d[1]) < 1e-6) return null
  const k = (y - o[1]) / d[1]
  if (k <= 0) return null
  return [o[0] + d[0] * k, o[2] + d[2] * k]
}

/** 球：夾在房間裡、不能穿過床（推到床最近的那一邊） */
export function clampFloor(p: Extract<TKPath, { type: 'floor' }>, x: number, z: number, r = 0.08): [number, number] {
  const a = p.area
  x = Math.min(Math.max(x, a.x0 + r), a.x1 - r)
  z = Math.min(Math.max(z, a.z0 + r), a.z1 - r)
  const b = p.block
  if (b && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) {
    const opts: [number, number, number][] = [
      [x - (b.x0 - r), b.x0 - r, z],
      [b.x1 + r - x, b.x1 + r, z],
      [z - (b.z0 - r), x, b.z0 - r],
      [b.z1 + r - z, x, b.z1 + r],
    ]
    opts.sort((m, n) => m[0] - n[0])
    x = opts[0][1]
    z = opts[0][2]
  }
  return [x, z]
}

// ---------------------------------------------------------------------------
// 今晚可以拖的東西
// ---------------------------------------------------------------------------

/** 掉的東西長什麼樣子 */
const LOST_LOOK: Partial<Record<GuestId, { look: TKLook; name: string }>> = {
  zhang: { look: 'glasses', name: '眼鏡' },
  xiaomei: { look: 'phone', name: '手機' },
  atu: { look: 'cup', name: '假牙杯' },
}

/** 客房的門：在護龍朝埕那面牆上，雙開門；只拖靠床那一扇，往房間裡推 */
const DOORS: Record<RoomId, { x: number; z: number; into: 1 | -1 }> = {
  r1: { x: WING_R.x0, z: GUEST_DOOR_Z, into: 1 },
  r2: { x: WING_L.x1, z: WING_BACK_DOOR_Z, into: -1 },
}

/**
 * 今晚現在可以拖的東西。
 * used：今晚已經用掉的（球滾過一次就不再出現）；doorCool：門剛甩過，還在冷卻的房間
 */
export function tkTargets(sim: NightSim, objects: Record<string, ObjectState>, used: Set<string>, doorCool: Set<string> = new Set()): TKTarget[] {
  const out: TKTarget[] = []
  for (const room of ['r1', 'r2'] as RoomId[]) {
    const gs = sim.guests.filter((g) => g.room === room)
    if (!gs.length) continue
    const R = GUEST_ROOMS[room]
    const bed = R.bed
    const foot = bed.z + bed.l / 2
    const inBed = gs.filter((g) => g.mode === 'bed')
    // 床的哪一邊是走道（阿嬤站著蓋被子的那一邊）
    const side = Math.sign(R.bedside[0] - bed.x) || -1

    // 被子：床尾的一角 → 拉到枕頭
    if (inBed.length && inBed.some((g) => !g.tucked)) {
      const x = bed.x + bed.w / 2 - 0.12
      const y = bed.topY + 0.16
      out.push({
        id: `blanket:${room}`,
        kind: 'blanket',
        room,
        look: 'corner',
        label: '把被子拉好',
        path: { type: 'poly', pts: linePts([x, y, foot - 0.05], [x, y, R.pillowZ + 0.32]) },
        bed: { x: bed.x, w: bed.w, topY: bed.topY, z0: foot },
      })
    }

    // 球：有小孩住的房間，滾到他床邊（一晚一次）
    const kid = gs.find((g) => g.def.type === 'child')
    if (kid && !used.has(`ball:${room}`)) {
      const area = ROOMS[R.room].area
      const nearX = bed.x + side * (bed.w / 2 + 0.3)
      out.push({
        id: `ball:${room}`,
        kind: 'ball',
        room,
        look: 'ball',
        label: `把球滾給${kid.def.name}`,
        path: {
          type: 'floor',
          y: FLOOR_Y + 0.08,
          area: { x0: area.x0 + 0.25, z0: area.z0 + 0.25, x1: area.x1 - 0.25, z1: area.z1 - 0.25 },
          block: { x0: bed.x - bed.w / 2, z0: bed.z - bed.l / 2, x1: bed.x + bed.w / 2, z1: bed.z + bed.l / 2 },
          goal: [nearX, bed.z + 0.2],
          goalR: 0.45,
        },
      })
    }

    // 窗：客房一的木板窗，從貼著牆打開的位置轉到關上
    if (R.window && !objects[`${room}.window`]?.on) {
      const hinge: V3 = [WING_R.x1 - 0.21, FLOOR_Y + 1.5, GUEST_WINDOW_OUT_Z - 0.5]
      const a0 = -Math.PI * 0.93
      const a1 = 0
      out.push({
        id: `window:${room}`,
        kind: 'window',
        room,
        look: 'shutter',
        label: '把窗關上',
        path: { type: 'poly', pts: arcPts(hinge, 0.48, a0, a1) },
        arc: { hinge, r: 0.48, a0, a1 },
      })
    }

    // 掉到床底下的東西：從床邊的地上飄到床頭櫃上
    for (const g of gs) {
      if (g.mode !== 'bed' || !g.needs.some((n) => n.kind === 'lost')) continue
      const lk = LOST_LOOK[g.id] ?? { look: 'phone' as TKLook, name: '東西' }
      const under: V3 = [bed.x + side * (bed.w / 2 - 0.12), FLOOR_Y + 0.03, bed.z + 0.25 + g.slot * 0.35]
      const top: V3 = [R.nightstand[0] + 0.08, FLOOR_Y + 0.6, R.nightstand[1] + 0.08]
      out.push({
        id: `item:${g.id}`,
        kind: 'item',
        room,
        look: lk.look,
        label: `把${g.def.name}的${lk.name}放回床頭`,
        path: { type: 'poly', pts: hopPts(under, top, 0.55) },
      })
    }

    // 門：推一下（很快地甩＝很大聲，可以拿來引開注意）
    if (!doorCool.has(room)) {
      const d = DOORS[room]
      // 靠 +z 那一扇：鉸鏈在 z + 0.5，關著時朝 -z（角度 π），往房間裡推
      const hinge: V3 = [d.x, FLOOR_Y + 1.1, d.z + 0.5]
      const a0 = Math.PI
      const a1 = Math.PI - d.into * 1.25
      out.push({
        id: `door:${room}`,
        kind: 'door',
        room,
        look: 'door',
        label: '推一下門',
        path: { type: 'poly', pts: arcPts(hinge, 0.46, a0, a1, 16) },
        arc: { hinge, r: 0.46, a0, a1 },
      })
    }
  }
  return out
}

/** 東西現在的起點（還沒拖時畫在哪裡） */
export function targetStart(t: TKTarget): V3 {
  if (t.path.type === 'poly') return t.path.pts[0]
  const a = t.path.area
  const room = t.room ? GUEST_ROOMS[t.room] : null
  const z = room && room.id === 'r1' ? a.z0 + 0.2 : a.z1 - 0.2
  return [(a.x0 + a.x1) / 2 + (room?.id === 'r1' ? -0.3 : 0.3), t.path.y, z]
}
