import type { GuestId, GuestType, NeedKind } from './types'

// 客人資料（DESIGN §5）。數值都在這裡調。
// 時間用「小時」：22 = 晚上十點、24 = 午夜、26 = 凌晨兩點、30 = 早上六點。

export interface NeedPlan {
  kind: NeedKind
  /** 大概幾點出現（實際會 ±0.3 小時） */
  at: number
  /** 出現的機率 */
  chance: number
}

export interface GuestDef {
  id: GuestId
  name: string
  type: GuestType
  /** 入住卡片上的類型名稱 */
  label: string
  /** 住一晚付多少 */
  pay: number
  /** 舒適要到多少才滿意 */
  comfortNeed: number
  /** 驚嚇超過這個開始扣分 */
  fearMax: number
  /** YouTuber：驚嚇至少要到這個才滿意 */
  fearMin?: number
  /** 看得到阿嬤（小孩、老朋友） */
  seesGhost?: boolean
  /** 幾點睡 */
  bedtime: number
  /** 淺眠程度 0..1：越高越容易被聲音吵醒 */
  lightSleeper: number
  /** 起夜（上廁所）的時間 */
  trips: number[]
  needs: NeedPlan[]
  /** 入住時的第一印象（觀察線索） */
  clues: string[]
  /** YouTuber：會在屋子裡巡著拍 */
  patrol?: boolean
  /** 背包客：半夜去灶腳找吃的 */
  snackRun?: number
  /** 被看到時驚嚇增加多少 */
  shock: number
}

