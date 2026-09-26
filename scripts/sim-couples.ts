// 情侶客人的機器人測試（不用瀏覽器）：npx tsx scripts/sim-couples.ts
//
// 新婚夫妻、外遇情侶各跑幾種玩法：不管它、掛勿擾牌、走進房間、附身阿咪去引開、阿凱來拍、
// 手機不管／讓它沒電／附身壁虎按靜音、讓阿凱拍到真的鬼。另外檢查：沒有情侶的晚上沒有外掛、
// 成人內容開著時情侶不會跟小宇排在同一晚、講到的台詞都有寫。

import LINES from '../src/data/couples.lines.json'
import { BARKS } from '../src/data/barks'
import { NightSim, type GrandmaState, type SimEvent } from '../src/world/night/sim'
import { planNight, type NightPlan } from '../src/world/night/plan'
import { NODES } from '../src/world/night/nav'
import { GUEST_ROOMS } from '../src/scene/layout'
import { COUPLE_DEFS, CouplesRT, couplesState, createCouples, type Couple } from '../src/world/night/couples'
import type { Meta } from '../src/world/night/director'
import type { GuestId, RoomId } from '../src/world/night/types'

const HOURS_PER_SEC = 1 / 37.5
const DT = 0.1
const NIGHT = 9
type XZ = [number, number]

