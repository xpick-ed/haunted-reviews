import { rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 城隍廟（DESIGN §32）：陰間的戶政事務所：阿嬤每個月底來報到、延長居留；判官、黑白無常。
// 規則在這裡；畫面在 src/scene/Chenghuang.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。

export const CHENGHUANG_SCENE: SceneDef = {
  id: 'chenghuang',
  name: '城隍廟',
  colliders: { rects: [], circles: [], bounds: rect(-10, -10, 10, 10) },
  spawns: {},
  exits: [],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
}

export const CHENGHUANG_HOTSPOTS: Hotspot[] = []
