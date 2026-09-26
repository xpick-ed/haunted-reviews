// 彈珠台的物理（純邏輯，Node 也能跑）：盤面座標寬 1、高 H，y 往下。
// 圓頂（右邊發射道打上去，沿著圓頂滑到左邊掉下來）、釘子、得分的小杯子、最底下的出口。

export const H = 1.55
export const BALL_R = 0.017
export const PIN_R = 0.008
const G = 1.6
const DOME = { x: 0.5, y: 0.5, r: 0.46 }
const LEFT = 0.04
const RIGHT = 0.96
/** 發射道：右邊 LANE_X..RIGHT，隔板從 LANE_TOP 往下 */
export const LANE_X = 0.88
export const LANE_TOP = 0.62
export const START = { x: 0.92, y: 1.42 }
export const V_MAX = 2.45

export interface Pocket {
  x: number
  y: number
  w: number
  points: number
  label: string
}

export const POCKETS: Pocket[] = [
  { x: 0.46, y: 0.95, w: 0.05, points: 50, label: '福' },
  { x: 0.2, y: 0.8, w: 0.05, points: 20, label: '20' },
  { x: 0.72, y: 0.8, w: 0.05, points: 20, label: '20' },
  { x: 0.28, y: 1.15, w: 0.055, points: 10, label: '10' },
  { x: 0.64, y: 1.15, w: 0.055, points: 10, label: '10' },
  { x: 0.46, y: 1.34, w: 0.055, points: 30, label: '30' },
]

/** 釘子：錯開的格子，杯子附近空出來，杯口兩邊各一根（讓球有機會彈進去） */
export const PINS: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = []
  let row = 0
  for (let y = 0.6; y < 1.42; y += 0.075, row++) {
    for (let x = 0.09 + (row % 2) * 0.045; x < LANE_X - 0.04; x += 0.09) {
      if (POCKETS.some((p) => Math.abs(p.x - x) < p.w * 0.9 && y > p.y - 0.06 && y < p.y + 0.05)) continue
      out.push({ x, y })
    }
  }
  for (const p of POCKETS) {
    out.push({ x: p.x - p.w / 2 - 0.012, y: p.y - 0.012 })
    out.push({ x: p.x + p.w / 2 + 0.012, y: p.y - 0.012 })
  }
  // 貼著兩邊牆的釘子：不讓球沿著牆直直掉下去
  for (let y = 0.64; y < 1.42; y += 0.15) {
    out.push({ x: LEFT + 0.018, y })
    out.push({ x: LANE_X - 0.018, y: y + 0.075 })
  }
  return out
})()

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  /** 還在發射道裡（隔板在左邊擋著） */
  inLane: boolean
  still: number
  t: number
}

export type BallEvent = { t: 'pin'; speed: number } | { t: 'wall' } | { t: 'pocket'; pocket: Pocket } | { t: 'out' } | { t: 'back' }

export function launch(power: number, rnd = Math.random): Ball {
  const v = V_MAX * (0.55 + 0.45 * Math.max(0, Math.min(1, power)))
  return { x: START.x + (rnd() - 0.5) * 0.004, y: START.y, vx: 0, vy: -v, inLane: true, still: 0, t: 0 }
}

/**
 * 推進 dt 秒（內部再切小步）。回傳這段時間發生的事；球進杯、掉出去、或力道不夠掉回發射道就結束（回傳 done）。
 */
export function stepBall(b: Ball, dt: number, rnd = Math.random): { events: BallEvent[]; done: boolean } {
  const events: BallEvent[] = []
  const N = Math.max(1, Math.ceil(dt / (1 / 240)))
  const h = dt / N
  for (let i = 0; i < N; i++) {
    b.t += h
    b.vy += G * h
    b.x += b.vx * h
    b.y += b.vy * h
    // 發射道：力道不夠又掉回起點
    if (b.inLane) {
      if (b.x < LANE_X + BALL_R) {
        b.x = LANE_X + BALL_R
        b.vx = Math.abs(b.vx) * 0.4
      }
      if (b.x > RIGHT - BALL_R) {
        b.x = RIGHT - BALL_R
        b.vx = -Math.abs(b.vx) * 0.4
      }
      if (b.y < LANE_TOP - BALL_R) b.inLane = false
      else if (b.y > START.y && b.vy > 0) {
        events.push({ t: 'back' })
        return { events, done: true }
      }
    }
    // 圓頂
    if (b.y < DOME.y) {
      const dx = b.x - DOME.x
      const dy = b.y - DOME.y
      const d = Math.hypot(dx, dy)
      const lim = DOME.r - BALL_R
      if (d > lim) {
        const nx = dx / d
        const ny = dy / d
        b.x = DOME.x + nx * lim
        b.y = DOME.y + ny * lim
        const vn = b.vx * nx + b.vy * ny
        if (vn > 0) {
          b.vx -= (1 + 0.35) * vn * nx
          b.vy -= (1 + 0.35) * vn * ny
          if (vn > 0.5) events.push({ t: 'wall' })
        }
      }
    }
    // 兩邊的牆
    if (b.x < LEFT + BALL_R) {
      b.x = LEFT + BALL_R
      b.vx = Math.abs(b.vx) * 0.5
    }
    if (!b.inLane) {
      if (b.x > RIGHT - BALL_R) {
        b.x = RIGHT - BALL_R
        b.vx = -Math.abs(b.vx) * 0.5
      }
      // 隔板（從盤面這邊擋住，不會掉回發射道）
      if (b.y > LANE_TOP) {
        // 在隔板右邊掉下來＝力道不夠，掉回發射道
        if (b.x > LANE_X) b.inLane = true
        else if (b.x > LANE_X - BALL_R) {
          b.x = LANE_X - BALL_R
          b.vx = -Math.abs(b.vx) * 0.5
        }
      }
    }
    // 釘子
    if (!b.inLane) {
      for (const p of PINS) {
        const dx = b.x - p.x
        const dy = b.y - p.y
        const d = Math.hypot(dx, dy)
        const min = BALL_R + PIN_R
        if (d < min && d > 1e-6) {
          const nx = dx / d
          const ny = dy / d
          b.x = p.x + nx * min
          b.y = p.y + ny * min
          const vn = b.vx * nx + b.vy * ny
          if (vn < 0) {
            b.vx -= (1 + 0.5) * vn * nx
            b.vy -= (1 + 0.5) * vn * ny
            // 一點點亂數（釘子歪歪的）
            b.vx += (rnd() - 0.5) * 0.12
            events.push({ t: 'pin', speed: -vn })
          }
        }
      }
      // 杯子
      for (const p of POCKETS) {
        if (b.vy > 0 && Math.abs(b.x - p.x) < p.w / 2 - BALL_R * 0.3 && b.y > p.y - 0.004 && b.y < p.y + 0.03) {
          events.push({ t: 'pocket', pocket: p })
          return { events, done: true }
        }
      }
    }
    if (b.y > H - 0.03) {
      events.push({ t: 'out' })
      return { events, done: true }
    }
  }
  // 卡住太久（兩根釘子中間）：輕推一下
  const sp = Math.hypot(b.vx, b.vy)
  b.still = sp < 0.05 ? b.still + dt : 0
  if (b.still > 1.2) {
    b.vx += (rnd() - 0.5) * 0.6
    b.vy += 0.2
    b.still = 0
  }
  if (b.t > 14) {
    events.push({ t: 'out' })
    return { events, done: true }
  }
  return { events, done: false }
}

export const meritFor = (points: number) => (points >= 140 ? 3 : points >= 70 ? 2 : points >= 25 ? 1 : 0)
