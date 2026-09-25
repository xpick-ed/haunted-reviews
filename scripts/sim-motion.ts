/**
 * 移動手感的模擬測試：用真的移動與碰撞程式（src/world/player.ts），
 * 以 60fps（含 ±25% 的幀時間抖動）和 30fps 跑一段「換方向、急轉身」的輸入，
 * 比較舊寫法與新寫法（src/world/motion.ts）的抖動指標。
 *
 * 執行：npx --yes tsx scripts/sim-motion.ts
 */
import { placePlayer, player, stepPlayer } from '../src/world/player'
import { HOME } from '../src/world/scenes'
import { floatBob, followTarget, turnToward, wrap, type BobState, type FollowState, type TurnState } from '../src/world/motion'

type Input = { x: number; y: number; dash: boolean }
// 畫面座標：x 右、y 上
const SCRIPT: [number, Input][] = [
  [1.0, { x: 1, y: 0, dash: false }], // 往右
  [1.0, { x: 0, y: 1, dash: false }], // 轉 90° 往上
  [0.6, { x: -1, y: 0, dash: false }], // 轉 90° 往左
  [0.6, { x: 1, y: 0, dash: false }], // 180° 急轉身
  [0.6, { x: -1, y: 0, dash: false }], // 再 180°
  [0.7, { x: 0.707, y: 0.707, dash: false }], // 斜走
  [0.5, { x: -0.707, y: -0.707, dash: false }], // 斜的 180°
  [0.6, { x: 0, y: 0, dash: false }], // 停
]

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

interface Metrics {
  /** 飄浮的最大垂直速度（m/s）。正常擺動最多約 0.26 */
  bobMaxVel: number
  /** 垂直速度超過 0.5 m/s 的幀數（上下抖一下） */
  bobSpikes: number
  /** 轉身時角速度正負號來回換的次數（左右搖擺） */
  headingWobble: number
  /** 轉身期間的最大角速度（rad/s） */
  headingMaxRate: number
  /** 鏡頭目標點的最大加速度（m/s²）。急轉身本來就要比較大的加速度，這個只是參考 */
  camMaxAccel: number
  /** 鏡頭加速度在相鄰兩幀之間最大跳多少（m/s²）。這個大才是鏡頭「頓」一下 */
  camJump: number
  /** 180° 急轉身轉到剩 10° 以內要幾秒 */
  turn180: number
}

let lastH = 0
const h_ = (_mode: string) => lastH

