// 夢境的機器人測試（不用瀏覽器）：npx tsx scripts/sim-dream.ts
//
// 每位客人的夢，用機器人照著版面設計好的路線（layout.route）走一遍，普通與「好夢」各跑幾個種子，
// 看做不做得完、花幾秒。也檢查：路線上的點沒有卡在道具裡、做夢的人沒有被推出地圖。

import { BOSS_HALF, BOSS_RANGE, dreamFor, startDream, stepDream, timeLeft, warmth, type DreamRT } from '../src/world/dream'
import { resolve, type Colliders } from '../src/world/collision'
import type { GuestId } from '../src/world/night/types'

const GUESTS: GuestId[] = ['xiaomei', 'linmom', 'agui', 'atu', 'zhang', 'ahao', 'xiaoyu', 'akai']
const DT = 1 / 30
const WALK = 2.5

type XZ = [number, number]

/** 格子 A*（0.4 公尺一格，道具往外膨脹 0.35）：機器人繞過積木、辦公桌 */
function findPath(c: Colliders, from: XZ, to: XZ): XZ[] {
  const S = 0.4
  const b = c.bounds
  const nx = Math.ceil((b.x1 - b.x0) / S)
  const nz = Math.ceil((b.z1 - b.z0) / S)
  const free = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= nx || j >= nz) return false
    const x = b.x0 + (i + 0.5) * S
    const z = b.z0 + (j + 0.5) * S
    if (x < b.x0 + 0.3 || x > b.x1 - 0.3 || z < b.z0 + 0.3 || z > b.z1 - 0.3) return false
    for (const r of c.rects) if (x > r.x0 - 0.35 && x < r.x1 + 0.35 && z > r.z0 - 0.35 && z < r.z1 + 0.35) return false
    for (const o of c.circles) if (Math.hypot(x - o.x, z - o.z) < o.r + 0.35) return false
    return true
  }
  const cell = ([x, z]: XZ): [number, number] => [Math.floor((x - b.x0) / S), Math.floor((z - b.z0) / S)]
  const [si, sj] = cell(from)
  const [ti, tj] = cell(to)
  const key = (i: number, j: number) => j * nx + i
  const g = new Map<number, number>([[key(si, sj), 0]])
  const prev = new Map<number, number>()
  const open: [number, number, number][] = [[0, si, sj]]
  while (open.length) {
    open.sort((a, b2) => a[0] - b2[0])
    const [, i, j] = open.shift()!
    if (i === ti && j === tj) break
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di
      const nj = j + dj
      if (!free(ni, nj) && !(ni === ti && nj === tj)) continue
      if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue
      const ng = g.get(key(i, j))! + (di && dj ? 1.414 : 1)
      if (ng >= (g.get(key(ni, nj)) ?? Infinity)) continue
      g.set(key(ni, nj), ng)
      prev.set(key(ni, nj), key(i, j))
      open.push([ng + Math.hypot(ti - ni, tj - nj), ni, nj])
    }
  }
  const out: XZ[] = [to]
  let k = prev.get(key(ti, tj))
  while (k !== undefined && k !== key(si, sj)) {
    out.unshift([b.x0 + ((k % nx) + 0.5) * S, b.z0 + (Math.floor(k / nx) + 0.5) * S])
    k = prev.get(k)
  }
  return out
}

