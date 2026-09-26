import { rect, type Circle } from './collision'
import type { SceneDef } from './scenes'

// 回到 1958（DESIGN §27.1）：從回憶相簿走進阿嬤的過去，用年輕的阿春玩短關卡。沒有出口；關卡結束時 store.exitPast() 回到原來的地方。每一關可以換掉 PAST_SCENE 的碰撞與出生點（World.tsx 不快取 past 的碰撞）。
// 規則在這裡；畫面在 src/scene/Past.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。

export const PAST_SCENE: SceneDef = {
  id: 'past',
  name: '1958 年',
  colliders: { rects: [], circles: [], bounds: rect(-24, -17, 27.5, 16) },
  spawns: { start: [0, 4] },
  exits: [],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}
