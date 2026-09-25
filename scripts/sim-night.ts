// 深夜模擬的機器人測試（不用瀏覽器）：npm run test:night
//
// 用三種玩法跑完整晚（22:00 → 06:00），看數值平衡合不合理：
//   idle    阿嬤整晚不在家（什麼都不做）→ 應該拿不到好評
//   helper  需求出現一陣子後去滿足、客人睡了才蓋被、阿凱在拍的時候嚇他 → 應該接近五星
//   clumsy  阿嬤整晚在客房一的床邊晃來晃去 → 應該一直被看到
//
// 也檢查：座標沒有 NaN、天亮時客人都回到床上、每個人至少睡著過一次（idle 除外）。

import { NightSim, type GrandmaState, type SimEvent } from '../src/world/night/sim'
import { planNight, type NightPlan } from '../src/world/night/plan'
import { ACTION_DEFS } from '../src/world/night/actions'
import { rateGuest } from '../src/world/night/rating'
import { GUEST_ROOMS } from '../src/scene/layout'
import type { NeedKind, ObjectState, RoomId } from '../src/world/night/types'

const HOURS_PER_SEC = 1 / 37.5
// TRACE=zhang TRACE_STRAT=helper TRACE_SEED=1 npm run test:night  → 印出某位客人整晚的狀態
const TRACE = process.env.TRACE
const TRACE_STRAT = process.env.TRACE_STRAT ?? 'helper'
const TRACE_SEED = Number(process.env.TRACE_SEED ?? 0)
const DT = 0.1

type Strategy = 'idle' | 'helper' | 'clumsy' | 'hidden' | 'cat'

/** 哪個需求用哪個動作滿足、動作做在哪裡、會打開哪個物件 */
const FIX: Partial<Record<NeedKind, { action: keyof typeof ACTION_DEFS; at: 'bedside' | 'nightstand' | 'fan' | 'coil' | 'doorOut'; object?: string }>> = {
  cold: { action: 'tuck', at: 'bedside' },
  hot: { action: 'temp', at: 'fan', object: 'fan' },
  thirsty: { action: 'water', at: 'nightstand', object: 'cup' },
  mosquito: { action: 'coil', at: 'coil', object: 'coil' },
  dark: { action: 'nightlight', at: 'nightstand', object: 'lamp' },
  hungry: { action: 'deliver', at: 'nightstand', object: 'dish' },
  insomnia: { action: 'pat', at: 'bedside' },
  play: { action: 'play', at: 'bedside' },
  chat: { action: 'chat', at: 'bedside' },
}

interface Result {
  stars: Record<string, number>
  counts: Record<string, number>
  problems: string[]
  needsSeen: string[]
}

