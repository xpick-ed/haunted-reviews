import type { GuestRT } from './sim'

// 天亮時每位客人給幾顆星（DESIGN §12）。純函式：遊戲和 scripts/sim-night.ts 共用。

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function rateGuest(g: GuestRT): number {
  const d = g.def
  let raw = 3 + clamp((g.comfort - d.comfortNeed) / 15, -2, 1.5)
  if (d.type === 'thrill') {
    raw += Math.min(2, g.captures * 1.1) - (g.captures === 0 ? 1.5 : 0)
    if (d.fearMin && g.fear < d.fearMin) raw -= clamp((d.fearMin - g.fear) / 20, 0, 1)
  } else if (!d.seesGhost) {
    raw -= clamp((g.fear - d.fearMax) / 12, 0, 3)
  }
  if (d.type === 'child') raw += g.played ? 1.2 : -1
  if (d.type === 'elder') raw += g.chatted ? 1 : -0.5
  raw -= g.needs.length * 0.4
  if (d.type === 'business') raw -= g.wokenCount * 0.5
  return clamp(Math.round(raw), 1, 5)
}
