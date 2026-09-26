import type { Meta } from './night/director'
import { MEMORIES } from './memories'
import { NIGHTS_PER_MONTH } from './night/plan'

// 主線與結局（DESIGN §28.3–28.4）。純函式：director 在天亮、月底呼叫；畫面在 src/ui/EndingScreen.tsx。

export type EndingId = 'train' | 'together' | 'stay' | 'sold'

/** 第三個月底（第 12 晚）小翰做決定 */
export const DECISION_NIGHT = 3 * NIGHTS_PER_MONTH
/** 小翰的條件：存款、他覺得「做得下去」 */
export const GOAL = { money: 30000, heart: 60 }
/** 好結局要找回幾片回憶 */
export const TRAIN_MEMORIES = 10

export const ENDING_NAME: Record<EndingId, string> = {
  train: '末班車',
  together: '一起回家',
  stay: '守著老家',
  sold: '賣掉了',
}

/** 主線劇情：陳董第 7 晚傍晚來（第 6 晚是清明，小翰在山上掃墓）、第 8 晚月底小翰給期限 */
export const STORY = {
  chendong: { night: 7 },
  deadline: { night: 2 * NIGHTS_PER_MONTH },
}

/** 主線的目標顯示了沒（小翰說出期限以後） */
export const goalShown = (meta: Meta) => meta.story.includes('deadline')

/** 天亮時：小翰的心歸零就撐不下去了 */
export function endingAtDawn(meta: Meta): EndingId | null {
  if (meta.story.some((x) => x.startsWith('ended_'))) return null
  return meta.heart <= 0 ? 'sold' : null
}

/**
 * 月底（扣完房貸之後的 meta）：連兩個月存款是負的 → 賣掉；第 12 晚 → 小翰做決定。
 * 已經看過結局（無盡模式）就不再判定。
 */
export function endingAtMonthEnd(meta: Meta): EndingId | null {
  if (meta.story.some((x) => x.startsWith('ended_'))) return null
  if (meta.debtMonths >= 2) return 'sold'
  if (meta.night < DECISION_NIGHT) return null
  const keep = meta.money >= GOAL.money && meta.heart >= GOAL.heart
  if (!keep) return 'sold'
  if (meta.memories.length >= MEMORIES.length && meta.pastDone.length >= 3) return 'together'
  if (meta.memories.length >= TRAIN_MEMORIES) return 'train'
  return 'stay'
}

// ---------------------------------------------------------------------------
// 小翰感覺得到阿嬤（DESIGN §31.2）：meta.hanSense 0..100（src/world/han.ts 加）
// ---------------------------------------------------------------------------

/** 到這裡：傍晚他多擺一副碗筷（storyBeats.bowlBeat），結局多一段 */
export const HAN_KNOWS = 80

/** 他感覺得到阿嬤以後，心比較撐得住：天亮時心本來就在加的話，多加一點 */
export function hanHeartBonus(hanSense: number, heartD: number) {
  if (heartD <= 0) return 0
  return hanSense >= 90 ? 2 : hanSense >= 60 ? 1 : 0
}

/** 結局多一張卡片（EndingScreen 插在 before 那張插畫前面；沒有那張就放最後） */
export interface HanEpilogue {
  art: string
  note: string
  lines: string[]
  before: string
}

export function hanEpilogue(end: EndingId, hanSense: number): HanEpilogue | null {
  if (hanSense < HAN_KNOWS) return null
  switch (end) {
    case 'sold':
      return { art: 'emptyroom', note: '天亮前，小翰一個人回來了一趟。他在空空的神明廳站了很久。', lines: ['hs.end.sold.1', 'hs.end.sold.2', 'hs.end.sold.3'], before: 'nighttrain' }
    case 'train':
      return { art: 'hansleep', note: '汽笛聲傳過來的時候，小翰其實沒有睡著。', lines: ['hs.end.go.1', 'hs.end.go.2', 'hs.end.go.3'], before: 'window' }
    case 'together':
      return { art: 'hansleep', note: '汽笛聲傳過來的時候，小翰其實沒有睡著。', lines: ['hs.end.go.1', 'hs.end.go.2', 'hs.end.go.3'], before: 'window2' }
    case 'stay':
      return { art: 'dawnhouse', note: '早上，飯桌上擺著兩副碗筷。', lines: ['hs.end.stay.1', 'hs.end.stay.2'], before: 'dawnlights' }
  }
}
