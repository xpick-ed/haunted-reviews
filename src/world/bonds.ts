import type { GameState, useStore } from '../store'
import type { Hotspot } from './hotspots'
import type { SceneId } from './scenes'
import type { Ingredient } from './night/items'
import { DIALOGUES, type Dialogue } from './dialogues'
import { NPC_SPOTS } from './scenes'
import { VILLAGE } from './sceneVillage'
import { MARKET_NPCS } from './sceneMarket'
import { HILL_GHOSTS, hillGate } from './sceneHill'
import { STAGE, stageMode } from './sceneStage'
import { RIVER, riverKids } from './sceneRiver'
import { kidsGate } from './tag'
import { HAN_BED, HAN_SWEEP, KITCHEN_TABLE } from '../scene/layout'

// 好感度＋送禮（DESIGN §27.2）：村民與鬼鄰居的好感度、喜歡的東西、每顆心的故事與回禮。
// 好感度存在 meta.bonds（0–100，每 20 一顆心）。送禮的熱點放在各 NPC 旁邊（講話的熱點另一側）。
//   喜歡 +20、普通 +8、討厭 −5；每個人一天收一次（旗標 gift_<id>_today）
//   2♥、4♥：一段故事（對話）；3♥：回禮；5♥：技能點 +1
// 這個檔案會被 hotspots.ts 載入，不能在最上面 import store／audio（改 store 都經過呼叫的人傳進來的 api，或動態 import）。

export type BondId = 'ajiao' | 'ayi' | 'hongyi' | 'jinyubo' | 'huobo' | 'yuyi' | 'banzhu' | 'dijizhu' | 'guikids' | 'xiaohan'

/** 可以送的東西：食材／雜貨，或燒金紙（花 1 點功德，只有鬼收） */
export type GiftId = Ingredient | 'joss'

export interface BondDef {
  id: BondId
  name: string
  /** 沒有頭像時顯示的字 */
  icon: string
  /** 鬼：可以燒金紙給他 */
  ghost: boolean
  likes: GiftId[]
  dislike: GiftId
  /** 3♥ 的回禮說明（送禮面板上顯示） */
  reward: string
  /** 小翰、班主看不到阿嬤：故事對話裡阿嬤的話標「聽不到」 */
  unseen?: boolean
}

export const BONDS: Record<BondId, BondDef> = {
  ajiao: { id: 'ajiao', name: '阿嬌', icon: '嬌', ghost: false, likes: ['egg', 'radish', 'crab'], dislike: 'toy', reward: '蚊香 ×3、蠟燭 ×1' },
  ayi: { id: 'ayi', name: '阿義', icon: '義', ghost: true, likes: ['fish', 'crab', 'zongzi'], dislike: 'ginger', reward: '功德 +2' },
  hongyi: { id: 'hongyi', name: '紅姨', icon: '紅', ghost: true, likes: ['joss', 'candle', 'zongzi'], dislike: 'crab', reward: '法器熟人價、功德 +1' },
  jinyubo: { id: 'jinyubo', name: '金魚伯', icon: '魚', ghost: true, likes: ['zongzi', 'fish', 'sweetpotato'], dislike: 'coil', reward: '功德 +2' },
  huobo: { id: 'huobo', name: '火伯', icon: '火', ghost: true, likes: ['noodle', 'ginger', 'joss'], dislike: 'toy', reward: '陰氣 +20' },
  yuyi: { id: 'yuyi', name: '玉姨', icon: '玉', ghost: true, likes: ['leaf', 'toy', 'zongzi'], dislike: 'fish', reward: '廟公的壓力 −1' },
  banzhu: { id: 'banzhu', name: '班主', icon: '班', ghost: false, likes: ['zongzi', 'egg', 'ginger'], dislike: 'crab', reward: '紅包 $1,500', unseen: true },
  dijizhu: { id: 'dijizhu', name: '地基主', icon: '地', ghost: true, likes: ['joss', 'egg', 'sweetpotato'], dislike: 'toy', reward: '陰氣 +20' },
  guikids: { id: 'guikids', name: '小孩鬼', icon: '囝', ghost: true, likes: ['toy', 'sweetpotato', 'zongzi'], dislike: 'ginger', reward: '寶貝彈珠（功德 +1、小玩具 ×1）' },
  xiaohan: { id: 'xiaohan', name: '小翰', icon: '翰', ghost: false, likes: ['egg', 'radish', 'sweetpotato'], dislike: 'ginger', reward: '小翰的心 +5', unseen: true },
}

