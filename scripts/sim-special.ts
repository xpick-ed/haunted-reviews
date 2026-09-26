// 特別的夜晚的機器人測試（不用瀏覽器）：npm run test:special
//
//   排程   哪幾晚是颱風夜、鬼客人夜；不碰主線（第 7、10、12 晚）、不碰別的節日；鬼客人夜沒有小孩、沒有情侶
//   颱風   不管 → 漏水沒接、窗板一直拍、神明廳蠟燭熄了、評論是壞的；有顧 → 評論是好的、舒適比較高；
//          02:00 大家都到神明廳、之後都回床上；事件（大風、天亮）各只發一次
//   鬼夜   不管 → 好兄弟出門時活人醒著會撞見；請他們晚一點、當觀眾、點香 → 功德比較多、沒人被嚇到
//   台詞   用到的台詞 id 都存在（碎念、夢、對話、sp.*）

import fs from 'node:fs'
import path from 'node:path'
import { NightSim, type GrandmaState, type SimEvent } from '../src/world/night/sim'
import { festivalOf, planNight, specialOf, type NightPlan } from '../src/world/night/plan'
import { GUESTS } from '../src/world/night/guests'
import { GHOST_GUEST_IDS } from '../src/world/night/guests.ghost'
import { GHOST_BARKS, GhostNight, TYPHOON, Typhoon, chatDialogueFor, makeSpecial } from '../src/world/night/special'
import { rateGuest } from '../src/world/night/rating'
import { BARKS } from '../src/data/barks'
import { dreamFor } from '../src/world/dream'
import type { GuestId } from '../src/world/night/types'

const HOURS_PER_SEC = 1 / 37.5
const DT = 0.1

