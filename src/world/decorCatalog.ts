import { FENCE, FLOOR_Y, GUEST_DOOR_Z, GUEST_ROOMS, HALL_PART_X, MAIN, ROOMS, SIDE_DOOR_Z, WING_BACK_DOOR_Z, WING_L, WING_R, YARD, type Area } from '../scene/layout'
import type { Circle, Rect } from './collision'
import { HOME } from './scenes'
import type { DecorPlacement } from './night/director'
import type { DecorBonus } from './night/sim'
import type { GuestType, RoomId } from './night/types'

// 裝修民宿（DESIGN §27.2）的純資料與規則：目錄、效果換算、擺放位置合不合法。
// 不 import store／音效，Node 測試（scripts/sim-decor.ts）也可以直接用。
//
// 存檔：擺好的東西存在 meta.decor（DecorPlacement）。買了還沒擺的也存在 meta.decor，
// 用「x = UNPLACED」當記號（room: null）；畫面、碰撞、效果都會先把它們濾掉（placedOnly）。

/** 還沒擺出來的東西：x、z 都是這個值 */
export const UNPLACED = 1e4

export const isPlaced = (d: DecorPlacement) => d.x < UNPLACED / 2
export const placedOnly = (decor: DecorPlacement[]) => decor.filter(isPlaced)

/** 擺在哪裡：地上、掛在牆上、罩在床上（蚊帳）、只能擺在埕（燈籠串） */
export type DecorKind = 'floor' | 'wall' | 'bed' | 'yard'

export interface DecorItem {
  id: string
  name: string
  icon: string
  price: number
  kind: DecorKind
  /** 碰撞半徑（掛著的、牆上的是 0） */
  r: number
  /** 只能擺在客房裡 */
  guestRoomOnly?: boolean
  /** 擺在客房裡的效果 */
  room: { comfort?: number; likes?: GuestType[]; spooky?: number; sleepier?: number; noMosquito?: boolean }
  /** 擺在公共空間（埕、神明廳、走廊）時，兩間客房都有的效果 */
  shared: { comfort?: number; spooky?: number; sleepier?: number }
  /** 目錄上的說明 */
  desc: string
}

export const DECOR_ITEMS: DecorItem[] = [
  {
    id: 'orchid',
    name: '蘭花盆栽',
    icon: '🪴',
    price: 1200,
    kind: 'floor',
    r: 0.22,
    room: { comfort: 4, likes: ['elder'] },
    shared: { comfort: 1 },
    desc: '客房：舒適 +4、老朋友喜歡。公共空間：兩間客房舒適 +1',
  },
  {
    id: 'moneytree',
    name: '金錢樹',
    icon: '🌳',
    price: 900,
    kind: 'floor',
    r: 0.25,
    room: { comfort: 3, likes: ['business'] },
    shared: { comfort: 1 },
    desc: '客房：舒適 +3、商務客喜歡（討吉利）。公共空間：兩間客房舒適 +1',
  },
  {
    id: 'windchime',
    name: '風鈴',
    icon: '🎐',
    price: 600,
    kind: 'floor',
    r: 0,
    room: { sleepier: 0.2, comfort: 1 },
    shared: { sleepier: 0.1 },
    desc: '晚上風一吹就叮叮響。客房：早 12 分鐘睡著。公共空間：兩間客房早 6 分鐘睡著',
  },
  {
    id: 'clock',
    name: '老掛鐘',
    icon: '🕰️',
    price: 1500,
    kind: 'wall',
    r: 0,
    room: { comfort: 2, likes: ['business', 'elder'] },
    shared: { comfort: 1 },
    desc: '掛在牆上，滴答滴答。客房：舒適 +2、商務客（準時開會）和老朋友喜歡',
  },
  {
    id: 'net',
    name: '蚊帳',
    icon: '🦟',
    price: 800,
    kind: 'bed',
    r: 0,
    guestRoomOnly: true,
    room: { noMosquito: true, comfort: 3 },
    shared: {},
    desc: '只能罩在客房的床上：那間房不會有蚊子、舒適 +3',
  },
  {
    id: 'rockinghorse',
    name: '搖搖馬',
    icon: '🐴',
    price: 1000,
    kind: 'floor',
    r: 0.3,
    room: { comfort: 2, likes: ['child'] },
    shared: { comfort: 1 },
    desc: '客房：舒適 +2、小孩喜歡。公共空間：兩間客房舒適 +1',
  },
  {
    id: 'doll',
    name: '舊人偶',
    icon: '🎎',
    price: 500,
    kind: 'floor',
    r: 0.16,
    room: { spooky: 2, likes: ['thrill'] },
    shared: { spooky: 1 },
    desc: '有點毛。客房：嚇人 +2（YouTuber 超愛，膽小的人會怕）。公共空間：兩間客房嚇人 +1',
  },
  {
    id: 'bamboochair',
    name: '竹躺椅',
    icon: '🪑',
    price: 1100,
    kind: 'floor',
    r: 0.38,
    room: { comfort: 3, likes: ['elder'] },
    shared: { comfort: 1 },
    desc: '客房：舒適 +3、老朋友喜歡。公共空間：兩間客房舒適 +1',
  },
  {
    id: 'lanterns',
    name: '燈籠串',
    icon: '🏮',
    price: 1300,
    kind: 'yard',
    r: 0.12,
    room: {},
    shared: { comfort: 2 },
    desc: '只能擺在埕，晚上會亮。兩間客房舒適 +2',
  },
  {
    id: 'fishtank',
    name: '金魚缸',
    icon: '🐠',
    price: 1600,
    kind: 'floor',
    r: 0.3,
    room: { comfort: 4, likes: ['child', 'timid'] },
    shared: { comfort: 1 },
    desc: '客房：舒適 +4、小孩和膽小的客人喜歡。公共空間：兩間客房舒適 +1',
  },
  {
    id: 'curtain',
    name: '花布窗簾',
    icon: '🌺',
    price: 700,
    kind: 'wall',
    r: 0,
    guestRoomOnly: true,
    room: { comfort: 5, likes: ['parent'] },
    shared: {},
    desc: '客家花布，只能掛在客房牆上。舒適 +5、帶小孩的家長喜歡',
  },
  {
    id: 'photowall',
    name: '老照片牆',
    icon: '🖼️',
    price: 400,
    kind: 'wall',
    r: 0,
    room: { spooky: 1, likes: ['elder'] },
    shared: { spooky: 1 },
    desc: '一整面黑白老照片。客房：嚇人 +1、老朋友喜歡（照片裡有阿春）',
  },
]