export const BOND_ORDER = Object.keys(BONDS) as BondId[]

/** 送禮的分數 */
export const GIFT_POINTS = { like: 20, neutral: 8, dislike: -5 } as const
export type GiftKind = keyof typeof GIFT_POINTS

export const heartsOf = (points: number) => Math.max(0, Math.min(5, Math.floor(points / 20)))
export const heartsText = (points: number) => '♥'.repeat(heartsOf(points)) + '♡'.repeat(5 - heartsOf(points))

export function giftKind(npc: BondId, gift: GiftId): GiftKind {
  const d = BONDS[npc]
  if (d.likes.includes(gift)) return 'like'
  if (d.dislike === gift) return 'dislike'
  return 'neutral'
}

/** 送過一次就知道他喜不喜歡（旗標 bondknow_<npc>_<gift>） */
export const knowFlag = (npc: BondId, gift: GiftId) => `bondknow_${npc}_${gift}`
export const giftedFlag = (npc: BondId) => `gift_${npc}_today`
/** 第 n 顆心的故事／回禮已經給過了 */
export const heartFlag = (npc: BondId, n: number) => `bond_${npc}_h${n}`

// ---------------------------------------------------------------------------
// 故事對話（2♥、4♥）與托夢給小翰：登記進 DIALOGUES（台詞在 src/data/bonds.lines.json）
// ---------------------------------------------------------------------------

/** 每段故事幾句（bond.<npc>.s<n>.1 …） */
const STORY_LEN: Record<BondId, [number, number]> = {
  ajiao: [5, 6],
  ayi: [5, 7],
  hongyi: [6, 7],
  jinyubo: [5, 7],
  huobo: [5, 6],
  yuyi: [5, 6],
  banzhu: [6, 5],
  dijizhu: [5, 5],
  guikids: [5, 7],
  xiaohan: [5, 6],
}

export const storyId = (npc: BondId, n: 2 | 4) => `bond_${npc}_${n}`

/** 托夢給小翰：五場夢輪流（依第幾晚） */
export const HAN_DREAMS = 5
export const hanDreamId = (night: number) => `bond_handream_${((night - 1) % HAN_DREAMS) + 1}`
const HAN_INTRO_LEN = [2, 2, 2, 2, 1]

const BOND_DIALOGUES: Record<string, Dialogue> = {}
for (const npc of BOND_ORDER) {
  ;([2, 4] as const).forEach((n, i) => {
    const len = STORY_LEN[npc][i]
    BOND_DIALOGUES[storyId(npc, n)] = {
      unseen: BONDS[npc].unseen,
      steps: Array.from({ length: len }, (_, k) => ({ line: `bond.${npc}.s${n}.${k + 1}` })),
    }
  })
}
for (let k = 1; k <= HAN_DREAMS; k++) {
  const p = `bond.han${k}`
  // 夢裡小翰看得到、聽得到阿嬤（不是 unseen）；選「溫柔」或「叮嚀」，結束時依旗標加小翰的心
  BOND_DIALOGUES[`bond_handream_${k}`] = {
    steps: [
      ...Array.from({ length: HAN_INTRO_LEN[k - 1] }, (_, i) => ({ line: `${p}.${i + 1}` })),
      {
        line: `${p}.q`,
        choices: [
          { line: `${p}.a`, goto: 'a' },
          { line: `${p}.b`, goto: 'b' },
        ],
      },
      { label: 'a', line: `${p}.a`, set: 'handream_warm_today' },
      { line: `${p}.a2`, goto: 'end' },
      { label: 'b', line: `${p}.b`, set: 'handream_firm_today' },
      { line: `${p}.b2` },
      { label: 'end', line: `${p}.end` },
    ],
  }
}
Object.assign(DIALOGUES, BOND_DIALOGUES)

// ---------------------------------------------------------------------------
// 送禮面板的開關（GiftPanel.tsx 訂閱；不放進主 store）
// ---------------------------------------------------------------------------

