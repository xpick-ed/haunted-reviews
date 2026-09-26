import type { GuestType, NeedKind } from './types'

// 食材、食譜、柑仔店的商品、鬼夜市的法器（DESIGN §25.3）。數值都在這裡調。

// ---------------------------------------------------------------------------
// 食材（meta.pantry 裡的數量）
// ---------------------------------------------------------------------------

export type Ingredient = 'egg' | 'leaf' | 'sweetpotato' | 'radish' | 'noodle' | 'ginger' | 'coil' | 'candle' | 'fish' | 'zongzi' | 'toy' | 'crab' | GoodId

/** 店裡的好東西（DESIGN §31.1）：傍晚在老街、村子的店拿到，半夜放到客人床頭 */
export type GoodId = 'herbtea' | 'ramune' | 'quilt' | 'photo' | 'floral' | 'banquet'

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
  herbtea: { name: '安神茶', icon: '🍵', desc: '和春中藥行的安神茶包：睡不著的人喝了就睡' },
  ramune: { name: '彈珠汽水', icon: '🧃', desc: '冰果室的彈珠汽水：熱、口渴一次解決' },
  quilt: { name: '厚棉被', icon: '🛏️', desc: '布莊的裁縫車縫的：整晚不會冷' },
  photo: { name: '老照片', icon: '🖼️', desc: '照相館洗的村子老照片：想家的人看了安心' },
  floral: { name: '花露水', icon: '🌸', desc: '理髮廳的花露水：蚊子不來、膽小的人聞了安心' },
  banquet: { name: '辦桌菜尾', icon: '🍲', desc: '阿財伯給的辦桌菜尾：半夜肚子餓的大菜（放不過夜）' },
}

// ---------------------------------------------------------------------------
// 店裡的好東西（DESIGN §31.1）：傍晚拿到、半夜從灶腳的菜櫥拿出來，放到客人床頭。
// 放下去當場解決 fixes 裡的需求，而且整晚那間房不會再出現 blocks 裡的需求；喜歡的客人（likes）舒適再加。
// ---------------------------------------------------------------------------

export interface GoodDef {
  id: GoodId
  /** 放下去的動作名稱 */
  verb: string
  /** 當場解決的需求 */
  fixes: NeedKind[]
  /** 放在房間裡，整晚不會再出現的需求 */
  blocks: NeedKind[]
  /** 解決需求時給的舒適 */
  comfort: number
  /** 特別喜歡的客人類型：舒適再加 likeBonus */
  likes: GuestType[]
  likeBonus: number
  /** 放下去的時候，房裡每個人的驚嚇減多少（老照片、花露水） */
  calm?: number
  /** 去哪裡拿（HUD 提示） */
  where: string
  /** 喜歡的客人天亮評論會多寫一句 */
  note: string
}

export const GOODS: Record<GoodId, GoodDef> = {
  herbtea: {
    id: 'herbtea',
    verb: '泡一杯安神茶放床頭',
    fixes: ['insomnia'],
    blocks: ['insomnia'],
    comfort: 16,
    likes: ['caregiver', 'lonely', 'business'],
    likeBonus: 10,
    where: '老街中藥行（抓藥、或放錢拿一包）',
    note: '床頭有一杯安神茶，喝完就睡著了，好久沒睡這麼沉。',
  },
  ramune: {
    id: 'ramune',
    verb: '放一瓶彈珠汽水',
    fixes: ['hot', 'thirsty'],
    blocks: ['thirsty'],
    comfort: 12,
    likes: ['child', 'backpacker', 'thrill'],
    likeBonus: 8,
    where: '老街冰果室的冰箱',
    note: '半夜床頭出現一瓶冰涼的彈珠汽水！？小時候的味道。',
  },
  quilt: {
    id: 'quilt',
    verb: '鋪上厚棉被',
    fixes: ['cold'],
    blocks: ['cold'],
    comfort: 16,
    likes: ['elder', 'parent', 'timid'],
    likeBonus: 8,
    where: '老街布莊的裁縫車',
    note: '被子好厚好暖，像小時候阿嬤家的棉被。',
  },
  photo: {
    id: 'photo',
    verb: '擺一張村子的老照片',
    fixes: [],
    blocks: [],
    comfort: 10,
    likes: ['elder', 'lonely', 'wanderer', 'caregiver'],
    likeBonus: 14,
    calm: 18,
    where: '老街照相館（拍完照老闆會給）',
    note: '床頭擺了一張村子的老照片，看著看著就想起小時候。',
  },
  floral: {
    id: 'floral',
    verb: '灑一點花露水',
    fixes: ['mosquito'],
    blocks: ['mosquito'],
    comfort: 12,
    likes: ['timid', 'parent', 'couple'],
    likeBonus: 8,
    calm: 12,
    where: '老街理髮廳',
    note: '房間有淡淡的花露水味，蚊子都不見了。',
  },
  banquet: {
    id: 'banquet',
    verb: '端上辦桌菜尾',
    fixes: ['hungry'],
    blocks: ['hungry'],
    comfort: 38,
    likes: ['backpacker', 'business', 'elder'],
    likeBonus: 8,
    where: '村子阿財伯家（陪他看八點檔）',
    note: '半夜床頭有辦桌的菜尾！這是什麼神仙民宿。',
  },
}

export const GOOD_IDS = Object.keys(GOODS) as GoodId[]

/** 菜櫥裡每樣最多放幾個（囤太多就沒得選了） */
export const GOOD_MAX = 3
/** 放不過夜的（天亮就壞了） */
export const GOOD_PERISHABLE: GoodId[] = ['banquet']
export const isGood = (id: string): id is GoodId => id in GOODS

/** 這位客人（類型）特別喜歡哪些好東西 */
export const goodsLovedBy = (type: GuestType) => GOOD_IDS.filter((g) => GOODS[g].likes.includes(type))

/** 哪些好東西解決得了這個需求 */
export const goodsFor = (need: NeedKind) => GOOD_IDS.filter((g) => GOODS[g].fixes.includes(need))

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
