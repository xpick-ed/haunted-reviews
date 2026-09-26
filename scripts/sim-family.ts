// 大人的心事的機器人測試（不用瀏覽器）：npx tsx scripts/sim-family.ts
//
//   福伯   不管他 → 志明驚醒、自己找到爸爸（沒解決）；早早帶回床上 → 志明一覺到天亮；
//          志明在找的時候帶回去 → 志明回房看到爸爸、睡了；跟他說話的選項會寫進評論
//   志偉   成人內容關著不會出現；陪他兩件事再推手機 → 送出訊息、回去睡、顯示 1925；不理他 → 天亮前先走
//   分遺產 第 10 晚：沒托夢 → 天亮 calm: false；托夢 → calm: true（各只發一次）
//   台詞   用到的台詞 id 都存在；志偉的台詞沒有不該出現的字

import fs from 'node:fs'
import path from 'node:path'
import { NightSim, type GrandmaState, type SimEvent } from '../src/world/night/sim'
import type { NightPlan } from '../src/world/night/plan'
import { BED_NODE, NODES, route } from '../src/world/night/nav'
import { GUEST_ROOMS } from '../src/scene/layout'
import { DAWN_AT, FAMILY_BARKS, HOTLINE, INHERITANCE_NIGHT, ZHIMING_WAKE_AFTER, makeFamily, type Family } from '../src/world/night/family'
import { ADULT_STORY_HOTSPOTS, FAMILY_DIALOGUES } from '../src/world/adultStory'
import { BARKS } from '../src/data/barks'
import { dreamFor } from '../src/world/dream'
import type { GuestId } from '../src/world/night/types'

const HOURS_PER_SEC = 1 / 37.5
const DT = 0.1
type XZ = [number, number]

let fails = 0
function check(ok: boolean, msg: string) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`)
  if (!ok) fails++
}

// ---------------------------------------------------------------------------
// 機器人阿嬤
// ---------------------------------------------------------------------------

class Bot {
  gm: GrandmaState = { x: 0, z: 1.4, speed: 0, busy: false, carrying: false, home: true, walkFactor: 1 }
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
  sim: NightSim
  fam: Family
  bot: Bot
  hour: number
  events: SimEvent[]
  /** 每一幀在模擬之前呼叫（機器人的腦袋）；回傳機器人這一幀走多快 */
  brain?: (r: Run) => number | void
}

function setup(plan: NightPlan, night: number, adult: boolean, story: string[] = []): Run | null {
  const sim = new NightSim(plan, { seed: night * 131 + 7, upgrades: [] })
  const fam = makeFamily(sim, { night, story }, { adult })
  if (!fam) return null
  sim.plugins.push(fam)
  return { sim, fam, bot: new Bot(), hour: 22, events: [] }
}

function runUntil(r: Run, until: number | ((r: Run) => boolean)) {
  const done = typeof until === 'number' ? () => r.hour >= until : () => until(r)
  while (!done(r) && r.hour < 30) {
    const speed = r.brain?.(r)
    r.bot.step(DT, typeof speed === 'number' ? speed : 2.3)
    r.events.push(...r.sim.update(DT, r.hour, r.bot.gm, {}))
    r.hour += DT * HOURS_PER_SEC
  }
}

const lines = (r: Run) => r.events.filter((e) => e.t === 'custom' && e.kind === 'line').map((e) => (e as { data: { id: string } }).data.id)
const customs = (r: Run, kind: string) => r.events.filter((e) => e.t === 'custom' && e.kind === kind) as { t: 'custom'; kind: string; data?: unknown }[]
const guest = (r: Run, id: GuestId) => r.sim.guests.find((g) => g.id === id)!
const clock = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`

