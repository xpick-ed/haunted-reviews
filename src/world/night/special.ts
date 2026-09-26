import type { NightSim, SimPlugin } from './sim'
import type { NightPlan } from './plan'
import type { Meta } from './director'

// 特別的夜晚（DESIGN §31.3）：颱風夜、中元普渡的鬼客人夜。一個月一次，打破重複感。
// 純邏輯（Node 測試可以跑），不能 import store／audio；畫面在 src/scene/SpecialLayer.tsx、src/ui/SpecialHud.tsx。

/** 今晚是不是特別的夜晚（null＝平常） */
export function createSpecialNight(sim: NightSim, plan: NightPlan, meta: Meta): SimPlugin | null {
  void sim
  void plan
  void meta
  return null
}

/** sim.emitCustom 的事件（director 轉過來） */
export const SPECIAL_EVENTS: Record<string, (data: unknown) => void> = {}
