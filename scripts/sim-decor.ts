// 裝修民宿的檢查（不用瀏覽器）：npx tsx scripts/sim-decor.ts
//
// 1. 擺放規則：幾個該可以／不可以擺的位置
// 2. 效果換算：一組範例擺設的 DecorBonus
// 3. 放進 NightSim 跑一整晚：有擺設 vs 沒擺設的星數

import { GUEST_ROOMS, BED, WING_R, FENCE } from '../src/scene/layout'
import { UNPLACED, decorBonus, decorSummary, snapPlacement } from '../src/world/decorCatalog'
import type { DecorPlacement } from '../src/world/night/director'
import { NightSim } from '../src/world/night/sim'
import { planNight } from '../src/world/night/plan'
import { rateGuest } from '../src/world/night/rating'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed++
}

// ---------------------------------------------------------------------------
console.log('== 擺放規則')
const none: DecorPlacement[] = []
const r1 = GUEST_ROOMS.r1
const r2 = GUEST_ROOMS.r2
{
  const p = snapPlacement('orchid', 8.6, 1.9, 0, none)
  check('客房一衣櫃旁邊可以擺盆栽', p.ok && p.room === 'r1', p.why)
}
{
  const p = snapPlacement('orchid', BED.x, BED.z, 0, none)
  check('床上不能擺盆栽', !p.ok, p.why)
}
{
  const p = snapPlacement('orchid', r1.doorIn[0], r1.doorIn[1], 0, none)
  check('客房門口不能擺', !p.ok, p.why)
}
{
  const p = snapPlacement('net', r2.bed.x + 0.3, r2.bed.z, 0, none)
  check('蚊帳會罩到客房二的床上', p.ok && p.room === 'r2' && p.x === r2.bed.x && p.z === r2.bed.z, p.why)
}
{
  const p = snapPlacement('net', 0, 3, 0, none)
  check('埕上不能擺蚊帳', !p.ok, p.why)
}
{
  const p = snapPlacement('lanterns', 2.5, 4.2, 0, none)
  check('燈籠串可以擺在埕', p.ok && p.room === null, p.why)
}
{
  const p = snapPlacement('lanterns', WING_R.x0 + 0.5, 5.6, 0, none)
  check('燈籠串不能擺在客房', !p.ok, p.why)
}
{
  const p = snapPlacement('clock', 8.4, 5.7, 0, none)
  check('掛鐘會貼到客房一的牆上', p.ok && p.room === 'r1' && p.y > 1.5, `${p.x.toFixed(2)}, ${p.z.toFixed(2)} rot ${p.rot.toFixed(2)} ${p.why}`)
}
{
  const p = snapPlacement('curtain', 0, 3, 0, none)
  check('花布窗簾只能掛在客房', !p.ok, p.why)
}
{
  const p = snapPlacement('orchid', 0, FENCE.z + 2, 0, none)
  check('圍牆外不能擺', !p.ok, p.why)
}
{
  const a: DecorPlacement[] = [{ item: 'orchid', x: 8.6, z: 1.9, rot: 0, room: 'r1' }]
  const p = snapPlacement('fishtank', 8.4, 2.0, 0, a)
  check('不能跟別的擺設疊在一起', !p.ok, p.why)
}

// ---------------------------------------------------------------------------
console.log('\n== 效果換算')
const layout: DecorPlacement[] = [
  { item: 'net', x: r1.bed.x, z: r1.bed.z, rot: 0, room: 'r1' },
  { item: 'orchid', x: 8.6, z: 1.9, rot: 0, room: 'r1' },
  { item: 'curtain', x: WING_R.x1 - 0.2, z: 5.2, rot: -Math.PI / 2, room: 'r1' },
  { item: 'doll', x: r2.bed.x, z: r2.bed.z + 1.5, rot: 0, room: 'r2' },
  { item: 'windchime', x: 3.5, z: -2.8, rot: 0, room: null },
  { item: 'lanterns', x: 2.5, z: 4.2, rot: 0, room: null },
  // 還沒擺的（倉庫）不算
  { item: 'rockinghorse', x: UNPLACED, z: UNPLACED, rot: 0, room: null },
]
const bonus = decorBonus(layout)
console.log(JSON.stringify(bonus))
for (const r of decorSummary(layout)) console.log(`  ${r.room}：${r.text}`)
check('客房一沒有蚊子', !!bonus.noMosquito?.includes('r1'))
check('客房一舒適 = 蚊帳 3 + 蘭花 4 + 窗簾 5 + 燈籠串 2 = 14', bonus.comfort?.r1 === 14, String(bonus.comfort?.r1))
check('客房二嚇人 +2（人偶）', bonus.spooky?.r2 === 2, String(bonus.spooky?.r2))
check('倉庫裡的搖搖馬沒有效果', !bonus.likes?.r1?.includes('child') && !bonus.likes?.r2?.includes('child'))

// ---------------------------------------------------------------------------
console.log('\n== 放進模擬跑一晚（什麼都不做，只看擺設的差別）')
const hidden = { x: -9.5, z: 5.5, speed: 0, busy: false, carrying: false, home: true, walkFactor: 1 }
function night(n: number, decor?: DecorPlacement[]) {
  const plan = planNight(n, 20, 0, 0)
  const sim = new NightSim(plan, { seed: 42 + n, upgrades: [], decor: decor ? decorBonus(decor) : undefined })
  let hour = 22
  while (hour < 30) {
    hour += 0.1 / 37.5
    sim.update(0.1, hour, hidden, {})
  }
  return sim.guests.map((g) => `${g.id} ${rateGuest(g)}★ 舒適 ${Math.round(g.comfort)}`).join('  ')
}
for (const n of [1, 2]) {
  console.log(`  第 ${n} 晚 沒擺設：${night(n)}`)
  console.log(`  第 ${n} 晚 有擺設：${night(n, layout)}`)
}

console.log(failed ? `\n${failed} problem(s)` : '\nall decor checks OK')
process.exit(failed ? 1 : 0)
