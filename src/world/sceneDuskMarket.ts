import { box, rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import type { GameState } from '../store'
import { DIALOGUES, type Dialogue } from './dialogues'
import { seeded } from './rng'
import { INGREDIENTS, type Ingredient, type MarketIngredient } from './night/items'
import type { BargainParams, BargainResult, Tactic } from '../ui/minigames/bargain.logic'

// 黃昏市場（DESIGN §32.1）：村子南邊過小橋、穿過田埂就到。傍晚才開（17:30 開到 22:00，21:00 以後收攤便宜賣），晚上收攤了。
// 買新食材（豬肉、虱目魚、蛤仔、高麗菜、豆花、紅龜粿）煮新的宵夜；跟攤販殺價（小遊戲）；每天一樣「今日特價」。
// 鬼菜販阿葉嬸（陰陽眼）還守著她的老位置，用功德賣「去年的菜」，還會偷偷教阿嬤怎麼殺價。
// 規則在這裡；畫面在 src/scene/DuskMarket.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。
//
//          z 負（北，鏡頭對面）：入口的牌樓（往北回村子）
//   ┌ 雜貨 ┬ 阿蘭豬肉 ┐ 入口 ┌ 阿忠鮮魚 ┬ 粿嬸 ┐   ← 浪板屋頂的攤子（高的都在北邊）
//   ═══════════════ 走道（水泥地，濕濕的）═══════════════
//        菜阿婆的菜攤（矮）   豆花車   阿葉嬸的空位（放一顆橘子）
//   ～～～～ 水溝、水田（鏡頭這一側，只有矮的） ～～～～
//          z 正（南，鏡頭這一側）

export type StallId = 'zahuo' | 'pork' | 'fish' | 'guo' | 'veg' | 'douhua'
export type VendorId = 'wanbo' | 'alan' | 'azhong' | 'guoshen' | 'caipo' | 'douhuabo'

export const DMARKET = {
  /** 北邊一排有屋頂的攤子：x 範圍、櫃台前緣 z、後牆 z */
  // 屋簷要夠高：鏡頭從斜上方看，站在櫃台後面的攤販才不會被屋簷擋住
  north: { front: -3.2, back: -6.4, roofFront: -2.55, roofY: 2.95, backY: 3.35 },
  stalls: {
    zahuo: { x0: -13.6, x1: -8.6, vendor: 'wanbo', name: '振興商行' },
    pork: { x0: -8.6, x1: -1.9, vendor: 'alan', name: '阿蘭豬肉' },
    fish: { x0: 1.9, x1: 8.6, vendor: 'azhong', name: '阿忠鮮魚' },
    guo: { x0: 8.6, x1: 13.6, vendor: 'guoshen', name: '粿嬸' },
  } as Record<'zahuo' | 'pork' | 'fish' | 'guo', { x0: number; x1: number; vendor: VendorId; name: string }>,
  /** 入口（北邊中間的缺口）：牌樓、出口 */
  gate: { x0: -1.9, x1: 1.9, z: -7.2 },
  /** 南邊一排矮的：菜攤（地上的竹籃、矮木台）、豆花車、阿葉嬸的空位 */
  veg: { x: -7.2, z: 3.1, w: 5.6, d: 1.4 },
  douhua: { x: 2.4, z: 3.1 },
  ghost: { x: 8.6, z: 3.0 },
  /** 走道 */
  aisle: { z0: -3.2, z1: 2.3 },
  /** 今日特價的黑板（入口東邊） */
  board: { x: 2.6, z: -2.55 },
  /** 兩頭：堆起來的菜籃、停著的機車（走到底的地方） */
  ends: { x: 14.2 },
  /** 站著買菜的人（碰撞；會走來走去的在畫面那邊，不擋路） */
  shoppers: [
    { x: -10.4, z: -2.35 },
    { x: 6.6, z: -2.4 },
    { x: -5.6, z: 1.55 },
  ],
}

const M = DMARKET
const N = M.north

// ---------------------------------------------------------------------------
// 價錢：原價、今日特價（七折）、收攤價（21:00 以後八折）
// ---------------------------------------------------------------------------

export type Stock = MarketIngredient | 'ginger' | 'noodle'

/** 每樣東西在哪一攤、原價 */
export const DM_GOODS: Record<Stock, { stall: StallId; price: number }> = {
  pork: { stall: 'pork', price: 90 },
  milkfish: { stall: 'fish', price: 80 },
  clam: { stall: 'fish', price: 60 },
  cabbage: { stall: 'veg', price: 45 },
  douhua: { stall: 'douhua', price: 35 },
  redguo: { stall: 'guo', price: 50 },
  ginger: { stall: 'zahuo', price: 25 },
  noodle: { stall: 'zahuo', price: 55 },
}
const SPECIAL_POOL: MarketIngredient[] = ['pork', 'milkfish', 'clam', 'cabbage', 'douhua', 'redguo']

/** 收攤時間（這之後都八折） */
export const CLOSING = 21
export const SPECIAL_OFF = 0.7
export const CLOSING_OFF = 0.8

/** 今天的特價品（第幾晚固定：重玩同一天一樣） */
export function todaySpecial(night: number): MarketIngredient {
  const r = seeded(night * 7919 + 101)
  r()
  return SPECIAL_POOL[Math.floor(r() * SPECIAL_POOL.length)]
}

/** 現在的價錢（特價、收攤價取便宜的那個） */
export function priceOf(item: Stock, night: number, time: number): { price: number; tag: 'special' | 'closing' | null } {
  const base = DM_GOODS[item].price
  const special = todaySpecial(night) === item ? Math.round(base * SPECIAL_OFF) : Infinity
  const closing = time >= CLOSING ? Math.round(base * CLOSING_OFF) : Infinity
  if (special <= closing && special < Infinity) return { price: special, tag: 'special' }
  if (closing < Infinity) return { price: closing, tag: 'closing' }
  return { price: base, tag: null }
}

/** 市場開著沒（傍晚）；晚上收攤了 */
export const marketOpen = (s: { phase: string }) => s.phase === 'dusk'

/** 可以殺價的攤販：最吃的一招、最討厭的一招（阿葉嬸會告訴阿嬤） */
export const BARGAINERS: { stall: StallId; vendor: VendorId; name: string; item: MarketIngredient; likes: Tactic; hates: Tactic }[] = [
  { stall: 'pork', vendor: 'alan', name: '阿蘭姐', item: 'pork', likes: 'praise', hates: 'compare' },
  { stall: 'fish', vendor: 'azhong', name: '阿忠', item: 'milkfish', likes: 'story', hates: 'leave' },
  { stall: 'veg', vendor: 'caipo', name: '菜阿婆', item: 'cabbage', likes: 'sweet', hates: 'leave' },
]

// ---------------------------------------------------------------------------
// 碰撞與場景
// ---------------------------------------------------------------------------

function dmarketColliders() {
  const rects: Rect[] = [
    // 北邊一排攤子：從後牆到櫃台前緣整塊擋住（入口的缺口留著）
    rect(-15, N.back - 1.2, M.gate.x0, N.front),
    rect(M.gate.x1, N.back - 1.2, 15, N.front),
    // 入口兩邊的牌樓柱子
    box(M.gate.x0 + 0.12, M.gate.z + 0.5, 0.3, 0.3),
    box(M.gate.x1 - 0.12, M.gate.z + 0.5, 0.3, 0.3),
    // 南邊一排：菜攤、豆花車、阿葉嬸的小桌子
    box(M.veg.x, M.veg.z, M.veg.w, M.veg.d),
    box(M.douhua.x, M.douhua.z, 2.0, 1.0),
    box(M.ghost.x, M.ghost.z, 1.1, 0.8),
    // 今日特價的黑板（A 字架）
    box(M.board.x, M.board.z, 0.8, 0.45),
    // 兩頭：菜籃、機車
    box(-M.ends.x, 0.2, 1.2, 3.0),
    box(M.ends.x, -0.4, 1.3, 2.2),
  ]
  const circles: Circle[] = []
  return { rects, circles, bounds: rect(-14.6, M.gate.z - 0.45, 14.6, 4.6) }
}

export const DMARKET_SCENE: SceneDef = {
  id: 'dmarket',
  name: '黃昏市場',
  colliders: dmarketColliders(),
  // 從村子過來：從北邊的牌樓走進來
  spawns: { village: [0, -5.4] },
  exits: [{ area: rect(M.gate.x0 + 0.3, M.gate.z - 0.45, M.gate.x1 - 0.3, M.gate.z + 0.15), to: 'village', spawn: 'market', label: '↑ 村子', sign: [M.gate.x0 - 0.55, N.front + 0.55] }],
  buildings: [
    // 攤子的浪板屋頂：阿嬤在攤子前面時擋到鏡頭就淡掉（只算屋頂那一層，走在走道上不會誤觸）
    ...(Object.entries(M.stalls) as [string, { x0: number; x1: number }][]).map(([id, st]) => ({
      id: `dm_roof_${id}`,
      inside: rect(1e3, 1e3, 1e3 + 0.1, 1e3 + 0.1),
      min: [st.x0, N.roofY - 0.2, N.back] as [number, number, number],
      max: [st.x1, N.backY + 0.8, N.roofFront] as [number, number, number],
    })),
  ],
  rooms: [{ id: 'dmarket', name: '黃昏市場', area: rect(-14.6, N.front, 14.6, 4.6) }],
  floorAt: () => 0.02,
  // 攤販站在櫃台後面（櫃台本身擋著）；傍晚有幾個站著買菜的人
  npcs: (phase: string): Circle[] => (phase === 'dusk' ? M.shoppers.map((p) => ({ ...p, r: 0.3 })) : []),
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** 規則檔不能直接 import store（Node 測試會載入），要改狀態時才動態載入 */
function withStore(fn: (st: typeof import('../store').useStore) => void) {
  void import('../store').then(({ useStore }) => fn(useStore))
}

/** 攤子前面（走道上）站的地方 */
function stallSpot(stall: StallId): { x: number; z: number; icon: { x: number; z: number }; iconY: number } {
  if (stall === 'veg') return { x: M.veg.x, z: M.veg.z - M.veg.d / 2 - 0.55, icon: { x: M.veg.x, z: M.veg.z }, iconY: 1.3 }
  if (stall === 'douhua') return { x: M.douhua.x, z: M.douhua.z - 1.05, icon: { x: M.douhua.x, z: M.douhua.z }, iconY: 1.9 }
  const st = M.stalls[stall]
  const cx = (st.x0 + st.x1) / 2
  return { x: cx, z: N.front + 0.7, icon: { x: cx, z: N.front - 0.4 }, iconY: 1.55 }
}

/** 每一攤的攤販（買東西時講的話） */
const VENDOR_OF: Record<StallId, VendorId> = { zahuo: 'wanbo', pork: 'alan', fish: 'azhong', guo: 'guoshen', veg: 'caipo', douhua: 'douhuabo' }
const STALL_NAME: Record<StallId, string> = { zahuo: '雜貨攤', pork: '豬肉攤', fish: '魚攤', guo: '粿攤', veg: '菜攤', douhua: '豆花車' }

/** 價錢的說明：「$63・今日特價」 */
function priceLabel(item: Stock, s: Pick<GameState, 'meta' | 'time'>) {
  const p = priceOf(item, s.meta.night, s.time)
  return `$${p.price}${p.tag === 'special' ? '・今日特價' : p.tag === 'closing' ? '・收攤價' : ''}`
}

/** 買一樣：扣錢、放進家裡；攤販講一句 */
function buy(s: GameState, item: Stock, price?: number) {
  const vendor = VENDOR_OF[DM_GOODS[item].stall]
  const cost = price ?? priceOf(item, s.meta.night, s.time).price
  if (s.meta.money < cost) {
    s.bark('dm.broke')
    return
  }
  withStore((st) => {
    const x = st.getState()
    if (x.meta.money < cost) return
    st.setState({ meta: { ...x.meta, money: x.meta.money - cost, pantry: { ...x.meta.pantry, [item]: (x.meta.pantry[item as Ingredient] ?? 0) + 1 } } })
    x.bark(pick([`dm.${vendor}.buy.1`, `dm.${vendor}.buy.2`]))
  })
}

/** 一攤賣的每一樣：傍晚一個「買」的熱點 */
function buyHotspots(stall: StallId): Hotspot[] {
  const at = stallSpot(stall)
  const items = (Object.keys(DM_GOODS) as Stock[]).filter((k) => DM_GOODS[k].stall === stall)
  return items.map((item) => ({
    id: `dm_buy_${item}`,
    scene: 'dmarket' as const,
    x: at.x,
    z: at.z,
    r: 1.5,
    icon: at.icon,
    iconY: at.iconY,
    label: (s: GameState) => (marketOpen(s) ? `買${INGREDIENTS[item].name}（${priceLabel(item, s)}）` : null),
    run: (s: GameState) => buy(s, item),
  }))
}

/** 晚上收攤了：每攤一個「收攤了」 */
function closedHotspot(stall: StallId): Hotspot {
  const at = stallSpot(stall)
  return {
    id: `dm_closed_${stall}`,
    scene: 'dmarket',
    x: at.x,
    z: at.z,
    r: 1.5,
    icon: at.icon,
    iconY: at.iconY,
    label: (s) => (marketOpen(s) ? null : `${STALL_NAME[stall]}（收攤了）`),
    run: (s) => s.bark(pick(['dm.closed.1', 'dm.closed.2'])),
  }
}

/** 殺價：一天一次（整個市場），殺到的價錢直接買一份 */
function bargainHotspot(b: (typeof BARGAINERS)[number]): Hotspot {
  const at = stallSpot(b.stall)
  return {
    id: `dm_bargain_${b.vendor}`,
    scene: 'dmarket',
    x: at.x,
    z: at.z,
    r: 1.5,
    icon: at.icon,
    iconY: at.iconY,
    label: (s) => (marketOpen(s) && !s.flags.dm_bargain_today ? `跟${b.name}殺價買${INGREDIENTS[b.item].name}` : null),
    run: (s) => {
      const base = priceOf(b.item, s.meta.night, s.time).price
      if (s.meta.money < Math.ceil(base * 0.6)) {
        s.bark('dm.broke')
        return
      }
      const params: BargainParams = { vendor: b.vendor, name: b.name, item: b.item, itemName: INGREDIENTS[b.item].name, base, likes: b.likes, hates: b.hates }
      s.bark(`dm.${b.vendor}.hi`)
      window.setTimeout(
        () =>
          s.startMinigame('bargain', params, (r) => {
            const res = r as BargainResult | null
            if (!res) return
            withStore((st) => {
              const x = st.getState()
              st.setState({ flags: { ...x.flags, dm_bargain_today: true } })
              if (!res.deal) {
                x.bark(`dm.${b.vendor}.angry`)
                return
              }
              if (x.meta.money < res.price) {
                x.bark('dm.broke')
                return
              }
              st.setState({ meta: { ...x.meta, money: x.meta.money - res.price, pantry: { ...x.meta.pantry, [b.item]: (x.meta.pantry[b.item] ?? 0) + 1 } } })
              x.bark(res.price <= res.base * 0.75 ? 'dm.bargain.great' : 'dm.bargain.ok')
            })
          }),
        700,
      )
    },
  }
}

// ---------- 鬼菜販阿葉嬸（陰陽眼） ----------

/** 阿葉嬸的「去年的菜」：功德換一顆高麗菜，一天一次 */
export const AYE_MERIT = 2

const AYE_DIALOGUES: Record<string, Dialogue> = {
  dm_aye_first: {
    steps: [
      { line: 'dm.aye.first.1' },
      { line: 'dm.aye.first.2' },
      { line: 'dm.aye.first.3' },
      { line: 'dm.aye.first.4' },
      {
        line: 'dm.aye.first.5',
        choices: [
          { line: 'dm.aye.first.c1', goto: 'orange' },
          { line: 'dm.aye.first.c2', goto: 'tips' },
        ],
      },
      { label: 'orange', line: 'dm.aye.first.c1' },
      { line: 'dm.aye.orange.1' },
      { line: 'dm.aye.orange.2', goto: 'tips2' },
      { label: 'tips', line: 'dm.aye.first.c2' },
      { label: 'tips2', line: 'dm.aye.tips.1' },
      { line: 'dm.aye.tips.2' },
      { line: 'dm.aye.tips.3' },
      { line: 'dm.aye.first.end', set: 'dm_aye_met' },
    ],
  },
  dm_aye_tips: { steps: [{ line: 'dm.aye.tips.1' }, { line: 'dm.aye.tips.2' }, { line: 'dm.aye.tips.3' }] },
}
Object.assign(DIALOGUES, AYE_DIALOGUES)

const ayeSpot = { x: M.ghost.x, z: M.ghost.z - 1.0 }

// ---------- 全部 ----------

const STALLS: StallId[] = ['zahuo', 'pork', 'fish', 'guo', 'veg', 'douhua']

export const DMARKET_HOTSPOTS: Hotspot[] = [
  ...STALLS.flatMap((st) => buyHotspots(st)),
  ...BARGAINERS.map(bargainHotspot),
  ...STALLS.map(closedHotspot),
  {
    // 今日特價的黑板
    id: 'dm_board',
    scene: 'dmarket',
    x: M.board.x - 0.2,
    z: M.board.z + 0.75,
    r: 1.2,
    icon: { x: M.board.x, z: M.board.z },
    iconY: 1.6,
    label: (s) => (marketOpen(s) ? `今日特價：${INGREDIENTS[todaySpecial(s.meta.night)].name}` : '市場的黑板'),
    run: (s) => {
      if (!marketOpen(s)) {
        s.bark('dm.board.night')
        return
      }
      s.bark(`dm.board.${todaySpecial(s.meta.night)}`)
      if (s.time >= CLOSING) window.setTimeout(() => s.bark('dm.board.closing'), 2600)
    },
  },
  {
    // 阿葉嬸：第一次聊天（教阿嬤殺價），之後用功德買「去年的菜」
    id: 'dm_aye',
    scene: 'dmarket',
    x: ayeSpot.x,
    z: ayeSpot.z,
    r: 1.4,
    icon: { x: M.ghost.x, z: M.ghost.z },
    iconY: 1.6,
    label: (s) => {
      if (!s.vision) return null
      if (!s.flags.dm_aye_met) return '跟空位上的阿桑說話'
      if (s.flags.dm_aye_today) return '阿葉嬸（今天買過了）'
      return `買「去年的菜」（功德 ${AYE_MERIT}）`
    },
    run: (s) => {
      if (!s.flags.dm_aye_met) {
        s.startDialogue('dm_aye_first')
        return
      }
      if (s.flags.dm_aye_today) {
        s.bark(pick(['dm.aye.again.1', 'dm.aye.again.2']))
        return
      }
      if (s.meta.merit < AYE_MERIT) {
        s.bark('dm.aye.nomerit')
        return
      }
      withStore((st) => {
        const x = st.getState()
        st.setState({
          flags: { ...x.flags, dm_aye_today: true },
          meta: { ...x.meta, merit: x.meta.merit - AYE_MERIT, pantry: { ...x.meta.pantry, cabbage: (x.meta.pantry.cabbage ?? 0) + 1 } },
        })
        x.bark(pick(['dm.aye.sell.1', 'dm.aye.sell.2']))
      })
    },
  },
  {
    // 阿葉嬸再講一次殺價的秘訣
    id: 'dm_aye_tips',
    scene: 'dmarket',
    x: ayeSpot.x,
    z: ayeSpot.z,
    r: 1.4,
    icon: { x: M.ghost.x, z: M.ghost.z },
    iconY: 1.6,
    label: (s) => (s.vision && s.flags.dm_aye_met ? '問阿葉嬸殺價的秘訣' : null),
    run: (s) => s.startDialogue('dm_aye_tips'),
  },
  {
    // 沒開陰陽眼：只看到空位上一顆橘子、一支香
    id: 'dm_orange',
    scene: 'dmarket',
    x: ayeSpot.x,
    z: ayeSpot.z,
    r: 1.4,
    icon: { x: M.ghost.x, z: M.ghost.z },
    iconY: 1.2,
    label: (s) => (s.vision ? null : '空攤位上的橘子'),
    run: (s) => s.bark(s.flags.dm_aye_met ? 'dm.orange.2' : 'dm.orange.1'),
  },
]