function run(plan: NightPlan, seed: number, strat: Strategy): Result {
  const sim = new NightSim(plan, { seed, upgrades: [] })
  const objects: Record<string, ObjectState> = {}
  const counts: Record<string, number> = {}
  const problems: string[] = []
  const needsSeen: string[] = []
  const tucked = new Set<RoomId>()
  let lastScare = 0
  let hour = 22
  const hidden: GrandmaState = { x: -9.5, z: 5.5, speed: 0, busy: false, carrying: false, home: strat !== 'idle', walkFactor: 1 }
  let t = 0
  const pending = new Map<string, number>()

  while (hour < 30) {
    t += DT
    hour += DT * HOURS_PER_SEC
    let gm = hidden
    if (strat === 'clumsy' || strat === 'hidden' || strat === 'cat') {
      const R = GUEST_ROOMS.r1
      gm = { ...hidden, x: R.bedside[0] + Math.sin(t) * 0.6, z: R.bedside[1] + Math.cos(t * 0.7) * 0.5, speed: 1.5, hidden: strat === 'hidden', cat: strat === 'cat' }
    }
    const ev: SimEvent[] = sim.update(DT, hour, gm, objects)
    for (const e of ev) {
      const k = e.t === 'bark' ? `bark.${e.kind}` : e.t === 'mg' ? `mg.${e.kind}` : e.t === 'dog' ? `dog.${e.kind}` : e.t
      counts[k] = (counts[k] ?? 0) + 1
      if (e.t === 'need') needsSeen.push(`${e.who}:${e.kind}@${hour.toFixed(1)}`)
    }

    if (strat === 'helper') {
      // 需求出現後 8 秒（發現＋走過去；整晚只有 300 秒）才處理
      for (const g of sim.guests) {
        for (const n of g.needs) {
          const key = `${g.id}.${n.kind}`
          if (n.kind === 'scare') continue
          if (!pending.has(key)) pending.set(key, t + 8)
          if (t < pending.get(key)!) continue
          const fix = FIX[n.kind]
          if (!fix) continue
          const R = GUEST_ROOMS[g.room]
          const at = R[fix.at]
          if (!at) continue
          const def = ACTION_DEFS[fix.action]
          // 一二三木頭人：有人看得到那裡就等一下（最多等 40 秒，之後硬做）
          if (def.type === 'kind' && sim.wouldBeSeen(at[0], at[1], g.room) && t < pending.get(key)! + 40) continue
          if (def.type === 'kind') sim.actionSeen(at[0], at[1], g.room, true)
          if (fix.action === 'tuck') sim.tuck(g.room)
          if (fix.object) objects[`${g.room}.${fix.object}`] = { on: true, at: t }
          sim.satisfy(g.room, n.kind, def.comfort ?? 0)
          if (def.noise > 0) sim.noise(at[0], at[1], def.noise)
          pending.delete(key)
          break
        }
        // 睡著了幫他蓋被
        if (!g.awake && g.mode === 'bed' && !tucked.has(g.room)) {
          tucked.add(g.room)
          sim.tuck(g.room)
        }
        // 阿凱在拍：嚇他（每 40 分鐘一次）
        if (g.def.type === 'thrill' && g.awake && g.filming && hour - lastScare > 0.66) {
          lastScare = hour
          // 聰明的嚇法：隔壁有淺眠的人就用安靜的（燈閃），沒有就敲門
          const quiet = sim.guests.some((o) => o !== g && o.def.lightSleeper > 0.5)
          const d = quiet ? ACTION_DEFS.flicker : ACTION_DEFS.knock
          sim.scare(g.filming, g.x + 1.5, g.z, d.fear!, d.noise, false)
        }
        if (g.def.type === 'thrill' && g.awake && g.mode === 'bed' && hour - lastScare > 0.66 && hour > 23) {
          lastScare = hour
          const R = GUEST_ROOMS[g.room]
          sim.scare(g.room, R.lamp[0], R.lamp[1], ACTION_DEFS.flicker.fear!, ACTION_DEFS.flicker.noise, false)
        }
      }
      if (sim.dog?.barking && !sim.dog.calm) sim.calmDog()
    }

    if (TRACE && strat === TRACE_STRAT && seed === TRACE_SEED) {
      const g = sim.guests.find((x) => x.id === TRACE)
      if (g && Math.floor(hour * 8) !== Math.floor((hour - DT * HOURS_PER_SEC) * 8))
        console.log(`      ${hour.toFixed(2)} ${g.mode} ${g.awake ? 'awake' : 'asleep'} fear=${g.fear.toFixed(0)} comfort=${g.comfort.toFixed(0)} needs=${g.needs.map((n) => n.kind)} woken=${g.wokenCount} resleep=${g.resleepT.toFixed(0)}`)
      for (const e of ev) if ('who' in e && e.who === TRACE) console.log(`        ${hour.toFixed(2)} ${JSON.stringify(e)}`)
    }
    for (const g of sim.guests) {
      if (!Number.isFinite(g.x) || !Number.isFinite(g.z) || !Number.isFinite(g.comfort) || !Number.isFinite(g.fear)) {
        problems.push(`${g.id} has NaN at ${hour.toFixed(2)}`)
        break
      }
    }
    if (problems.length) break
  }

  const stars: Record<string, number> = {}
  for (const g of sim.guests) {
    stars[g.id] = rateGuest(g)
    if (g.mode !== 'bed' && !g.awake) problems.push(`${g.id} asleep outside bed`)
    if (strat === 'helper' && !g.sleptOnce && g.def.type !== 'thrill') problems.push(`${g.id} never slept`)
  }
  return { stars, counts, problems, needsSeen }
}

