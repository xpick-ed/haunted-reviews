import { rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 黃昏市場（DESIGN §32）：村子旁邊傍晚才開的傳統市場：菜攤、豬肉攤、魚販、粿攤。買新食材，殺價。
// 規則在這裡；畫面在 src/scene/DuskMarket.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。

export const DMARKET_SCENE: SceneDef = {
  id: 'dmarket',
  name: '黃昏市場',
  colliders: { rects: [], circles: [], bounds: rect(-10, -10, 10, 10) },
  spawns: {},
  exits: [],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
}

export const DMARKET_HOTSPOTS: Hotspot[] = []
