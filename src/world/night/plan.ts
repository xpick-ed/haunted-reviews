import { seeded } from '../rng'
import type { ActionId, GuestId, NightEvent, RoomId } from './types'

// 每晚誰來住、發生什麼事；技能樹；老宅升級（DESIGN §3、§7、§9、§10）。

export interface Party {
  room: RoomId
  members: GuestId[]
}

export interface NightPlan {
  parties: Party[]
  event: NightEvent
  /** 開場時小翰或阿嬤說的話（台詞 id 的來源在 barks.ts） */
  story?: 'room2'
}

/** 一個月四晚 */
export const NIGHTS_PER_MONTH = 4
export const MONTH_NAMES = ['二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月', '正月']
export const MONTHLY_COST = 15000

/** 第一個月是寫好的教學月：每晚介紹一種新玩法 */
const MONTH1: NightPlan[] = [
  { parties: [{ room: 'r1', members: ['xiaomei'] }], event: 'none' },
  { parties: [{ room: 'r1', members: ['akai'] }, { room: 'r2', members: ['zhang'] }], event: 'none', story: 'room2' },
  { parties: [{ room: 'r1', members: ['linmom', 'xiaoyu'] }, { room: 'r2', members: ['ahao'] }], event: 'dog' },
  { parties: [{ room: 'r1', members: ['agui', 'atu'] }, { room: 'r2', members: ['xiaomei'] }], event: 'blackout' },
]

const WARM_POOL: GuestId[][] = [['xiaomei'], ['zhang'], ['linmom', 'xiaoyu'], ['agui', 'atu'], ['zhiming', 'fubo']]
/** 成人內容開著時才會來的客人（DESIGN §29） */
const ADULT_POOL: GuestId[][] = [['ajie', 'xiaohui'], ['mrwang', 'mrswang'], ['zhiwei']]
const SPOOKY_POOL: GuestId[][] = [['akai'], ['ahao']]
const EVENTS: NightEvent[] = ['none', 'none', 'dog', 'mosquitoes', 'coldsnap', 'blackout']

/**
 * 第 night 晚（從 1 開始）的安排。第一個月照劇本；之後依名聲決定客人比例：
 * 溫馨名聲高 → 一般客、家庭、商務客多；靈異名聲高 → YouTuber、背包客多。
 */
export function planNight(night: number, warm: number, spooky: number, pressure: number, opts: { adult?: boolean } = {}): NightPlan {
  if (night <= MONTH1.length) return MONTH1[night - 1]
  const r = seeded(night * 7919)
  const pick = (): GuestId[] => {
    const spookyChance = 0.15 + (spooky / 100) * 0.6 - (warm / 100) * 0.2
    // 成人內容開著：三成的機會來大人的客人
    if (opts.adult && r() < 0.3) return ADULT_POOL[Math.floor(r() * ADULT_POOL.length)]
    const pool = r() < spookyChance ? SPOOKY_POOL : WARM_POOL
    return pool[Math.floor(r() * pool.length)]
  }
  const a = pick()
  let b = pick()
  for (let i = 0; i < 4 && b.some((id) => a.includes(id)); i++) b = pick()
  const parties: Party[] = [{ room: 'r1', members: a }]
  if (!b.some((id) => a.includes(id))) parties.push({ room: 'r2', members: b })
  const event: NightEvent = pressure >= 3 ? 'miaogong' : EVENTS[Math.floor(r() * EVENTS.length)]
  return { parties, event }
}

// ---------------------------------------------------------------------------
// 技能樹（DESIGN §7）：三條線。一開始每條線的第一格已經會了。
// ---------------------------------------------------------------------------

export type SkillLine = 'kind' | 'scare' | 'ghost' | 'spirit'

export interface SkillDef {
  id: string
  line: SkillLine
  name: string
  desc: string
  cost: number
  /** 解鎖的動作 */
  action?: ActionId
  /** 需要先學會 */
  requires?: string
}

