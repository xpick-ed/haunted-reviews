import { resolve, type Colliders } from './collision'

// 廢棄國小的小孩鬼（DESIGN §26.1）：平常在操場上玩；阿嬤可以跟他們玩「鬼抓人」、「躲貓貓」。
// 這個檔案是純邏輯（不碰畫面、store、音效），Node 也能跑：scripts/sim-tag.ts 用機器人玩一遍。
// 畫面在 src/scene/School.tsx（每幀呼叫 stepPlay）；場景座標、熱點在 src/world/sceneSchool.ts。

type XZ = [number, number]

export type KidId = 'guikid1' | 'guikid2' | 'guikid3' | 'guikid4'

/** 小孩鬼：有名字的兩個有配音（cast.json 的 guikid1／guikid2） */
export const KIDS: { id: KidId; name: string; voiced: boolean }[] = [
  { id: 'guikid1', name: '阿弟仔', voiced: true },
  { id: 'guikid2', name: '阿妹仔', voiced: true },
  { id: 'guikid3', name: '阿龍', voiced: false },
  { id: 'guikid4', name: '阿珠', voiced: false },
]

/**
 * 小孩鬼看不看得到。預設看得到；之後陰陽眼做好了，主程式可以換成
 * `kidsGate.visible = () => useStore.getState().vision`。畫面、熱點都會問它。
 */
export const kidsGate: { visible: () => boolean } = { visible: () => true }

export type KidMode = 'idle' | 'flee' | 'tagged' | 'hidden' | 'found'

export interface Kid {
  id: KidId
  name: string
  x: number
  z: number
  heading: number
  speed: number
  mode: KidMode
  /** 平常閒晃的目標點（play spots 的 index） */
  target: number
  /** 在目標點停多久 */
  wait: number
  /** 躲在哪裡（hide spots 的 index） */
  spot: number
  /** 鬼抓人：停下來做鬼臉的時間 */
  taunt: number
  /** 躲貓貓：已經咯咯笑過（提示）了 */
  giggled: boolean
}

export interface HideSpot {
  x: number
  z: number
  name: string
}

export type PlayKind = 'tag' | 'hide'

export interface PlayRT {
  kind: PlayKind | null
  /** 這一局玩了幾秒、限時幾秒 */
  time: number
  limit: number
  kids: Kid[]
  /** 抓到／找到幾個 */
  count: number
  /** 結束了（等畫面播完結束卡片再清掉） */
  over: boolean
  won: boolean
  colliders: Colliders
  hides: HideSpot[]
  plays: XZ[]
  rnd: () => number
  /** 被叫過去（辦公室廣播下課鐘）：平常閒晃的小孩先跑到這裡，t 秒後再回去玩 */
  call: { x: number; z: number; t: number } | null
}

export type PlayEvent =
  | { t: 'start'; kind: PlayKind }
  | { t: 'tagged'; kid: KidId }
  | { t: 'found'; kid: KidId }
  | { t: 'giggle'; kid: KidId }
  | { t: 'taunt'; kid: KidId }
  | { t: 'end'; kind: PlayKind; won: boolean; count: number }

/** 鬼抓人 45 秒、躲貓貓 60 秒 */
export const TAG_TIME = 45
export const HIDE_TIME = 60
/** 碰到算抓到、靠近算找到（公尺） */
export const TAG_R = 0.7
export const FIND_R = 1.15
/** 小孩跑的速度：阿嬤走路 2.5、快飄 4.3 */
const FLEE_FAST = 2.45
const FLEE_SLOW = 1.9
const WANDER = 0.9
/** 被叫過去的時候用跑的 */
const CALLED = 2.3
const KID_R = 0.25

const EMPTY: Colliders = { rects: [], circles: [], bounds: { x0: -20, z0: -14, x1: 20, z1: 12 } }

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function newPlay(seed = 7): PlayRT {
  return {
    kind: null,
    time: 0,
    limit: 0,
    kids: KIDS.map((k, i) => ({ id: k.id, name: k.name, x: -4 + i * 2.5, z: 2, heading: 0, speed: 0, mode: 'idle', target: i, wait: i, spot: -1, taunt: 0, giggled: false })),
    count: 0,
    over: false,
    won: false,
    colliders: EMPTY,
    hides: [],
    plays: [],
    rnd: lcg(seed),
    call: null,
  }
}