function play(guest: GuestId, easy: boolean, seed: number) {
  const def = dreamFor(guest, easy)
  const rt: DreamRT = startDream(def, seed)
  const gm = { x: def.layout.spawn[0], z: def.layout.spawn[1], speed: 0 }
  const route = def.layout.route
  let wp = 0
  let path: XZ[] = []
  let pathFor = ''
  let ended: boolean | null = null
  let stuckT = 0
  let heard: XZ | null = null
  for (let i = 0; i < 90 / DT && ended === null; i++) {
    // 這一步要去哪
    let goal: XZ = route[def.mode === 'find' ? wp % route.length : Math.min(wp, route.length - 1)]
    if (def.mode === 'collect') {
      const left = rt.items.filter((it) => !it.got)
      const runner = left.find((it) => it.runner && Math.hypot(it.x - gm.x, it.z - gm.z) < 6)
      if (runner) goal = [runner.x, runner.z]
      else if (left.length) {
        left.sort((a, b) => Math.hypot(a.x - gm.x, a.z - gm.z) - Math.hypot(b.x - gm.x, b.z - gm.z))
        goal = [left[0].x, left[0].z]
      }
    }
    if (def.mode === 'find') {
      // 像玩家一樣：看到閃光（離目標 5 公尺內）就直接過去，不然翻最近一個還沒翻過的
      // 像玩家一樣：看到閃光（離目標 5 公尺內）就直接過去；聽到笑聲就去那附近找；不然翻最近一個還沒翻過的
      const s = rt.spots[rt.target]
      const [hx, hz] = heard ?? [gm.x, gm.z]
      if (warmth(rt, gm.x, gm.z) > 0) goal = [s.x, s.z]
      else {
        const fresh = rt.spots.filter((p) => rt.t - p.checkedAt > 12 && Math.hypot(p.x - gm.x, p.z - gm.z) > 1)
        fresh.sort((a, b) => Math.hypot(a.x - hx, a.z - hz) - Math.hypot(b.x - hx, b.z - hz))
        if (fresh.length) goal = [fresh[0].x, fresh[0].z]
      }
    }
    let target: XZ = goal
    // 陪走：做夢的人跟不上就回頭等他
    if (def.mode === 'escort' && Math.hypot(rt.dreamer.x - gm.x, rt.dreamer.z - gm.z) > 2.4) target = [rt.dreamer.x, rt.dreamer.z]
    const k = `${target[0].toFixed(1)},${target[1].toFixed(1)}`
    if (k !== pathFor) {
      path = findPath(rt.colliders, [gm.x, gm.z], target)
      pathFor = k
    }
    while (path.length > 1 && Math.hypot(path[0][0] - gm.x, path[0][1] - gm.z) < 0.3) path.shift()
    // 老闆看過來就站著不動
    let freeze = false
    if (rt.boss) {
      const dx = gm.x - rt.boss.x
      const dz = gm.z - rt.boss.z
      const a = Math.atan2(dx, dz) - rt.boss.heading
      if (Math.hypot(dx, dz) < BOSS_RANGE(easy) + 1.2 && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < BOSS_HALF(easy) + 0.3) freeze = true
    }
    const [tx, tz] = path[0] ?? target
    const dx = tx - gm.x
    const dz = tz - gm.z
    const d = Math.hypot(dx, dz)
    const ox = gm.x
    const oz = gm.z
    if (d > 0.05 && !freeze) {
      const step = Math.min(d, WALK * DT)
      gm.x += (dx / d) * step
      gm.z += (dz / d) * step
      resolve(gm, 0.3, rt.colliders)
    }
    gm.speed = Math.hypot(gm.x - ox, gm.z - oz) / DT
    if (!freeze && gm.speed < 0.2 * WALK && d > 0.5) stuckT += DT
    if (Math.hypot(goal[0] - gm.x, goal[1] - gm.z) < 0.35 && target === goal) wp++
    for (const e of stepDream(rt, DT, gm)) {
      if (e.t === 'end') ended = e.ok
      if (e.t === 'hint') heard = [e.x, e.z]
    }
  }
  const b = def.layout.bounds
  const out = rt.dreamer.x < b.x0 - 0.5 || rt.dreamer.x > b.x1 + 0.5 || rt.dreamer.z < b.z0 - 0.5 || rt.dreamer.z > b.z1 + 0.5
  return { ok: ended === true, used: def.duration - timeLeft(rt), stuck: stuckT, out, progress: rt.progress }
}

let problems = 0
for (const g of GUESTS) {
  const def = dreamFor(g)
  // 路線上的點不能在道具裡（不然機器人、玩家都到不了）
  const rt = startDream(def, 1)
  for (const [x, z] of def.layout.route) {
    const p = { x, z }
    resolve(p, 0.3, rt.colliders)
    if (Math.hypot(p.x - x, p.z - z) > 0.05) {
      console.log(`  !! ${g}: 路線點 (${x}, ${z}) 卡在道具裡`)
      problems++
    }
  }
  // 什麼都不做：一定要失敗（時間到醒來）
  {
    const idle = startDream(dreamFor(g), 5)
    let end: boolean | null = null
    for (let i = 0; i < 70 / DT && end === null; i++) for (const e of stepDream(idle, DT, { x: def.layout.spawn[0], z: def.layout.spawn[1], speed: 0 })) if (e.t === 'end') end = e.ok
    if (end !== false) {
      console.log(`  !! ${g}: 站著不動也${end ? '成功' : '沒結束'}`)
      problems++
    }
  }
  for (const easy of [false, true]) {
    const runs = [1, 2, 3, 4].map((s) => play(g, easy, s))
    const wins = runs.filter((r) => r.ok).length
    const used = runs.map((r) => r.used.toFixed(0)).join('/')
    const stuck = Math.max(...runs.map((r) => r.stuck))
    console.log(`${def.title.padEnd(14)} ${def.mode.padEnd(7)} ${easy ? '好夢' : '普通'}  成功 ${wins}/4  用掉 ${used} 秒  卡住最多 ${stuck.toFixed(1)} 秒`)
    if (runs.some((r) => r.out)) {
      console.log(`  !! ${g}: 做夢的人跑出地圖`)
      problems++
    }
    // 照著正解走應該要過（普通至少 3/4，好夢要全過）
    if (wins < (easy ? 4 : 3)) {
      console.log(`  !! ${g} ${easy ? '好夢' : '普通'}：正解路線只成功 ${wins}/4`)
      problems++
    }
  }
}
console.log(problems ? `\n${problems} problem(s)` : '\nall dreams OK')
process.exit(problems ? 1 : 0)
