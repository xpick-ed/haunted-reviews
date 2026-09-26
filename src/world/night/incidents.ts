import type { NightPlan } from './plan'
import type { Meta } from './director'
import type { NightSim, SimPlugin } from './sim'

// 半夜突發事件（DESIGN §27.2）：純邏輯（Node 可測）。director.ts 每晚呼叫 createIncidents()，
// 回傳 null 表示今晚沒有事件。畫面在 src/scene/Incidents.tsx、HUD 在 src/ui/IncidentHud.tsx。

export function createIncidents(_sim: NightSim, _plan: NightPlan, _meta: Meta): SimPlugin | null {
  return null
}

/** 自訂事件（sim.emitCustom(kind, data)）的處理函式；director 會併進 CUSTOM_EVENTS */
export const INCIDENT_EVENTS: Record<string, (data: unknown) => void> = {}
