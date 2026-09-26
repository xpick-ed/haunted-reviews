import { create } from 'zustand'
import { box, rect, type Circle, type Rect } from './collision'
import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import { HOME } from './scenes'
import { PAST_SCENE } from './scenePast'
import { RIVER, RIVER_SCENE, riverCenter, riverHalfWidth } from './sceneRiver'
import { DRESSER, FENCE, MAIN, SIDE_DOOR_Z, STOVE, TEA } from '../scene/layout'
import type { CookResult } from '../ui/minigames/types'

// 回到 1958（DESIGN §27.1）：從回憶相簿走進阿嬤的過去，用年輕的阿春玩短關卡。
// 這裡是規則（純邏輯，不 import store／audio）：關卡定義、每關的碰撞與出生點、進度、熱點。
// 畫面在 src/scene/Past.tsx（場景與人）、src/ui/PastHud.tsx（標題卡、目標、老照片濾鏡、結尾）。
//
//   stones   1957 溪邊：洗三件衫 → 踩踏石過溪 → 踩空、籃子漂走 → 少年跳下水撈 → 他的鞋子流走了
//   wedding  1958 嫁過來那天：牛車到門口 → 穿借來的鞋（很痛，走得慢）跟叔公、嬸婆問好 → 灶腳找婆婆（甜湯圓、木屐）→ 梳妝鏡
//   kitchen  1959 第一盤菜脯蛋：在灶腳煮（小遊戲）→ 黑黑的 → 端到八仙桌給阿公 →「明天還要」

export type EpisodeId = 'stones' | 'wedding' | 'kitchen'

export interface EpisodeDef {
  id: EpisodeId
  /** 對應的回憶（src/world/memories.ts） */
  memory: string
  /** 標題卡：「一九五八・嫁過來那天」 */
  yearText: string
  title: string
  place: 'home' | 'river'
  spawn: [number, number]
  /** 每一步的目標（HUD 顯示）；{n} 會換成目前的計數 */
  steps: string[]
  /** 開場時老阿嬤的旁白、結尾卡上的一句話 */
  intro: string
  outro: string
}

export const EPISODES: Record<EpisodeId, EpisodeDef> = {
  stones: {
    id: 'stones',
    memory: 'stones',
    yearText: '一九五七',
    title: '溪邊的踏石',
    place: 'river',
    spawn: [4.6, 4.2],
    steps: ['在洗衣石洗衫（{n}/3）', '踩踏石過溪，到對岸晾衫', '籃子漂走了！', '去看看那個跳下水的少年'],
    intro: 'past.stones.intro',
    outro: '那個憨人，後來我嫁給他了。',
  },
  wedding: {
    id: 'wedding',
    memory: 'wedding',
    yearText: '一九五八',
    title: '嫁過來那天',
    place: 'home',
    spawn: [0.6, 9.5],
    steps: ['下牛車，走進大門', '跟叔公、嬸婆問好（{n}/2）', '去灶腳找婆婆', '去房間，看看那面梳妝鏡'],
    intro: 'past.wed.intro',
    outro: '他在門口講了三次「那就好」。',
  },
  kitchen: {
    id: 'kitchen',
    memory: 'kitchen',
    yearText: '一九五九',
    title: '第一盤菜脯蛋',
    place: 'home',
    spawn: [-7.6, 2.3],
    steps: ['在灶腳煮菜脯蛋', '端去神明廳的八仙桌，給阿公吃'],
    intro: 'past.kit.intro',
    outro: '後來我才知道，他那天肚子痛了一整晚。',
  },
}

/** 回憶 id → 可以走進去的關卡 */
export const EPISODE_OF: Record<string, EpisodeId> = { stones: 'stones', wedding: 'wedding', kitchen: 'kitchen' }

// ---------------------------------------------------------------------------
// 人與東西站的位置
// ---------------------------------------------------------------------------

