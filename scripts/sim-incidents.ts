// 半夜突發事件的機器人測試（不用瀏覽器）：npx tsx scripts/sim-incidents.ts
//
// 每一種事件跑兩次：
//   不管它  阿嬤整晚不在家 → 應該失敗（東西被偷、客人走丟、醉漢唱整晚……）
//   處理它  簡單的機器人照著提示做 → 應該解決
// 另外檢查：第 1、2 晚沒有事件、廟公的晚上沒有、大約一半的晚上有。

import { NightSim, type GrandmaState } from '../src/world/night/sim'
import { planNight, type NightPlan } from '../src/world/night/plan'
import { BED_NODE, NODES, route } from '../src/world/night/nav'
import { GUEST_ROOMS } from '../src/scene/layout'
import { Drunk, FUSE_BOX, Fuse, LostChild, LOST_SPOTS, Sleepwalk, Thief, makeIncident, pickIncident, type IncidentKind, type IncidentRT } from '../src/world/night/incidents'
import type { GuestId } from '../src/world/night/types'

const HOURS_PER_SEC = 1 / 37.5
const DT = 0.1
type XZ = [number, number]

const PLAN: NightPlan = {
  parties: [
    { room: 'r1', members: ['linmom', 'xiaoyu'] },
    { room: 'r2', members: ['zhang'] },
  ],
  event: 'none',
}

/** 機器人：沿著點列走（像玩家一樣有速度，不瞬移） */
class Bot {
  gm: GrandmaState = { x: -9.5, z: 5.5, speed: 0, busy: false, carrying: false, home: true, walkFactor: 1 }
  path: XZ[] = []
  goTo(p: XZ[]) {
    this.path = p.slice()
  }
  step(dt: number, speed = 2.3) {
    this.gm.speed = 0
    let left = speed * dt
    while (left > 0 && this.path.length) {
      const [tx, tz] = this.path[0]
      const d = Math.hypot(tx - this.gm.x, tz - this.gm.z)
      if (d < 1e-3) {
        this.path.shift()
        continue
      }
      const s = Math.min(d, left)
      this.gm.x += ((tx - this.gm.x) / d) * s
      this.gm.z += ((tz - this.gm.z) / d) * s
      left -= s
      this.gm.speed = speed
      if (s >= d) this.path.shift()
    }
  }
}

function nearestNode(x: number, z: number) {
  let best = 'yardC'
  let bd = Infinity
  for (const [k, [nx, nz]] of Object.entries(NODES)) {
    const d = Math.hypot(nx - x, nz - z)
    if (d < bd) {
      bd = d
      best = k
    }
  }
  return best
}

interface Run {
  inc: IncidentRT
  sim: NightSim
  comfort: Record<string, number>
  merit: number
}

function run(kind: IncidentKind, handle: boolean): Run {
  const sim = new NightSim(PLAN, { seed: 11, upgrades: [] })
  const inc = makeIncident(sim, kind, 5)!
  sim.plugins.push(inc)
  const bot = new Bot()
  if (!handle) bot.gm.home = false
  let merit = 0
  let hour = 22
  let fixedFuse = false
  let led = false
  let searchI = 0
  while (hour < 30) {
    hour += DT * HOURS_PER_SEC
    if (handle) botThink(kind, inc, sim, bot, hour, { fixedFuse, led, searchI })
    // 一些狀態從 botThink 回寫
    if (inc instanceof Fuse && handle && !fixedFuse && inc.blown && Math.hypot(bot.gm.x - FUSE_BOX.standX, bot.gm.z - FUSE_BOX.standZ) < 0.5) {
      inc.fix(12)
      fixedFuse = true
    }
    if (inc instanceof LostChild && handle && inc.mode === 'hide' && !bot.path.length) searchI = Math.min(searchI + 1, LOST_SPOTS.length - 1)
    if ((inc instanceof Sleepwalk && inc.mode === 'follow') || (inc instanceof LostChild && inc.mode === 'follow')) led = true
    // 夢遊：把其他客人照顧好、讓他們睡熟、不起夜（只測夢遊本身；不然起夜的人看到阿嬤一尖叫，夢遊的人就被吵醒了）
    if (kind === 'sleepwalk' && inc instanceof Sleepwalk) {
      for (const g of sim.guests) {
        if (g.id === inc.guestId) continue
        g.needs = []
        g.tripsDone = 99
        if (!g.awake) g.deepUntil = 31
      }
    }
    bot.step(DT)
    const ev = sim.update(DT, hour, bot.gm, {})
    for (const e of ev) if (e.t === 'custom' && e.kind === 'incident.reward') merit += (e.data as { merit: number }).merit
    ;(botState as { searchI: number }).searchI = searchI
  }
  const comfort: Record<string, number> = {}
  for (const g of sim.guests) comfort[g.id] = Math.round(g.comfort)
  return { inc, sim, comfort, merit }
}

const botState = { searchI: 0 }

