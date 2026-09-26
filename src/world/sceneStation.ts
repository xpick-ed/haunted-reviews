import { rect, type Circle } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'

// 小火車站＋五分車（DESIGN §27.1）：家門前的路往西。傍晚今晚的客人在這裡下車，半夜有載鬼的末班車，可以搭五分車穿過甘蔗田。
// 規則在這裡；畫面在 src/scene/Station.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。

export const STATION_SCENE: SceneDef = {
  id: 'station',
  name: '小火車站',
  colliders: { rects: [], circles: [], bounds: rect(-22, -12, 22, 12) },
  spawns: { east: [18, 0], oldstreet: [-18, 0] },
  exits: [
    { area: rect(20.5, -3, 22, 3), to: 'home', spawn: 'road_west', label: '阿春民宿 →', sign: [18.8, -2.2] },
    { area: rect(-22, -3, -20.5, 3), to: 'oldstreet', spawn: 'station', label: '← 老街', sign: [-18.8, -2.2] },
  ],
  buildings: [],
  rooms: [],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}

export const STATION_HOTSPOTS: Hotspot[] = []