export const PAST_SPOTS = {
  // 1958 三合院
  shugong: { x: TEA.x + 1.0, z: TEA.z + 0.4, heading: 0.4 },
  shenpo: { x: 2.7, z: MAIN.z1 + 0.75, heading: 0.2 },
  popo: { x: STOVE.x + 1.2, z: STOVE.z + 0.45, heading: -Math.PI / 2 },
  /** 婚禮那天最後，阿公站在房門口 */
  agongDoor: { x: -3.35, z: SIDE_DOOR_Z - 0.2, heading: -Math.PI / 2 },
  mirror: { x: DRESSER.x + 0.8, z: DRESSER.z },
  /** 牛車停在大門外（剛好蓋住機車）、嫁妝箱疊在腳踏車上 */
  oxcart: { x: 3.0, z: 9.3 },
  ox: { x: 5.0, z: 9.65 },
  dowry: { x: 4.4, z: 7.18 },
  // 1959 灶腳
  stove: { x: STOVE.x + 1.05, z: STOVE.z },
  table: { x: 0, z: MAIN.z0 + 1.87 },
  agongTable: { x: -0.95, z: MAIN.z0 + 1.87, heading: Math.PI / 2 },
  // 1957 溪邊
  wash: { x: RIVER.washX, z: riverCenter(RIVER.washX) + riverHalfWidth(RIVER.washX) + 0.35 },
  agongStart: { x: 10.2, z: 5.2 },
}

/** 少年撈到籃子以後爬上岸的地方 */
const OUT_X = 3.4
export const AGONG_OUT = { x: OUT_X, z: riverCenter(OUT_X) + riverHalfWidth(OUT_X) + 0.45 }

// ---------------------------------------------------------------------------
// 進度（HUD 要跟著變的放 zustand；每幀在動的位置放下面的 pastRT）
// ---------------------------------------------------------------------------

export interface PastState {
  episode: EpisodeId | null
  step: number
  /** 洗了幾件衫、問好了幾個人 */
  count: number
  greeted: string[]
  /** 手上拿著什麼 */
  carrying: 'basket' | 'dish' | null
  /** 穿著借來的鞋：走得慢 */
  slow: boolean
  /** 演完了：顯示結尾卡 */
  ending: boolean
  /** 什麼時候進來的（標題卡用，performance.now） */
  startedAt: number
}

const fresh = (episode: EpisodeId | null): PastState => ({
  episode,
  step: 0,
  count: 0,
  greeted: [],
  carrying: episode === 'stones' ? 'basket' : null,
  slow: episode === 'wedding',
  ending: false,
  startedAt: typeof performance !== 'undefined' ? performance.now() : 0,
})

export const usePast = create<PastState>(() => fresh(null))

/** 每幀在動的東西：漂走的籃子、跳下水的少年、流走的鞋子 */
export const pastRT = {
  basket: { x: 0, z: 0, mode: 'none' as 'none' | 'float' | 'caught' },
  agong: { x: PAST_SPOTS.agongStart.x, z: PAST_SPOTS.agongStart.z, heading: -Math.PI / 2, mode: 'hidden' as 'hidden' | 'run' | 'swim' | 'back' | 'wet', t: 0 },
  shoe: { x: 0, z: 0, on: false },
  /** 踩空的那一下（畫面讓阿春嚇一跳） */
  slipAt: 0,
  /** 穿借來的鞋走了多遠（每走一段喊一次痛） */
  walked: 0,
  last: { x: 0, z: 0 },
}

const setStep = (step: number) => usePast.setState({ step })

// ---------------------------------------------------------------------------
// 每一關的碰撞、出生點
// ---------------------------------------------------------------------------

/** 溪水擋住（年輕的阿春不是鬼，不能走進水裡），只留踏石那一條 */
function waterRects(): Rect[] {
  const out: Rect[] = []
  const deck = RIVER.deck
  for (let x = -19; x < 19; x += 1) {
    const xm = x + 0.5
    if (Math.abs(xm - RIVER.stonesX) < 0.75) continue
    const c = riverCenter(xm)
    const hw = riverHalfWidth(xm) - 0.3
    // 釣魚平台伸進水裡：平台上可以走，只擋平台外面那一半
    if (xm > deck.x0 && xm < deck.x1) out.push(rect(x, c - hw, x + 1, Math.min(c + hw, deck.z0)))
    else out.push(rect(x, c - hw, x + 1, c + hw))
  }
  return out
}

