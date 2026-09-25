import { rect, type Circle } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 村路＋柑仔店（DESIGN §25.1）：阿春民宿東邊的路走過來，再往東是土地公廟。
// 柑仔店的阿嬌看得到阿嬤。這個檔案是規則（碰撞、出生點、出口、熱點）；畫面在 src/scene/Village.tsx。

export const VILLAGE = {
  roadZ: 0,
  roadWidth: 3.4,
}

export const VILLAGE_SCENE: SceneDef = {
  id: 'village',
  name: '村路',
  colliders: { rects: [], circles: [], bounds: rect(-24, -12, 24, 12) },
  spawns: {
    west: [-19, VILLAGE.roadZ],
    east: [19, VILLAGE.roadZ],
  },
  exits: [
    { area: rect(-24, VILLAGE.roadZ - 3, -21.5, VILLAGE.roadZ + 3), to: 'home', spawn: 'road_east', label: '← 阿春民宿', sign: [-20, VILLAGE.roadZ - 2.2] },
    { area: rect(21.5, VILLAGE.roadZ - 3, 24, VILLAGE.roadZ + 3), to: 'temple', spawn: 'road_west', label: '土地公廟 →', sign: [20, VILLAGE.roadZ - 2.2] },
  ],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}

export const VILLAGE_HOTSPOTS: Hotspot[] = []
