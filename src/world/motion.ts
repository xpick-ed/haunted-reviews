// 角色與鏡頭的平滑運動：純函式，畫面元件與 scripts/sim-motion.ts（模擬測試）共用。

/** 把角度包到 -π..π */
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

export interface TurnState {
  heading: number
  /** 上一次轉的方向（+1／-1）。轉身接近 180° 時沿用，避免每幀左右搖擺 */
  dir: number
}

/** 平滑轉向目標角度。maxRate：每秒最多轉幾弧度（180° 約 0.25 秒） */
export function turnToward(s: TurnState, target: number, dt: number, rate = 10, maxRate = 13) {
  let dh = wrap(target - s.heading)
  if (Math.abs(dh) > Math.PI * 0.85) {
    // 幾乎正後方：最短路徑的方向會因為一點點誤差來回跳，改成維持上次的轉向
    dh = Math.abs(dh) * s.dir
  } else if (Math.abs(dh) > 0.02) {
    s.dir = Math.sign(dh)
  }
  const step = dh * (1 - Math.exp(-rate * dt))
  const cap = maxRate * dt
  s.heading = wrap(s.heading + Math.max(-cap, Math.min(cap, step)))
}

export interface BobState {
  phase: number
  /** 平滑過的速度 */
  speed: number
}

/**
 * 飄浮上下擺動。相位是累加的：頻率隨速度變，但相位不會跳。
 * （舊寫法 sin(總時間 × 頻率) 在頻率一變時，相位會瞬間跳一大段，角色就上下抖一下）
 */
export function floatBob(s: BobState, rawSpeed: number, dt: number, amp = 0.05) {
  s.speed += (rawSpeed - s.speed) * (1 - Math.exp(-8 * dt))
  const moving = Math.min(1, s.speed / 2.5)
  s.phase += dt * (2.2 + moving * 3)
  return Math.sin(s.phase) * amp
}

export interface FollowState {
  x: number
  y: number
  z: number
  /** 平滑過的角色速度（前看用） */
  vx: number
  vz: number
  /** 鏡頭目標點自己的速度（彈簧用） */
  cvx?: number
  cvy?: number
  cvz?: number
}

/**
 * 臨界阻尼彈簧（Unity 的 SmoothDamp）：位置、速度、加速度都連續，
 * 角色急轉身時鏡頭不會「頓」一下。smoothTime 約等於跟上所需的時間。
 */
export function smoothDamp(cur: number, target: number, vel: number, smoothTime: number, dt: number): [number, number] {
  const omega = 2 / smoothTime
  const x = omega * dt
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = cur - target
  const temp = (vel + omega * change) * dt
  const v = (vel - omega * temp) * e
  return [target + (change + temp) * e, v]
}

/** 鏡頭跟隨的目標點：跟著角色、往移動方向前看一點 */
export function followTarget(s: FollowState, px: number, py: number, pz: number, pvx: number, pvz: number, dt: number, lookAhead: number, snap: boolean, smoothTime = 0.32) {
  const kv = snap ? 1 : 1 - Math.exp(-3 * dt)
  s.vx += (pvx - s.vx) * kv
  s.vz += (pvz - s.vz) * kv
  const wx = px + s.vx * lookAhead
  const wz = pz + s.vz * lookAhead
  if (snap) {
    s.x = wx
    s.y = py
    s.z = wz
    s.cvx = s.cvy = s.cvz = 0
    return
  }
  ;[s.x, s.cvx] = smoothDamp(s.x, wx, s.cvx ?? 0, smoothTime, dt)
  ;[s.y, s.cvy] = smoothDamp(s.y, py, s.cvy ?? 0, smoothTime, dt)
  ;[s.z, s.cvz] = smoothDamp(s.z, wz, s.cvz ?? 0, smoothTime, dt)
}