/** 機器人：走到福伯看得到的地方，等他跟上來，再慢慢走回客房床邊（路線只在需要時重新規劃，不會來回抖） */
function escortBrain(startWhen: (r: Run) => boolean) {
  let mode: 'find' | 'lead' | null = null
  let target: XZ = [0, 0]
  return (r: Run) => {
    const f = r.fam
    const g = guest(r, 'fubo')
    if (!f.fuboOut || !startWhen(r)) {
      r.bot.path = []
      mode = null
      return
    }
    const [bx, bz] = GUEST_ROOMS[g.room].bedside
    const from = () => nearestNode(r.bot.gm.x, r.bot.gm.z)
    if (f.fubo === 'follow') {
      // 帶路：走太快他會跟丟，離他超過 3 公尺就停下來等
      if (mode !== 'lead') {
        mode = 'lead'
        r.bot.goTo([...route(from(), BED_NODE[g.room]), [bx, bz]])
      }
      return Math.hypot(g.x - r.bot.gm.x, g.z - r.bot.gm.z) > 3 ? 0 : 1.0
    }
    // 去找他：走到他身邊（他走遠了才重新規劃）
    if (mode !== 'find' || Math.hypot(target[0] - g.x, target[1] - g.z) > 1.5) {
      mode = 'find'
      target = [g.x, g.z]
      r.bot.goTo([...route(from(), nearestNode(g.x, g.z)), target])
    }
    return 2.3
  }
}

const FUBO_PLAN: NightPlan = {
  parties: [
    { room: 'r1', members: ['zhiming', 'fubo'] },
    { room: 'r2', members: ['xiaomei'] },
  ],
  event: 'none',
}
const WEI_PLAN: NightPlan = {
  parties: [
    { room: 'r1', members: ['zhiming', 'fubo'] },
    { room: 'r2', members: ['zhiwei'] },
  ],
  event: 'none',
}

// ---------------------------------------------------------------------------
console.log('\n福伯＆志明：不管他')
{
  const r = setup(FUBO_PLAN, 5, false)!
  r.bot.gm.home = false
  runUntil(r, 30)
  const z = guest(r, 'zhiming')
  const f = guest(r, 'fubo')
  check(r.fam.fuboStart >= 24 && r.fam.fuboStart <= 24.5, `福伯 ${clock(r.fam.fuboStart)} 起來找阿玉`)
  check(lines(r).includes('fam.fubo.wake'), '起床的台詞')
  check(lines(r).includes('fam.zhiming.panic'), '志明驚醒')
  check(r.fam.fubo === 'found' && r.fam.ming === 'done', `志明自己找到爸爸（fubo=${r.fam.fubo} ming=${r.fam.ming}）`)
  check(f.mode === 'bed' && z.mode === 'bed', '兩個人都回到床上')
  check(!z.met.includes('insomnia'), '志明的睡不著沒有解決')
  check(!!r.sim.reviewNotes.zhiming?.includes('很久很久'), `志明的評論：${r.sim.reviewNotes.zhiming}`)
  check(!!r.sim.reviewNotes.fubo?.includes('志明代寫'), `福伯的評論：${r.sim.reviewNotes.fubo}`)
}

console.log('\n福伯＆志明：志明醒來之前就帶回床上')
{
  const r = setup(FUBO_PLAN, 5, false)!
  r.brain = escortBrain(() => true)
  runUntil(r, (x) => x.fam.fubo === 'home' || x.fam.fubo === 'found')
  const at = r.hour
  runUntil(r, at + 0.5)
  const z = guest(r, 'zhiming')
  check(r.fam.fubo === 'home', `帶回去了（${clock(at)}，走了 ${((at - r.fam.wanderStart) * 60).toFixed(0)} 分鐘）`)
  check(lines(r).includes('fam.fubo.greet'), '福伯把阿嬤認成阿玉')
  check(at - r.fam.wanderStart < ZHIMING_WAKE_AFTER && !lines(r).includes('fam.zhiming.panic'), '志明沒有醒來')
  check(!z.awake && z.met.includes('insomnia') && z.deepUntil > r.hour, '志明睡得很沉（睡不著解決）')
  check(!!r.sim.reviewNotes.zhiming?.includes('第一次一覺睡到天亮'), `志明的評論：${r.sim.reviewNotes.zhiming}`)
  check(r.sim.reviewNotes.fubo?.includes('牽他回房間') ?? false, `福伯的評論：${r.sim.reviewNotes.fubo}`)
  check(customs(r, 'family.reward').length === 1, '功德')
  runUntil(r, 30)
  check(guest(r, 'fubo').mode === 'bed' && r.fam.fubo === 'home', '福伯沒有再起來')
}

