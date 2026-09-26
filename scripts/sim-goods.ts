// 店裡的好東西的平衡測試（DESIGN §31.1）：npm run test:goods
//
// 跟 sim-night.ts 同一個機器人阿嬤（需求出現 8 秒後去滿足、睡著了蓋被），比較：
//   helper       不用好東西（跟 test:night 一樣）
//   goods        22:20 先把「今晚可能用得到」的好東西放到客房（每間最多兩樣），其他照舊
//   idle         整晚不在家
//   goodsOnly    只放好東西、其他什麼都不做
// 檢查：用了好東西的晚上星星比較多、從來不會比較差；厚棉被擋掉寒流、花露水擋掉蚊子；只放好東西也比完全不管好。

import { NightSim, type GrandmaState } from '../src/world/night/sim'
import { planNight, type NightPlan } from '../src/world/night/plan'
import { ACTION_DEFS } from '../src/world/night/actions'
import { rateGuest } from '../src/world/night/rating'
import { GUESTS } from '../src/world/night/guests'
import { GOODS, goodsLovedBy, type GoodId } from '../src/world/night/items'
import { GUEST_ROOMS } from '../src/scene/layout'
import type { NeedKind, ObjectState, RoomId } from '../src/world/night/types'

const HOURS_PER_SEC = 1 / 37.5
const DT = 0.1

type Strategy = 'idle' | 'helper' | 'goods' | 'goodsOnly'

const FIX: Partial<Record<NeedKind, { action: keyof typeof ACTION_DEFS; at: 'bedside' | 'nightstand' | 'fan' | 'coil'; object?: string }>> = {
  cold: { action: 'tuck', at: 'bedside' },
  hot: { action: 'temp', at: 'fan', object: 'fan' },
  thirsty: { action: 'water', at: 'nightstand', object: 'cup' },
  mosquito: { action: 'coil', at: 'coil', object: 'coil' },
  dark: { action: 'nightlight', at: 'nightstand', object: 'lamp' },
  hungry: { action: 'deliver', at: 'nightstand', object: 'dish' },
  insomnia: { action: 'pat', at: 'bedside' },
  play: { action: 'play', at: 'bedside' },
  chat: { action: 'chat', at: 'bedside' },
  lost: { action: 'retrieve', at: 'bedside' },
}

/** 傍晚會準備的好東西（跟 HUD 的「今晚可能用得到」同一個邏輯）：事件優先，再來是客人喜歡的；每間最多兩樣 */
function goodsFor(plan: NightPlan, room: RoomId): GoodId[] {
  const out: GoodId[] = []
  if (plan.event === 'coldsnap') out.push('quilt')
  if (plan.event === 'mosquitoes') out.push('floral')
  const party = plan.parties.find((p) => p.room === room)
  for (const id of party?.members ?? []) for (const k of goodsLovedBy(GUESTS[id].type)) if (!out.includes(k)) out.push(k)
  return out.slice(0, 2)
}

interface Result {
  stars: Record<string, number>
  needs: Record<string, number>
  placed: string[]
}

function run(plan: NightPlan, seed: number, strat: Strategy): Result {
  const sim = new NightSim(plan, { seed, upgrades: [] })
  const objects: Record<string, ObjectState> = {}
  const needs: Record<string, number> = {}
  const placed: string[] = []
  const tucked = new Set<RoomId>()
  const home = strat !== 'idle'
  const gm: GrandmaState = { x: -9.5, z: 5.5, speed: 0, busy: false, carrying: false, home, walkFactor: 1 }
  const helps = strat === 'helper' || strat === 'goods'
  const useGoods = strat === 'goods' || strat === 'goodsOnly'
  let hour = 22
  let t = 0
  let lastScare = 0
  let goodsDone = false
  const pending = new Map<string, number>()
  while (hour < 30) {
    t += DT
    hour += DT * HOURS_PER_SEC
    for (const e of sim.update(DT, hour, gm, objects)) if (e.t === 'need') needs[e.kind] = (needs[e.kind] ?? 0) + 1
    if (useGoods && !goodsDone && hour >= 22.33) {
      goodsDone = true
      for (const p of plan.parties)
        for (const k of goodsFor(plan, p.room)) {
          sim.useGood(p.room, k)
          if (k === 'banquet') objects[`${p.room}.dish`] = { on: true, at: t }
          placed.push(`${p.room}:${k}`)
        }
    }
    if (!helps) continue
    for (const g of sim.guests) {
      for (const n of g.needs) {
        const key = `${g.id}.${n.kind}`
        if (n.kind === 'scare') continue
        if (!pending.has(key)) pending.set(key, t + 8)
        if (t < pending.get(key)!) continue
        const fix = FIX[n.kind]
        if (!fix) continue
        const at = GUEST_ROOMS[g.room][fix.at]
        const def = ACTION_DEFS[fix.action]
        if (def.type === 'kind' && sim.wouldBeSeen(at[0], at[1], g.room) && t < pending.get(key)! + 40) continue
        if (def.type === 'kind') sim.actionSeen(at[0], at[1], g.room, true)
        if (fix.action === 'tuck') sim.tuck(g.room)
        if (fix.object) objects[`${g.room}.${fix.object}`] = { on: true, at: t }
        sim.satisfy(g.room, n.kind, def.comfort ?? 0)
        if (def.noise > 0) sim.noise(at[0], at[1], def.noise)
        pending.delete(key)
        break
      }
      if (!g.awake && g.mode === 'bed' && !tucked.has(g.room)) {
        tucked.add(g.room)
        sim.tuck(g.room)
      }
      if (g.def.type === 'thrill' && g.awake && g.filming && hour - lastScare > 0.66) {
        lastScare = hour
        sim.scare(g.filming, g.x + 1.5, g.z, ACTION_DEFS.knock.fear!, ACTION_DEFS.knock.noise, false)
      }
    }
    if (sim.dog?.barking && !sim.dog.calm) sim.calmDog()
  }
  const stars: Record<string, number> = {}
  for (const g of sim.guests) stars[g.id] = rateGuest(g)
  return { stars, needs, placed }
}