// ---------------------------------------------------------------------------

const nights: { name: string; plan: NightPlan }[] = []
for (let n = 1; n <= 4; n++) nights.push({ name: `M1-N${n}`, plan: planNight(n, 20, 0, 0) })
nights.push({ name: 'warm-N6', plan: planNight(6, 70, 10, 0) })
nights.push({ name: 'spooky-N7', plan: planNight(7, 20, 70, 0) })
nights.push({ name: 'mixed-N9', plan: planNight(9, 50, 50, 0) })
nights.push({ name: 'miaogong-N10', plan: planNight(10, 30, 30, 3) })

const SEEDS = [1, 2, 3, 4]
let failed = 0
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

for (const { name, plan } of nights.filter((n) => !process.env.ONLY || n.name === process.env.ONLY)) {
  const who = plan.parties.map((p) => `${p.room}:${p.members.join('+')}`).join(' ')
  console.log(`\n== ${name}  ${who}  event=${plan.event}`)
  const byStrat: Record<Strategy, number[]> = { idle: [], helper: [], clumsy: [] }
  for (const strat of ['idle', 'helper', 'clumsy'] as Strategy[]) {
    const all: Record<string, number[]> = {}
    const agg: Record<string, number> = {}
    const probs = new Set<string>()
    for (const seed of SEEDS) {
      const r = run(plan, seed * 97 + name.length, strat)
      for (const [id, s] of Object.entries(r.stars)) (all[id] ??= []).push(s)
      for (const [k, v] of Object.entries(r.counts)) agg[k] = (agg[k] ?? 0) + v
      r.problems.forEach((p) => probs.add(p))
      if (TRACE && strat === TRACE_STRAT) console.log(`      seed ${seed * 97 + name.length}: ${JSON.stringify(r.stars)}`)
      if (strat === 'helper' && seed === SEEDS[0]) console.log(`   needs: ${r.needsSeen.join(', ') || '(none)'}`)
    }
    const starText = Object.entries(all)
      .map(([id, xs]) => `${id} ${avg(xs).toFixed(1)}★`)
      .join('  ')
    byStrat[strat] = Object.values(all).flat()
    const pick = ['seen', 'capture', 'woken', 'nearmiss', 'bark.bathroom', 'asleep', 'mgCatch', 'dog.bark']
    const cnt = pick
      .filter((k) => agg[k])
      .map((k) => `${k}=${(agg[k] / SEEDS.length).toFixed(1)}`)
      .join(' ')
    console.log(`   ${strat.padEnd(6)} ${starText}   | ${cnt}`)
    for (const p of probs) {
      console.log(`   !! ${p}`)
      failed++
    }
  }
  const h = avg(byStrat.helper)
  const i = avg(byStrat.idle)
  if (h < 3.8) {
    console.log(`   !! helper avg ${h.toFixed(2)} < 3.8`)
    failed++
  }
  if (i > h - 0.8) {
    console.log(`   !! idle avg ${i.toFixed(2)} too close to helper ${h.toFixed(2)}`)
    failed++
  }
}

// 躲著、附身在貓身上：整晚在床邊晃也不該被看到（貓還會讓客人舒服一點）
for (const strat of ['hidden', 'cat'] as Strategy[]) {
  const r = run(planNight(1, 20, 0, 0), 7, strat)
  const seen = r.counts.seen ?? 0
  console.log(`${strat.padEnd(6)} M1-N1 seen=${seen} stars=${JSON.stringify(r.stars)}`)
  if (seen > 0) {
    console.log(`   !! ${strat}: grandma was seen ${seen} times`)
    failed++
  }
}

console.log(failed ? `\n${failed} problem(s)` : '\nall nights OK')
process.exit(failed ? 1 : 0)
