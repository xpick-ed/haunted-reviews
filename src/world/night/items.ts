import type { GuestType } from './types'

// 食材、食譜、柑仔店的商品、鬼夜市的法器（DESIGN §25.3）。數值都在這裡調。

// ---------------------------------------------------------------------------
// 食材（meta.pantry 裡的數量）
// ---------------------------------------------------------------------------

export type Ingredient = 'egg' | 'leaf' | 'sweetpotato' | 'radish' | 'noodle' | 'ginger' | 'coil' | 'candle' | 'fish' | 'zongzi' | 'toy' | 'crab'

export const INGREDIENTS: Record<Ingredient, { name: string; icon: string; desc: string }> = {
  egg: { name: '雞蛋', icon: '🥚', desc: '後院雞舍撿的' },
  leaf: { name: '地瓜葉', icon: '🥬', desc: '後院菜園採的' },
  sweetpotato: { name: '地瓜', icon: '🍠', desc: '後院菜園挖的' },
  radish: { name: '菜脯', icon: '🟤', desc: '後院竹篩上曬的' },
  noodle: { name: '麵線', icon: '🍜', desc: '柑仔店買的' },
  ginger: { name: '薑', icon: '🫚', desc: '柑仔店買的' },
  coil: { name: '蚊香', icon: '🌀', desc: '點蚊香要用' },
  candle: { name: '蠟燭', icon: '🕯️', desc: '停電時小夜燈改點蠟燭' },
  fish: { name: '溪哥', icon: '🐟', desc: '溪邊釣的' },
  zongzi: { name: '粽子', icon: '🍙', desc: '節日包的' },
  toy: { name: '小玩具', icon: '🧸', desc: '柑仔店夾娃娃機夾到的，可以送小宇' },
  crab: { name: '螃蟹', icon: '🦀', desc: '海邊潮間帶抓的' },
}

/** 新遊戲一開始家裡有的東西 */
export const START_PANTRY: Partial<Record<Ingredient, number>> = { egg: 2, radish: 2, coil: 3, candle: 1 }

// ---------------------------------------------------------------------------
// 宵夜食譜（在灶腳煮：選食譜 → 小遊戲 → 端過去）
// ---------------------------------------------------------------------------

export type RecipeId = 'porridge' | 'omelette' | 'leaves' | 'sweetporridge' | 'misua' | 'gingersoup' | 'fishsoup' | 'zongzi' | 'crabporridge'

export interface Recipe {
  id: RecipeId
  name: string
  icon: string
  needs: Partial<Record<Ingredient, number>>
  /** 端到床頭時給的舒適（再乘上小遊戲的品質 0.6–1.2） */
  comfort: number
  /** 特別喜歡的客人類型：舒適再 +15 */
  likes: GuestType[]
  /** 薑湯：順便解決「好冷」 */
  alsoCold?: boolean
}

export const RECIPES: Recipe[] = [
  { id: 'omelette', name: '菜脯蛋', icon: '🍳', needs: { egg: 1, radish: 1 }, comfort: 30, likes: ['elder', 'backpacker'] },
  { id: 'misua', name: '麵線', icon: '🍜', needs: { noodle: 1, egg: 1 }, comfort: 30, likes: ['backpacker', 'business'] },
  { id: 'sweetporridge', name: '地瓜粥', icon: '🍠', needs: { sweetpotato: 1 }, comfort: 25, likes: ['child', 'parent', 'timid'] },
  { id: 'leaves', name: '炒地瓜葉', icon: '🥬', needs: { leaf: 1 }, comfort: 20, likes: ['elder'] },
  { id: 'gingersoup', name: '薑湯', icon: '🍵', needs: { ginger: 1 }, comfort: 15, likes: ['timid', 'business'], alsoCold: true },
  { id: 'fishsoup', name: '溪哥湯', icon: '🐟', needs: { fish: 1, ginger: 1 }, comfort: 32, likes: ['elder', 'business', 'parent'], alsoCold: true },
  { id: 'crabporridge', name: '螃蟹粥', icon: '🦀', needs: { crab: 1 }, comfort: 34, likes: ['business', 'thrill', 'backpacker'] },
  { id: 'zongzi', name: '粽子', icon: '🍙', needs: { zongzi: 1 }, comfort: 34, likes: ['backpacker', 'elder', 'child', 'thrill'] },
  // 什麼都沒有：白粥
  { id: 'porridge', name: '白粥', icon: '🍚', needs: {}, comfort: 12, likes: [] },
]

export function canCook(r: Recipe, pantry: Partial<Record<Ingredient, number>>) {
  return Object.entries(r.needs).every(([k, n]) => (pantry[k as Ingredient] ?? 0) >= (n ?? 0))
}

// ---------------------------------------------------------------------------
// 柑仔店（村路）：用民宿的錢買
// ---------------------------------------------------------------------------

export const SHOP_GOODS: { id: Ingredient; price: number }[] = [
  { id: 'noodle', price: 60 },
  { id: 'ginger', price: 30 },
  { id: 'coil', price: 50 },
  { id: 'candle', price: 40 },
]

// ---------------------------------------------------------------------------
// 法器（鬼夜市紅姨的攤子）：用功德買，永久有效
// ---------------------------------------------------------------------------

export type RelicId = 'hat' | 'incense' | 'bell' | 'charm' | 'lantern' | 'gourd'

export const RELICS: { id: RelicId; name: string; icon: string; desc: string; merit: number }[] = [
  { id: 'bell', name: '鎮狗鈴', icon: '🔔', desc: '狗不會半夜亂叫', merit: 3 },
  { id: 'charm', name: '驅蚊符', icon: '📜', desc: '「有蚊子」的需求少一半', merit: 4 },
  { id: 'incense', name: '安眠香', icon: '🪔', desc: '客人早 20 分鐘睡，睡得比較沉', merit: 5 },
  { id: 'hat', name: '隱身斗笠', icon: '👒', desc: '走路時被發現的速度 ×0.8', merit: 6 },
  { id: 'gourd', name: '聚陰葫蘆', icon: '🏺', desc: '陰氣上限 +20', merit: 7 },
  { id: 'lantern', name: '引魂燈', icon: '🏮', desc: '不用靠近就看得到客人需要什麼', merit: 8 },
]

// ---------------------------------------------------------------------------
// 擲筊（土地公廟，一天三次）：聖筊 → 今晚的運勢
// ---------------------------------------------------------------------------

export type Fortune = 'yin' | 'calm' | 'insight' | 'luck'

export const FORTUNES: Record<Fortune, { name: string; desc: string }> = {
  yin: { name: '陰氣充足', desc: '今晚陰氣 +30' },
  calm: { name: '一夜好眠', desc: '今晚客人睡得比較沉' },
  insight: { name: '明察秋毫', desc: '今晚遠遠就看得到客人的需要' },
  luck: { name: '財神到', desc: '今晚的小費加倍' },
}