/** 把閒晃中的小孩叫到 (x, z) 附近排一排（玩遊戲的時候不理） */
export function callKids(rt: PlayRT, x: number, z: number, secs = 9) {
  if (rt.kind) return
  rt.call = { x, z, t: secs }
}

/** 場景（sceneSchool.ts）告訴這裡碰撞、躲藏點、閒晃點 */
export function configurePlay(rt: PlayRT, colliders: Colliders, hides: HideSpot[], plays: XZ[]) {
  rt.colliders = colliders
  rt.hides = hides
  rt.plays = plays
  rt.kids.forEach((k, i) => {
    const p = plays[i % plays.length]
    if (p) {
      k.x = p[0]
      k.z = p[1]
    }
  })
}

/** 畫面與熱點共用的那一份 */
export const schoolPlay: { rt: PlayRT } = { rt: newPlay() }

export function startTag(rt: PlayRT) {
  rt.kind = 'tag'
  rt.time = 0
  rt.limit = TAG_TIME
  rt.count = 0
  rt.over = false
  rt.won = false
  for (const k of rt.kids) {
    k.mode = 'flee'
    k.taunt = 0
  }
}

export function startHide(rt: PlayRT, rnd: () => number = rt.rnd) {
  rt.kind = 'hide'
  rt.time = 0
  rt.limit = HIDE_TIME
  rt.count = 0
  rt.over = false
  rt.won = false
  // 每個小孩挑一個不重複的躲藏點
  const idx = rt.hides.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  rt.kids.forEach((k, i) => {
    const h = rt.hides[idx[i % idx.length]]
    k.mode = 'hidden'
    k.spot = idx[i % idx.length]
    k.giggled = false
    k.x = h.x
    k.z = h.z
    k.speed = 0
  })
}

/** 結束卡片播完：回到平常閒晃 */
export function clearPlay(rt: PlayRT) {
  rt.kind = null
  rt.over = false
  for (const k of rt.kids) {
    k.mode = 'idle'
    k.wait = 0.5 + rt.rnd() * 2
    k.target = Math.floor(rt.rnd() * Math.max(1, rt.plays.length))
  }
}

/** 還剩幾秒 */
export function playLeft(rt: PlayRT) {
  return Math.max(0, rt.limit - rt.time)
}

function blocked(rt: PlayRT, x: number, z: number) {
  const c = rt.colliders
  const r = KID_R + 0.15
  if (x < c.bounds.x0 + r || x > c.bounds.x1 - r || z < c.bounds.z0 + r || z > c.bounds.z1 - r) return true
  for (const b of c.rects) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true
  for (const o of c.circles) if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true
  return false
}

function moveKid(rt: PlayRT, k: Kid, dirX: number, dirZ: number, speed: number, dt: number) {
  const l = Math.hypot(dirX, dirZ) || 1
  const ox = k.x
  const oz = k.z
  k.x += (dirX / l) * speed * dt
  k.z += (dirZ / l) * speed * dt
  resolve(k, KID_R, rt.colliders)
  const moved = Math.hypot(k.x - ox, k.z - oz)
  k.speed = moved / Math.max(dt, 1e-4)
  if (moved > 1e-4) k.heading = Math.atan2(k.x - ox, k.z - oz)
}

/** 逃跑：試幾個方向，挑一個走得通、又離阿嬤最遠的（別往牆角鑽） */
function fleeDir(rt: PlayRT, k: Kid, gm: { x: number; z: number }): XZ {
  const base = Math.atan2(k.x - gm.x, k.z - gm.z)
  const c = rt.colliders.bounds
  let best: XZ = [Math.sin(base), Math.cos(base)]
  let bestScore = -Infinity
  for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.9, -1.9, 2.6, -2.6, Math.PI]) {
    const a = base + off
    const dx = Math.sin(a)
    const dz = Math.cos(a)
    const ax = k.x + dx * 1.6
    const az = k.z + dz * 1.6
    if (blocked(rt, k.x + dx * 0.6, k.z + dz * 0.6)) continue
    let score = Math.hypot(ax - gm.x, az - gm.z)
    if (blocked(rt, ax, az)) score -= 2
    // 牆角、邊邊扣分：困在角落就被抓了
    const edge = Math.min(ax - c.x0, c.x1 - ax, az - c.z0, c.z1 - az)
    if (edge < 2.5) score -= (2.5 - edge) * 1.2
    score -= Math.abs(off) * 0.15
    if (score > bestScore) {
      bestScore = score
      best = [dx, dz]
    }
  }
  return best
}