let fails = 0
function check(ok: boolean, msg: string) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`)
  if (!ok) fails++
}

const LINES: Record<string, { who: string; text: string }> = Object.assign(
  {},
  ...fs
    .readdirSync(path.join('src', 'data'))
    .filter((f) => f.endsWith('.lines.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join('src', 'data', f), 'utf8'))),
)
const CAST_NOTE = new Set(GHOST_GUEST_IDS as string[])

interface Run {
  sim: NightSim
  sp: Typhoon | GhostNight
  events: SimEvent[]
  hour: number
}

/** 跑一整晚；brain 每幀在模擬之前呼叫（機器人阿嬤要做的事） */
function run(plan: NightPlan, night: number, brain: (r: Run, gm: GrandmaState) => void, seed = 3): Run {
  const sim = new NightSim(plan, { seed, upgrades: [] })
  const sp = makeSpecial(sim, plan, night)
  if (!sp) throw new Error(`第 ${night} 晚應該是特別的夜晚`)
  sim.plugins.push(sp)
  const r: Run = { sim, sp, events: [], hour: 22 }
  const gm: GrandmaState = { x: -5, z: -6, speed: 0, busy: false, carrying: false, home: true, walkFactor: 1 }
  for (let hour = 22; hour < 30; hour += DT * HOURS_PER_SEC) {
    r.hour = hour
    brain(r, gm)
    r.events.push(...sim.update(DT, hour, gm, {}))
    for (const g of sim.guests) {
      if (!Number.isFinite(g.x) || !Number.isFinite(g.z) || !Number.isFinite(g.comfort) || !Number.isFinite(g.fear)) throw new Error(`${g.id} 的數值壞掉了`)
    }
  }
  return r
}

const customs = (r: Run, kind: string) => r.events.filter((e) => e.t === 'custom' && e.kind === kind)
const avgComfort = (r: Run, ids?: GuestId[]) => {
  const gs = r.sim.guests.filter((g) => !ids || ids.includes(g.id))
  return gs.reduce((a, g) => a + g.comfort, 0) / Math.max(1, gs.length)
}

// ---------------------------------------------------------------------------
console.log('排程')
// ---------------------------------------------------------------------------
{
  const typhoons: number[] = []
  const ghosts: number[] = []
  for (let n = 1; n <= 60; n++) {
    const k = specialOf(n)
    if (k === 'typhoon') typhoons.push(n)
    if (k === 'ghost') ghosts.push(n)
  }
  check(typhoons.slice(0, 4).join(',') === '5,11,23,35', `颱風夜：${typhoons.join('、')}`)
  check(ghosts.slice(0, 3).join(',') === '8,20,32', `鬼客人夜：${ghosts.join('、')}`)
  check(![1, 2, 3, 4, 7, 10, 12].some((n) => specialOf(n)), '不碰第一個月、第 7、10、12 晚的主線')
  check(typhoons.every((n) => !festivalOf(n)), '颱風夜不會碰到節日')
  check(ghosts.every((n) => festivalOf(n) === 'zhongyuan'), '鬼客人夜都是中元普渡')
  check(typhoons.every((n) => !ghosts.includes(n - 1) && !ghosts.includes(n + 1)), '颱風夜不會跟鬼客人夜連著')
  for (const n of typhoons.slice(0, 3)) {
    const p = planNight(n, 50, 30, 4, { adult: true })
    check(p.special === 'typhoon' && p.event === 'blackout', `第 ${n} 晚的安排：颱風＋停電（壓力高也不會有廟公）`)
  }
  for (const n of ghosts.slice(0, 2)) {
    const p = planNight(n, 50, 30, 4, { adult: true })
    const members = p.parties.flatMap((x) => x.members)
    const r2 = p.parties.find((x) => x.room === 'r2')!.members
    check(p.special === 'ghost' && p.event === 'none', `第 ${n} 晚的安排：鬼客人夜、沒有廟公`)
    check(r2.every((id) => GHOST_GUEST_IDS.includes(id)) && r2.length === 2, `第 ${n} 晚客房二：${r2.map((id) => GUESTS[id].name).join('、')}`)
    check(!members.some((id) => GUESTS[id].type === 'child' || GUESTS[id].type === 'couple'), `第 ${n} 晚沒有小孩、沒有情侶`)
  }
  check(planNight(8, 50, 30, 0).parties[1].members[0] !== planNight(20, 50, 30, 0).parties[1].members[0], '第二次中元來的是另一對好兄弟')
  for (const id of GHOST_GUEST_IDS) {
    const d = GUESTS[id]
    check(!!d && d.seesGhost === true && d.pay === 0 && d.type === 'elder', `${d?.name ?? id}：看得到阿嬤、付冥紙`)
  }
}

// ---------------------------------------------------------------------------
console.log('颱風夜')
// ---------------------------------------------------------------------------
{
  const plan = planNight(11, 50, 20, 0)
  const idle = run(plan, 11, (_r, gm) => {
    gm.home = false
  })
  const ti = idle.sp as Typhoon
  check(ti.leaks.filter((l) => l.active).length === TYPHOON.leaks.length, `漏水 ${ti.leaks.length} 處都出現了`)
  check(ti.shutter.bangs > 30, `不管的話窗板一直拍（${ti.shutter.bangs} 下）`)
  check(ti.thunderN >= 6 && ti.thunderN <= 14, `整晚打雷 ${ti.thunderN} 次`)
  check(customs(idle, 'special.typhoon.gust').length === 1, '02:00 的大風只發一次')
  check(customs(idle, 'special.typhoon.dawn').length === 1, '天亮只發一次')
  check(!!ti.outcome && !ti.outcome.good, `不管的話結果是壞的（接住 ${ti.outcome?.caught}／${ti.outcome?.total}）`)
  check(ti.gatherTime > 20, `大家在神明廳躲了 ${ti.gatherTime.toFixed(0)} 秒`)
  check(ti.litTime / ti.gatherTime < 0.6, `沒人點蠟燭：亮著的時間 ${((ti.litTime / ti.gatherTime) * 100).toFixed(0)}%`)
  check(idle.sim.guests.every((g) => g.mode === 'bed'), '天亮時大家都回到床上')
  check(idle.sim.guests.every((g) => (idle.sim.reviewNotes[g.id] ?? '').includes('颱風') || (idle.sim.reviewNotes[g.id] ?? '').includes('窗板')), '每個人的評論都寫到颱風')

  let maxHall = 0
  const helper = run(plan, 11, (r, gm) => {
    const t = r.sp as Typhoon
    gm.home = true
    t.leaks.forEach((l, i) => {
      if (t.canBucket(i)) t.placeBucket(i)
    })
    if (t.shutter.banging) t.closeShutter()
    if (t.canRelight) t.relight()
    if (t.canHum) t.hum()
    for (const x of r.sim.guests) for (const n of [...x.needs]) if (r.hour - n.since > 0.25) r.sim.satisfy(x.room, n.kind, 20)
    const inHall = r.sim.guests.filter((g) => g.mode === 'stand' && g.z < -3.4 && Math.abs(g.x) < 2.2).length
    maxHall = Math.max(maxHall, inHall)
  })
  const th = helper.sp as Typhoon
  check(maxHall === helper.sim.guests.length, `02:00 所有客人（${helper.sim.guests.length} 位）都擠到神明廳（最多 ${maxHall}）`)
  check(!!th.outcome?.good, `有顧好：結果是好的（接住 ${th.outcome?.caught}／${th.outcome?.total}）`)
  check(th.relights > 0 && th.hums > 0, `蠟燭重新點了 ${th.relights} 次、哼歌 ${th.hums} 次`)
  check(th.shutter.closed && th.shutter.bangs <= 1, '窗板一拍就扣好')
  check(avgComfort(helper) > avgComfort(idle) + 15, `有顧的舒適 ${avgComfort(helper).toFixed(0)} > 不管 ${avgComfort(idle).toFixed(0)}`)
  const ev = customs(helper, 'special.typhoon.dawn')[0]?.data as { warm: number } | undefined
  check(ev?.warm === 6, '有顧好：天亮溫馨 +6')
  const stars = helper.sim.guests.map((g) => rateGuest(g))
  check(stars.reduce((a, b) => a + b, 0) / stars.length >= 3.5, `有顧的星數：${helper.sim.guests.map((g, i) => `${g.def.name} ${stars[i]}`).join('、')}`)
}

// ---------------------------------------------------------------------------
console.log('中元鬼客人夜')
// ---------------------------------------------------------------------------
for (const night of [8, 20]) {
  const plan = planNight(night, 50, 20, 0)
  const names = plan.parties.flatMap((p) => p.members).map((id) => GUESTS[id].name)
  console.log(`  第 ${night} 晚：${names.join('、')}`)
  // 不管：活人不睡（需求沒人理）→ 好兄弟出門就撞見
  const idle = run(plan, night, (_r, gm) => {
    gm.home = false
  })
  const gi = idle.sp as GhostNight
  check(gi.trips.length >= 2 && gi.trips.every((t) => t.state === 'done'), `好兄弟出門走了 ${gi.trips.length} 趟，都回來了`)
  check(customs(idle, 'special.ghost.dawn').length === 1, '天亮只發一次')
  const living = idle.sim.guests.find((g) => !GHOST_GUEST_IDS.includes(g.id))!
  console.log(`    （不管：${living.def.name} 撞見好兄弟 ${gi.sightings} 次、功德 ${gi.outcome?.merit}）`)

  // 顧：活人醒著就請好兄弟晚一點；秋月唱戲去聽；點香；需求直接滿足
  const helper = run(plan, night, (r, gm) => {
    const g = r.sp as GhostNight
    gm.home = true
    if (g.pending) g.delay()
    if (!g.incense && r.hour > 23) g.burnIncense()
    if (g.singer && !g.audience) g.listen()
    for (const x of r.sim.guests) for (const n of [...x.needs]) if (r.hour - n.since > 0.2) r.sim.satisfy(x.room, n.kind, 20)
  })
  const gh = helper.sp as GhostNight
  check(gi.sightings > 0, `不管的話${living.def.name}起來上廁所會撞見好兄弟（${gi.sightings} 次）`)
  check(gh.sightings === 0, `請好兄弟小心：撞見 ${gh.sightings} 次`)
  check((gh.outcome?.merit ?? 0) > (gi.outcome?.merit ?? 0), `功德 ${gh.outcome?.merit} > 不管 ${gi.outcome?.merit}`)
  check(helper.sim.guests.every((g) => g.mode === 'bed'), '天亮時大家都回到床上')
  for (const id of plan.parties[1].members) check(!!helper.sim.reviewNotes[id]?.includes('冥紙'), `${GUESTS[id].name}的評論寫在冥紙背面`)
  check(!!chatDialogueFor(helper.sim, 'r2') && chatDialogueFor(helper.sim, 'r1') === null, `聊天對話：${chatDialogueFor(helper.sim, 'r2')}`)
}

// ---------------------------------------------------------------------------
console.log('台詞')
// ---------------------------------------------------------------------------
{
  const missing: string[] = []
  for (const id of GHOST_GUEST_IDS) {
    for (const xs of Object.values(GHOST_BARKS[id] ?? {})) for (const x of xs ?? []) if (!LINES[x]) missing.push(x)
    check(BARKS[id] === BARKS[id] && Object.keys(BARKS[id]).length > 10, `${GUESTS[id].name}的碎念補進 BARKS 了`)
    const d = dreamFor(id)
    for (const x of Object.values(d.lines).flat()) if (typeof x === 'string' && !LINES[x]) missing.push(x)
  }
  const src = ['src/world/night/special.ts', 'src/world/specialStory.ts', 'src/ui/SpecialHud.tsx'].map((f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')).join('\n')
  const used = new Set<string>()
  for (const m of src.matchAll(/'(sp\.[a-z_.0-9]+)'/g)) if (!m[1].startsWith('sp.chat.')) used.add(m[1])
  for (const m of src.matchAll(/`sp\.gm\.leak\.\$\{l\.room\}`/g)) void m
  for (const room of ['r1', 'r2', 'hall']) used.add(`sp.gm.leak.${room}`)
  for (const k of ['sp.gg_shuimu.trip.pray', 'sp.gg_bangsi.trip.wash', 'sp.gg_soldier.trip.moon', 'sp.gg_soldier.trip.guard', 'sp.gg_opera.trip.sing']) used.add(k)
  for (const id of ['gg_shuimu', 'gg_bangsi', 'gg_soldier', 'gg_opera']) used.add(`sp.${id}.wait`)
  for (const k of ['old', 'soldier', 'opera']) for (let i = 1; i <= 8; i++) if (LINES[`sp.chat.${k}.${i}`]) used.add(`sp.chat.${k}.${i}`)
  for (const x of used) if (!LINES[x]) missing.push(x)
  check(missing.length === 0, `用到的 ${used.size} 句 sp.* 台詞與好兄弟的碎念、夢都存在${missing.length ? `（少了：${missing.slice(0, 8).join('、')}）` : ''}`)
  const whos = new Set(Object.entries(LINES).filter(([k]) => k.startsWith('sp.') || GHOST_GUEST_IDS.some((id) => k.startsWith(`${id}.`))).map(([, v]) => v.who))
  console.log(`    （要在 cast.json 登記的新聲音：${[...whos].filter((w) => CAST_NOTE.has(w)).join('、')}）`)
}

console.log(fails ? `\n✗ ${fails} 項沒過` : '\n✓ 全部通過')
process.exit(fails ? 1 : 0)