function run(mode: 'old' | 'new', fps: number, jitter: number): Metrics {
  const r = rng(7)
  placePlayer(0, 3)
  const T0 = 60 // 頁面已經開了 60 秒（舊寫法用總時間算相位）
  let t = 0
  let prevY: number | null = null
  let prevH: number | null = null
  let prevRate = 0
  const m: Metrics = { bobMaxVel: 0, bobSpikes: 0, headingWobble: 0, headingMaxRate: 0, camMaxAccel: 0, camJump: 0, turn180: 0 }
  let camAcc: [number, number] | null = null
  const cam: FollowState = { x: 0, y: 1, z: 3, vx: 0, vz: 0 }
  let camPrev: [number, number] | null = null
  let camVel: [number, number] | null = null
  let segStart = 0
  let segTarget: number | null = null
  let segDone = false
  // 舊：朝向跟著實際速度、最短角度；飄浮 sin(總時間 × 頻率)
  let oldHeading = 0.7
  // 新
  const turn: TurnState = { heading: 0.7, dir: 1 }
  const bob: BobState = { phase: 0, speed: 0 }
  let target = 0.7

  for (const [si, [dur, inp]] of SCRIPT.entries()) {
    const end = t + dur
    segStart = t
    segTarget = si === 3 ? null : -1 // 只量第 4 段（往右→往左的 180° 急轉身）
    segDone = false
    while (t < end) {
      const dt = (1 / fps) * (1 + (r() * 2 - 1) * jitter)
      t += dt
      stepPlayer(dt, inp, HOME.colliders, false)

      let y: number
      let h: number
      if (mode === 'old') {
        const moving = Math.min(1, player.speed / 2.5)
        y = Math.sin((T0 + t) * (2.2 + moving * 3)) * 0.05
        if (Math.hypot(player.vx, player.vz) > 0.25) {
          const target = Math.atan2(player.vx, player.vz)
          const dh = wrap(target - oldHeading)
          oldHeading = wrap(oldHeading + dh * (1 - Math.exp(-10 * dt)))
        }
        h = oldHeading
      } else {
        lastH = turn.heading
        y = floatBob(bob, player.speed, dt)
        if (player.wantX || player.wantZ) target = Math.atan2(player.wantX, player.wantZ)
        turnToward(turn, target, dt)
        h = turn.heading
      }

      // 鏡頭
      if (mode === 'old') {
        // 舊：一階跟隨
        const kv = 1 - Math.exp(-3 * dt)
        cam.vx += (player.vx - cam.vx) * kv
        cam.vz += (player.vz - cam.vz) * kv
        const k = 1 - Math.exp(-4 * dt)
        cam.x += (player.x + cam.vx * 0.35 - cam.x) * k
        cam.z += (player.z + cam.vz * 0.35 - cam.z) * k
      } else {
        followTarget(cam, player.x, 1, player.z, player.vx, player.vz, dt, 0.3, false)
      }
      if (camPrev) {
        const v: [number, number] = [(cam.x - camPrev[0]) / dt, (cam.z - camPrev[1]) / dt]
        if (camVel) {
          const a: [number, number] = [(v[0] - camVel[0]) / dt, (v[1] - camVel[1]) / dt]
          m.camMaxAccel = Math.max(m.camMaxAccel, Math.hypot(a[0], a[1]))
          if (camAcc) m.camJump = Math.max(m.camJump, Math.hypot(a[0] - camAcc[0], a[1] - camAcc[1]))
          camAcc = a
        }
        camVel = v
      }
      camPrev = [cam.x, cam.z]
      // 180° 轉身花多久
      if (segTarget === null && (player.wantX || player.wantZ)) segTarget = Math.atan2(player.wantX, player.wantZ)
      if (segTarget !== null && segTarget !== -1 && !segDone && Math.abs(wrap(h_(mode) - segTarget)) < 0.17) {
        m.turn180 = t - segStart
        segDone = true
      }

      if (prevY !== null) {
        const v = Math.abs(y - prevY) / dt
        m.bobMaxVel = Math.max(m.bobMaxVel, v)
        if (v > 0.5) m.bobSpikes++
      }
      if (prevH !== null) {
        const rate = wrap(h - prevH) / dt
        if (Math.abs(rate) > 0.3) {
          m.headingMaxRate = Math.max(m.headingMaxRate, Math.abs(rate))
          if (Math.abs(prevRate) > 0.3 && Math.sign(rate) !== Math.sign(prevRate)) m.headingWobble++
        }
        prevRate = rate
      }
      prevY = y
      prevH = h
      lastH = h
    }
  }
  return m
}

const fmt = (m: Metrics) =>
  `飄浮最大垂直速度 ${m.bobMaxVel.toFixed(2)} m/s，上下抖 ${m.bobSpikes} 幀；轉身左右搖擺 ${m.headingWobble} 次，` +
  `最大角速度 ${m.headingMaxRate.toFixed(1)} rad/s，180° 轉身 ${m.turn180.toFixed(2)} 秒；鏡頭最大加速度 ${m.camMaxAccel.toFixed(1)} m/s²、相鄰幀最大跳動 ${m.camJump.toFixed(1)} m/s²`

let fail = false
for (const [fps, jitter] of [
  [60, 0],
  [60, 0.25],
  [30, 0.35],
] as const) {
  const o = run('old', fps, jitter)
  const n = run('new', fps, jitter)
  console.log(`\n=== ${fps}fps（幀時間${jitter ? `抖動 ±${jitter * 100}%` : '穩定'}）===`)
  console.log(`舊：${fmt(o)}`)
  console.log(`新：${fmt(n)}`)
  if (n.bobSpikes > 0 || n.headingWobble > 0 || n.headingMaxRate > 14 || n.turn180 > 0.5 || n.camJump > (jitter ? 10 : 3)) fail = true
}
console.log(fail ? '\n✗ 新寫法還有抖動' : '\n✓ 新寫法：沒有上下抖、轉身沒有左右搖擺')
process.exit(fail ? 1 : 0)
