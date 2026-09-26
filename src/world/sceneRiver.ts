import { box, rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import type { FishingResult, LanternResult } from '../ui/minigames/types'
import { festivalOf } from './night/plan'

// 溪邊＋螢火蟲（DESIGN §26.1）：從村子北邊的小路過來。釣溪哥、中元節放水燈、陰陽眼才看得到的玩水小鬼。
// 規則在這裡；畫面在 src/scene/River.tsx。注意：這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import）。
//
//          z 負（北，竹林這一側）
//   竹林   水車            竹林                 竹林
//   ～～～～ 溪（由西往東流）～～～～～～ 攔沙壩 ≋≋ 下游 ～～
//   釣魚平台   踏腳石   玩水的小鬼   洗衣石     大石頭
//   芒草      土地公石   小路     芒草
//          z 正（南，鏡頭這一側）→ 出口回村子

/** 溪的形狀：中心線、半寬、水面高度（攔沙壩以東低一截） */
export const RIVER = {
  weirX: 8.0,
  /** 上游水面、下游水面 */
  waterUp: -0.14,
  waterDown: -0.62,
  /** 河岸從水邊斜上來的寬度 */
  bank: 1.4,
  /** 釣魚平台（木頭，從南岸伸到水面上） */
  deck: { x0: -8.6, x1: -6.8, z0: -1.5, z1: 1.3, y: 0.3 },
  /** 踏腳石過溪的地方 */
  stonesX: -2.5,
  /** 土地公石（南岸，小路旁） */
  shrine: { x: 2.8, z: 6.2 },
  /** 大石頭（南岸，攔沙壩附近） */
  boulder: { x: 7.0, z: 4.6, r: 0.9 },
  /** 洗衣石（南岸水邊） */
  washX: 4.5,
  /** 水車（北岸，一半泡在水裡） */
  wheel: { x: -14, z: -3.7, r: 1.3 },
  /** 小鬼玩水的地方 */
  kids: { x: 1.6, z: 0.1 },
  /** 竹林（北岸） */
  groves: [
    { x: -9.5, z: -8.4, rx: 3.0, rz: 1.2 },
    { x: 3.5, z: -8.8, rx: 3.6, rz: 1.1 },
    { x: 14.5, z: -7.6, rx: 2.6, rz: 1.1 },
  ],
}

const R = RIVER

export const riverCenter = (x: number) => -1.2 + 1.3 * Math.sin(0.15 * x + 0.5)
export const riverHalfWidth = (x: number) => 2.2 + 0.5 * Math.sin(0.23 * x + 1.1)
export const riverWater = (x: number) => (x < R.weirX ? R.waterUp : R.waterDown)

const smooth = (t: number) => t * t * (3 - 2 * t)

/** 地形高度（草地 0，溪床比水面低） */
export function riverGround(x: number, z: number) {
  const c = riverCenter(x)
  const hw = riverHalfWidth(x)
  const d = Math.abs(z - c)
  const w = riverWater(x)
  if (d < hw) {
    const k = d / hw
    return w - 0.06 - 0.32 * (1 - k * k)
  }
  const t = Math.min(1, (d - hw) / R.bank)
  return w - 0.06 + (0.02 - (w - 0.06)) * smooth(t)
}

/** 北邊（竹林後面）慢慢隆起的山坡，只是背景 */
export const riverRidge = (z: number) => (z < -10 ? Math.pow(-10 - z, 1.3) * 0.18 : 0)

/** 在不在水裡（小鬼玩水、魚群、螢火蟲比較密的地方用） */
export const inRiver = (x: number, z: number) => Math.abs(z - riverCenter(x)) < riverHalfWidth(x)

/** 踏腳石：沿著 stonesX 過溪，每 0.75 公尺一顆 */
export function steppingStones(): [number, number][] {
  const c = riverCenter(R.stonesX)
  const hw = riverHalfWidth(R.stonesX)
  const out: [number, number][] = []
  for (let z = c - hw - 0.15; z <= c + hw + 0.2; z += 0.75) out.push([R.stonesX + Math.sin(z * 2.1) * 0.18, z])
  return out
}

const onDeck = (x: number, z: number) => x > R.deck.x0 && x < R.deck.x1 && z > R.deck.z0 && z < R.deck.z1

function riverFloor(x: number, z: number) {
  if (onDeck(x, z)) return R.deck.y
  // 阿嬤是鬼：在水上也是飄在水面上
  const g = riverGround(x, z)
  return inRiver(x, z) ? Math.max(g, riverWater(x)) : g
}

function riverColliders() {
  const rects: Rect[] = [
    // 土地公石
    box(R.shrine.x, R.shrine.z, 0.9, 0.7),
    // 水車的木架（北岸）
    box(R.wheel.x, R.wheel.z - 1.2, 2.2, 0.5),
  ]
  const circles: Circle[] = [
    { x: R.boulder.x, z: R.boulder.z, r: R.boulder.r },
    // 竹林：一叢一叢
    ...R.groves.flatMap((g) => [-1, 0, 1].map((k) => ({ x: g.x + k * g.rx * 0.6, z: g.z, r: g.rz + 0.2 }))),
  ]
  // 北邊到竹林為止，南邊到出口
  return { rects, circles, bounds: rect(-19, -10, 19, 12) }
}

export const RIVER_SCENE: SceneDef = {
  id: 'river',
  name: '溪邊',
  colliders: riverColliders(),
  spawns: { path: [0, 9] },
  exits: [{ area: rect(-2.5, 11, 2.5, 12), to: 'village', spawn: 'north', label: '↓ 村子', sign: [2.6, 10.2] }],
  buildings: [],
  rooms: [
    { id: 'deck', name: '釣魚平台', area: rect(R.deck.x0, R.deck.z0, R.deck.x1, R.deck.z1) },
    { id: 'weir', name: '攔沙壩', area: rect(R.weirX - 1.2, -6, R.weirX + 1.2, 3) },
  ],
  floorAt: riverFloor,
  npcs: (): Circle[] => [],
}

// ---------------------------------------------------------------------------
// 玩水的小鬼：阿弟仔、阿妹仔。晚上才出來；之後改成陰陽眼才看得到（把 visible 換掉就好）
// ---------------------------------------------------------------------------

export const riverKids: { visible: (s: GameState) => boolean } = {
  // 玩水的小鬼：晚上、而且開陰陽眼才看得到（DESIGN §26.2）
  visible: (s) => s.isNight && s.vision,
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

const addFish = (n: number) =>
  withStore((st) => {
    if (n <= 0) return
    const s = st.getState()
    st.setState({ meta: { ...s.meta, pantry: { ...s.meta.pantry, fish: (s.meta.pantry.fish ?? 0) + n } } })
  })

const addMerit = (n: number) =>
  withStore((st) => {
    if (n <= 0) return
    const s = st.getState()
    st.setState({ meta: { ...s.meta, merit: s.meta.merit + n } })
  })

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** 中元節晚上才能放水燈 */
export const lanternNight = (s: Pick<GameState, 'meta' | 'phase'>) => festivalOf(s.meta.night) === 'zhongyuan' && s.phase === 'night'

const deckEnd = { x: (R.deck.x0 + R.deck.x1) / 2, z: R.deck.z0 + 0.45 }
const washZ = riverCenter(R.washX) + riverHalfWidth(R.washX) - 0.1

export const RIVER_HOTSPOTS: Hotspot[] = [
  {
    id: 'river_fish',
    scene: 'river',
    x: deckEnd.x,
    z: deckEnd.z + 0.3,
    r: 1.5,
    icon: { x: deckEnd.x, z: deckEnd.z - 0.4 },
    iconY: 1.2,
    label: (s) => (s.flags.river_fish_today ? '釣溪哥（今天釣過了）' : '釣溪哥'),
    run: (s) => {
      if (s.flags.river_fish_today) {
        s.bark('river.fish.done')
        return
      }
      setFlag('river_fish_today')
      s.bark('river.fish.start')
      s.startMinigame('fishing', {}, (r) => {
        const fish = (r as FishingResult | null)?.fish ?? 0
        addFish(fish)
        s.bark(fish >= 2 ? 'river.fish.good' : fish === 1 ? 'river.fish.one' : 'river.fish.none')
      })
    },
  },
  {
    // 中元節：在洗衣石那裡放水燈，給找不到路的人照路
    id: 'river_lantern',
    scene: 'river',
    x: R.washX,
    z: washZ + 0.9,
    r: 1.5,
    icon: { x: R.washX, z: washZ },
    iconY: 0.9,
    label: (s) => (!lanternNight(s) ? null : s.flags.river_lantern_today ? '放水燈（放過了）' : '放水燈（中元節）'),
    run: (s) => {
      if (s.flags.river_lantern_today) {
        s.bark('river.lantern.done')
        return
      }
      setFlag('river_lantern_today')
      s.bark('river.lantern.start')
      s.startMinigame('lantern', {}, (r) => {
        const score = (r as LanternResult | null)?.score ?? 0
        addMerit(Math.round(score * 3))
        s.bark(score >= 0.6 ? 'river.lantern.good' : 'river.lantern.ok')
      })
    },
  },
  {
    id: 'river_kids',
    scene: 'river',
    x: R.kids.x,
    z: R.kids.z + 1.6,
    r: 2.0,
    icon: { x: R.kids.x, z: R.kids.z },
    iconY: 1.6,
    label: (s) => (riverKids.visible(s) ? '跟玩水的小朋友說話' : null),
    run: (s) => {
      if (!s.flags.guikids_met) s.startDialogue('guikids_river')
      else s.bark(pick(['guikid1.1', 'guikid1.2', 'guikid1.3', 'guikid2.1', 'guikid2.2', 'guikid2.3']))
    },
  },
  {
    id: 'river_fireflies',
    scene: 'river',
    x: -4.6,
    z: 4.2,
    r: 1.8,
    icon: { x: -5.0, z: 3.4 },
    iconY: 1.1,
    label: (s) => (s.isNight ? '看火金姑（螢火蟲）' : '溪邊的晚風'),
    run: (s) => s.bark(s.isNight ? pick(['river.firefly.1', 'river.firefly.2', 'river.firefly.3']) : 'river.firefly.day'),
  },
  {
    id: 'river_shrine',
    scene: 'river',
    x: R.shrine.x - 0.9,
    z: R.shrine.z + 0.6,
    r: 1.3,
    icon: { x: R.shrine.x, z: R.shrine.z },
    iconY: 1.1,
    label: () => '石頭公（土地公石）',
    run: (s) => s.bark(pick(['river.shrine.1', 'river.shrine.2'])),
  },
  {
    id: 'river_boulder',
    scene: 'river',
    x: R.boulder.x - 1.1,
    z: R.boulder.z + 0.7,
    r: 1.4,
    icon: { x: R.boulder.x, z: R.boulder.z },
    iconY: 1.5,
    label: () => '大石頭',
    run: (s) => s.bark(pick(['river.stone.1', 'river.stone.2'])),
  },
  {
    id: 'river_wheel',
    scene: 'river',
    x: R.wheel.x + 1.6,
    z: R.wheel.z + 2.4,
    r: 1.8,
    icon: { x: R.wheel.x, z: R.wheel.z },
    iconY: 2.6,
    label: () => '老水車',
    run: (s) => s.bark(pick(['river.wheel.1', 'river.wheel.2'])),
  },
  {
    id: 'river_weir',
    scene: 'river',
    x: R.weirX - 0.4,
    z: riverCenter(R.weirX) + riverHalfWidth(R.weirX) + 1.2,
    r: 1.5,
    icon: { x: R.weirX, z: riverCenter(R.weirX) + riverHalfWidth(R.weirX) - 0.4 },
    iconY: 0.9,
    label: () => '攔沙壩',
    run: (s) => s.bark(pick(['river.weir.1', 'river.weir.2'])),
  },
]