type Listener = () => void
export const giftUI = {
  npc: null as BondId | null,
  listeners: new Set<Listener>(),
  open(npc: BondId) {
    this.npc = npc
    this.listeners.forEach((f) => f())
  },
  close() {
    this.npc = null
    this.listeners.forEach((f) => f())
  },
  subscribe(f: Listener) {
    giftUI.listeners.add(f)
    return () => {
      giftUI.listeners.delete(f)
    }
  },
  get() {
    return giftUI.npc
  },
}

// ---------------------------------------------------------------------------
// 送禮與解鎖（呼叫的人把 useStore 傳進來，這樣這個檔案不用 import store）
// ---------------------------------------------------------------------------

type Api = typeof useStore
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** 送一樣東西。回傳這次是喜歡／普通／討厭（東西不夠、今天送過回傳 null） */
export function giveGift(api: Api, npc: BondId, gift: GiftId): { kind: GiftKind; before: number; after: number } | null {
  const s = api.getState()
  if (s.flags[giftedFlag(npc)]) return null
  const meta = { ...s.meta }
  if (gift === 'joss') {
    if (!BONDS[npc].ghost || meta.merit < 1) return null
    meta.merit -= 1
  } else {
    const have = meta.pantry[gift] ?? 0
    if (have < 1) return null
    meta.pantry = { ...meta.pantry, [gift]: have - 1 }
  }
  const kind = giftKind(npc, gift)
  const before = meta.bonds[npc] ?? 0
  const after = Math.max(0, Math.min(100, before + GIFT_POINTS[kind]))
  meta.bonds = { ...meta.bonds, [npc]: after }
  // 送小翰他喜歡的東西：小翰的心也會暖一點
  if (npc === 'xiaohan' && kind === 'like') meta.heart = Math.min(100, meta.heart + 2)
  const flags = { ...s.flags, [giftedFlag(npc)]: true, [knowFlag(npc, gift)]: true }
  api.setState({ meta, flags })
  const line = kind === 'like' ? pick([`bond.${npc}.like.1`, `bond.${npc}.like.2`]) : `bond.${npc}.${kind}`
  api.getState().bark(line)
  return { kind, before, after }
}

/** 已經到了、但還沒給的心（故事／回禮／技能點） */
export function pendingHearts(s: GameState, npc: BondId) {
  const h = heartsOf(s.meta.bonds[npc] ?? 0)
  const out: number[] = []
  for (let n = 2; n <= h; n++) if (!s.flags[heartFlag(npc, n)]) out.push(n)
  return out
}

/** 依序把還沒給的心給完：2♥／4♥ 放故事對話，3♥ 回禮，5♥ 技能點。done 在全部給完後呼叫 */
export function deliverPending(api: Api, npc: BondId, done?: () => void) {
  const s = api.getState()
  const [n] = pendingHearts(s, npc)
  if (n === undefined) {
    done?.()
    return
  }
  api.setState({ flags: { ...s.flags, [heartFlag(npc, n)]: true } })
  const next = () => window.setTimeout(() => deliverPending(api, npc, done), 400)
  if (n === 2 || n === 4) {
    s.startDialogue(storyId(npc, n), next)
    return
  }
  if (n === 3) {
    void applyReward(api, npc).then(() => {
      api.getState().bark(`bond.${npc}.h3`)
      window.setTimeout(next, 3200)
    })
    return
  }
  // 5♥：技能點 +1
  api.setState((x) => ({ meta: { ...x.meta, skillPts: x.meta.skillPts + 1 } }))
  api.getState().bark(`bond.${npc}.h5`)
  window.setTimeout(() => {
    api.getState().bark('bond.gm.skill')
    api.getState().say(`${BONDS[npc].name}：好感度滿了！技能點 +1`)
    next()
  }, 3600)
}

