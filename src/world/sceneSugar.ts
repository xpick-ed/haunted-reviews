import { rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 糖廠（DESIGN §32）：坐五分車到終點：廢棄的糖廠、生鏽的機器、鬼工人、枝仔冰。
// 規則在這裡；畫面在 src/scene/Sugar.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。

export const SUGAR_SCENE: SceneDef = {
  id: 'sugar',
  name: '糖廠',
  colliders: { rects: [], circles: [], bounds: rect(-10, -10, 10, 10) },
  spawns: {},
  exits: [],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
}

export const SUGAR_HOTSPOTS: Hotspot[] = []
