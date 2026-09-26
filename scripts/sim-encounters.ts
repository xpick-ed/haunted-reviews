// 客人之間的故事的測試（不用瀏覽器）：npx tsx scripts/sim-encounters.ts
//
// 用第一個月的三晚（阿凱＋張經理、林太太＋阿豪、小美＋阿桂）和之後隨機的晚上跑完整晚，檢查：
//   - 時間到兩個人會走去約好的地方、講完、走回床上（天亮時都在床上）
//   - 阿嬤不在：照預設的結局；阿嬤躲在旁邊選不同的耳語：結局不同
//   - 評論附註有寫進去、沒有 NaN、一段故事不會拖太久
//   - 演過的劇本不會再演

import { NightSim, type GrandmaState, type SimEvent } from '../src/world/night/sim'
import { planNight, type NightPlan } from '../src/world/night/plan'
import { createEncounters, doneEncounters, encounterState, pickScripts, pickWhisper, SCRIPTS } from '../src/world/night/encounters'
import type { Meta } from '../src/world/night/director'
import type { GuestId } from '../src/world/night/types'

const HOURS_PER_SEC = 1 / 37.5
const DT = 0.1

type Mode = 'absent' | { pick: number }

interface Result {
  started: string | null
  outcome: string | null
  lines: number
  choicesShown: number
  startHour: number
  endHour: number
  inBedAtDawn: boolean
  notes: Partial<Record<GuestId, string>>
  nan: boolean
}

function run(plan: NightPlan, night: number, mode: Mode): Result {
  const sim = new NightSim(plan, { seed: night * 131 + 7, upgrades: [] })
  const p = createEncounters(sim, plan, { night } as Meta)
  if (p) sim.plugins.push(p)
  let hour = 22
  let lines = 0
  let choicesShown = 0
  let lastPhase = ''
  let started: string | null = null
  let outcome: string | null = null
  let startHour = 0
  let endHour = 0
  let nan = false
  while (hour < 30) {
    hour += DT * HOURS_PER_SEC
    const v = encounterState.view
    // 阿嬤躲在兩個人旁邊 3 公尺（躲著誰都看不到）
    const gm: GrandmaState =
      mode !== 'absent' && v && v.phase !== 'done'
        ? { x: v.mid[0], z: v.mid[1] + 3, speed: 0, busy: false, carrying: false, home: true, walkFactor: 1, hidden: true }
        : { x: -9.5, z: 5.5, speed: 0, busy: false, carrying: false, home: mode !== 'absent', walkFactor: 1, hidden: true }
    const ev: SimEvent[] = sim.update(DT, hour, gm, {})
    for (const e of ev) {
      if (e.t === 'custom' && e.kind === 'line') lines++
      if (e.t === 'custom' && e.kind === 'enc_done') {
        const d = e.data as { id: string; outcome: string | null }
        outcome = d.outcome
        endHour = hour
      }
    }
    const nv = encounterState.view
    if (nv && !started) {
      started = nv.id
      startHour = hour
    }
    if (nv && nv.phase !== lastPhase) {
      if (nv.phase === 'choice') {
        choicesShown++
        if (mode !== 'absent') pickWhisper(Math.min(mode.pick, (nv.choice?.options.length ?? 1) - 1))
      }
      lastPhase = nv.phase
    }
    for (const g of sim.guests) if (!Number.isFinite(g.x) || !Number.isFinite(g.comfort) || !Number.isFinite(g.fear)) nan = true
  }
  return {
    started,
    outcome,
    lines,
    choicesShown,
    startHour,
    endHour,
    inBedAtDawn: sim.guests.every((g) => g.mode === 'bed'),
    notes: { ...sim.reviewNotes },
    nan,
  }
}

