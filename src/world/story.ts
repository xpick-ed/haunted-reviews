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
