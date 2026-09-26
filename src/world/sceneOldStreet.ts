import { rect, type Circle } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 老街（DESIGN §27.1）：從小火車站出來。冰果室剉冰、關門的老戲院（放映機播阿嬤的回憶）、照相館、理髮廳；盡頭往海邊。
// 規則在這裡；畫面在 src/scene/OldStreet.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。

export const OLDSTREET_SCENE: SceneDef = {
  id: 'oldstreet',
  name: '老街',
  colliders: { rects: [], circles: [], bounds: rect(-22, -12, 22, 12) },
  spawns: { station: [18, 0], harbor: [-18, 0] },
  exits: [
    { area: rect(20.5, -3, 22, 3), to: 'station', spawn: 'oldstreet', label: '小火車站 →', sign: [18.8, -2.2] },
    { area: rect(-22, -3, -20.5, 3), to: 'harbor', spawn: 'oldstreet', label: '← 海邊', sign: [-18.8, -2.2] },
  ],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}

export const OLDSTREET_HOTSPOTS: Hotspot[] = []