/** 3♥ 的回禮 */
async function applyReward(api: Api, npc: BondId) {
  const set = (fn: (s: GameState) => Partial<GameState>) => api.setState(fn)
  const bump = (k: Ingredient, n: number) => set((x) => ({ meta: { ...x.meta, pantry: { ...x.meta.pantry, [k]: (x.meta.pantry[k] ?? 0) + n } } }))
  const merit = (n: number) => set((x) => ({ meta: { ...x.meta, merit: x.meta.merit + n } }))
  const yin = async (n: number) => {
    const { yinMax } = await import('./night/director')
    set((x) => ({ yin: Math.min(yinMax(x.meta), x.yin + n) }))
  }
  switch (npc) {
    case 'ajiao':
      bump('coil', 3)
      bump('candle', 1)
      break
    case 'ayi':
    case 'jinyubo':
      merit(2)
      break
    case 'hongyi':
      // 法器熟人價（Relics.tsx 讀旗標 hongyi_discount：每樣便宜 1 點功德）
      set((x) => ({ flags: { ...x.flags, hongyi_discount: true } }))
      merit(1)
      break
    case 'huobo':
    case 'dijizhu':
      await yin(20)
      break
    case 'yuyi':
      set((x) => ({ meta: { ...x.meta, pressure: Math.max(0, x.meta.pressure - 1) } }))
      break
    case 'banzhu':
      set((x) => ({ meta: { ...x.meta, money: x.meta.money + 1500 } }))
      break
    case 'guikids':
      merit(1)
      bump('toy', 1)
      break
    case 'xiaohan':
      set((x) => ({ meta: { ...x.meta, heart: Math.min(100, x.meta.heart + 5) } }))
      break
  }
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

/** 動態載入 store（這個檔案不能在最上面 import store） */
const withStore = (fn: (api: Api) => void) => void import('../store').then(({ useStore }) => fn(useStore))

/**
 * 送禮的熱點：放在 NPC 旁邊（講話熱點的另一側，免得兩個搶同一個位置）。
 * present：這個 NPC 現在在不在／看不看得到（看不到就不顯示）。
 * 其他新場景的 NPC 可以用這個加：BOND_HOTSPOTS.push(bondHotspot(...)) 或在 hotspots.ts 展開。
 */
export function bondHotspot(
  npc: BondId,
  scene: SceneId,
  x: number,
  z: number,
  opt: { r?: number; icon?: { x: number; z: number }; iconY?: number; present?: (s: GameState) => boolean; verb?: string; id?: string } = {},
): Hotspot {
  const d = BONDS[npc]
  return {
    id: opt.id ?? `bond_${npc}_${scene}`,
    scene,
    x,
    z,
    r: opt.r ?? 0.95,
    icon: opt.icon,
    iconY: opt.iconY ?? 1.9,
    label: (s) => {
      if (opt.present && !opt.present(s)) return null
      const pts = s.meta.bonds[npc] ?? 0
      const verb = opt.verb ?? `送禮給${d.name}`
      return s.flags[giftedFlag(npc)] ? `${verb}（${heartsText(pts)}・今天送過了）` : `${verb}（${heartsText(pts)}）`
    },
    run: (s) => {
      if (s.flags[giftedFlag(npc)]) {
        // 今天送過了：如果還有沒看過的故事就先看；不然講一句
        if (pendingHearts(s, npc).length) withStore((api) => deliverPending(api, npc))
        else s.bark(`bond.${npc}.done`)
        return
      }
      giftUI.open(npc)
    },
  }
}

const huobo = HILL_GHOSTS.find((g) => g.id === 'huobo')!
const yuyi = HILL_GHOSTS.find((g) => g.id === 'yuyi')!
const marketOpen = () => true // 鬼夜市的場景本身只在開市時間進得去
const festivalStage = (s: GameState) => stageMode(s.meta.night, s.phase) !== 'bare'

export const BOND_HOTSPOTS: Hotspot[] = [
  bondHotspot('ajiao', 'village', 1.9, -2.55, { icon: { x: VILLAGE.ajiao.x + 0.6, z: VILLAGE.ajiao.z }, iconY: 2.5 }),
  bondHotspot('ayi', 'temple', -3.1, 1.2, { icon: { x: NPC_SPOTS.ayi.x + 0.5, z: NPC_SPOTS.ayi.z }, iconY: 2.4 }),
  bondHotspot('hongyi', 'market', 2.2, -7.2, { icon: { x: MARKET_NPCS.hongyi.x + 0.6, z: MARKET_NPCS.hongyi.z }, iconY: 2.9, present: marketOpen }),
  bondHotspot('jinyubo', 'market', 1.9, 5.2, { icon: { x: MARKET_NPCS.jinyubo.x, z: MARKET_NPCS.jinyubo.z + 0.5 }, iconY: 2.3, present: marketOpen }),
  bondHotspot('huobo', 'hill', huobo.x - 1.3, huobo.z + 0.9, { icon: { x: huobo.x - 0.4, z: huobo.z }, iconY: 2.6, present: (s) => hillGate.ghostsVisible(s) }),
  bondHotspot('yuyi', 'hill', yuyi.x + 1.2, yuyi.z + 1.1, { icon: { x: yuyi.x + 0.4, z: yuyi.z }, iconY: 2.4, present: (s) => hillGate.ghostsVisible(s) }),
  bondHotspot('banzhu', 'temple', -8.3, 5.4, { icon: { x: STAGE.banzhu.x + 0.4, z: STAGE.banzhu.z + 0.4 }, iconY: 2.5, present: festivalStage }),
  // 拜地基主：灶腳的桌子（拜地基主本來就在灶腳，向著後門）
  bondHotspot('dijizhu', 'home', KITCHEN_TABLE.x, KITCHEN_TABLE.z - 0.8, {
    icon: { x: KITCHEN_TABLE.x, z: KITCHEN_TABLE.z },
    iconY: 1.5,
    verb: '拜地基主',
    present: (s) => s.vision,
  }),
  bondHotspot('guikids', 'school', 7.0, -3.0, { r: 1.1, iconY: 1.6, present: () => kidsGate.visible() }),
  bondHotspot('guikids', 'river', RIVER.kids.x - 2.4, RIVER.kids.z + 2.5, {
    icon: { x: RIVER.kids.x - 1.2, z: RIVER.kids.z + 1.2 },
    iconY: 1.5,
    present: (s) => riverKids.visible(s),
  }),
  // 小翰看不到阿嬤：傍晚趁他掃地，把東西偷偷放在他旁邊
  bondHotspot('xiaohan', 'home', HAN_SWEEP.x + 1.9, HAN_SWEEP.z + 0.6, {
    icon: { x: HAN_SWEEP.x + 1.2, z: HAN_SWEEP.z + 0.3 },
    iconY: 1.3,
    verb: '偷偷送東西給小翰',
    present: (s) => s.phase === 'dusk',
  }),
  {
    // 托夢給小翰：深夜，在他床邊（一晚一次，花 10 陰氣）
    id: 'bond_handream',
    scene: 'home',
    x: HAN_BED.x - 1.15,
    z: HAN_BED.z + 0.35,
    r: 1.1,
    icon: { x: HAN_BED.x, z: HAN_BED.z - 0.4 },
    iconY: 1.4,
    label: (s) => (s.phase !== 'night' ? null : s.flags.handream_today ? '托夢給小翰（今晚去過了）' : '托夢給小翰（陰氣 10）'),
    cost: (s) => (s.flags.handream_today ? 0 : 10),
    run: (s) => {
      if (s.flags.handream_today) {
        s.bark('bond.gm.handream.done')
        return
      }
      if (s.yin < 10) {
        s.bark('bond.gm.handream.noyin')
        return
      }
      withStore((api) => {
        api.setState((x) => ({ yin: x.yin - 10, flags: { ...x.flags, handream_today: true } }))
        api.getState().startDialogue(hanDreamId(s.meta.night), () => {
          // 溫柔的話：心 +8；叮嚀：心 +5（好感度另外加）
          const f = api.getState().flags
          const warm = !!f.handream_warm_today
          api.setState((x) => ({
            meta: {
              ...x.meta,
              heart: Math.min(100, x.meta.heart + (warm ? 8 : 5)),
              bonds: { ...x.meta.bonds, xiaohan: Math.min(100, (x.meta.bonds.xiaohan ?? 0) + (warm ? 15 : 12)) },
            },
          }))
          api.getState().say(`小翰的心 +${warm ? 8 : 5}`)
          window.setTimeout(() => deliverPending(api, 'xiaohan'), 1500)
        })
      })
    },
  },
]
