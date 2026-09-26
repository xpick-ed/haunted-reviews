import { rect, type Circle } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 山上墓仔埔（DESIGN §26.1）：從土地公廟後面的山路上來。阿嬤和阿公的墳、鬼鄰居的社區、清明節掃墓。
// 規則在這裡；畫面在 src/scene/Hill.tsx。這個檔案會被 Node 測試載入，不能 import store／audio。

export const HILL_SCENE: SceneDef = {
  id: 'hill',
  name: '山上墓仔埔',
  colliders: { rects: [], circles: [], bounds: rect(-20, -14, 20, 12) },
  spawns: { path: [0, 10] },
  exits: [{ area: rect(-2.5, 11, 2.5, 12), to: 'temple', spawn: 'hill_path', label: '↓ 土地公廟', sign: [2.6, 10.2] }],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}

export const HILL_HOTSPOTS: Hotspot[] = []
