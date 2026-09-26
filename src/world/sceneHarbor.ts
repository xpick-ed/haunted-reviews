import { rect, type Circle } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 海邊漁港＋燈塔（DESIGN §27.1）：老街盡頭。漁船、魚市、消波塊；退潮時潮間帶可以走、抓螃蟹；燈塔的守燈人鬼。
// 規則在這裡；畫面在 src/scene/Harbor.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。

export const HARBOR_SCENE: SceneDef = {
  id: 'harbor',
  name: '海邊漁港',
  colliders: { rects: [], circles: [], bounds: rect(-22, -14, 22, 12) },
  spawns: { oldstreet: [18, 0] },
  exits: [{ area: rect(20.5, -3, 22, 3), to: 'oldstreet', spawn: 'harbor', label: '老街 →', sign: [18.8, -2.2] }],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}

export const HARBOR_HOTSPOTS: Hotspot[] = []
