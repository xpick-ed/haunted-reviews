// 大人的恐怖（冥婚、凶宅夜）的機器人測試（不用瀏覽器）：npx tsx scripts/sim-horror.ts
//
// 每一件跑兩次：
//   不管它  阿嬤整晚不在家 → 應該失敗（冥婚：03:00 客人嚇壞；凶宅：敲到 04:30）
//   處理它  簡單的機器人照著提示做（走到旁邊才「說話」「撿東西」，跟熱點的距離一樣）→ 應該化解
// 另外檢查：Node 裡成人內容是關的（createHorror 一定是 null）、第 5／6 晚以前沒有、
// 不會找上小孩（或有小孩的房間）、化解過的不會再來、大約多少晚上有。

import { NightSim, type GrandmaState } from '../src/world/night/sim'
import { planNight, type NightPlan } from '../src/world/night/plan'
import { NODES, route } from '../src/world/night/nav'
import { GUESTS } from '../src/world/night/guests'
import {
  BRIDE_TIME,
  CLUE_IDS,
  CLUES,
  GhostWedding,
  HAUNT,
  HORROR_DONE,
  HORROR_FROM,
  HauntedRoom,
  PIN_SPOTS,
  createHorror,
  makeHorror,
  pickHorror,
  type HorrorRT,
} from '../src/world/night/horror'
import type { Meta } from '../src/world/night/director'
import type { GuestId } from '../src/world/night/types'

const HOURS_PER_SEC = 1 / 37.5
const DT = 0.1
type XZ = [number, number]

/** 熱點的半徑（src/world/horrorStory.ts） */
const R_BRIDE = 1.6
const R_PIN = 1.3
const R_SPIRIT = 1.7
const R_CLUE = 1.25
const SPIRIT_SPOT: XZ = [HAUNT.spirit.x + 0.5, HAUNT.spirit.z - 0.3]

