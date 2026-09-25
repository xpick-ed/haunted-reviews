import { rect, type Circle } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 後院菜園＋雞舍（DESIGN §25.1）：從阿春民宿屋後的小路過來。採地瓜葉、挖地瓜、撿雞蛋、拿菜脯。
// 規則在這裡；畫面在 src/scene/Garden.tsx。

export const GARDEN_SCENE: SceneDef = {
  id: 'garden',
  name: '後院菜園',
  colliders: { rects: [], circles: [], bounds: rect(-14, -12, 14, 10) },
  spawns: {
    path: [0, 8],
  },
  exits: [{ area: rect(-2.5, 9, 2.5, 10), to: 'home', spawn: 'back', label: '↓ 回家', sign: [2.6, 8.2] }],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}

export const GARDEN_HOTSPOTS: Hotspot[] = []
