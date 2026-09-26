// 夾娃娃機的規則（純邏輯，Node 也能跑）：娃娃坑的座標 x 左右 0..1、d 前後 0..1（0 最裡面、1 最靠玻璃）。
// 出獎口在左前角。爪子很弱：夾不夾得起來看對得準不準、娃娃重不重；拉上去、搬過去的路上都可能掉。

export type PrizeKind = 'dino' | 'doll' | 'snack' | 'rabbit'

export const PRIZE_INFO: Record<PrizeKind, { name: string; icon: string; r: number; weight: number }> = {
  dino: { name: '恐龍布偶', icon: '🦖', r: 0.075, weight: 0.55 },
  doll: { name: '紅衫胖娃娃', icon: '🧸', r: 0.07, weight: 0.6 },
  snack: { name: '一包乖乖', icon: '🍿', r: 0.06, weight: 0.35 },
  rabbit: { name: '粉紅兔', icon: '🐰', r: 0.07, weight: 0.5 },
}

export interface Prize {
  id: number
  kind: PrizeKind
  x: number
  d: number
  /** 擺的角度（畫面用） */
  tilt: number
}

/** 出獎口（左前角）：夾著的娃娃掉在這裡面就算夾到 */
export const CHUTE = { x1: 0.2, d0: 0.72 }
export const HOME = { x: 0.1, d: 0.86 }
export const inChute = (x: number, d: number) => x < CHUTE.x1 && d > CHUTE.d0

/** 一坑娃娃：恐龍 2、胖娃娃 2、乖乖 3、兔子 2，不擺在出獎口上 */
export function makePrizes(rnd = Math.random): Prize[] {
  const kinds: PrizeKind[] = ['dino', 'dino', 'doll', 'doll', 'snack', 'snack', 'snack', 'rabbit', 'rabbit']
  const out: Prize[] = []
  let id = 0
  for (const kind of kinds) {
    for (let tries = 0; tries < 60; tries++) {
      const x = 0.26 + rnd() * 0.68
      const d = 0.08 + rnd() * 0.82
      const r = PRIZE_INFO[kind].r
      if (out.some((p) => Math.hypot(p.x - x, p.d - d) < r + PRIZE_INFO[p.kind].r - 0.02)) continue
      out.push({ id: id++, kind, x, d, tilt: (rnd() - 0.5) * 0.6 })
      break
    }
  }
  return out
}

/** 爪子合起來時：夾到哪一個（或沒有）。對得越準、越輕越容易 */
export function tryGrab(prizes: Prize[], x: number, d: number, rnd = Math.random): { prize: Prize | null; aim: number } {
  let best: Prize | null = null
  let bestD = Infinity
  for (const p of prizes) {
    const dist = Math.hypot(p.x - x, p.d - d)
    if (dist < PRIZE_INFO[p.kind].r + 0.04 && dist < bestD) {
      best = p
      bestD = dist
    }
  }
  if (!best) return { prize: null, aim: 0 }
  const info = PRIZE_INFO[best.kind]
  const aim = 1 - bestD / (info.r + 0.04)
  const chance = Math.pow(aim, 0.6) * (1 - info.weight * 0.4)
  return { prize: rnd() < chance ? best : null, aim }
}

/** 拉到頂的那一下會不會掉 */
export function slipOnLift(p: Prize, aim: number, rnd = Math.random) {
  return rnd() < 0.18 + PRIZE_INFO[p.kind].weight * 0.25 - aim * 0.15
}

/** 搬過去的路上每秒掉的機率（晃越大越容易掉） */
export function slipPerSecond(p: Prize, swing: number) {
  return 0.16 + PRIZE_INFO[p.kind].weight * 0.12 + Math.min(0.3, Math.abs(swing) * 0.6)
}