class Bot {
  gm: GrandmaState = { x: 0, z: 1.4, speed: 0, busy: false, carrying: false, home: true, walkFactor: 1 }
  path: XZ[] = []
  /** 走到某一點：先走路點，最後直線走過去 */
  goTo(p: XZ) {
    this.path = route(nearestNode(this.gm.x, this.gm.z), nearestNode(p[0], p[1])).concat([p])
  }
  near(p: XZ, r: number) {
    return Math.hypot(this.gm.x - p[0], this.gm.z - p[1]) < r - 0.1
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
  ev: HorrorRT
  sim: NightSim
  fear: Record<string, number>
  /** 整晚最怕的時候 */
  peak: Record<string, number>
  comfort: Record<string, number>
  merit: number
  story: string[]
  lines: string[]
  /** 化解那一刻敲了幾次、最後敲了幾次（化解以後不該再敲） */
  knocksAtEnd: number
  knocks: number
  scolded: boolean
}

function run(plan: NightPlan, pick: Parameters<typeof makeHorror>[1], handle: boolean, opts: { scold?: boolean; seed?: number } = {}): Run {
  const sim = new NightSim(plan, { seed: 11, upgrades: [] })
  const ev = makeHorror(sim, pick, opts.seed ?? 5)!
  sim.plugins.push(ev)
  // 只測恐怖事件本身：客人不會有別的需求、不起夜
  for (const g of sim.guests) {
    g.needs = []
    g.tripsDone = 99
  }
  const bot = new Bot()
  // 不管它：阿嬤不在家。處理它：阿嬤小心不被看到（只測事件本身，不測被客人看到的驚嚇）
  if (!handle) bot.gm.home = false
  else bot.gm.hidden = true
  const peak: Record<string, number> = {}
  let merit = 0
  const story: string[] = []
  const lines: string[] = []
  let knocksAtEnd = -1
  let scolded = false
  let hour = 22
  while (hour < 30) {
    hour += DT * HOURS_PER_SEC
    for (const g of sim.guests) g.needs = []
    const was = ev.status
    if (handle && ev.active) {
      const idle = !bot.path.length
      if (ev instanceof GhostWedding && ev.phase !== 'wait') {
        const at: XZ = [ev.x, ev.z]
        if (!ev.wish) {
          // 走到她旁邊說話（她在走，就一直追）
          if (bot.near(at, R_BRIDE)) {
            if (opts.scold && !scolded) {
              ev.scold()
              scolded = true
            } else ev.learnWish()
          } else if (idle || Math.hypot(bot.path[bot.path.length - 1][0] - ev.x, bot.path[bot.path.length - 1][1] - ev.z) > 1) bot.goTo(at)
        } else if (!ev.pinFound) {
          const p = PIN_SPOTS[ev.pinSpot]
          if (bot.near([p.x, p.z], R_PIN)) ev.takePin()
          else if (idle) bot.goTo([p.x, p.z])
        } else {
          if (bot.near(at, R_BRIDE)) ev.givePin()
          else if (idle) bot.goTo(at)
        }
      }
      if (ev instanceof HauntedRoom) {
        const next = CLUE_IDS.find((c) => !ev.found.has(c))
        if (next) {
          const c = CLUES[next]
          if (bot.near([c.x, c.z], R_CLUE)) ev.find(next)
          else if (idle) bot.goTo([c.x, c.z])
        } else if (bot.near(SPIRIT_SPOT, R_SPIRIT)) {
          ev.meet()
          ev.free()
        } else if (idle) bot.goTo(SPIRIT_SPOT)
      }
    }
    bot.step(DT)
    const out = sim.update(DT, hour, bot.gm, {})
    for (const e of out) {
      if (e.t !== 'custom') continue
      if (e.kind === 'horror.reward') {
        const d = e.data as { merit: number; story?: string }
        merit += d.merit
        if (d.story) story.push(d.story)
      }
      if (e.kind === 'line') lines.push((e.data as { id: string }).id)
    }
    if (was === 'active' && ev.status !== 'active' && ev instanceof HauntedRoom) knocksAtEnd = ev.knocks
    for (const g of sim.guests) peak[g.id] = Math.max(peak[g.id] ?? 0, Math.round(g.fear))
  }
  const fear: Record<string, number> = {}
  const comfort: Record<string, number> = {}
  for (const g of sim.guests) {
    fear[g.id] = Math.round(g.fear)
    comfort[g.id] = Math.round(g.comfort)
  }
  return { ev, sim, fear, peak, comfort, merit, story, lines, knocksAtEnd, knocks: ev instanceof HauntedRoom ? ev.knocks : 0, scolded }
}

// ---------------------------------------------------------------------------

let failed = 0
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '!!'} ${msg}`)
  if (!ok) failed++
}

// ---------- 冥婚 ----------
const WED_PLAN: NightPlan = {
  parties: [
    { room: 'r1', members: ['ahao'] },
    { room: 'r2', members: ['xiaomei'] },
  ],
  event: 'none',
}
{
  const ignore = run(WED_PLAN, { kind: 'wedding', guest: 'ahao' }, false)
  const handled = run(WED_PLAN, { kind: 'wedding', guest: 'ahao' }, true)
  const scold = run(WED_PLAN, { kind: 'wedding', guest: 'ahao' }, true, { scold: true })
  const w0 = ignore.ev as GhostWedding
  const w1 = handled.ev as GhostWedding
  console.log('\n== 冥婚（阿豪撿到紅包）')
  console.log(`  不管它：${w0.status}「${w0.outcome}」 fear=${JSON.stringify(ignore.fear)}`)
  console.log(`  處理它：${w1.status}「${w1.outcome}」 玉簪在 ${w1.pinSpot} fear=${JSON.stringify(handled.fear)} merit=+${handled.merit}`)
  console.log(`  先兇她：${scold.ev.status} peak=${JSON.stringify(scold.peak)}（處理它 peak=${JSON.stringify(handled.peak)}、不管它 peak=${JSON.stringify(ignore.peak)}）`)
  check(w0.status === 'failed', '不管它就失敗')
  check(ignore.fear.ahao >= 40, `不管它：阿豪嚇壞了（驚嚇 ${ignore.fear.ahao} ≥ 40）`)
  check(ignore.lines.includes('hor.scream.ahao'), '她走到門口時阿豪尖叫')
  check(ignore.lines.includes('hor.bride.appear'), '鬼新娘出現時有台詞')
  check(!!ignore.sim.reviewNotes.ahao?.includes('紅嫁衣'), '失敗的評論附註提到紅嫁衣的女人')
  check(!ignore.sim.reviewNotes.xiaomei, '只找上撿紅包的人（小美沒事）')
  check(w1.status === 'resolved', '處理它就化解')
  check(handled.merit >= 3, '化解有功德')
  check(handled.story.includes(HORROR_DONE.wedding), '化解後記進 meta.story（不會再來）')
  check(handled.fear.ahao < ignore.fear.ahao, `處理了阿豪比較不怕（${handled.fear.ahao} < ${ignore.fear.ahao}）`)
  check(!!handled.sim.reviewNotes.ahao?.includes('謝謝'), '化解的評論附註（門外說謝謝）')
  check(handled.fear.xiaomei === ignore.fear.xiaomei, '別的客人不受影響')
  check(scold.scolded && scold.ev.status === 'resolved', '先兇她一次，再好好問，還是可以化解')
  check(scold.peak.ahao > handled.peak.ahao, `兇她：她哭，阿豪更怕（最怕的時候 ${scold.peak.ahao} > ${handled.peak.ahao}）`)
}
// 兩個玉簪的位置都要能在 03:00 前化解
for (const spot of ['jar', 'altar'] as const) {
  let seed = 1
  for (; seed < 100; seed++) {
    const sim = new NightSim(WED_PLAN, { seed: 11, upgrades: [] })
    if ((makeHorror(sim, { kind: 'wedding', guest: 'ahao' }, seed) as GhostWedding).pinSpot === spot) break
  }
  const r = run(WED_PLAN, { kind: 'wedding', guest: 'ahao' }, true, { seed })
  const w = r.ev as GhostWedding
  check(w.pinSpot === spot && w.status === 'resolved', `玉簪在 ${spot}：找得到、還得回去（${w.status}）`)
}
check(BRIDE_TIME.deadline - BRIDE_TIME.start >= 2, '從出現到 03:00 至少兩個小時（遊戲時間）')

// ---------- 凶宅夜 ----------
const HAUNT_PLAN: NightPlan = {
  parties: [
    { room: 'r1', members: ['linmom', 'xiaoyu'] },
    { room: 'r2', members: ['zhang'] },
  ],
  event: 'none',
}
{
  const ignore = run(HAUNT_PLAN, { kind: 'haunt' }, false)
  const handled = run(HAUNT_PLAN, { kind: 'haunt' }, true)
  const h0 = ignore.ev as HauntedRoom
  const h1 = handled.ev as HauntedRoom
  console.log('\n== 凶宅夜（客房二：張先生）')
  console.log(`  不管它：${h0.status}「${h0.outcome}」 敲了 ${ignore.knocks} 次 fear=${JSON.stringify(ignore.fear)} woken=${ignore.sim.guests.find((g) => g.id === 'zhang')?.wokenCount}`)
  console.log(`  處理它：${h1.status}「${h1.outcome}」 化解時敲了 ${handled.knocksAtEnd} 次、最後 ${handled.knocks} 次 fear=${JSON.stringify(handled.fear)} merit=+${handled.merit}`)
  check(h0.status === 'failed', '不管它就失敗')
  check(ignore.knocks >= 8, `不管它：敲了一整晚（${ignore.knocks} 次）`)
  check(!!ignore.sim.reviewNotes.zhang, '失敗的評論附註（床頭的牆在敲）')
  check(!ignore.sim.reviewNotes.linmom && !ignore.sim.reviewNotes.xiaoyu, '客房一（有小孩）不會有凶宅的附註')
  check(h1.status === 'resolved', '處理它就化解')
  check(handled.merit >= 4, '化解有功德')
  check(handled.story.includes(HORROR_DONE.haunt), '化解後記進 meta.story（敲牆聲永遠停了）')
  check(handled.knocks === handled.knocksAtEnd, '化解以後不再敲')
  check(handled.peak.zhang < ignore.peak.zhang, `處理了張先生比較不怕（最怕的時候 ${handled.peak.zhang} < ${ignore.peak.zhang}）`)
  check((ignore.fear.xiaoyu ?? 0) === (handled.fear.xiaoyu ?? 0), '小宇不受影響（敲牆聲傳不到客房一）')
  // 線索沒找齊就「轉告」沒有用
  const sim = new NightSim(HAUNT_PLAN, { seed: 3, upgrades: [] })
  const h = makeHorror(sim, { kind: 'haunt' }, 9) as HauntedRoom
  sim.plugins.push(h)
  const gm: GrandmaState = { x: 0, z: 0, speed: 0, busy: false, carrying: false, home: false, walkFactor: 1 }
  sim.update(DT, HAUNT.start + 0.01, gm, {})
  h.find('diary')
  h.free()
  check(h.active, '線索沒找齊，轉告沒有用（還在）')
  h.find('diary')
  check(h.found.size === 1, '同一個線索不會算兩次')
}

// ---------- 抽選 ----------
console.log('\n== 每晚抽到的')
const meta = (night: number): Meta => ({ night, warm: 30, spooky: 20, pressure: 0, story: [] }) as unknown as Meta
{
  const sim = new NightSim(WED_PLAN, { seed: 1, upgrades: [] })
  check(createHorror(sim, WED_PLAN, meta(9)) === null, 'Node 裡成人內容是關的：createHorror 永遠是 null')
}
const counts: Record<string, number> = { wedding: 0, haunt: 0, none: 0 }
let early = 0
let kid = 0
let eligibleWed = 0
let eligibleHaunt = 0
let doneAgain = 0
const N = 400
for (let n = 1; n <= N; n++) {
  const plan = planNight(n, 30, 20, 0, { adult: true })
  const p = pickHorror(n, plan, [])
  counts[p?.kind ?? 'none']++
  if (p && n < HORROR_FROM[p.kind]) early++
  if (p?.kind === 'wedding') {
    const party = plan.parties.find((x) => x.members.includes(p.guest!))!
    if (party.members.some((id) => GUESTS[id]?.type === 'child')) kid++
  }
  if (p?.kind === 'haunt') {
    const r2 = plan.parties.find((x) => x.room === 'r2')
    if (!r2 || r2.members.some((id) => GUESTS[id]?.type === 'child')) kid++
  }
  if (n >= 6 && plan.event !== 'miaogong' && plan.parties.some((x) => x.room === 'r2' && !x.members.some((id) => GUESTS[id]?.type === 'child'))) eligibleHaunt++
  if (n >= 5 && plan.event !== 'miaogong' && plan.parties.some((x) => !x.members.some((id) => GUESTS[id]?.type === 'child') && x.members.some((id) => (['ahao', 'zhiwei', 'zhang', 'ajie', 'mrwang', 'zhiming'] as GuestId[]).includes(id))))
    eligibleWed++
  if (p && pickHorror(n, plan, [HORROR_DONE.wedding, HORROR_DONE.haunt])) doneAgain++
}
console.log(`  ${JSON.stringify(counts)}；可能有凶宅的晚上 ${eligibleHaunt}、可能有冥婚的晚上 ${eligibleWed}`)
check(early === 0, '冥婚第 5 晚、凶宅第 6 晚以前沒有')
check(kid === 0, '不會找上小孩、有小孩的房間')
check(doneAgain === 0, '兩件都化解過以後就不會再來')
const hauntRate = counts.haunt / Math.max(1, eligibleHaunt)
check(hauntRate > 0.18 && hauntRate < 0.42, `凶宅大約三成（${(hauntRate * 100).toFixed(0)}%）`)
const wedRate = counts.wedding / Math.max(1, eligibleWed)
check(wedRate > 0.1 && wedRate < 0.35, `冥婚大約四分之一（沒被凶宅搶走的晚上，${(wedRate * 100).toFixed(0)}%）`)

console.log(failed ? `\n${failed} problem(s)` : '\nall horror OK')
process.exit(failed ? 1 : 0)