export const itemById = (id: string) => DECOR_ITEMS.find((i) => i.id === id)

// ---------------------------------------------------------------------------
// 房間
// ---------------------------------------------------------------------------

const inArea = (a: Area | Rect, x: number, z: number, pad = 0) => x >= a.x0 + pad && x <= a.x1 - pad && z >= a.z0 + pad && z <= a.z1 - pad

/** 這個位置在哪間客房（不在客房裡就是 null） */
export function roomAt(x: number, z: number): RoomId | null {
  for (const r of ['r1', 'r2'] as RoomId[]) if (inArea(ROOMS[GUEST_ROOMS[r].room].area, x, z)) return r
  return null
}

/** 室內的房間（掛牆壁的東西要在裡面） */
function indoorRoom(x: number, z: number): Area | null {
  for (const r of Object.values(ROOMS)) if (inArea(r.area, x, z)) return r.area
  return null
}

// ---------------------------------------------------------------------------
// 效果：換算成 NightSim 的 DecorBonus
// ---------------------------------------------------------------------------

/** 每間房的上限（擺太多也不會無限加） */
const CAP = { comfort: 20, spooky: 4, sleepier: 0.5 }

export function decorBonus(decor: DecorPlacement[]): DecorBonus {
  const comfort: Record<RoomId, number> = { r1: 0, r2: 0 }
  const spooky: Record<RoomId, number> = { r1: 0, r2: 0 }
  const sleepier: Record<RoomId, number> = { r1: 0, r2: 0 }
  const likes: Record<RoomId, GuestType[]> = { r1: [], r2: [] }
  const noMosquito = new Set<RoomId>()
  for (const d of placedOnly(decor)) {
    const it = itemById(d.item)
    if (!it) continue
    if (d.room) {
      const e = it.room
      comfort[d.room] += e.comfort ?? 0
      spooky[d.room] += e.spooky ?? 0
      sleepier[d.room] += e.sleepier ?? 0
      for (const t of e.likes ?? []) if (!likes[d.room].includes(t)) likes[d.room].push(t)
      if (e.noMosquito) noMosquito.add(d.room)
    } else {
      for (const r of ['r1', 'r2'] as RoomId[]) {
        comfort[r] += it.shared.comfort ?? 0
        spooky[r] += it.shared.spooky ?? 0
        sleepier[r] += it.shared.sleepier ?? 0
      }
    }
  }
  const out: DecorBonus = { comfort: {}, spooky: {}, sleepier: {}, likes: {} }
  for (const r of ['r1', 'r2'] as RoomId[]) {
    if (comfort[r]) out.comfort![r] = Math.min(CAP.comfort, comfort[r])
    if (spooky[r]) out.spooky![r] = Math.min(CAP.spooky, spooky[r])
    if (sleepier[r]) out.sleepier![r] = Math.min(CAP.sleepier, +sleepier[r].toFixed(2))
    if (likes[r].length) out.likes![r] = likes[r]
  }
  if (noMosquito.size) out.noMosquito = [...noMosquito]
  return out
}