export const GUESTS: Record<GuestId, GuestDef> = {
  xiaomei: {
    id: 'xiaomei',
    name: '小美',
    type: 'timid',
    label: '一般旅客',
    pay: 2400,
    comfortNeed: 60,
    fearMax: 10,
    bedtime: 24,
    lightSleeper: 0.5,
    trips: [26.2],
    needs: [
      { kind: 'thirsty', at: 23.0, chance: 0.7 },
      { kind: 'mosquito', at: 23.5, chance: 0.5 },
      { kind: 'dark', at: 24.0, chance: 0.6 },
      { kind: 'cold', at: 25.3, chance: 0.9 },
    ],
    clues: ['一個人拖著大行李箱', '一直拍房間的照片', '問老闆「這裡有沒有什麼傳說？」'],
    shock: 25,
  },
  akai: {
    id: 'akai',
    name: '阿凱',
    type: 'thrill',
    label: '靈異 YouTuber',
    pay: 1500,
    comfortNeed: 35,
    fearMax: 999,
    fearMin: 35,
    bedtime: 26.6,
    lightSleeper: 0.2,
    trips: [],
    needs: [
      { kind: 'scare', at: 22.3, chance: 1 },
      { kind: 'thirsty', at: 25.0, chance: 0.5 },
    ],
    clues: ['帶了腳架和兩台攝影機', '一直對著鏡頭自言自語', '一進門就問「最兇的是哪一間？」'],
    patrol: true,
    shock: 18,
  },
  zhang: {
    id: 'zhang',
    name: '張經理',
    type: 'business',
    label: '商務客',
    pay: 2000,
    comfortNeed: 62,
    fearMax: 8,
    bedtime: 23.4,
    lightSleeper: 0.9,
    trips: [27.0],
    needs: [
      { kind: 'thirsty', at: 22.6, chance: 0.8 },
      { kind: 'insomnia', at: 23.4, chance: 0.7 },
      { kind: 'cold', at: 26.0, chance: 0.6 },
    ],
    clues: ['西裝、公事包，講電話講不停', '問「這裡晚上很安靜吧？」', '明天一早要開會'],
    shock: 20,
  },
  ahao: {
    id: 'ahao',
    name: '阿豪',
    type: 'backpacker',
    label: '背包客',
    pay: 900,
    comfortNeed: 40,
    fearMax: 30,
    bedtime: 25.4,
    lightSleeper: 0.15,
    trips: [],
    needs: [
      { kind: 'mosquito', at: 23.0, chance: 0.7 },
      { kind: 'hungry', at: 24.0, chance: 1 },
      { kind: 'cold', at: 26.6, chance: 0.4 },
    ],
    clues: ['超大登山背包', '一身汗，問有沒有吃的', '說自己「什麼都不怕」'],
    snackRun: 24.4,
    shock: 12,
  },
  xiaoyu: {
    id: 'xiaoyu',
    name: '小宇',
    type: 'child',
    label: '小孩（看得到阿嬤）',
    pay: 0,
    comfortNeed: 45,
    fearMax: 60,
    seesGhost: true,
    bedtime: 23.0,
    lightSleeper: 0.3,
    trips: [],
    needs: [
      { kind: 'play', at: 22.2, chance: 1 },
      { kind: 'cold', at: 25.0, chance: 0.6 },
    ],
    clues: ['穿恐龍 T 恤', '一直盯著房間角落看', '對著空氣說「阿嬤好」'],
    shock: 0,
  },
  linmom: {
    id: 'linmom',
    name: '林太太',
    type: 'parent',
    label: '帶小孩的媽媽',
    pay: 3000,
    comfortNeed: 60,
    fearMax: 12,
    bedtime: 23.6,
    lightSleeper: 0.6,
    trips: [22.6, 26.0],
    needs: [
      { kind: 'mosquito', at: 22.9, chance: 0.8 },
      { kind: 'thirsty', at: 24.2, chance: 0.5 },
      { kind: 'cold', at: 26.2, chance: 0.6 },
    ],
    clues: ['帶著一個小男孩', '一直幫小孩擦防蚊液', '睡前檢查了兩次門有沒有鎖'],
    shock: 25,
  },
  agui: {
    id: 'agui',
    name: '阿桂',
    type: 'elder',
    label: '老朋友（看得到阿嬤）',
    pay: 1800,
    comfortNeed: 55,
    fearMax: 999,
    seesGhost: true,
    bedtime: 23.0,
    lightSleeper: 0.4,
    trips: [25.5],
    needs: [
      { kind: 'chat', at: 22.2, chance: 1 },
      { kind: 'cold', at: 24.8, chance: 0.8 },
    ],
    clues: ['叫得出阿春的名字', '帶了一盒自己曬的菜脯', '一直看著牆上的老照片'],
    shock: 0,
  },
  atu: {
    id: 'atu',
    name: '阿土伯',
    type: 'elder',
    label: '老朋友（看得到阿嬤）',
    pay: 1800,
    comfortNeed: 55,
    fearMax: 999,
    seesGhost: true,
    bedtime: 22.8,
    lightSleeper: 0.2,
    trips: [24.6, 27.2],
    needs: [
      { kind: 'thirsty', at: 23.0, chance: 0.6 },
      { kind: 'cold', at: 24.4, chance: 0.7 },
    ],
    clues: ['阿桂的老伴，話不多', '走路很慢', '說「阿春的菜脯蛋最好吃」'],
    shock: 0,
  },
}

export const NEED_INFO: Record<NeedKind, { icon: string; label: string }> = {
  cold: { icon: '❄️', label: '好冷' },
  hot: { icon: '🥵', label: '好熱' },
  thirsty: { icon: '💧', label: '口渴' },
  mosquito: { icon: '🦟', label: '有蚊子' },
  dark: { icon: '🌙', label: '怕黑' },
  hungry: { icon: '🍜', label: '肚子餓' },
  insomnia: { icon: '😣', label: '睡不著' },
  scare: { icon: '🎥', label: '想拍到靈異畫面' },
  play: { icon: '🧸', label: '想找阿嬤玩' },
  chat: { icon: '💬', label: '想跟阿春聊天' },
}

/** 這些需求沒解決就睡不著 */
export const BLOCKS_SLEEP: NeedKind[] = ['dark', 'insomnia', 'play', 'chat', 'hungry']