function botThink(kind: IncidentKind, inc: IncidentRT, sim: NightSim, bot: Bot, hour: number, st: { fixedFuse: boolean; led: boolean; searchI: number }) {
  const idle = !bot.path.length
  if (kind === 'thief' && inc instanceof Thief) {
    // 在埕中間等：小偷一靠近就被看到
    if (idle && inc.status === 'active' && Math.hypot(bot.gm.x - NODES.yardC[0], bot.gm.z - NODES.yardC[1]) > 0.3) bot.goTo([NODES.yardC])
    if (idle && inc.bag && !inc.bag.returned) {
      if (Math.hypot(bot.gm.x - inc.bag.x, bot.gm.z - inc.bag.z) < 1) inc.returnBag()
      else bot.goTo([[inc.bag.x, inc.bag.z]])
    }
  }
  if (kind === 'drunk' && inc instanceof Drunk) {
    if (idle && inc.status === 'active' && Math.hypot(bot.gm.x - inc.x, bot.gm.z - (inc.z - 1.2)) > 0.3) bot.goTo([NODES.yardFront, [0.2, 7.9], [inc.x, inc.z - 1.2]])
  }
  if (kind === 'fuse' && inc instanceof Fuse) {
    if (idle && inc.blown) bot.goTo([NODES.yardL, [-6.5, 6.95], [FUSE_BOX.standX, FUSE_BOX.standZ]])
  }
  if (kind === 'sleepwalk' && inc instanceof Sleepwalk) {
    const g = sim.guests.find((x) => x.id === inc.guestId)!
    if (inc.status !== 'active') return
    if (inc.mode === 'wander' || inc.mode === 'pause') {
      // 擋在他前面 0.6 公尺
      const ahead: XZ = [g.x + Math.sin(g.heading) * 0.6, g.z + Math.cos(g.heading) * 0.6]
      bot.goTo([ahead])
    } else if (inc.mode === 'follow') {
      // 帶他回床上：慢慢走，他落後太多就等
      const lag = Math.hypot(g.x - bot.gm.x, g.z - bot.gm.z)
      if (idle) bot.goTo(route(nearestNode(bot.gm.x, bot.gm.z), BED_NODE[g.room]).concat([GUEST_ROOMS[g.room].bedside]))
      if (lag > 2.4) bot.path = []
      else if (!bot.path.length) bot.goTo(route(nearestNode(bot.gm.x, bot.gm.z), BED_NODE[g.room]).concat([GUEST_ROOMS[g.room].bedside]))
    }
  }
  if (kind === 'lost' && inc instanceof LostChild) {
    const g = sim.guests.find((x) => x.id === 'xiaoyu')!
    if (inc.status !== 'active') return
    if (inc.mode === 'hide' && idle) {
      // 照順序一個一個躲藏點找（聽到笑聲就知道在附近，這裡簡化成挨個找）
      const s = LOST_SPOTS[botState.searchI]
      bot.goTo(route(nearestNode(bot.gm.x, bot.gm.z), s.node).concat([s.at]))
    } else if (inc.mode === 'follow') {
      const lag = Math.hypot(g.x - bot.gm.x, g.z - bot.gm.z)
      if (lag > 2.2) bot.path = []
      else if (!bot.path.length) bot.goTo(route(nearestNode(bot.gm.x, bot.gm.z), BED_NODE[g.room]).concat([GUEST_ROOMS[g.room].bedside]))
    }
  }
  void hour
  void st
}

// ---------------------------------------------------------------------------

let failed = 0
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '!!'} ${msg}`)
  if (!ok) failed++
}

const KINDS: IncidentKind[] = ['thief', 'sleepwalk', 'lost', 'drunk', 'fuse']
for (const kind of KINDS) {
  botState.searchI = 0
  const ignore = run(kind, false)
  botState.searchI = 0
  const handled = run(kind, true)
  console.log(`\n== ${kind}`)
  console.log(`  不管它：${ignore.inc.status}「${ignore.inc.outcome}」 comfort=${JSON.stringify(ignore.comfort)}`)
  console.log(`  處理它：${handled.inc.status}「${handled.inc.outcome}」 comfort=${JSON.stringify(handled.comfort)} merit=+${handled.merit}`)
  check(ignore.inc.status === 'failed', '不管它就失敗')
  check(handled.inc.status === 'resolved', '處理它就解決')
  check(handled.merit > 0, '解決有功德')
  // 處理了，客人的舒適不該比不管它還差
  const sum = (r: Run) => Object.values(r.comfort).reduce((a, b) => a + b, 0)
  check(sum(handled) >= sum(ignore), `處理了客人比較舒服（${sum(handled)} ≥ ${sum(ignore)}）`)
  if (kind === 'thief' && handled.inc instanceof Thief) check(!handled.inc.stolen, '東西沒被偷（或還回去了）')
  if (kind === 'fuse' && handled.inc instanceof Fuse) check(!handled.inc.blown, '電修好了')
  if (kind === 'sleepwalk' || kind === 'lost') {
    const id = (handled.inc instanceof Sleepwalk ? handled.inc.guestId : 'xiaoyu') as GuestId
    const g = handled.sim.guests.find((x) => x.id === id)!
    check(g.mode === 'bed', `${id} 天亮時在床上`)
  }
  const notes = Object.keys(handled.sim.reviewNotes).length + Object.keys(ignore.sim.reviewNotes).length
  check(notes > 0, '評論有附註')
}

// 每晚的抽選
console.log('\n== 每晚抽到的事件')
const counts: Record<string, number> = {}
let early = 0
let mg = 0
for (let n = 1; n <= 60; n++) {
  const plan = planNight(n, 30, 20, n % 11 === 0 ? 3 : 0)
  const sim = new NightSim(plan, { seed: n, upgrades: [] })
  const k = pickIncident(sim, plan, n)
  counts[k ?? 'none'] = (counts[k ?? 'none'] ?? 0) + 1
  if (n < 3 && k) early++
  if (plan.event === 'miaogong' && k) mg++
}
console.log(' ', JSON.stringify(counts))
check(early === 0, '第 1、2 晚沒有事件')
check(mg === 0, '廟公來的晚上沒有事件')
const some = 60 - (counts.none ?? 0)
check(some > 15 && some < 45, `大約一半的晚上有事件（${some}/60）`)

console.log(failed ? `\n${failed} problem(s)` : '\nall incidents OK')
process.exit(failed ? 1 : 0)
