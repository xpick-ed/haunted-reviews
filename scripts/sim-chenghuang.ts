// 城隍廟（DESIGN §32.2）的 Node 測試：月底考核的打分數、獎勵、判官的台詞、叫號、互動點。
// npm run test:chenghuang
import fs from 'node:fs'
import { CHENGHUANG_HOTSPOTS, CHENGHUANG_SCENE, CH, MERIT_GOOD, MERIT_OK, MY_TICKET, resetCh, reviewMonth, stepCh, useCh, type MonthInput } from '../src/world/sceneChenghuang'
import { DIALOGUES } from '../src/world/dialogues'

const lines: Record<string, { who: string; text: string }> = JSON.parse(fs.readFileSync(new URL('../src/data/chenghuang.lines.json', import.meta.url), 'utf8'))
let fail = 0
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${info ? `  ${info}` : ''}`)
  if (!ok) fail++
}

const base: MonthInput = { month: 1, merit: 30, warm: 40, spooky: 20, heart: 50, money: 5000, pressure: 0, hanSense: 10, memories: 3, debtMonths: 0, ending: null, trainReady: false }

console.log('考核')
{
  const best = reviewMonth({ ...base, merit: MERIT_GOOD + 5, warm: 70, heart: 80, money: 20000 })
  check('全部都好 → 甲上、技能點 +1、功德 +3', best.grade === 'ap' && best.reward.skillPts === 1 && best.reward.merit === 3, JSON.stringify(best.scores))
  const mid = reviewMonth(base)
  check('普通的一個月 → 乙', mid.grade === 'b', `total ${mid.total}`)
  const worst = reviewMonth({ ...base, merit: 0, warm: 5, heart: 10, money: -3000, debtMonths: 1 })
  check('什麼都不好 → 丁、沒有獎勵（不處罰）', worst.grade === 'd' && worst.reward.skillPts === 0 && worst.reward.merit === 0)
  check('負債時判官會提醒', worst.lines.includes('ch.pg.debt'))
  check('功德分級：36 以上好、16 以上普通', reviewMonth({ ...base, merit: MERIT_GOOD }).scores.merit === 2 && reviewMonth({ ...base, merit: MERIT_OK }).scores.merit === 1 && reviewMonth({ ...base, merit: MERIT_OK - 1 }).scores.merit === 0)
  check('第一個月的開場白不一樣', reviewMonth({ ...base, month: 0 }).lines[0] === 'ch.pg.open.first' && mid.lines[0] === 'ch.pg.open.n')
  check('每次都以蓋章結尾', [best, mid, worst].every((r) => r.lines[r.lines.length - 1] === 'ch.pg.stamp'))
  check('小翰想阿嬤、靈異、廟公檢舉、回憶多：各有一句', (() => {
    const r = reviewMonth({ ...base, hanSense: 50, spooky: 60, pressure: 3, memories: 9 })
    return ['ch.pg.han', 'ch.pg.spooky', 'ch.pg.pressure', 'ch.pg.mem'].every((l) => r.lines.includes(l))
  })())
}

console.log('結局前的最後一次報到')
{
  for (const [end, want] of [
    ['train', 'ch.pg.end.train.1'],
    ['together', 'ch.pg.end.together.2'],
    ['stay', 'ch.pg.end.stay'],
    ['sold', 'ch.pg.end.sold'],
  ] as const) {
    const r = reviewMonth({ ...base, month: 2, ending: end })
    check(`${end}：判官提到末班車／厝`, r.lines.includes(want) && r.lines.indexOf(want) < r.lines.indexOf('ch.pg.stamp'))
  }
  check('第二個月回憶夠了：先預告', reviewMonth({ ...base, month: 1, trainReady: true }).lines.includes('ch.pg.tease'))
  check('沒有結局的月份不提末班車', !reviewMonth(base).lines.some((l) => l.startsWith('ch.pg.end.')))
}

console.log('台詞')
{
  const used = new Set<string>()
  for (const g of ['ap', 'a', 'b', 'c', 'd']) used.add(`ch.gm.after.${g}`)
  for (const m of [0, 1, 2]) for (const e of [null, 'train', 'together', 'stay', 'sold'] as const) for (const t of [false, true])
    for (const v of [0, 20, 60]) for (const l of reviewMonth({ ...base, month: m, ending: e, trainReady: t, merit: v, warm: v, heart: v, money: v * 500 - 5000, spooky: v, hanSense: v, pressure: v / 10, memories: v / 5, debtMonths: v ? 0 : 1 }).lines) used.add(l)
  for (const id of ['ch_qiye_first', 'ch_lu', 'ch_suit', 'ch_auntie', 'ch_night_baye']) {
    const d = DIALOGUES[id]
    check(`對話 ${id} 有登記`, !!d)
    for (const s of d?.steps ?? []) used.add(s.line)
  }
  const missing = [...used].filter((l) => !lines[l])
  check('考核與對話用到的台詞都有寫', !missing.length, missing.join(' '))
  const who = new Set(Object.values(lines).map((l) => l.who))
  check('說話的人', [...who].every((w) => ['grandma', 'panguan', 'qiye', 'baye', 'ch_lu', 'ch_suit', 'ch_auntie'].includes(w)), [...who].join(' '))
}

console.log('叫號')
{
  resetCh(reviewMonth(base), null)
  check('還沒抽號碼牌：不跳號', stepCh(10, false).length === 0 && useCh.getState().now === MY_TICKET - 6)
  useCh.setState({ ticket: MY_TICKET })
  let t = 0
  let called = false
  while (t < 60 && !called) {
    const ev = stepCh(0.1, false)
    t += 0.1
    if (ev.includes('call')) called = true
  }
  check('抽了號碼牌大約 20 秒叫到阿嬤', called && t > 15 && t < 25, `${t.toFixed(1)} 秒`)
  resetCh(reviewMonth(base), null)
  useCh.setState({ ticket: MY_TICKET })
  check('對話中（暫停）不跳號', stepCh(30, true).length === 0)
}

console.log('互動點')
{
  const label = (id: string) => CHENGHUANG_HOTSPOTS.find((h) => h.id === id)!.label({} as never)
  resetCh(reviewMonth(base), null)
  check('月底報到：抽號碼牌、判官（先抽）、沒有「回家」', label('ch_ticket') === '抽號碼牌' && label('ch_desk') === '判官（先抽號碼牌）' && label('ch_door') === null && label('ch_night_baye') === null)
  useCh.setState({ ticket: MY_TICKET, called: true })
  check('叫到號：到判官桌前報到', label('ch_desk') === '到判官桌前報到')
  useCh.setState({ stamped: true })
  check('蓋完章：走出廟門', label('ch_door') === '走出廟門（回家）')
  resetCh()
  check('半夜散步：只有值夜班的八爺，可以走回夜市', label('ch_ticket') === null && label('ch_desk') === null && label('ch_night_baye') !== null && CHENGHUANG_SCENE.exits[0].when!({ phase: 'night', time: 25 }))
  resetCh(reviewMonth(base), null)
  check('月底報到時門口不能直接走回夜市', !CHENGHUANG_SCENE.exits[0].when!({ phase: 'dawn', time: 28.6 }))
  const b = CHENGHUANG_SCENE.colliders.bounds
  check('出生點在廟裡', CHENGHUANG_SCENE.spawns.report[0] > b.x0 && CHENGHUANG_SCENE.spawns.report[0] < b.x1 && CHENGHUANG_SCENE.spawns.report[1] > b.z0 && CHENGHUANG_SCENE.spawns.report[1] < b.z1)
  check('門口在南邊', CH.door.z > CH.benches[1].z)
}

console.log(fail ? `\n✗ ${fail} 項沒過` : '\n✓ 全部通過')
process.exit(fail ? 1 : 0)
