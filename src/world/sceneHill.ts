import { rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import { festivalOf } from './night/plan'

// 山上墓仔埔（DESIGN §26.1）：從土地公廟後面的山路上來。阿嬤和阿公的墳、鬼鄰居的社區、清明節掃墓。
// 規則在這裡；畫面在 src/scene/Hill.tsx。這個檔案會被 Node 測試載入，不能 import store／audio
// （熱點用 run(s) 的 s；要改狀態時在 handler 裡動態 import('../store')）。
//
//          z 負（北，山頂；再過去是往下看的山谷、村子的燈）
//   ─── 上層：阿公、阿嬤的墳（樓梯直上來就是）、相思樹 ─────────
//   ═══ 擋土牆＋中間的石階 ════════════════════════════════
//   ─── 中層：火伯的墳（西）、玉姨的墳（東）、兩座老墳 ─────────
//   ═══ 擋土牆＋中間的石階 ════════════════════════════════
//   ─── 下層：入口、兩座長滿草的老墳、土饅頭 ──────────────
//          z 正（南，入口，鏡頭這一側；往下走回土地公廟）

export const HILL = {
  /** 三層台地的地面高度（下層 0.02） */
  t1: 0.75,
  t2: 1.5,
  /** 擋土牆在哪裡（下層／中層、中層／上層的交界） */
  wall1Z: 3.6,
  wall2Z: -3.2,
  /** 中間的石階：寬度一半、往下層突出多長 */
  stairHalf: 1.05,
  stairLen: 1.0,
  /** 山頂邊緣（再過去往下掉）、東西兩邊 */
  ridgeZ: -11,
  x0: -19,
  x1: 19,
  /** 入口（南邊，往下走回土地公廟） */
  gateZ: 10.8,
  /** 相思樹、樹下的平石頭 */
  acacia: { x: 8.2, z: -8.4 },
  rock: { x: 7.1, z: -6.9 },
  /** 看山谷的地方 */
  lookout: { x: -7.5, z: -10.1 },
}

const H = HILL

/** 台地的高度（不算樓梯） */
export function terraceY(z: number) {
  return z >= H.wall1Z ? 0.02 : z >= H.wall2Z ? H.t1 : H.t2
}

// ---------------------------------------------------------------------------
// 墳：椅子墳（墓碑、墓埕、兩隻墓手圍成馬蹄形、後面的墓龜）
// ---------------------------------------------------------------------------

export type TombStyle = 'overgrown' | 'weathered' | 'tidy' | 'new'

export interface TombDef {
  id: string
  x: number
  z: number
  /** 墳面向的方向（0 = 朝 +z 往南看，跟角色的 heading 一樣） */
  rot: number
  /** 寬度（墓手外緣） */
  w: number
  style: TombStyle
  /** 墓碑上的字：中間一行、左右兩行（直書） */
  text: { center: string; left?: string; right?: string }
  /** 墓碑上的照片（阿嬤） */
  photo?: boolean
}

export const TOMBS: TombDef[] = [
  // 上層：阿公、阿嬤（並排，樓梯上來正對著）
  { id: 'agong', x: -1.9, z: -7.2, rot: 0.08, w: 2.6, style: 'tidy', text: { center: '顯考林公諱添福之墓', left: '民國十九年生', right: '孝男 林國雄 敬立' } },
  { id: 'ama', x: 1.9, z: -7.2, rot: -0.08, w: 2.6, style: 'new', photo: true, text: { center: '顯妣林媽陳氏春之墓', left: '民國二十五年生', right: '民國一一〇年卒　孝孫 林翰' } },
  { id: 't2a', x: -11, z: -6.8, rot: 0.5, w: 2.4, style: 'overgrown', text: { center: '顯考黃公諱金水之墓' } },
  { id: 't2b', x: 12.6, z: -6.0, rot: 0.75, w: 2.4, style: 'weathered', text: { center: '顯妣吳媽李氏秀之墓' } },
  // 中層：火伯（西）、玉姨（東）
  { id: 'huobo', x: -8.5, z: -0.2, rot: 0.45, w: 2.5, style: 'weathered', text: { center: '陸軍上士張火旺之墓', left: '山東省人', right: '民國八年生' } },
  { id: 'yuyi', x: 8.8, z: -0.6, rot: 0.6, w: 2.5, style: 'tidy', text: { center: '顯妣蔡媽林氏玉珠之墓', left: '民國二十二年生' } },
  { id: 't1a', x: -15.2, z: 0.3, rot: 0.35, w: 2.3, style: 'overgrown', text: { center: '顯考陳公諱土之墓' } },
  { id: 't1b', x: 15.4, z: 0.9, rot: 0.8, w: 2.3, style: 'weathered', text: { center: '顯妣王媽謝氏阿招之墓' } },
  // 下層：長滿草的老墳
  { id: 't0a', x: -12.5, z: 7.0, rot: 0.4, w: 2.3, style: 'overgrown', text: { center: '顯考李公諱阿發之墓' } },
  { id: 't0b', x: 12.0, z: 7.6, rot: 0.9, w: 2.3, style: 'overgrown', text: { center: '顯考林公諱石頭之墓' } },
]

/** 下層兩座沒有墓手的老土墳（土饅頭） */
export const MOUNDS: { x: number; z: number; r: number }[] = [
  { x: -6.6, z: 8.6, r: 0.8 },
  { x: 6.8, z: 5.8, r: 0.7 },
]

/** 墳上的一點（local：x 往墳的右手邊、z 往墳前）換成世界座標 */
export function tombPoint(t: TombDef, lx: number, lz: number): [number, number] {
  const c = Math.cos(t.rot)
  const s = Math.sin(t.rot)
  return [t.x + lx * c + lz * s, t.z - lx * s + lz * c]
}

export const tombById = (id: string) => TOMBS.find((t) => t.id === id)!

// ---------------------------------------------------------------------------
// 鬼鄰居（DESIGN §26.1）：之後會改成只有陰陽眼看得到（hillGate.ghostsVisible）
// ---------------------------------------------------------------------------

export interface HillGhost {
  id: string
  /** src/chars/specs.hill.ts 的長相 */
  spec: string
  x: number
  z: number
  heading: number
  pose: 'idle' | 'fan' | 'sit' | 'clasp'
  /** 坐在墓手上（沒有腳，鬼本來就沒有腳） */
  seated?: boolean
}

const huoboTomb = tombById('huobo')
const yuyiTomb = tombById('yuyi')

export const HILL_GHOSTS: HillGhost[] = (() => {
  const [hx, hz] = tombPoint(huoboTomb, -1.35, 0.85)
  const [yx, yz] = tombPoint(yuyiTomb, 1.02, 0.1)
  const [fx, fz] = tombPoint(tombById('t1a'), -0.98, 0.15)
  const [gx, gz] = tombPoint(tombById('t1b'), 1.2, 1.0)
  return [
    { id: 'huobo', spec: 'huobo', x: hx, z: hz, heading: huoboTomb.rot + 0.5, pose: 'clasp' },
    { id: 'yuyi', spec: 'yuyi', x: yx, z: yz, heading: yuyiTomb.rot - 0.4, pose: 'fan', seated: true },
    // 不說話的鬼鄰居：看著山下的老農夫、在墳前站著的老太太
    { id: 'farmer', spec: 'hillfarmer', x: fx, z: fz, heading: -2.4, pose: 'sit', seated: true },
    { id: 'granny', spec: 'hillgranny', x: gx, z: gz, heading: 0.9, pose: 'clasp' },
  ]
})()

/**
 * 鬼鄰居看不看得到。現在一直看得到；之後接上陰陽眼時改成 `(s) => !!s.vision`
 * （畫面與熱點都會讀這個）。
 */
export const hillGate = {
  // 墓仔埔的鬼鄰居：開陰陽眼才看得到（DESIGN §26.2）
  ghostsVisible: (s: { vision?: boolean }) => !!s.vision,
}

// ---------------------------------------------------------------------------
// 碰撞
// ---------------------------------------------------------------------------

function hillColliders() {
  const rects: Rect[] = []
  // 兩道擋土牆（中間留樓梯）：上下層只能走樓梯
  for (const z of [H.wall1Z, H.wall2Z]) {
    rects.push(rect(H.x0 - 1, z - 0.16, -H.stairHalf, z + 0.16))
    rects.push(rect(H.stairHalf, z - 0.16, H.x1 + 1, z + 0.16))
    // 樓梯兩邊的矮扶牆
    for (const s of [-1, 1]) rects.push(rect(s * H.stairHalf - 0.12, z, s * H.stairHalf + 0.12, z + H.stairLen))
  }
  // 入口兩根石柱
  for (const s of [-1, 1]) rects.push(rect(s * 2.3 - 0.25, H.gateZ - 0.25, s * 2.3 + 0.25, H.gateZ + 0.25))
  const circles: Circle[] = [
    // 墳：馬蹄形的墓手和墓龜，用一個圓包住（墓埕可以站）
    ...TOMBS.map((t) => {
      const [x, z] = tombPoint(t, 0, -0.35)
      return { x, z, r: t.w * 0.48 }
    }),
    ...MOUNDS.map((m) => ({ x: m.x, z: m.z, r: m.r + 0.1 })),
    { x: H.acacia.x, z: H.acacia.z, r: 0.35 },
    { x: H.rock.x, z: H.rock.z, r: 0.45 },
    // 西北角的一棵相思樹
    { x: -16.5, z: -8.8, r: 0.35 },
  ]
  return { rects, circles, bounds: rect(H.x0, H.ridgeZ, H.x1, 11.9) }
}

export const HILL_SCENE: SceneDef = {
  id: 'hill',
  name: '山上墓仔埔',
  colliders: hillColliders(),
  spawns: { path: [0, 10] },
  exits: [{ area: rect(-2.5, 11, 2.5, 12), to: 'temple', spawn: 'hill_path', label: '↓ 土地公廟', sign: [2.6, 10.2] }],
  buildings: [],
  rooms: [
    { id: 'hill_top', name: '阿公阿嬤的墳', area: rect(-5, H.ridgeZ, 5, H.wall2Z) },
    { id: 'hill_mid', name: '鬼鄰居', area: rect(H.x0, H.wall2Z, H.x1, H.wall1Z) },
  ],
  floorAt: (x, z) => {
    // 中間的石階：高度沿著樓梯漸變
    if (Math.abs(x) < H.stairHalf) {
      if (z > H.wall1Z && z < H.wall1Z + H.stairLen) return H.t1 + (0.02 - H.t1) * ((z - H.wall1Z) / H.stairLen)
      if (z > H.wall2Z && z < H.wall2Z + H.stairLen) return H.t2 + (H.t1 - H.t2) * ((z - H.wall2Z) / H.stairLen)
    }
    return terraceY(z)
  },
  // 火伯站著（會擋路）；其他鬼坐在墳上，墳本身就擋了
  npcs: (): Circle[] => {
    const g = HILL_GHOSTS.find((x) => x.id === 'huobo')!
    return [{ x: g.x, z: g.z, r: 0.32 }]
  },
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const isNight = (s: { phase: string }) => s.phase === 'night'

/** 動態載入 store 改狀態（這個檔案不能在最上面 import store） */
function patch(fn: (x: { flags: Record<string, boolean>; meta: { merit: number; heart: number } }) => object) {
  void import('../store').then(({ useStore }) => useStore.setState((x) => fn(x) as never))
}
const setFlag = (f: string) => patch((x) => ({ flags: { ...x.flags, [f]: true } }))
const addMerit = (n: number) => patch((x) => ({ meta: { ...x.meta, merit: x.meta.merit + n } }))

/** 清明節那晚的傍晚：小翰在阿嬤的墳前掃墓 */
export const isQingmingDusk = (s: { phase: string; meta: { night: number } }) => s.phase === 'dusk' && festivalOf(s.meta.night) === 'qingming'
/** 清明那一天（傍晚＋深夜）：墳上掛了新的墓紙、有供品 */
export const isQingming = (s: { meta: { night: number } }) => festivalOf(s.meta.night) === 'qingming'

const ama = tombById('ama')
const agong = tombById('agong')
const [amaFrontX, amaFrontZ] = tombPoint(ama, 0, 1.35)
const [agongFrontX, agongFrontZ] = tombPoint(agong, 0, 1.35)
const [bowlX, bowlZ] = tombPoint(huoboTomb, 0, 0.45)
const huobo = HILL_GHOSTS.find((g) => g.id === 'huobo')!
const yuyi = HILL_GHOSTS.find((g) => g.id === 'yuyi')!
const farmer = HILL_GHOSTS.find((g) => g.id === 'farmer')!
const granny = HILL_GHOSTS.find((g) => g.id === 'granny')!

/** 小翰清明節掃墓時站的位置（阿嬤墳前右邊） */
export const HAN_SPOT = (() => {
  const [x, z] = tombPoint(ama, 1.0, 1.25)
  return { x, z }
})()

/** 看過野台戲了嗎（火伯的委託）：戲台那邊設 stage_seen；土地公生（第 4 晚）過了也算 */
const operaSeen = (s: { flags: Record<string, boolean>; meta: { night: number } }) => !!s.flags.stage_seen || s.meta.night > 4

export const HILL_HOTSPOTS: Hotspot[] = [
  // ---------- 阿嬤自己的墳、阿公的墳 ----------
  {
    id: 'hill_ama',
    scene: 'hill',
    x: amaFrontX,
    z: amaFrontZ,
    r: 1.2,
    icon: { x: ama.x, z: ama.z },
    iconY: 1.45,
    label: (s) => (isQingmingDusk(s) && !s.flags.qingming_seen ? null : '自己的墳'),
    run: (s) => {
      if (isQingming(s)) s.bark(pick(['hill.self.qingming.1', 'hill.self.qingming.2']))
      else if (!s.flags.hill_self_seen) {
        s.bark('hill.self.first')
        setFlag('hill_self_seen')
      } else s.bark(pick(['hill.self.1', 'hill.self.2', 'hill.self.3', 'hill.self.4']))
    },
  },
  {
    id: 'hill_agong',
    scene: 'hill',
    x: agongFrontX,
    z: agongFrontZ,
    r: 1.2,
    icon: { x: agong.x, z: agong.z },
    iconY: 1.45,
    label: (s) => (isQingmingDusk(s) && !s.flags.qingming_seen ? null : '阿公的墳'),
    run: (s) => {
      if (!s.flags.hill_agong_first) {
        s.startDialogue('hill_agong_first')
        return
      }
      s.bark(isNight(s) ? pick(['hill.agong.night.1', 'hill.agong.night.2']) : pick(['hill.agong.1', 'hill.agong.2', 'hill.agong.3']))
    },
  },
  // ---------- 清明：小翰來掃墓 ----------
  {
    id: 'hill_han',
    scene: 'hill',
    x: HAN_SPOT.x - 0.4,
    z: HAN_SPOT.z + 0.6,
    r: 1.6,
    icon: { x: HAN_SPOT.x, z: HAN_SPOT.z },
    iconY: 2.0,
    label: (s) => (isQingmingDusk(s) && !s.flags.qingming_seen ? '小翰在掃墓' : null),
    run: (s) => {
      s.startDialogue('hill_qingming', () => {
        // 孫子的心：他覺得阿嬤聽得到
        patch((x) => ({ meta: { ...x.meta, heart: Math.min(100, x.meta.heart + 5) } }))
      })
    },
  },
  // ---------- 火伯（老兵）：香爐 → 野台戲 ----------
  {
    id: 'hill_huobo',
    scene: 'hill',
    x: huobo.x + 0.3,
    z: huobo.z + 0.8,
    r: 1.5,
    icon: { x: huobo.x, z: huobo.z },
    iconY: 2.2,
    label: (s) => (hillGate.ghostsVisible(s) ? '跟火伯說話' : null),
    run: (s) => {
      const f = s.flags
      if (!f.huobo_met) s.startDialogue('huobo_1')
      else if (!f.huobo_bowl) s.bark(pick(['huobo.wait.bowl.1', 'huobo.wait.bowl.2']))
      else if (!f.huobo_ask_opera) s.startDialogue('huobo_2')
      else if (!f.huobo_done && operaSeen(s)) s.startDialogue('huobo_3', () => addMerit(3))
      else if (!f.huobo_done) s.bark(pick(['huobo.wait.opera.1', 'huobo.wait.opera.2']))
      else s.bark(isNight(s) ? pick(['huobo.night.1', 'huobo.night.2']) : pick(['huobo.idle.1', 'huobo.idle.2', 'huobo.idle.3']))
    },
  },
  {
    id: 'hill_huobo_bowl',
    scene: 'hill',
    x: bowlX,
    z: bowlZ + 0.5,
    r: 1.0,
    icon: { x: bowlX, z: bowlZ },
    iconY: 0.9,
    label: (s) => (s.flags.huobo_met && !s.flags.huobo_bowl ? '把火伯的香爐扶正' : null),
    run: (s) => {
      setFlag('huobo_bowl')
      addMerit(1)
      s.bark('hill.gm.bowl')
    },
  },
  // ---------- 玉姨（八卦）：柑仔店的消息換一個秘密 ----------
  {
    id: 'hill_yuyi',
    scene: 'hill',
    x: yuyi.x - 0.4,
    z: yuyi.z + 1.0,
    r: 1.5,
    icon: { x: yuyi.x, z: yuyi.z },
    iconY: 1.9,
    label: (s) => (hillGate.ghostsVisible(s) ? '跟玉姨說話' : null),
    run: (s) => {
      const f = s.flags
      if (!f.yuyi_met) s.startDialogue('yuyi_1')
      else if (!f.yuyi_done && f.ajiao_met) s.startDialogue('yuyi_2', () => addMerit(2))
      else if (!f.yuyi_done) s.bark(pick(['yuyi.wait.1', 'yuyi.wait.2']))
      else s.bark(pick(['yuyi.gossip.1', 'yuyi.gossip.2', 'yuyi.gossip.3', 'yuyi.gossip.4']))
    },
  },
  // ---------- 不說話的鬼鄰居 ----------
  {
    id: 'hill_farmer',
    scene: 'hill',
    x: farmer.x + 0.6,
    z: farmer.z + 1.1,
    r: 1.3,
    icon: { x: farmer.x, z: farmer.z },
    iconY: 1.9,
    label: (s) => (hillGate.ghostsVisible(s) ? '看山下的老農夫' : null),
    run: (s) => s.bark(pick(['hill.farmer.1', 'hill.farmer.2'])),
  },
  {
    id: 'hill_granny',
    scene: 'hill',
    x: granny.x - 0.5,
    z: granny.z + 0.7,
    r: 1.3,
    icon: { x: granny.x, z: granny.z },
    iconY: 2.1,
    label: (s) => (hillGate.ghostsVisible(s) ? '墳前的老太太' : null),
    run: (s) => s.bark(pick(['hill.granny.1', 'hill.granny.2'])),
  },
  // ---------- 相思樹下、看山谷 ----------
  {
    id: 'hill_acacia',
    scene: 'hill',
    x: H.rock.x - 0.2,
    z: H.rock.z + 0.9,
    r: 1.2,
    icon: { x: H.rock.x, z: H.rock.z },
    iconY: 1.0,
    label: () => '相思樹下的石頭',
    run: (s) => s.bark(pick(['hill.acacia.1', 'hill.acacia.2'])),
  },
  {
    id: 'hill_lookout',
    scene: 'hill',
    x: H.lookout.x,
    z: H.lookout.z + 0.6,
    r: 1.6,
    icon: { x: H.lookout.x, z: H.lookout.z - 0.4 },
    iconY: 1.3,
    label: () => '從山上看下去',
    run: (s) => s.bark(isNight(s) ? pick(['hill.view.night.1', 'hill.view.night.2']) : 'hill.view.dusk'),
  },
]

/** 回憶碎片的位置（給 src/world/memories.ts）：阿公墳前的舊照片、相思樹下的石頭 */
export const HILL_MEMORY_SPOTS = {
  wedding: (() => {
    const [x, z] = tombPoint(agong, -0.95, 0.55)
    return { x, z, y: H.t2 }
  })(),
  acacia: { x: H.rock.x, z: H.rock.z, y: H.t2 + 0.3 },
}
