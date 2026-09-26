import type { Circle } from './collision'
import type { Hotspot } from './hotspots'
import type { DecorPlacement } from './night/director'

// 裝修民宿（DESIGN §27.2）：家具擺飾的目錄與效果。擺好的東西存在 meta.decor。
// 效果：這個模組把 decorHooks.bonus（night/director.ts）換成自己的換算，NightSim 就會用。

export const DECOR_HOTSPOTS: Hotspot[] = []

/** 擺好的東西的碰撞圓（World.tsx 把它們加進家裡的碰撞） */
export function decorCircles(_decor: DecorPlacement[]): Circle[] {
  return []
}