// ---------------------------------------------------------------------------

const P = (a: string[], b: string[] | null, event: NightPlan['event']): NightPlan => ({
  parties: [{ room: 'r1', members: a as NightPlan['parties'][number]['members'] }, ...(b ? [{ room: 'r2' as RoomId, members: b as NightPlan['parties'][number]['members'] }] : [])],
  event,
})
const nights: { name: string; plan: NightPlan }[] = [
  ...[1, 2, 3, 4].map((n) => ({ name: `M1-N${n}`, plan: planNight(n, 20, 0, 0) })),
  { name: 'mixed-N9', plan: planNight(9, 50, 50, 0) },
  { name: 'coldsnap', plan: P(['xiaomei'], ['agui', 'atu'], 'coldsnap') },
  { name: 'mosquitoes', plan: P(['linmom', 'xiaoyu'], ['zhang'], 'mosquitoes') },
  { name: 'caregiver', plan: P(['zhiming', 'fubo'], ['zhiwei'], 'none') },
  { name: 'backpacker', plan: P(['ahao'], ['akai'], 'none') },
]

const SEEDS = [1, 2, 3, 4, 5, 6]
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
let failed = 0
const fail = (msg: string) => {
  console.log(`   !! ${msg}`)
  failed++
}
const all: Record<Strategy, number[]> = { idle: [], helper: [], goods: [], goodsOnly: [] }

for (const { name, plan } of nights) {
  const who = plan.parties.map((p) => `${p.room}:${p.members.join('+')}`).join(' ')
  console.log(`\n== ${name}  ${who}  event=${plan.event}`)
  const per: Record<Strategy, number[]> = { idle: [], helper: [], goods: [], goodsOnly: [] }
  const needsBy: Record<Strategy, Record<string, number>> = { idle: {}, helper: {}, goods: {}, goodsOnly: {} }
  let placed: string[] = []
  for (const strat of ['idle', 'helper', 'goods', 'goodsOnly'] as Strategy[]) {
    const byGuest: Record<string, number[]> = {}
    for (const seed of SEEDS) {
      const r = run(plan, seed * 53 + name.length, strat)
      for (const [id, s] of Object.entries(r.stars)) (byGuest[id] ??= []).push(s)
      for (const [k, v] of Object.entries(r.needs)) needsBy[strat][k] = (needsBy[strat][k] ?? 0) + v / SEEDS.length
      if (strat === 'goods') placed = r.placed
    }
    per[strat] = Object.values(byGuest).flat()
    all[strat].push(...per[strat])
    const txt = Object.entries(byGuest)
      .map(([id, xs]) => `${id} ${avg(xs).toFixed(1)}★`)
      .join('  ')
    const nd = Object.entries(needsBy[strat])
      .map(([k, v]) => `${k}=${v.toFixed(1)}`)
      .join(' ')
    console.log(`   ${strat.padEnd(9)} avg ${avg(per[strat]).toFixed(2)}  ${txt}   | needs ${nd}`)
  }
  console.log(`   placed: ${placed.map((p) => `${p.split(':')[0]} ${GOODS[p.split(':')[1] as GoodId].verb}`).join('、')}`)
  const h = avg(per.helper)
  const g = avg(per.goods)
  if (g < h - 0.05) fail(`${name}: goods ${g.toFixed(2)} worse than helper ${h.toFixed(2)}`)
  if (avg(per.goodsOnly) < avg(per.idle)) fail(`${name}: goodsOnly worse than idle`)
  if (name === 'coldsnap' && (needsBy.goods.cold ?? 0) > 0.01) fail(`coldsnap: 厚棉被 should block cold (got ${needsBy.goods.cold})`)
  if (name === 'mosquitoes' && (needsBy.goods.mosquito ?? 0) > 0.01) fail(`mosquitoes: 花露水 should block mosquito (got ${needsBy.goods.mosquito})`)
}

const H = avg(all.helper)
const G = avg(all.goods)
console.log(`\noverall  idle ${avg(all.idle).toFixed(2)}  helper ${H.toFixed(2)}  goods ${G.toFixed(2)}  goodsOnly ${avg(all.goodsOnly).toFixed(2)}`)
const O = avg(all.goodsOnly)
const I = avg(all.idle)
// 好東西要有感（贏 helper），但不能取代整晚照顧（只放好東西離 helper 還很遠）
if (G < H + 0.1) fail(`goods overall ${G.toFixed(2)} should beat helper ${H.toFixed(2)} by ≥ 0.1`)
if (O < I + 0.5) fail(`goodsOnly ${O.toFixed(2)} should clearly beat idle ${I.toFixed(2)}`)
if (O > H - 1.2) fail(`goodsOnly ${O.toFixed(2)} too close to helper ${H.toFixed(2)}: goods replace the whole night`)

console.log(failed ? `\n${failed} problem(s)` : '\nall goods checks OK')
process.exit(failed ? 1 : 0)