console.log('\n福伯＆志明：志明在找的時候把爸爸帶回去')
{
  const r = setup(FUBO_PLAN, 5, false)!
  // 阿嬤一開始在灶腳忙（福伯走的路上看不到她）
  r.bot.gm.x = -8.4
  r.bot.gm.z = 3.2
  let searchAt = 0
  r.brain = escortBrain((x) => {
    if (x.fam.ming === 'search' && !searchAt) searchAt = x.hour
    return !!searchAt && x.hour > searchAt + 3 * HOURS_PER_SEC
  })
  runUntil(r, (x) => x.fam.ming === 'done')
  const z = guest(r, 'zhiming')
  check(r.fam.fubo === 'home', `阿嬤先帶回去了（fubo=${r.fam.fubo}）`)
  check(lines(r).includes('fam.zhiming.relief'), '志明回房看到爸爸')
  check(!z.awake && z.met.includes('insomnia'), '志明睡了')
  check(!!r.sim.reviewNotes.zhiming?.includes('被子蓋到下巴'), `志明的評論：${r.sim.reviewNotes.zhiming}`)
}

console.log('\n福伯：跟他說話（說實話）')
{
  const r = setup(FUBO_PLAN, 5, false)!
  r.brain = escortBrain(() => true)
  runUntil(r, (x) => x.fam.fubo === 'follow')
  check(r.fam.canTalkFubo(), '可以跟他說話')
  r.fam.talkFubo('truth')
  check(!r.fam.canTalkFubo() && r.fam.talked === 'truth', '只能說一次')
  runUntil(r, (x) => x.fam.fubo === 'home' || x.fam.fubo === 'found')
  runUntil(r, r.hour + 0.05)
  check(lines(r).includes('fam.fubo.bed.truth'), '回床上的台詞跟著變')
  check(!!r.sim.reviewNotes.fubo?.includes('好好吃飯'), `福伯的評論：${r.sim.reviewNotes.fubo}`)
}

console.log('\n福伯：托夢睡得很沉就不會起來')
{
  const r = setup(FUBO_PLAN, 5, false)!
  r.bot.gm.home = false
  runUntil(r, 23.9)
  const f = guest(r, 'fubo')
  f.awake = false
  f.deepUntil = 26
  runUntil(r, 30)
  check(r.fam.fubo === 'skip', `今晚沒有起來（${r.fam.fubo}）`)
  check(r.fam.ming === 'idle' && !lines(r).includes('fam.zhiming.panic'), '志明沒有被嚇醒')
}

console.log('\n志偉：成人內容關著')
{
  const plan: NightPlan = { parties: [{ room: 'r2', members: ['zhiwei'] }], event: 'none' }
  const sim = new NightSim(plan, { seed: 1, upgrades: [] })
  check(makeFamily(sim, { night: 5, story: [] }, { adult: false }) === null, '沒有外掛')
  const fam = makeFamily(new NightSim(WEI_PLAN, { seed: 1, upgrades: [] }), { night: 5, story: [] }, { adult: false })!
  check(!fam.hasWei && fam.wei === 'skip', '同房有福伯時，志偉的故事也不會開始')
}

