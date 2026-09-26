import { rect, type Rect } from './collision'

// 海邊的潮汐（DESIGN §27.1）：純邏輯（Node 可測）。
// 深夜 22–24 點滿潮；24 點開始退，25:12 退到最低；乾潮到 27 點；之後慢慢漲，29:30 又滿。
// 傍晚（時間固定在 18.6）一律當滿潮。
// 滿潮時潮間帶整片在水裡（擋住不能走）；半潮時只有靠岸的一半露出來；乾潮整片都能走、可以抓螃蟹。

/** 潮間帶（碼頭東邊、往海的那一片礁石）：x、z 範圍與礁石表面高度 */
export const FLATS = { x0: 6, x1: 19, z0: -10, z1: -1.5, rockY: -1.3 }

/** 海面高度：滿潮、乾潮 */
export const TIDE = { highY: -0.72, lowY: -2.0 }

export type TideBand = 'high' | 'mid' | 'low'

const smooth = (t: number) => t * t * (3 - 2 * t)

/** 潮位 0..1（1＝滿潮、0＝乾潮） */
export function tideLevel(hour: number, phase?: string): number {
  if (phase === 'dusk' || hour < 24) return 1
  if (hour < 25.2) return 1 - smooth((hour - 24) / 1.2)
  if (hour < 27) return 0
  if (hour < 29.5) return smooth((hour - 27) / 2.5)
  return 1
}

/** 海面的高度（公尺） */
export const waterY = (level: number) => TIDE.lowY + (TIDE.highY - TIDE.lowY) * level

/** 潮位分三段：滿潮、半潮、乾潮 */
export function tideBand(level: number): TideBand {
  if (level > 0.66) return 'high'
  if (level > 0.22) return 'mid'
  return 'low'
}

/** 這個潮位要多擋的地方：滿潮整片潮間帶、半潮外側那一半 */
export function tideRects(band: TideBand): Rect[] {
  const f = FLATS
  if (band === 'high') return [rect(f.x0, f.z0, f.x1, f.z1)]
  if (band === 'mid') return [rect(f.x0, f.z0, f.x1, (f.z0 + f.z1) / 2)]
  return []
}

/** 在不在潮間帶上 */
export const onFlats = (x: number, z: number) => x > FLATS.x0 && x < FLATS.x1 && z > FLATS.z0 && z < FLATS.z1

/** 潮間帶礁石表面的高度（有一點起伏；靠岸高、往外低） */
export function flatsY(x: number, z: number) {
  const f = FLATS
  const out = (f.z1 - z) / (f.z1 - f.z0)
  return f.rockY + 0.18 - out * 0.35 + Math.sin(x * 1.3) * Math.cos(z * 1.1) * 0.06
}

/**
 * 目前的潮位（Harbor.tsx 每幀更新；floorAt、熱點用）。
 * 不在海邊的時候不會更新，停在上一次的值也沒關係：一進海邊就會馬上算。
 */
export const tideState = { level: 1, band: 'high' as TideBand }