const TYPE_NAME: Record<GuestType, string> = {
  couple: '情侶',
  caregiver: '照顧家人的人',
  wanderer: '失智的老人',
  lonely: '一個人來的客人',
  timid: '膽小的客人',
  thrill: 'YouTuber',
  business: '商務客',
  backpacker: '背包客',
  child: '小孩',
  parent: '家長',
  elder: '老朋友',
}

/** 效果摘要（HUD 用）：每間客房一行 */
export function decorSummary(decor: DecorPlacement[]): { room: string; text: string }[] {
  const b = decorBonus(decor)
  return (['r1', 'r2'] as RoomId[]).map((r) => {
    const parts: string[] = []
    if (b.comfort?.[r]) parts.push(`舒適 +${b.comfort[r]}`)
    if (b.spooky?.[r]) parts.push(`嚇人 +${b.spooky[r]}`)
    if (b.sleepier?.[r]) parts.push(`早 ${Math.round(b.sleepier[r]! * 60)} 分鐘睡`)
    if (b.noMosquito?.includes(r)) parts.push('沒有蚊子')
    const lk = b.likes?.[r]
    if (lk?.length) parts.push(`${lk.map((t) => TYPE_NAME[t]).join('、')}喜歡`)
    return { room: GUEST_ROOMS[r].name, text: parts.length ? parts.join('、') : '還沒有擺設' }
  })
}

// ---------------------------------------------------------------------------
// 擺放：位置吸附（牆、床）與合不合法
// ---------------------------------------------------------------------------

/** 門口：前後 0.9 公尺不能擋 */
const DOORS: [number, number][] = [
  [0, MAIN.z1],
  [-HALL_PART_X, SIDE_DOOR_Z],
  [HALL_PART_X, SIDE_DOOR_Z],
  [WING_R.x0, WING_BACK_DOOR_Z],
  [WING_R.x0, GUEST_DOOR_Z],
  [WING_L.x1, WING_BACK_DOOR_Z],
  [WING_L.x1, GUEST_DOOR_Z],
  [0, FENCE.z],
]

/** 阿嬤晚上要站的地方（床邊、床頭櫃、電扇、蚊香）也不能擋 */
const WORK_SPOTS: [number, number][] = (['r1', 'r2'] as RoomId[]).flatMap((r) => {
  const g = GUEST_ROOMS[r]
  return [g.bedside, g.nightstand, g.fan, g.coil, g.doorIn]
})

/** 可以擺東西的範圍：房子和埕（圍牆以內） */
const HOME_AREA: Rect = { x0: WING_L.x0 - 0.3, z0: MAIN.z0 - 0.3, x1: WING_R.x1 + 0.3, z1: FENCE.z - 0.35 }

function circleHitsRect(x: number, z: number, r: number, b: Rect) {
  const cx = Math.max(b.x0, Math.min(x, b.x1))
  const cz = Math.max(b.z0, Math.min(z, b.z1))
  return (x - cx) ** 2 + (z - cz) ** 2 < r * r
}

export interface Snapped {
  x: number
  z: number
  rot: number
  room: RoomId | null
  /** 掛在牆上的高度（地上的東西是 0） */
  y: number
  ok: boolean
  /** 不行的原因（HUD 顯示） */
  why: string
}

/** 牆上東西掛的高度（離地板） */
export const WALL_Y: Record<string, number> = { clock: 1.95, photowall: 1.55, curtain: 1.45 }

/**
 * 把想擺的位置吸附好（牆上的東西貼到最近的牆、蚊帳罩到床上），並檢查合不合法。
 * rot 是玩家轉的方向（地上的東西用；牆上的東西會自動面向房間）。
 */