console.log('\n志偉：陪他、推手機')
{
  const r = setup(WEI_PLAN, 5, true)!
  r.bot.gm.home = false
  runUntil(r, (x) => x.fam.wei === 'sit')
  const g = guest(r, 'zhiwei')
  check(r.hour >= 25.5 && r.hour < 25.8, `${clock(r.hour)} 坐到茶桌前`)
  check(lines(r).includes('fam.zhiwei.out'), '出去的台詞')
  runUntil(r, r.hour + 0.2)
  check(g.mode === 'stand' && Math.abs(g.heading + 0.8) < 0.01 && g.suspicion === 0, '盯著手機（不會東張西望、看不到阿嬤）')
  check(r.fam.act('tea') === 1 && !r.fam.phoneReady, '倒茶：第 1 件事，還沒準備好')
  check(r.fam.act('tea') === 0, '同一件事不能做兩次')
  check(r.fam.act('hum') === 2 && r.fam.phoneReady, '哼歌：第 2 件事，可以推手機了')
  r.fam.sendMessage()
  check(r.fam.sent && r.fam.wei === 'send', '訊息送出去了')
  runUntil(r, r.hour + 0.4)
  check(customs(r, 'family.hotline').length === 1, `顯示安心專線（${HOTLINE.includes('1925') ? '1925' : '缺號碼'}）`)
  check(r.fam.wei === 'home' && g.mode === 'bed' && !g.awake && g.deepUntil > r.hour, '回房間睡得很沉')
  check(g.met.includes('insomnia'), '睡不著解決')
  check(!!r.sim.reviewNotes.zhiwei?.includes('回家就好'), `評論：${r.sim.reviewNotes.zhiwei}`)
  runUntil(r, 30)
  check(customs(r, 'family.zhiwei.left').length === 0, '沒有先走')
}

console.log('\n志偉：沒人陪')
{
  const r = setup(WEI_PLAN, 5, true)!
  r.bot.gm.home = false
  runUntil(r, 30)
  const g = guest(r, 'zhiwei')
  check(r.fam.wei === 'gone' && g.mode === 'bed', `天快亮回房間收東西（${r.fam.wei}）`)
  check(customs(r, 'family.zhiwei.left').length === 1, '天亮前先走了（事件一次）')
  check(!!r.sim.reviewNotes.zhiwei?.includes('沒跟老闆打招呼'), `評論：${r.sim.reviewNotes.zhiwei}`)
}

console.log('\n分遺產')
{
  const plan: NightPlan = { parties: [{ room: 'r1', members: ['zhang'] }], event: 'none' }
  check(makeFamily(new NightSim(plan, { seed: 1, upgrades: [] }), { night: 9, story: [] }, { adult: false }) === null, '第 9 晚沒有')
  check(makeFamily(new NightSim(plan, { seed: 1, upgrades: [] }), { night: INHERITANCE_NIGHT, story: ['ended_sold'] }, { adult: false }) === null, '看過結局就沒有')
  const a = setup(plan, INHERITANCE_NIGHT, false)!
  a.bot.gm.home = false
  runUntil(a, 30)
  const ea = customs(a, 'family.inheritance')
  check(ea.length === 1 && (ea[0].data as { calm: boolean }).calm === false, '沒托夢：天亮叔叔打來吵（calm: false，一次）')
  const b = setup(plan, INHERITANCE_NIGHT, false)!
  runUntil(b, 24)
  b.fam.calmAunt('sewing')
  runUntil(b, 30)
  const eb = customs(b, 'family.inheritance')
  check(eb.length === 1 && (eb[0].data as { calm: boolean }).calm === true, `托夢了：天亮姑姑打給叔叔（${DAWN_AT} 之後、calm: true）`)
}

