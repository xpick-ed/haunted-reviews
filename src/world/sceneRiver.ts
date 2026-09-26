import { rect, type Circle } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 溪邊＋螢火蟲（DESIGN §26.1）：從村子北邊的小路過來。釣溪哥、中元節放水燈、陰陽眼才看得到的玩水小鬼。
// 規則在這裡；畫面在 src/scene/River.tsx。注意：這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import）。

export const RIVER_SCENE: SceneDef = {
  id: 'river',
  name: '溪邊',
  colliders: { rects: [], circles: [], bounds: rect(-20, -12, 20, 12) },
  spawns: { path: [0, 9] },
  exits: [{ area: rect(-2.5, 11, 2.5, 12), to: 'village', spawn: 'north', label: '↓ 村子', sign: [2.6, 10.2] }],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}

export const RIVER_HOTSPOTS: Hotspot[] = []