/** 設定 PAST_SCENE（碰撞、地板、建築、出生點）並把進度歸零。從相簿進來前、以及畫面掛上時呼叫 */
export function preparePast(ep: EpisodeId) {
  const def = EPISODES[ep]
  if (def.place === 'river') {
    PAST_SCENE.colliders = {
      rects: [...RIVER_SCENE.colliders.rects, ...waterRects()],
      circles: RIVER_SCENE.colliders.circles,
      bounds: RIVER_SCENE.colliders.bounds,
    }
    PAST_SCENE.floorAt = RIVER_SCENE.floorAt
    PAST_SCENE.buildings = []
    PAST_SCENE.rooms = RIVER_SCENE.rooms
  } else {
    const extraRects: Rect[] = []
    const extraCircles: Circle[] = []
    if (ep === 'wedding') {
      // 牛車、水牛；叔公、嬸婆、婆婆站的地方
      extraRects.push(box(PAST_SPOTS.oxcart.x, PAST_SPOTS.oxcart.z, 2.4, 1.4))
      extraCircles.push({ x: PAST_SPOTS.ox.x, z: PAST_SPOTS.ox.z, r: 0.75 })
      for (const k of ['shugong', 'shenpo', 'popo'] as const) extraCircles.push({ x: PAST_SPOTS[k].x, z: PAST_SPOTS[k].z, r: 0.32 })
    } else {
      extraCircles.push({ x: PAST_SPOTS.agongTable.x, z: PAST_SPOTS.agongTable.z, r: 0.32 })
    }
    PAST_SCENE.colliders = {
      rects: [...HOME.colliders.rects, ...extraRects],
      circles: [...HOME.colliders.circles, ...extraCircles],
      bounds: HOME.colliders.bounds,
    }
    PAST_SCENE.floorAt = HOME.floorAt
    PAST_SCENE.buildings = HOME.buildings
    PAST_SCENE.rooms = HOME.rooms
  }
  PAST_SCENE.spawns = { start: def.spawn }
  PAST_SCENE.name = `${def.yearText}・${def.title}`
  usePast.setState(fresh(ep))
  pastRT.basket = { x: 0, z: 0, mode: 'none' }
  pastRT.agong = { x: PAST_SPOTS.agongStart.x, z: PAST_SPOTS.agongStart.z, heading: -Math.PI / 2, mode: 'hidden', t: 0 }
  pastRT.shoe = { x: 0, z: 0, on: false }
  pastRT.slipAt = 0
  pastRT.walked = 0
  pastRT.last = { x: def.spawn[0], z: def.spawn[1] }
}

/** 演完了：顯示結尾卡（PastHud 按「回到現在」或幾秒後自己 exitPast） */
export function finishEpisode() {
  usePast.setState({ ending: true })
}

// ---------------------------------------------------------------------------
// 每幀（src/scene/Past.tsx 呼叫）：位置觸發、漂走的籃子、少年跳水
// 回傳要講的台詞 id（畫面那邊 bark）
// ---------------------------------------------------------------------------

const MID_STONE = { x: RIVER.stonesX, z: riverCenter(RIVER.stonesX) }