// ---------------------------------------------------------------------------
console.log('\n台詞')
{
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '../src/data')
  const LINES: Record<string, { who: string; text: string }> = {}
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.lines.json')) Object.assign(LINES, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
  const missing: string[] = []
  const need = (id: string) => {
    if (!LINES[id]) missing.push(id)
  }
  for (const d of Object.values(FAMILY_DIALOGUES)) for (const s of d.steps) {
    need(s.line)
    for (const c of s.choices ?? []) need(c.line)
  }
  for (const [id, kinds] of Object.entries(FAMILY_BARKS)) {
    check(BARKS[id as GuestId] === kinds || Object.keys(BARKS[id as GuestId]).length === Object.keys(kinds!).length, `${id} 的碎念已經補進 BARKS（${Object.keys(kinds!).length} 種）`)
    for (const list of Object.values(kinds!)) for (const l of list) need(l)
  }
  for (const id of ['zhiming', 'fubo', 'zhiwei'] as GuestId[]) {
    const def = dreamFor(id)
    for (const l of Object.values(def.lines).flat()) if (typeof l === 'string' && l.startsWith(`dream.${id}`)) need(l)
  }
  // 程式裡直接寫的台詞 id
  const src = ['../src/world/night/family.ts', '../src/world/adultStory.ts'].map((p) => fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), p), 'utf8')).join('\n')
  for (const m of src.matchAll(/'((?:fam|zw|inh)\.[\w.]+)'/g)) need(m[1])
  for (const k of [1, 2, 3]) need(`fam.fubo.call.${k}`), need(`fam.zhiming.search.${k}`)
  for (const a of ['tea', 'meal', 'hum']) need(`zw.${a}.react`)
  check(missing.length === 0, `用到的台詞都存在${missing.length ? '，缺：' + missing.join(', ') : ''}`)
  const own = JSON.parse(fs.readFileSync(path.join(dir, 'family.lines.json'), 'utf8')) as Record<string, { who: string; text: string }>
  const cast = new Set((JSON.parse(fs.readFileSync(path.join(dir, 'cast.json'), 'utf8')) as { id: string }[]).map((c) => c.id))
  const noCast = Object.entries(own).filter(([, l]) => !cast.has(l.who))
  check(noCast.length === 0, `說話的人都在 cast.json 裡${noCast.length ? '：' + noCast.map(([k]) => k).join(', ') : ''}`)
  // 志偉的故事：不描述細節、不美化（只在結尾給求助資訊）
  const BAD = ['死', '自殺', '跳下', '藥', '遺書', '不想活', '結束生命', '輕生']
  const heavy = Object.entries(own).filter(([k, l]) => (k.startsWith('zw.') || k.includes('zhiwei')) && BAD.some((w) => l.text.includes(w)))
  check(heavy.length === 0, `志偉的台詞沒有不該出現的字${heavy.length ? '：' + heavy.map(([k]) => k).join(', ') : ''}`)
  check(HOTLINE === '如果你也覺得撐不下去，可以打 1925 安心專線（24 小時）。', '安心專線的字卡')
}

console.log('\n互動點')
{
  const ids = ADULT_STORY_HOTSPOTS.map((h) => h.id)
  check(new Set(ids).size === ids.length, `沒有重複的 id（${ids.length} 個）`)
  const s = (over: object) => ({ phase: 'night', meta: { night: 5, story: [] }, flags: {}, carrying: false, yin: 100, ...over }) as never
  const labels = (st: never) => ADULT_STORY_HOTSPOTS.map((h) => h.label(st)).filter(Boolean)
  check(labels(s({})).length === 0, '平常的晚上什麼都沒有')
  check(labels(s({ phase: 'dusk', meta: { night: INHERITANCE_NIGHT, story: [] } })).includes('站在神明廳門口偷聽'), '第 10 晚傍晚可以偷聽')
  check(!labels(s({ phase: 'dusk', meta: { night: INHERITANCE_NIGHT, story: ['inheritance'] } })).length, '聽過就不再出現')
  check(labels(s({ meta: { night: INHERITANCE_NIGHT, story: [] } })).includes('坐在姑姑床邊（托夢）'), '第 10 晚晚上可以托夢給姑姑')
  check(!labels(s({ meta: { night: INHERITANCE_NIGHT, story: [] }, flags: { inheritance_calm: true } })).length, '托夢過就不再出現')
}

console.log(fails ? `\n✗ ${fails} 項沒過` : '\n✓ 全部通過')
process.exit(fails ? 1 : 0)