let failed = 0
const bad = (msg: string) => {
  console.log(`   !! ${msg}`)
  failed++
}
const clock = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`

// 第一個月：N2 阿凱＋張經理、N3 林太太＋阿豪、N4 小美＋阿桂
for (const night of [2, 3, 4]) {
  const plan = planNight(night, 20, 0, 0)
  const members = plan.parties.flatMap((p) => p.members)
  const expect = pickScripts(members, new Set())[0]
  console.log(`\n== N${night}  ${members.join('+')}  → ${expect?.id ?? '(none)'}`)
  if (!expect) {
    bad('no script for this night')
    continue
  }
  const outcomes = new Set<string>()
  for (const mode of ['absent', { pick: 0 }, { pick: 1 }] as Mode[]) {
    doneEncounters.clear()
    const r = run(plan, night, mode)
    const label = mode === 'absent' ? '阿嬤不在' : `耳語選 ${mode.pick + 1}`
    const took = r.endHour - r.startHour
    console.log(
      `   ${label.padEnd(6)} ${r.started ?? '-'} → ${r.outcome ?? '(沒演完)'}  ${clock(r.startHour)}–${clock(r.endHour)}（${took.toFixed(2)} 小時） 台詞 ${r.lines} 句、跳出選項 ${r.choicesShown} 次`,
    )
    for (const [id, n] of Object.entries(r.notes)) console.log(`      ${id}：${n}`)
    if (r.started !== expect.id) bad(`${label}: expected ${expect.id} to start, got ${r.started}`)
    if (!r.outcome) bad(`${label}: encounter never finished`)
    if (!r.inBedAtDawn) bad(`${label}: someone is not in bed at dawn`)
    if (r.nan) bad(`${label}: NaN`)
    if (took > 2.2) bad(`${label}: took ${took.toFixed(2)} game hours`)
    if (mode === 'absent' && r.choicesShown) bad('choices shown while grandma was away')
    if (mode !== 'absent' && !r.choicesShown) bad('no whisper choices while grandma was next to them')
    if (mode === 'absent' && r.lines) bad('lines were voiced while grandma was away (she should not hear them)')
    if (r.outcome) outcomes.add(r.outcome)
  }
  if (outcomes.size < 2) bad(`whispers never changed the ending (${[...outcomes].join(', ')})`)
}

// 阿嬤沒聽到的故事之後還會再演；聽過的不會
doneEncounters.clear()
run(planNight(2, 20, 0, 0), 2, 'absent')
if (doneEncounters.has('akai_zhang')) bad('a story grandma never heard was marked done')
run(planNight(2, 20, 0, 0), 2, { pick: 0 })
if (!doneEncounters.has('akai_zhang')) bad('a story grandma listened to was not marked done')
doneEncounters.clear()
doneEncounters.add('akai_zhang')
if (createEncounters(new NightSim(planNight(2, 20, 0, 0), { seed: 1, upgrades: [] }), planNight(2, 20, 0, 0), { night: 2 } as Meta)) bad('akai_zhang replayed after it was done')

// 之後隨機的晚上：有對上的組合就要演得完
doneEncounters.clear()
let played = 0
let tried = 0
for (let night = 5; night <= 40; night++) {
  const plan = planNight(night, 20 + (night % 5) * 15, (night % 3) * 25, 0)
  const members = plan.parties.flatMap((p) => p.members)
  if (!pickScripts(members, new Set()).length) continue
  tried++
  doneEncounters.clear()
  const r = run(plan, night, { pick: night % 2 })
  if (r.outcome) played++
  else console.log(`   N${night} ${members.join('+')}: ${r.started ?? 'never started'} (not finished)`)
  if (!r.inBedAtDawn) bad(`N${night}: someone not in bed at dawn`)
  if (r.nan) bad(`N${night}: NaN`)
}
console.log(`\n隨機的晚上：${tried} 晚有對上的組合，演完 ${played} 晚`)
if (tried && played / tried < 0.6) bad(`only ${played}/${tried} random-night encounters finished`)

console.log(`\n${SCRIPTS.length} 段劇本`)
console.log(failed ? `${failed} problem(s)` : 'all encounters OK')
process.exit(failed ? 1 : 0)