let failed = 0
function check(ok: boolean, msg: string) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`)
  if (!ok) failed++
}

const lineIds = new Set(Object.keys(LINES))
const said = new Set<string>()

/** 機器人：沿著點列走（像玩家一樣有速度，不瞬移） */
class Bot {
  gm: GrandmaState = { x: -3, z: -0.2, speed: 0, busy: false, carrying: false, home: true, walkFactor: 1 }
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

interface Opts {
  couple: 'honeymoon' | 'affair'
  other: GuestId[]
  sign?: boolean
  /** 每一步機器人要做什麼（hour、這一對情侶、機器人） */
  think?: (hour: number, c: Couple, bot: Bot, sim: NightSim) => void
  /** 情侶睡著就別有需求吵醒自己（測手機用） */
  calm?: boolean
}

interface Run {
  sim: NightSim
  c: Couple
  bounces: number
  comfort: Record<string, number>
  notes: Partial<Record<GuestId, string>>
}

function run(o: Opts): Run {
  const def = COUPLE_DEFS.find((d) => d.kind === o.couple)!
  const plan: NightPlan = { parties: [{ room: 'r1', members: [...def.ids] }, { room: 'r2', members: o.other }], event: 'none' }
  const sim = new NightSim(plan, { seed: 21, upgrades: [] })
  couplesState.signs = o.sign ? { r1: NIGHT } : {}
  const p = createCouples(sim, plan, { night: NIGHT } as Meta)!
  sim.plugins.push(p)
  const c = (p as CouplesRT).couple('r1')!
  const bot = new Bot()
  if (!o.think) bot.gm.home = false
  let hour = 22
  let bounces = 0
  while (hour < 30) {
    hour += DT * HOURS_PER_SEC
    if (o.calm) for (const g of sim.guests) if (def.ids.includes(g.id)) g.needs = []
    o.think?.(hour, c, bot, sim)
    bot.step(DT)
    const ev: SimEvent[] = sim.update(DT, hour, bot.gm, {})
    for (const e of ev) {
      if (e.t !== 'custom') continue
      if (e.kind === 'line') said.add((e.data as { id: string }).id)
      if (e.kind === 'couple.bounce') {
        const d = e.data as { x: number; z: number }
        bot.gm.x = d.x
        bot.gm.z = d.z
        bot.path = []
        bounces++
      }
    }
  }
  const comfort: Record<string, number> = {}
  for (const g of sim.guests) comfort[g.id] = Math.round(g.comfort)
  return { sim, c, bounces, comfort, notes: { ...sim.reviewNotes } }
}

const R1 = GUEST_ROOMS.r1
const avg = (r: Run, ids: GuestId[]) => ids.reduce((a, id) => a + r.comfort[id], 0) / ids.length
const HM: GuestId[] = ['ajie', 'xiaohui']
const AF: GuestId[] = ['mrwang', 'mrswang']

// ---------------------------------------------------------------------------
console.log('新婚夫妻')
{
  const knock = run({ couple: 'honeymoon', other: ['xiaomei'] })
  check(knock.c.interrupted >= 1, `沒掛牌子：小美來敲門（敲了 ${knock.c.interrupted} 次）`)
  check(!!knock.notes.ajie?.includes('敲門'), `評論提到被敲門：「${knock.notes.ajie ?? ''}」`)

  const sign = run({ couple: 'honeymoon', other: ['xiaomei'], sign: true })
  check(sign.c.signRead >= 1 && sign.c.interrupted === 0, `掛了勿擾牌：小美看到牌子就回去（看牌 ${sign.c.signRead}、敲門 ${sign.c.interrupted}）`)
  check(sign.c.okWindows === 2, `兩段兩人世界都沒人打擾（${sign.c.okWindows}/2）`)
  check(avg(sign, HM) > avg(knock, HM) + 15, `掛牌子比較舒服：${avg(sign, HM).toFixed(0)} vs ${avg(knock, HM).toFixed(0)}`)
  check(!!sign.notes.ajie?.includes('請勿打擾'), `評論稱讚勿擾牌：「${sign.notes.ajie ?? ''}」`)

  // 走進房間：23:20 走到床邊
  const walk = run({
    couple: 'honeymoon',
    other: ['zhang'],
    sign: true,
    think: (h, _c, bot) => {
      if (h > 23.3 && h < 23.35 && !bot.path.length) bot.goTo([NODES.yardR, NODES.r1_door_out, NODES.r1_door_in, [R1.bed.x - 1, R1.bed.z]])
    },
  })
  check(walk.bounces >= 1 && walk.c.walkedIn >= 1, `兩人世界時走進房間：被彈出門外（${walk.bounces} 次）`)
  check(said.has('couple.gm.oops.1') || said.has('couple.gm.oops.2') || said.has('couple.gm.oops.3'), '阿嬤：「哎喲喂……我什麼都沒看到」')
  check(walk.c.okWindows === 1, `被撞見的那一段不算（${walk.c.okWindows}/2）`)

  // 附身阿咪去引開來敲門的人
  const cat = run({
    couple: 'honeymoon',
    other: ['xiaomei'],
    think: (_h, c, bot, sim) => {
      bot.gm.body = 'cat'
      const v = c.visit
      if (v) {
        const g = sim.guests.find((x) => x.id === v.id)!
        bot.goTo([[g.x, g.z]])
      } else if (!bot.path.length) bot.goTo([NODES.yardC])
    },
  })
  check(cat.c.distracted >= 1 && cat.c.interrupted === 0, `附身阿咪蹭過去：小美被引開（引開 ${cat.c.distracted}、敲門 ${cat.c.interrupted}）`)

  // 阿凱（在巡夜）會繞過來拍；不管的話就被拍到
  const akai = run({ couple: 'honeymoon', other: ['akai'], sign: true })
  check(akai.c.filmed, '阿凱不管勿擾牌，跑來門口拍')
  check(!!akai.notes.akai?.includes('不是鬼'), `阿凱的評論：「${akai.notes.akai ?? ''}」`)
}

// ---------------------------------------------------------------------------
console.log('外遇情侶')
{
  const film = run({ couple: 'affair', other: ['akai'] })
  check(film.c.filmed, '阿凱來拍門口')
  check(film.notes.mrwang?.includes('希望老闆不要跟任何人說我們來過') ?? false, `評論：「${film.notes.mrwang ?? ''}」`)

  // 讓阿凱拍到真的鬼：他就忘了那間房
  const ghost = run({
    couple: 'affair',
    other: ['akai'],
    think: (_h, c, bot, sim) => {
      const v = c.visit
      const g = sim.guests.find((x) => x.id === 'akai')!
      if (v && (v.phase === 'door' || v.phase === 'go')) {
        // 站到他面前 2 公尺
        bot.goTo([[g.x + Math.sin(g.heading) * 2, g.z + Math.cos(g.heading) * 2]])
      } else if (!bot.path.length) bot.goTo([[-3, -0.2]])
    },
  })
  check(!ghost.c.filmed && ghost.c.distracted >= 1, `讓阿凱拍到阿嬤：他跑回去看畫面，沒拍到情侶（引開 ${ghost.c.distracted}）`)

  const ignored = run({ couple: 'affair', other: ['zhang'], calm: true })
  check(ignored.c.phone?.end === 'caught', `手機不管：響起來吵醒王太太 → 穿幫（${ignored.c.phone?.end}）`)
  check(!!ignored.notes.mrswang?.includes('電話'), `王太太的評論：「${ignored.notes.mrswang ?? ''}」`)

  const drained = run({
    couple: 'affair',
    other: ['zhang'],
    calm: true,
    think: (_h, c) => {
      if (c.phone?.state === 'buzz' && c.phone.t > 6) c.silence('drain')
    },
  })
  check(drained.c.phone?.end === 'drain', `讓手機沒電（${drained.c.phone?.end}）`)
  check(!!drained.notes.mrwang?.includes('謝天謝地'), `王先生的評論：「${drained.notes.mrwang ?? ''}」`)
  check(avg(drained, AF) > avg(ignored, AF) + 10, `處理手機比較舒服：${avg(drained, AF).toFixed(0)} vs ${avg(ignored, AF).toFixed(0)}`)

  const gecko = run({
    couple: 'affair',
    other: ['zhang'],
    calm: true,
    think: (_h, c, bot) => {
      bot.gm.body = 'gecko'
      if (c.phone && c.phone.state === 'buzz' && !bot.path.length) bot.goTo([NODES.yardR, NODES.r1_door_out, NODES.r1_door_in, [c.phone.x - 0.5, c.phone.z]])
    },
  })
  check(gecko.c.phone?.end === 'gecko', `附身壁虎爬過去按靜音（${gecko.c.phone?.end}）`)
}

// ---------------------------------------------------------------------------
console.log('其他')
{
  const plan: NightPlan = { parties: [{ room: 'r1', members: ['xiaomei'] }, { room: 'r2', members: ['zhang'] }], event: 'none' }
  const sim = new NightSim(plan, { seed: 1, upgrades: [] })
  check(createCouples(sim, plan, { night: 5 } as Meta) === null, '沒有情侶的晚上沒有外掛')

  let both = 0
  let couples = 0
  let off = 0
  for (let n = 5; n < 600; n++) {
    const p = planNight(n, 40, 20, 0, { adult: true })
    const ids = p.parties.flatMap((x) => x.members)
    const hasCouple = ids.some((id) => ['ajie', 'mrwang'].includes(id))
    if (hasCouple) couples++
    if (hasCouple && ids.includes('xiaoyu')) both++
    const q = planNight(n, 40, 20, 0)
    if (q.parties.flatMap((x) => x.members).some((id) => ['ajie', 'mrwang', 'zhiwei'].includes(id))) off++
  }
  check(couples > 30, `成人內容開著：情侶大約每 ${(595 / Math.max(1, couples)).toFixed(1)} 晚來一次`)
  check(both === 0, `情侶不會跟小宇排在同一晚（${both}）`)
  check(off === 0, `成人內容關著：不會排大人的客人（${off}）`)

  const missing = [...said].filter((id) => !lineIds.has(id))
  check(missing.length === 0, `講到的 ${said.size} 句台詞都有寫${missing.length ? '：缺 ' + missing.join('、') : ''}`)
  const barkIds = (['ajie', 'xiaohui', 'mrwang', 'mrswang'] as GuestId[]).flatMap((id) => Object.values(BARKS[id]).flat() as string[])
  const missingB = barkIds.filter((id) => !lineIds.has(id))
  check(missingB.length === 0, `客人的 ${barkIds.length} 句台詞都有寫${missingB.length ? '：缺 ' + missingB.slice(0, 5).join('、') : ''}`)
  const rooms: RoomId[] = ['r1', 'r2']
  void rooms
}

if (failed) {
  console.log(`\n${failed} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
