import { rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 鬼火車（DESIGN §32）：半夜 12 點的末班車：車廂裡都是要去另一邊的鬼。坐一站。
// 規則在這裡；畫面在 src/scene/GhostTrain.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。

export const GHOSTTRAIN_SCENE: SceneDef = {
  id: 'ghosttrain',
  name: '鬼火車',
  colliders: { rects: [], circles: [], bounds: rect(-10, -10, 10, 10) },
  spawns: {},
  exits: [],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
}

export const GHOSTTRAIN_HOTSPOTS: Hotspot[] = []
