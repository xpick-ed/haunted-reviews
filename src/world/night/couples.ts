import type { NightPlan } from './plan'
import type { Meta } from './director'
import type { NightSim, SimPlugin } from './sim'

// 情侶客人：勿擾牌、別讓小宇和阿凱去敲門、撞見的尷尬（成人內容）。純邏輯（Node 可測），director.ts 每晚呼叫 createCouples()，回傳 null 表示今晚沒有。
// 成人內容的判斷：用 settings.ts 的 adultOn()（Node 裡是預設值：關）。

export function createCouples(_sim: NightSim, _plan: NightPlan, _meta: Meta): SimPlugin | null {
  return null
}

/** 自訂事件（sim.emitCustom(kind, data)）的處理函式；director 會併進 CUSTOM_EVENTS */
export const COUPLE_EVENTS: Record<string, (data: unknown) => void> = {}
