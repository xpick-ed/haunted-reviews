import type { NightPlan } from './plan'
import type { Meta } from './director'
import type { NightSim, SimPlugin } from './sim'

// 客人之間的故事（DESIGN §27.2）：純邏輯（Node 可測）。director.ts 每晚呼叫 createEncounters()，
// 回傳 null 表示今晚沒有。耳語選項的 UI 在 src/ui/EncounterPanel.tsx、畫面在 src/scene/Encounters.tsx。

export function createEncounters(_sim: NightSim, _plan: NightPlan, _meta: Meta): SimPlugin | null {
  return null
}

/** 自訂事件（sim.emitCustom(kind, data)）的處理函式；director 會併進 CUSTOM_EVENTS */
export const ENCOUNTER_EVENTS: Record<string, (data: unknown) => void> = {}