/** 每幀：阿嬤的位置（公尺）。回傳這一幀發生的事 */
export function stepPlay(rt: PlayRT, dt: number, gm: { x: number; z: number }): PlayEvent[] {
  const out: PlayEvent[] = []
  if (rt.kind && !rt.over) rt.time += dt
  const call = rt.call && !rt.kind ? rt.call : null
  if (call) {
    call.t -= dt
    if (call.t <= 0) rt.call = null
  }
  rt.kids.forEach((k, i) => {
    const d = Math.hypot(k.x - gm.x, k.z - gm.z)
    switch (k.mode) {
      case 'idle': {
        // 被叫過去：在叫的地方排成一排（一人隔 0.7 公尺）
        const p: XZ | undefined = call ? [call.x + (i - 1.5) * 0.7, call.z] : rt.plays[k.target]
        if (!p) break
        const dx = p[0] - k.x
        const dz = p[1] - k.z
        if (Math.hypot(dx, dz) < 0.3) {
          k.speed = 0
          k.wait -= dt
          // 阿嬤靠近：轉頭看她
          if (d < 3) k.heading = Math.atan2(gm.x - k.x, gm.z - k.z)
          if (k.wait <= 0 && !call) {
            k.target = Math.floor(rt.rnd() * rt.plays.length)
            k.wait = 1.5 + rt.rnd() * 4
          }
        } else moveKid(rt, k, dx, dz, call ? CALLED : WANDER + (k.id === 'guikid1' ? 0.4 : 0), dt)
        break
      }
      case 'flee': {
        if (d < TAG_R && !rt.over) {
          k.mode = 'tagged'
          k.speed = 0
          k.heading = Math.atan2(gm.x - k.x, gm.z - k.z)
          rt.count++
          out.push({ t: 'tagged', kid: k.id })
          break
        }
        if (k.taunt > 0) {
          // 停下來做鬼臉（抓他的好機會）
          k.taunt -= dt
          k.speed = 0
          k.heading = Math.atan2(gm.x - k.x, gm.z - k.z)
          break
        }
        if (d > 6) {
          // 離很遠：慢慢晃，偶爾停下來挑釁
          if (rt.rnd() < dt * 0.35) {
            k.taunt = 0.9
            out.push({ t: 'taunt', kid: k.id })
            break
          }
          const [dx, dz] = fleeDir(rt, k, gm)
          moveKid(rt, k, dx, dz, FLEE_SLOW * 0.6, dt)
        } else {
          const [dx, dz] = fleeDir(rt, k, gm)
          moveKid(rt, k, dx, dz, d < 2.6 ? FLEE_FAST : FLEE_SLOW, dt)
        }
        break
      }
      case 'hidden': {
        k.speed = 0
        if (!rt.over && d < FIND_R) {
          k.mode = 'found'
          k.heading = Math.atan2(gm.x - k.x, gm.z - k.z)
          rt.count++
          out.push({ t: 'found', kid: k.id })
        } else if (!k.giggled && d < 3.2) {
          // 阿嬤很近了：忍不住笑出來（提示）
          k.giggled = true
          out.push({ t: 'giggle', kid: k.id })
        }
        break
      }
      case 'tagged':
      case 'found':
        k.speed = 0
        if (d < 3) k.heading = Math.atan2(gm.x - k.x, gm.z - k.z)
        break
    }
  })
  if (rt.kind && !rt.over) {
    const all = rt.count >= rt.kids.length
    if (all || rt.time >= rt.limit) {
      rt.over = true
      rt.won = all
      out.push({ t: 'end', kind: rt.kind, won: all, count: rt.count })
    }
  }
  return out
}
