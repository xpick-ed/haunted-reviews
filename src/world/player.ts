import { resolve, type Colliders } from './collision'

// 阿嬤（玩家）的位置與移動。每幀更新，不放在 zustand 裡（不需要觸發 React 重畫）。

/** 鏡頭看過來的方向（從目標指向鏡頭，已正規化）。CameraRig 與移動共用，畫面的上下左右才對得上。 */
export const VIEW = (() => {
  const x = 18.5
  const y = 13.2
  const z = 22
  const l = Math.hypot(x, y, z)
  return { x: x / l, y: y / l, z: z / l }
})()

/** 畫面「上」在地面上的方向（遠離鏡頭）與畫面「右」 */
const FWD = (() => {
  const l = Math.hypot(VIEW.x, VIEW.z)
  return { x: -VIEW.x / l, z: -VIEW.z / l }
})()
export const RIGHT = { x: -FWD.z, z: FWD.x }

export const RADIUS = 0.3
const WALK = 2.5
const DASH = 4.3
const ACCEL = 14

export const player = {
  x: 0,
  z: -4.8,
  vx: 0,
  vz: 0,
  /** 畫面上面向右（1）或左（-1） */
  facing: 1 as 1 | -1,
  speed: 0,
  dashing: false,
}

export function placePlayer(x: number, z: number) {
  player.x = x
  player.z = z
  player.vx = 0
  player.vz = 0
  player.speed = 0
}

/**
 * 依輸入更新位置。move 是畫面座標（x 右、y 上）。
 * 回傳這一幀實際移動的距離（衝刺扣陰氣用）。
 */
export function stepPlayer(dt: number, move: { x: number; y: number; dash: boolean }, colliders: Colliders, frozen: boolean): number {
  const want = frozen ? 0 : Math.min(1, Math.hypot(move.x, move.y))
  const top = move.dash && want > 0.1 ? DASH : WALK
  const tx = frozen ? 0 : (RIGHT.x * move.x + FWD.x * move.y) * top
  const tz = frozen ? 0 : (RIGHT.z * move.x + FWD.z * move.y) * top
  const k = 1 - Math.exp(-ACCEL * dt)
  player.vx += (tx - player.vx) * k
  player.vz += (tz - player.vz) * k

  const ox = player.x
  const oz = player.z
  // 分步移動，快的時候也不會穿牆
  const steps = Math.max(1, Math.ceil((Math.hypot(player.vx, player.vz) * dt) / 0.12))
  for (let i = 0; i < steps; i++) {
    player.x += (player.vx * dt) / steps
    player.z += (player.vz * dt) / steps
    resolve(player, RADIUS, colliders)
  }
  const moved = Math.hypot(player.x - ox, player.z - oz)
  if (dt > 1e-4) {
    player.vx = (player.x - ox) / dt
    player.vz = (player.z - oz) / dt
  }
  player.speed = moved / Math.max(dt, 1e-4)
  player.dashing = move.dash && player.speed > WALK + 0.3
  const side = player.vx * RIGHT.x + player.vz * RIGHT.z
  if (Math.abs(side) > 0.25) player.facing = side > 0 ? 1 : -1
  return moved
}