export function snapPlacement(itemId: string, x: number, z: number, rot: number, others: DecorPlacement[]): Snapped {
  const it = itemById(itemId)
  const bad = (why: string, sx = x, sz = z, srot = rot, y = 0): Snapped => ({ x: sx, z: sz, rot: srot, room: roomAt(sx, sz), y, ok: false, why })
  if (!it) return bad('沒有這樣東西')
  const placed = placedOnly(others)

  if (it.kind === 'bed') {
    const room = roomAt(x, z)
    if (!room) return bad('蚊帳要罩在客房的床上')
    const b = GUEST_ROOMS[room].bed
    if (placed.some((d) => d.item === itemId && d.room === room)) return bad('這張床已經有蚊帳了', b.x, b.z, 0)
    return { x: b.x, z: b.z, rot: 0, room, y: 0, ok: true, why: '' }
  }

  if (it.kind === 'wall') {
    const area = indoorRoom(x, z)
    if (!area) return bad('要掛在屋子裡的牆上')
    // 最近的一面牆
    const d = [x - area.x0, area.x1 - x, z - area.z0, area.z1 - z]
    const k = d.indexOf(Math.min(...d))
    const inset = 0.2
    let sx = x
    let sz = z
    let srot = 0
    if (k === 0) [sx, srot] = [area.x0 + inset, Math.PI / 2]
    else if (k === 1) [sx, srot] = [area.x1 - inset, -Math.PI / 2]
    else if (k === 2) [sz, srot] = [area.z0 + inset, 0]
    else [sz, srot] = [area.z1 - inset, Math.PI]
    // 沿著牆別太靠角落
    if (k < 2) sz = Math.max(area.z0 + 0.45, Math.min(area.z1 - 0.45, sz))
    else sx = Math.max(area.x0 + 0.45, Math.min(area.x1 - 0.45, sx))
    const y = WALL_Y[itemId] ?? 1.6
    const room = roomAt(sx, sz)
    if (it.guestRoomOnly && !room) return bad('只能掛在客房裡', sx, sz, srot, y)
    for (const [dx, dz] of DOORS) if (Math.hypot(sx - dx, sz - dz) < 0.85) return bad('會擋到門', sx, sz, srot, y)
    for (const o of placed) {
      const oi = itemById(o.item)
      if (oi?.kind === 'wall' && Math.hypot(o.x - sx, o.z - sz) < 0.7) return bad('這面牆那裡已經掛東西了', sx, sz, srot, y)
    }
    return { x: sx, z: sz, rot: srot, room, y, ok: true, why: '' }
  }

  // 地上的東西（風鈴也是：掛在屋簷下／天花板，佔一個位置但不擋路）
  const room = roomAt(x, z)
  const floor = HOME.floorAt(x, z)
  if (!inArea(HOME_AREA, x, z) || floor < 0.05) return bad('要擺在屋子裡或埕上')
  if (it.guestRoomOnly && !room) return bad('只能擺在客房裡')
  if (it.kind === 'yard') {
    const inYard = inArea({ x0: YARD.x0, z0: YARD.z0 + 0.3, x1: YARD.x1, z1: FENCE.z - 0.5 }, x, z) && floor < FLOOR_Y - 0.1
    if (!inYard) return bad('燈籠串只能擺在埕')
  }
  const rr = Math.max(it.r, 0.15)
  for (const b of HOME.colliders.rects) if (circleHitsRect(x, z, rr, b)) return bad('會撞到牆或家具')
  for (const c of HOME.colliders.circles) if (Math.hypot(c.x - x, c.z - z) < c.r + rr) return bad('會撞到東西')
  for (const [dx, dz] of DOORS) if (Math.hypot(x - dx, z - dz) < 0.9) return bad('會擋到門')
  for (const [sx, sz] of WORK_SPOTS) if (Math.hypot(x - sx, z - sz) < 0.55) return bad('會擋到阿嬤晚上做事的地方')
  for (const o of placed) {
    const oi = itemById(o.item)
    if (!oi || oi.kind === 'wall' || oi.kind === 'bed') continue
    if (Math.hypot(o.x - x, o.z - z) < Math.max(oi.r, 0.15) + rr) return bad('跟別的擺設太近了')
  }
  return { x, z, rot, room, y: 0, ok: true, why: '' }
}

/** 擺好的東西的碰撞圓（World.tsx 把它們加進家裡的碰撞） */
export function decorCirclesOf(decor: DecorPlacement[]): Circle[] {
  const out: Circle[] = []
  for (const d of placedOnly(decor)) {
    const it = itemById(d.item)
    if (it && it.r > 0 && it.kind !== 'wall' && it.kind !== 'bed') out.push({ x: d.x, z: d.z, r: it.r })
  }
  return out
}
