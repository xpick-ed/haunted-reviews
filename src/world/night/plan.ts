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
  /** 特別的夜晚（DESIGN §31.3）：颱風夜、中元鬼客人夜（night/special.ts） */
  special?: SpecialNight
}

/** 特別的夜晚：颱風夜（停電、漏水、大家擠在神明廳）、中元鬼客人夜（客房二住的是好兄弟） */
export type SpecialNight = 'typhoon' | 'ghost'

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
/** 情侶和小孩不排在同一晚（成人內容的界線：有小孩的地方不放成人內容） */
const COUPLES: GuestId[] = ['ajie', 'xiaohui', 'mrwang', 'mrswang']
const clash = (a: GuestId[], b: GuestId[]) =>
  b.some((id) => a.includes(id)) || (a.some((id) => COUPLES.includes(id)) && b.includes('xiaoyu')) || (b.some((id) => COUPLES.includes(id)) && a.includes('xiaoyu'))
const EVENTS: NightEvent[] = ['none', 'none', 'dog', 'mosquitoes', 'coldsnap', 'blackout']

/**
 * 第 night 晚（從 1 開始）的安排。第一個月照劇本；之後依名聲決定客人比例：
 * 溫馨名聲高 → 一般客、家庭、商務客多；靈異名聲高 → YouTuber、背包客多。
 */
export function planNight(night: number, warm: number, spooky: number, pressure: number, opts: { adult?: boolean } = {}): NightPlan {
  if (night <= MONTH1.length) return MONTH1[night - 1]
  const special = specialOf(night)
  if (special === 'ghost') return ghostPlan(night)
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
  for (let i = 0; i < 4 && clash(a, b); i++) b = pick()
  const parties: Party[] = [{ room: 'r1', members: a }]
  if (!clash(a, b)) parties.push({ room: 'r2', members: b })
  const event: NightEvent = pressure >= 3 ? 'miaogong' : EVENTS[Math.floor(r() * EVENTS.length)]
  // 颱風夜：一定停電（沿用「颱風停電」的停電、怕黑）；廟公這種天氣不會出來巡
  if (special === 'typhoon') return { parties, event: 'blackout', special }
  return { parties, event }
}

// ---------------------------------------------------------------------------
// 特別的夜晚（DESIGN §31.3）：一個月大概一次，而且避開主線（第 7 晚陳董、第 8 晚月底期限的帳、第 10 晚分遺產、第 12 晚做決定）
//   颱風夜    第 5 晚、第 11 晚，之後每 12 晚一次（23、35、47……都是單數，不會碰到節日；也不會緊接在鬼客人夜後面）
//   鬼客人夜  中元普渡的晚上（第 8、20、32……晚）：客房二住的是好兄弟，客房一是一位活人客人
//   所以是：5 颱風、8 鬼、11 颱風、20 鬼、23 颱風、32 鬼、35 颱風……（大概一個月一次）
// ---------------------------------------------------------------------------

export function specialOf(night: number): SpecialNight | null {
  if (night === 5 || (night >= 11 && (night - 11) % 12 === 0)) return 'typhoon'
  if (night > MONTH1.length && festivalOf(night) === 'zhongyuan') return 'ghost'
  return null
}

/** 鬼客人夜的第幾次（0 起算）：輪流來不同的好兄弟 */
export function ghostVisit(night: number) {
  let k = 0
  for (let n = 1; n < night; n++) if (specialOf(n) === 'ghost') k++
  return k
}

/** 好兄弟：第一次是回來看村子的老夫妻，第二次是老兵和歌仔戲的花旦，之後輪流 */
export const GHOST_PARTIES: GuestId[][] = [
  ['gg_shuimu', 'gg_bangsi'],
  ['gg_soldier', 'gg_opera'],
]
/** 客房一的活人：一個人來、容易被嚇到的（這樣「別讓他撞見好兄弟」才有意思） */
const GHOST_NIGHT_LIVING: GuestId[] = ['xiaomei', 'zhang']

function ghostPlan(night: number): NightPlan {
  const k = ghostVisit(night)
  return {
    parties: [
      { room: 'r1', members: [GHOST_NIGHT_LIVING[k % GHOST_NIGHT_LIVING.length]] },
      { room: 'r2', members: GHOST_PARTIES[k % GHOST_PARTIES.length] },
    ],
    // 普渡的晚上廟公在廟裡忙，不會來巡
    event: 'none',
    special: 'ghost',
  }
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
