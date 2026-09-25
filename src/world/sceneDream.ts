import { rect, type Circle } from './collision'
import type { SceneDef } from './scenes'

// 夢境（DESIGN §25.1）：托夢時進來，沒有出口；結束時 store.endDream() 回到客人床邊。
// 每個客人的夢長得不一樣（src/world/dream.ts 決定主題與玩法），碰撞由主題決定。

export const DREAM_SCENE: SceneDef = {
  id: 'dream',
  name: '夢境',
  colliders: { rects: [], circles: [], bounds: rect(-12, -12, 12, 12) },
  spawns: { start: [0, 6] },
  exits: [],
  buildings: [],
  rooms: [],
  floorAt: () => 0,
  npcs: (): Circle[] => [],
}