export const SKILLS: SkillDef[] = [
  { id: 'pat', line: 'kind', name: '輕拍哄睡', desc: '睡不著的客人，輕輕拍一拍就睡著了', cost: 0, action: 'pat' },
  { id: 'cook', line: 'kind', name: '阿嬤的宵夜', desc: '在灶腳煮宵夜，端到客人床頭', cost: 2, action: 'cook', requires: 'pat' },
  { id: 'lullaby', line: 'kind', name: '搖籃曲', desc: '站在門口哼歌，不用靠近床就能哄睡', cost: 3, action: 'lullaby', requires: 'cook' },
  { id: 'softhands', line: 'kind', name: '阿嬤的手', desc: '慈祥的動作聲音減半、比較不容易被發現', cost: 4, requires: 'lullaby' },
  { id: 'flicker', line: 'scare', name: '燈閃', desc: '讓房間的燈閃一閃', cost: 0, action: 'flicker' },
  { id: 'knock', line: 'scare', name: '敲門', desc: '在房門外敲門（很大聲）', cost: 1, action: 'knock', requires: 'flicker' },
  { id: 'rocker', line: 'scare', name: '搖椅', desc: '讓阿嬤房間的搖椅自己搖', cost: 2, action: 'rocker', requires: 'knock' },
  { id: 'mirror', line: 'scare', name: '鏡中人', desc: '在浴室鏡子裡現身', cost: 3, action: 'mirror', requires: 'rocker' },
  { id: 'freeze', line: 'ghost', name: '一二三木頭人', desc: '不動的時候，客人幾乎看不到妳', cost: 0 },
  { id: 'ghoststep', line: 'ghost', name: '鬼步', desc: '走路時被發現的速度慢 35%', cost: 2, requires: 'freeze' },
  { id: 'swift', line: 'ghost', name: '快飄省力', desc: '快飄的陰氣減半，而且沒有聲音', cost: 2, requires: 'ghoststep' },
  { id: 'yinmax', line: 'ghost', name: '陰氣上限 +30', desc: '最多可以存 130 陰氣', cost: 3, requires: 'swift' },
  { id: 'possess', line: 'spirit', name: '附身', desc: '附身在阿咪（貓）、小黑（狗）、壁虎身上，各有本事', cost: 1, action: 'possess' },
  { id: 'telekinesis', line: 'spirit', name: '念力', desc: '用手指直接拖房間裡的東西：拉被子、滾球、撿東西（拖太快會有聲音）', cost: 2, requires: 'possess' },
  { id: 'dream', line: 'spirit', name: '托夢', desc: '進入睡著客人的夢，幫他解決心事，他會睡得很沉', cost: 2, action: 'dream', requires: 'possess' },
  { id: 'radio', line: 'spirit', name: '收音機', desc: '附身神明廳的收音機，遠遠放老歌哄睡（膽小的人會怕）', cost: 2, action: 'radio', requires: 'dream' },
  { id: 'deepdream', line: 'spirit', name: '好夢', desc: '夢境的時間 +15 秒，夢裡的東西也比較好找', cost: 3, requires: 'radio' },
]

export const START_SKILLS = ['pat', 'flicker', 'freeze']

// ---------------------------------------------------------------------------
// 老宅升級（DESIGN §9）：月底小翰拿錢買
// ---------------------------------------------------------------------------

export interface UpgradeDef {
  id: string
  name: string
  desc: string
  cost: number
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'net', name: '蚊帳', desc: '客房不會有蚊子', cost: 6000 },
  { id: 'nightlamp', name: '感應小夜燈', desc: '怕黑的客人自己會開燈', cost: 5000 },
  { id: 'heater', name: '電暖器', desc: '客人半夜覺得冷的機率減半', cost: 9000 },
  { id: 'shrine', name: '神明廳修復', desc: '家裡上香的陰氣 +10 → +30', cost: 15000 },
  { id: 'cctv', name: '監視器', desc: 'YouTuber 會看監視器畫面：任何地方的嚇人動作都算拍到', cost: 8000 },
]

// ---------------------------------------------------------------------------
// 節日（DESIGN §26.1）：第 4 晚土地公生、第 6 晚清明、第 8 晚中元普渡，之後每 4 晚輪一次
// ---------------------------------------------------------------------------

export type Festival = 'tudigong' | 'qingming' | 'zhongyuan'

export const FESTIVAL_NAME: Record<Festival, string> = { tudigong: '土地公生', qingming: '清明', zhongyuan: '中元普渡' }

export function festivalOf(night: number): Festival | null {
  if (night === 4) return 'tudigong'
  if (night === 6) return 'qingming'
  if (night === 8) return 'zhongyuan'
  if (night > 8 && night % 4 === 0) return (['tudigong', 'qingming', 'zhongyuan'] as Festival[])[(night / 4) % 3]
  return null
}
