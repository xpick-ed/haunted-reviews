// 跟小翰的陰陽溝通（DESIGN §31.2）的測試：npm run test:han
// 規則（鏡子、帳本、擲筊、托夢、收音機、隔天的反應、門檻、碗筷、結局多一張）＋一個認真玩的人和一個隨便玩的人各跑 12 晚。
import { readFileSync, readdirSync } from 'node:fs'
import type { Meta } from '../src/world/night/director'
import { DIALOGUES } from '../src/world/dialogues'
import {
  HAN_HOTSPOTS,
  MIRROR_MSGS,
  SENSE,
  TIERS,
  addSense,
  afterDream,
  doneOn,
  duskReactions,
  hanDreamPick,
  kneelResult,
  ledgerMistake,
  ledgerMoney,
  ledgerOpen,
  mirrorOpen,
  mirrorTonight,
  radioOpen,
  writeMirror,
} from '../src/world/han'
import { HAN_KNOWS, hanEpilogue, hanHeartBonus, type EndingId } from '../src/world/story'
import { KNEEL_NIGHTS, bowlBeat, hanAtHome, kneelBeat } from '../src/world/storyBeats'
import { hanPostscript } from '../src/world/requests'

let bad = 0
const check = (name: string, ok: boolean, info = '') => {
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? `：${info}` : ''}`)
}

const base = (p: Partial<Meta> = {}): Meta =>
  ({ night: 1, money: 20000, heart: 60, memories: [], pastDone: [], story: [], debtMonths: 0, hanSense: 0, hanSigns: [], ...p }) as unknown as Meta
type S = { meta: Meta; flags: Record<string, boolean>; phase: 'dusk' | 'night'; time: number }
const st = (p: Partial<S> & { meta: Meta }): S => ({ flags: {}, phase: 'dusk', time: 18, ...p })

// ---------------------------------------------------------------------------
// 台詞、對話
// ---------------------------------------------------------------------------
const LINES: Record<string, { who: string; text: string }> = {}
for (const f of readdirSync('src/data').filter((x) => x.endsWith('.lines.json'))) Object.assign(LINES, JSON.parse(readFileSync(`src/data/${f}`, 'utf8')))
const CAST = new Set((JSON.parse(readFileSync('src/data/cast.json', 'utf8')) as { id: string }[]).map((c) => c.id))
const han = JSON.parse(readFileSync('src/data/han.lines.json', 'utf8')) as Record<string, { who: string; text: string }>
check('han.lines.json 的說話的人都在 cast.json', Object.values(han).every((l) => CAST.has(l.who)), `${Object.keys(han).length} 句`)

const used = new Set<string>()
const dialogueIds = Object.keys(DIALOGUES).filter((k) => k.startsWith('hs_'))
check('對話都登記了（鏡子、煎蛋的夢、碗筷、三場擲筊）', ['hs_mirror', 'hs_dream_omelette', 'hs_bowl', 'hs_jb_3', 'hs_jb_9', 'hs_jb_11'].every((k) => dialogueIds.includes(k)))
for (const id of dialogueIds) {
  const d = DIALOGUES[id]
  const labels = new Set(d.steps.map((s) => s.label).filter(Boolean))
  const gotos = d.steps.flatMap((s) => [s.goto, ...(s.choices ?? []).map((c) => c.goto)]).filter(Boolean) as string[]
  check(`對話 ${id} 的跳轉都有標籤`, gotos.every((g) => labels.has(g)), gotos.filter((g) => !labels.has(g)).join(','))
  for (const s of d.steps) {
    used.add(s.line)
    for (const c of s.choices ?? []) used.add(c.line)
  }
}
// 反應、門檻、結局、收音機、帳本會用到的台詞
for (const m of MIRROR_MSGS) used.add(`hs.re.mirror.${m}`).add(`hs.re.mirror.${m}2`)
for (const k of ['hs.re.ledger.1', 'hs.re.ledger.v0', 'hs.re.ledger.v1', 'hs.re.ledger.v2', 'hs.re.ledger.2', 'hs.re.om.1', 'hs.re.om.2', 'hs.re.om.3', 'hs.radio.1', 'hs.radio.2', 'hs.radio.3', 'hs.radio.gm', 'hs.ledger.flip.0', 'hs.ledger.flip.1', 'hs.ledger.flip.2', 'hs.mirror.noyin', 'hs.ledger.noyin']) used.add(k)
for (const t of TIERS) used.add(`hs.tier${t}.1`).add(`hs.tier${t}.2`)
for (const e of ['train', 'together', 'stay', 'sold'] as EndingId[]) for (const l of hanEpilogue(e, 100)!.lines) used.add(l)
const missing = [...used].filter((k) => !LINES[k])
check('用到的台詞都有寫', !missing.length, missing.length ? missing.join(', ') : `${used.size} 句`)
const unused = Object.keys(han).filter((k) => !used.has(k))
check('han.lines.json 沒有用不到的台詞', !unused.length, unused.join(', '))

// ---------------------------------------------------------------------------
// 鏡子
// ---------------------------------------------------------------------------
{
  const m0 = base({ night: 4 })
  const m1 = writeMirror(m0, 'eat')
  check('鏡子：第一次寫「吃飯」', m1.hanSense === SENSE.mirror + SENSE.mirrorNew && mirrorTonight(m1) === 'eat', `感覺 ${m1.hanSense}`)
  const m2 = writeMirror({ ...m1, night: 5 }, 'eat')
  check('鏡子：隔天再寫一樣的字（沒有新鮮感）', m2.hanSense === m1.hanSense + SENSE.mirror, `感覺 ${m2.hanSense}`)
  check('鏡子：寫過就不能再寫', !mirrorOpen({ phase: 'night', time: 22.5, meta: m1 }) && mirrorOpen({ phase: 'night', time: 22.5, meta: m0 }))
  check('鏡子：只有 22:00–00:00 霧霧的', !mirrorOpen({ phase: 'night', time: 24.2, meta: m0 }) && !mirrorOpen({ phase: 'dusk', time: 22.5, meta: m0 }))
}

// ---------------------------------------------------------------------------
// 帳本
// ---------------------------------------------------------------------------
{
  const nights = Array.from({ length: 60 }, (_, i) => i + 2)
  const has = nights.filter((n) => ledgerMistake(n) !== null).length
  check('帳本：第 1 晚沒有、第 3 晚一定有', ledgerMistake(1) === null && ledgerMistake(3) !== null)
  check('帳本：大約一半的晚上算錯', has > 20 && has < 40, `${has}/60`)
  check('帳本：找回的錢 300–800', nights.every((n) => ledgerMoney(n) >= 300 && ledgerMoney(n) <= 800))
  const m = addSense(base({ night: 3 }), SENSE.ledger, 'ledger@3')
  check('帳本：翻過就不再出現', ledgerOpen({ phase: 'night', meta: base({ night: 3 }) }) && !ledgerOpen({ phase: 'night', meta: m }))
}

// ---------------------------------------------------------------------------
// 隔天傍晚的反應
// ---------------------------------------------------------------------------
{
  const meta = base({ night: 4, hanSense: 18, hanSigns: ['mirror@3=here'] })
  const r = duskReactions({ meta, flags: { hsp_mirror_here: true, hsp_ledger_3: true, other: true } })!
  check('反應：鏡子＋帳本都說', !!r && r.lines[0] === 'hs.re.mirror.here' && r.lines.includes(`hs.re.ledger.v${ledgerMistake(3)}`), r?.lines.join(' '))
  check('反應：心、錢加上去，旗標清掉', r.meta.heart === 60 + 2 + 1 && r.meta.money === 20000 + ledgerMoney(3) && !r.flags.hsp_mirror_here && !r.flags.hsp_ledger_3 && r.flags.other, `心 ${r.meta.heart}、錢 ${r.meta.money}`)
  check('反應：沒事就不說話', duskReactions({ meta: base(), flags: {} }) === null)
  const t = duskReactions({ meta: base({ hanSense: 45 }), flags: {} })!
  check('門檻：一天只說一段（先說 20 的）', t.lines.join() === 'hs.tier20.1,hs.tier20.2' && t.meta.hanSigns.includes('tier20'))
  const t2 = duskReactions({ meta: t.meta, flags: {} })!
  check('門檻：隔天說 40 的，之後就沒了', t2.lines[0] === 'hs.tier40.1' && duskReactions({ meta: t2.meta, flags: {} }) === null)
  const o = duskReactions({ meta: base({ hanSense: 12, hanSigns: ['tier20'] }), flags: { hsp_omelette: true } })!
  check(`反應：煎菜脯蛋（灶腳冒煙、感覺 +${SENSE.omelette}）`, o.smoke && o.meta.hanSense === 12 + SENSE.omelette && o.lines.includes('hs.re.om.2'))
}

// ---------------------------------------------------------------------------
// 托夢、擲筊、收音機
// ---------------------------------------------------------------------------
{
  check('托夢：感覺到一點、第 3 晚起先教煎蛋', hanDreamPick(base({ night: 3, hanSense: 10 })) === 'hs_dream_omelette' && hanDreamPick(base({ night: 2, hanSense: 30 })) === null && hanDreamPick(base({ night: 5, hanSense: 5 })) === null)
  const a = afterDream(base({ night: 4, hanSense: 10 }), {}, 'hs_dream_omelette')
  check('托夢：教完煎蛋隔天會煎、以後不再演', a.flags.hsp_omelette && a.meta.hanSense === 10 + SENSE.dream && hanDreamPick(a.meta) === null)
  const b = afterDream(base({ night: 4, hanSense: 10 }), {}, 'bond_handream_4')
  check('托夢：一般的夢也多感覺一點', !b.flags.hsp_omelette && b.meta.hanSense === 10 + SENSE.dream)

  const dusk = (night: number, flags: Record<string, boolean> = {}, p: Partial<Meta> = {}) => st({ meta: base({ night, ...p }), flags })
  check('擲筊：第 3、9、11 晚傍晚', KNEEL_NIGHTS.every((n) => kneelBeat(dusk(n))) && !kneelBeat(dusk(4)) && !kneelBeat({ ...dusk(3), phase: 'night' }))
  check('擲筊：跪著的時候不在埕裡掃地，擲完就回去', !hanAtHome(dusk(3)) && hanAtHome(dusk(3, { hs_jb_3: true })))
  check('擲筊：結局以後不跪', !kneelBeat(dusk(11, {}, { story: ['ended_stay'] })))
  check('擲筊：第 11 晚兩種都 +10 感覺', kneelResult(11, 'a').sense === 10 && kneelResult(11, 'b').sense === 10)
  check('收音機：他很累才開、一天一次', radioOpen(dusk(5, {}, { heart: 40 })) && !radioOpen(dusk(5, {}, { heart: 50 })) && !radioOpen(dusk(5, {}, { heart: 40, hanSigns: ['radio@5'] })))
  check('收音機：清明（他在山上）不開', !radioOpen(dusk(6, {}, { heart: 30 })))
}

// ---------------------------------------------------------------------------
// 碗筷、結局、心、紙條
// ---------------------------------------------------------------------------
{
  const s = (night: number, sense: number, flags: Record<string, boolean> = {}) => st({ meta: base({ night, hanSense: sense }), flags })
  check('碗筷：到 80 才擺', bowlBeat(s(5, HAN_KNOWS)) && !bowlBeat(s(5, HAN_KNOWS - 1)))
  check('碗筷：看過就不再演', !bowlBeat(s(5, 90, { hs_bowl: true })))
  check('碗筷：擲筊那天先擲筊', !bowlBeat(s(9, 90)) && bowlBeat(s(9, 90, { hs_jb_9: true })))
  check('碗筷：陳董那天、分遺產那天不演', !bowlBeat(s(7, 90)) && !bowlBeat(s(10, 90)))
  const eps = (['train', 'together', 'stay', 'sold'] as EndingId[]).map((e) => hanEpilogue(e, 85))
  check('結局：到 80 每個結局都多一張', eps.every(Boolean) && (['train', 'together', 'stay', 'sold'] as EndingId[]).every((e) => hanEpilogue(e, 79) === null))
  check('結局：插的位置在原本的插畫裡', eps.every((e) => ['nighttrain', 'window', 'window2', 'dawnlights'].includes(e!.before)))
  check('心：他感覺得到阿嬤，好的晚上多一點', hanHeartBonus(50, 3) === 0 && hanHeartBonus(60, 3) === 1 && hanHeartBonus(95, 3) === 2 && hanHeartBonus(95, -5) === 0)
  check('紙條：感覺少不寫附註', hanPostscript({ hanSense: 20, hanSigns: [] }) === '' && hanPostscript({ hanSense: 40, hanSigns: [] }).includes('P.S.'))
  check('紙條：擺過碗筷以後', hanPostscript({ hanSense: 90, hanSigns: ['bowl'] }).includes('多煮了一碗'))
  check('熱點都在家裡', HAN_HOTSPOTS.every((h) => h.scene === 'home') && HAN_HOTSPOTS.length === 5)
}

// ---------------------------------------------------------------------------
// 跑 12 晚：認真玩的人、隨便玩的人
// ---------------------------------------------------------------------------
function play(name: string, opt: { mirrorEvery: number; ledger: boolean; dreamEvery: number; kneel: boolean; radioDays: number[] }) {
  let meta = base({ heart: 55 })
  let flags: Record<string, boolean> = {}
  const log: string[] = []
  let bowlNight = 0
  for (let n = 1; n <= 12; n++) {
    meta = { ...meta, night: n }
    // 傍晚：昨晚的事
    const d = { meta, flags, phase: 'dusk' as const, time: 18 }
    if (hanAtHome(d) || kneelBeat(d) || bowlBeat(d)) {
      const r = duskReactions(d)
      if (r) {
        meta = r.meta
        flags = r.flags
      }
    }
    if (opt.kneel && kneelBeat({ meta, flags, phase: 'dusk' })) {
      const k = kneelResult(n, 'a')
      meta = { ...addSense(meta, k.sense, `jb@${n}`), heart: Math.min(100, meta.heart + k.heart) }
      flags = { ...flags, [`hs_jb_${n}`]: true }
    }
    if (opt.radioDays.includes(n) && radioOpen({ meta: { ...meta, heart: 40 }, flags, phase: 'dusk' })) meta = addSense(meta, SENSE.radio, `radio@${n}`)
    if (bowlBeat({ meta, flags, phase: 'dusk' })) {
      bowlNight = n
      meta = addSense(meta, SENSE.bowl, 'bowl')
      flags = { ...flags, hs_bowl: true }
    }
    // 深夜
    if (n % opt.mirrorEvery === 0 && mirrorOpen({ phase: 'night', time: 22.5, meta })) {
      const msg = MIRROR_MSGS[n % 3]
      meta = writeMirror(meta, msg)
      flags = { ...flags, [`hsp_mirror_${msg}`]: true }
    }
    if (opt.ledger && ledgerOpen({ phase: 'night', meta })) {
      meta = addSense(meta, SENSE.ledger, `ledger@${n}`)
      flags = { ...flags, [`hsp_ledger_${n}`]: true }
    }
    if (n % opt.dreamEvery === 0) {
      const a = afterDream(meta, flags, hanDreamPick(meta) ?? 'bond_handream_1')
      meta = a.meta
      flags = a.flags
    }
    log.push(`${n}:${meta.hanSense}`)
  }
  console.log(`  ${name}：${log.join(' ')}${bowlNight ? `（第 ${bowlNight} 晚擺碗筷）` : ''}`)
  return { sense: meta.hanSense, bowlNight }
}
const keen = play('認真玩', { mirrorEvery: 1, ledger: true, dreamEvery: 1, kneel: true, radioDays: [5, 8] })
const usual = play('一般玩（鏡子每晚、帳本、隔晚托夢）', { mirrorEvery: 1, ledger: true, dreamEvery: 2, kneel: true, radioDays: [] })
const casual = play('隨便玩', { mirrorEvery: 3, ledger: false, dreamEvery: 4, kneel: true, radioDays: [] })
check('認真玩的人第 12 晚以前會看到碗筷', keen.bowlNight > 0 && keen.bowlNight <= 11, `第 ${keen.bowlNight} 晚`)
check('一般玩的人第 12 晚到得了 80（結局多一張）', usual.sense >= HAN_KNOWS, `${usual.sense}`)
check('隨便玩的人到不了 80', casual.sense < HAN_KNOWS, `${casual.sense}`)
check('doneOn 認得「鏡子@晚=字」', doneOn(base({ hanSigns: ['mirror@4=eat'] }), 'mirror', 4) && !doneOn(base({ hanSigns: ['mirror@4=eat'] }), 'mirror', 5))

console.log(bad ? `\n${bad} problem(s)` : '\nall han checks OK')
process.exit(bad ? 1 : 0)
