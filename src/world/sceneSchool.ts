import { rect, type Circle } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 廢棄國小（DESIGN §26.1）：從村子南邊的小路過來。小孩鬼：鬼抓人、跳房子、躲貓貓；教室裡有阿嬤的童年回憶。
// 規則在這裡；畫面在 src/scene/School.tsx。這個檔案會被 Node 測試載入，不能 import store／audio。

export const SCHOOL_SCENE: SceneDef = {
  id: 'school',
  name: '廢棄國小',
  colliders: { rects: [], circles: [], bounds: rect(-20, -14, 20, 12) },
  spawns: { gate: [0, -12] },
  exits: [{ area: rect(-2.5, -14, 2.5, -13), to: 'village', spawn: 'south', label: '↑ 村子', sign: [2.6, -12.2] }],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}

export const SCHOOL_HOTSPOTS: Hotspot[] = []