export function stepPast(dt: number, px: number, pz: number, now: number): string[] {
  const st = usePast.getState()
  const out: string[] = []
  if (!st.episode || st.ending) return out
  const moved = Math.hypot(px - pastRT.last.x, pz - pastRT.last.z)
  pastRT.last = { x: px, z: pz }

  if (st.episode === 'wedding') {
    // 走進大門
    if (st.step === 0 && pz < FENCE.z - 0.5) {
      setStep(1)
      out.push('past.wed.gate')
    }
    // 借來的鞋：每走一段喊一次痛
    if (st.slow && moved < 0.5) {
      pastRT.walked += moved
      if (pastRT.walked > 6.5) {
        pastRT.walked = 0
        out.push(`past.wed.ouch.${1 + Math.floor(Math.random() * 3)}`)
      }
    }
  }

  if (st.episode === 'stones') {
    // 踩到踏石中間：踩空，籃子掉進水裡
    if (st.step === 1 && Math.abs(px - MID_STONE.x) < 0.7 && Math.abs(pz - MID_STONE.z) < 0.6) {
      usePast.setState({ step: 2, carrying: null })
      pastRT.slipAt = now
      pastRT.basket = { x: MID_STONE.x + 0.35, z: MID_STONE.z, mode: 'float' }
      pastRT.agong = { ...pastRT.agong, mode: 'hidden', t: 1.4 }
      out.push('past.stones.slip')
    }
    const b = pastRT.basket
    const a = pastRT.agong
    if (b.mode === 'float') {
      // 順著溪水往下游漂
      b.x += 0.75 * dt
      b.z = riverCenter(b.x) + Math.sin(b.x * 3) * 0.12
    }
    if (st.step === 2) {
      if (a.mode === 'hidden') {
        a.t -= dt
        if (a.t <= 0) {
          a.mode = 'run'
          out.push('past.stones.shout')
        }
      } else if (a.mode === 'run') {
        // 跑到籃子前面的岸邊
        const tx = b.x + 0.8
        const tz = riverCenter(tx) + riverHalfWidth(tx) + 0.2
        const dx = tx - a.x
        const dz = tz - a.z
        const d = Math.hypot(dx, dz)
        if (d < 0.25) {
          a.mode = 'swim'
          out.push('past.stones.splash')
        } else {
          const step = Math.min(d, 3.4 * dt)
          a.x += (dx / d) * step
          a.z += (dz / d) * step
          a.heading = Math.atan2(dx, dz)
        }
      } else if (a.mode === 'swim') {
        const dx = b.x - a.x
        const dz = b.z - a.z
        const d = Math.hypot(dx, dz)
        if (d < 0.3 && b.mode === 'float') {
          b.mode = 'caught'
          // 鞋子流走了
          pastRT.shoe = { x: a.x + 0.2, z: a.z, on: true }
          out.push('past.stones.shoe')
          a.mode = 'back'
        } else {
          const step = Math.min(d, 1.7 * dt)
          a.x += (dx / d) * step
          a.z += (dz / d) * step
          a.heading = Math.atan2(dx, dz)
        }
      } else if (a.mode === 'back') {
        const dx = AGONG_OUT.x - a.x
        const dz = AGONG_OUT.z - a.z
        const d = Math.hypot(dx, dz)
        if (d < 0.2) {
          a.mode = 'wet'
          a.heading = Math.PI
          setStep(3)
        } else {
          const step = Math.min(d, 1.4 * dt)
          a.x += (dx / d) * step
          a.z += (dz / d) * step
          a.heading = Math.atan2(dx, dz)
        }
      }
    }
    if (b.mode === 'caught') {
      b.x = a.x + Math.sin(a.heading) * 0.35
      b.z = a.z + Math.cos(a.heading) * 0.35
    }
    const sh = pastRT.shoe
    if (sh.on) {
      sh.x += 1.0 * dt
      sh.z = riverCenter(sh.x) + Math.sin(sh.x * 2) * 0.2
      if (sh.x > 17) sh.on = false
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 熱點（scene 'past'）
// ---------------------------------------------------------------------------

/** 目前在玩的關卡（結尾卡出來以後就沒有可以做的事了） */
const ep = (s: GameState) => (usePast.getState().ending ? null : ((s.past?.episode ?? null) as EpisodeId | null))
const cur = () => usePast.getState()

export const PAST_HOTSPOTS: Hotspot[] = [
  // ---------- 1957 溪邊 ----------
  {
    id: 'past_wash',
    scene: 'past',
    x: PAST_SPOTS.wash.x,
    z: PAST_SPOTS.wash.z,
    r: 1.3,
    iconY: 1.0,
    label: (s) => (ep(s) === 'stones' && cur().step === 0 ? `洗衫（${cur().count}/3）` : null),
    run: (s) => {
      const n = cur().count + 1
      usePast.setState({ count: n })
      s.bark(`past.stones.wash.${n}`)
      if (n >= 3) setStep(1)
    },
  },
  {
    id: 'past_agong_river',
    scene: 'past',
    x: AGONG_OUT.x,
    z: AGONG_OUT.z,
    r: 1.5,
    iconY: 2.0,
    label: (s) => (ep(s) === 'stones' && cur().step === 3 ? '跟那個全身濕透的少年說話' : null),
    run: (s) => s.startDialogue('past_stones_agong', finishEpisode),
  },

  // ---------- 1958 嫁過來那天 ----------
  {
    id: 'past_shugong',
    scene: 'past',
    x: PAST_SPOTS.shugong.x,
    z: PAST_SPOTS.shugong.z + 0.5,
    r: 1.4,
    icon: { x: PAST_SPOTS.shugong.x, z: PAST_SPOTS.shugong.z },
    iconY: 2.1,
    label: (s) => (ep(s) === 'wedding' && cur().step === 1 && !cur().greeted.includes('shugong') ? '跟叔公問好' : null),
    run: (s) => s.startDialogue('past_wed_shugong', () => greet('shugong')),
  },
  {
    id: 'past_shenpo',
    scene: 'past',
    x: PAST_SPOTS.shenpo.x,
    z: PAST_SPOTS.shenpo.z + 0.5,
    r: 1.4,
    icon: { x: PAST_SPOTS.shenpo.x, z: PAST_SPOTS.shenpo.z },
    iconY: 2.1,
    label: (s) => (ep(s) === 'wedding' && cur().step === 1 && !cur().greeted.includes('shenpo') ? '跟嬸婆問好' : null),
    run: (s) => s.startDialogue('past_wed_shenpo', () => greet('shenpo')),
  },
  {
    id: 'past_popo',
    scene: 'past',
    x: PAST_SPOTS.popo.x + 0.4,
    z: PAST_SPOTS.popo.z - 0.9,
    r: 1.5,
    icon: { x: PAST_SPOTS.popo.x, z: PAST_SPOTS.popo.z },
    iconY: 2.0,
    label: (s) => (ep(s) === 'wedding' && cur().step === 2 ? '找婆婆' : null),
    run: (s) =>
      s.startDialogue('past_wed_popo', () => {
        // 婆婆給的木屐：腳不痛了
        usePast.setState({ step: 3, slow: false })
      }),
  },
  {
    id: 'past_mirror',
    scene: 'past',
    x: PAST_SPOTS.mirror.x,
    z: PAST_SPOTS.mirror.z,
    r: 1.3,
    icon: { x: DRESSER.x, z: DRESSER.z },
    iconY: 1.8,
    label: (s) => (ep(s) === 'wedding' && cur().step === 3 ? '看看梳妝鏡' : null),
    run: (s) => s.startDialogue('past_wed_mirror', finishEpisode),
  },

  // ---------- 1959 第一盤菜脯蛋 ----------
  {
    id: 'past_stove',
    scene: 'past',
    x: PAST_SPOTS.stove.x,
    z: PAST_SPOTS.stove.z,
    r: 1.2,
    icon: { x: STOVE.x, z: STOVE.z },
    iconY: 1.5,
    label: (s) => (ep(s) === 'kitchen' && cur().step === 0 ? '煮菜脯蛋' : null),
    run: (s) => {
      s.bark('past.kit.cook')
      s.startMinigame('cook', { recipes: ['omelette'] }, (r) => {
        const res = r as CookResult
        if (!res) return
        // 不管煮得怎樣，故事裡都是黑黑的
        usePast.setState({ step: 1, carrying: 'dish' })
        window.setTimeout(() => s.bark(res.quality >= 0.7 ? 'past.kit.burnt.good' : 'past.kit.burnt'), 400)
      })
    },
  },
  {
    id: 'past_agong_table',
    scene: 'past',
    x: PAST_SPOTS.table.x + 0.2,
    z: PAST_SPOTS.table.z + 1.05,
    r: 1.4,
    icon: { x: PAST_SPOTS.agongTable.x, z: PAST_SPOTS.agongTable.z },
    iconY: 2.2,
    label: (s) => (ep(s) === 'kitchen' && cur().step === 1 ? '端給阿公' : null),
    run: (s) => {
      usePast.setState({ carrying: null, step: 2 })
      s.startDialogue('past_kit_agong', finishEpisode)
    },
  },
]

function greet(who: string) {
  const st = cur()
  if (st.greeted.includes(who)) return
  const greeted = [...st.greeted, who]
  usePast.setState({ greeted, count: greeted.length, step: greeted.length >= 2 ? 2 : 1 })
}
