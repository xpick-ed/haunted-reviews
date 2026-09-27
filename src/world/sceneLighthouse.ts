import { rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 燈塔（DESIGN §32）：海邊燈塔的裡面：螺旋梯爬到頂，看整個村子的夜景，守燈人。
// 規則在這裡；畫面在 src/scene/Lighthouse.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。

export const LIGHTHOUSE_SCENE: SceneDef = {
  id: 'lighthouse',
  name: '燈塔',
  colliders: { rects: [], circles: [], bounds: rect(-10, -10, 10, 10) },
  spawns: {},
  exits: [],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
}

export const LIGHTHOUSE_HOTSPOTS: Hotspot[] = []
