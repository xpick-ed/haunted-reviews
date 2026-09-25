import { rect, type Circle } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 鬼夜市（DESIGN §25.1）：深夜 00:00–04:30 從土地公廟後面的小路進來。好兄弟擺攤：
// 紅姨賣法器（功德）、金魚伯撈金魚、射氣球。規則在這裡；畫面在 src/scene/Market.tsx。

/** 夜市開的時間（遊戲小時，24 = 午夜） */
export const MARKET_OPEN = 24
export const MARKET_CLOSE = 28.5

export const MARKET_SCENE: SceneDef = {
  id: 'market',
  name: '鬼夜市',
  colliders: { rects: [], circles: [], bounds: rect(-16, -10, 16, 10) },
  spawns: {
    gate: [0, 8],
  },
  exits: [{ area: rect(-2.5, 9, 2.5, 10), to: 'temple', spawn: 'market_gate', label: '↓ 土地公廟', sign: [2.6, 8.2] }],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}

export const MARKET_HOTSPOTS: Hotspot[] = []
